"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authErrorMessage, dataErrorMessage } from "@/lib/errors";
import type { EmployeeRow, ProfileRow } from "@/lib/supabase/database.types";

export interface FormState {
  error?: string;
  success?: string;
}

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

function isSafePath(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("weiter") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) ?? "Anmeldung fehlgeschlagen." };

  revalidatePath("/", "layout");
  redirect(isSafePath(next) ? next : "/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Bitte eine E-Mail-Adresse eingeben." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?weiter=/passwort-neu`,
  });
  if (error) return { error: authErrorMessage(error) ?? "Versand fehlgeschlagen." };

  // Bewusst dieselbe Antwort, egal ob die Adresse existiert:
  // sonst ließe sich abfragen, wer ein Konto hat.
  return {
    success:
      "Wenn es zu dieser Adresse ein Konto gibt, ist der Link zum Zurücksetzen unterwegs.",
  };
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("password_repeat") ?? "");

  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  if (password !== repeat) return { error: "Die beiden Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) ?? "Änderung fehlgeschlagen." };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateOwnProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();

  if (!firstName || !lastName) return { error: "Vor- und Nachname dürfen nicht leer sein." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  // E-Mail und Rolle stehen bewusst nicht in diesem Update – dafür ist
  // die Administration zuständig, und die Policy verbietet es ohnehin.
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl || null,
    })
    .eq("id", user.id);

  if (error) return { error: dataErrorMessage(error) ?? "Speichern fehlgeschlagen." };

  revalidatePath("/profil");
  revalidatePath("/", "layout");
  return { success: "Profil gespeichert." };
}

/**
 * Lädt einen Mitarbeiter per E-Mail ein. Braucht den Service-Role-Key und
 * läuft ausschließlich auf dem Server. Die Rolle und die Zuordnung landen in
 * den User-Metadaten; der Trigger `handle_new_user` legt daraus das Profil an.
 */
export async function inviteEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .returns<Pick<ProfileRow, "role" | "company_id">[]>()
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, email, first_name, last_name, role, company_id")
    .eq("id", employeeId)
    .returns<
      Pick<EmployeeRow, "id" | "email" | "first_name" | "last_name" | "role" | "company_id">[]
    >()
    .maybeSingle();

  if (employeeError || !employee) {
    return { error: "Der Mitarbeiter wurde nicht gefunden." };
  }
  if (!employee.email) {
    return { error: "Für diesen Mitarbeiter ist keine E-Mail-Adresse hinterlegt." };
  }
  if (employee.company_id !== profile.company_id) {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  try {
    const admin = createAdminClient();
    const origin = await siteOrigin();
    const { error } = await admin.auth.admin.inviteUserByEmail(employee.email, {
      redirectTo: `${origin}/auth/callback?weiter=/passwort-neu`,
      data: {
        company_id: employee.company_id,
        employee_id: employee.id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        role: employee.role,
      },
    });
    if (error) return { error: authErrorMessage(error) ?? "Einladung fehlgeschlagen." };
  } catch {
    return {
      error:
        "Für Einladungen fehlt der Service-Role-Key (SUPABASE_SERVICE_ROLE_KEY) auf dem Server.",
    };
  }

  revalidatePath("/mitarbeiter");
  return { success: `Einladung an ${employee.email} verschickt.` };
}
