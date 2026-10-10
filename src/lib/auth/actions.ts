"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE } from "./idle";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authErrorMessage, dataErrorMessage } from "@/lib/errors";
import type { EmployeeRow, ProfileRow } from "@/lib/supabase/database.types";
import type { FormState } from "./form-state";
import { grantAccess, siteOrigin } from "./invite";
import { safeInternalPath } from "@/lib/security/safe-path";
import { allow, clientKey, emailKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { PASSWORT_MAX, PASSWORT_MIN } from "./password-policy";
import { geraet, mitFrist, protokolliere } from "./protokoll-server";

export type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

/** Startpunkt für die automatische Abmeldung nach Inaktivität. */
async function merkeAnmeldung() {
  (await cookies()).set(ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVITY_COOKIE_MAX_AGE,
  });
}

/**
 * Fehlgeschlagene Anmeldung festhalten. Ohne Anmeldung gibt es keine
 * Sitzung – deshalb über den Service-Schlüssel, nur auf dem Server. Fehlt
 * der Schlüssel (Vorschau, lokal), entfällt der Eintrag.
 */
async function protokolliereFehlanmeldung(email: string) {
  try {
    await mitFrist(Promise.resolve(createAdminClient().rpc("protokoll_fehlanmeldung", { p_email: email })));
  } catch {
    // Protokoll ist Beiwerk.
  }
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("weiter") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  if (password.length > PASSWORT_MAX) return { error: "E-Mail oder Passwort ist falsch." };

  // Bremse gegen automatisiertes Durchprobieren: je Adresse des Aufrufers
  // und je Konto. Die Zähler laufen in der Datenbank, nicht im Speicher.
  const erlaubt =
    (await allow("login-ip", await clientKey(), 40, 600)) &&
    (await allow("login-mail", emailKey(email), 10, 600));
  if (!erlaubt) return { error: ZU_VIELE_VERSUCHE };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if ((error.message ?? "").toLowerCase().includes("invalid login credentials")) {
      await protokolliereFehlanmeldung(email);
    }
    return { error: authErrorMessage(error) ?? "Anmeldung fehlgeschlagen." };
  }

  await protokolliere(supabase, "anmeldung", await geraet());

  // Die Frist für die automatische Abmeldung beginnt jetzt. Ohne das würde
  // ein Zeitstempel aus einer früheren Sitzung sofort wieder greifen.
  await merkeAnmeldung();

  revalidatePath("/", "layout");
  redirect(safeInternalPath(next, "/dashboard"));
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await protokolliere(supabase, "abmeldung", null);
    await supabase.auth.signOut();
  }
  (await cookies()).delete(ACTIVITY_COOKIE);
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

  // Gleiche Antwort in jedem Fall – auch wenn die Grenze erreicht ist. So
  // verrät weder die Meldung noch das Ausbleiben einer Mail etwas über das
  // Konto, und niemand kann ein fremdes Postfach mit Reset-Mails fluten.
  const neutral: FormState = {
    success: "Wenn es zu dieser Adresse ein Konto gibt, ist der Link zum Zurücksetzen unterwegs.",
  };
  const erlaubt =
    (await allow("reset-ip", await clientKey(), 10, 3600)) &&
    (await allow("reset-mail", emailKey(email), 3, 3600));
  if (!erlaubt) return neutral;

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?weiter=/passwort-neu`,
  });
  // Nur echte Störungen des Dienstes werden gemeldet; ob die Adresse ein
  // Konto hat, bleibt unsichtbar.
  if (error && (error.status === undefined || error.status >= 500)) {
    return { error: authErrorMessage(error) ?? "Versand fehlgeschlagen." };
  }
  return neutral;
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const password = String(formData.get("password") ?? "");
  const repeat = String(formData.get("password_repeat") ?? "");

  if (password.length < PASSWORT_MIN) {
    return { error: `Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen lang sein.` };
  }
  if (password.length > PASSWORT_MAX) {
    return { error: `Das Passwort darf höchstens ${PASSWORT_MAX} Zeichen lang sein.` };
  }
  if (password !== repeat) return { error: "Die beiden Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error) ?? "Änderung fehlgeschlagen." };

  await protokolliere(supabase, "anmeldung.passwort", "Neues Passwort gesetzt");

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

  if (!firstName || !lastName) return { error: "Vor- und Nachname dürfen nicht leer sein." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  // E-Mail und Rolle stehen bewusst nicht in diesem Update – dafür ist
  // die Administration zuständig, und die Policy verbietet es ohnehin.
  // Ein Profilbild gibt es nicht mehr: angezeigt werden die Initialen.
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<Pick<ProfileRow, "role" | "company_id">[]>()
    .maybeSingle();

  // Einladen darf die Administration und die Schichtleitung. Die
  // Schichtleitung aber nur für normale Mitarbeiter: ein Zugangslink für ein
  // Admin- oder Schichtleitungskonto wäre ein Weg zu Rechten, die sie selbst
  // nicht hat.
  if (!profile || (profile.role !== "admin" && profile.role !== "shift_leader")) {
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
  if (employee.company_id !== profile.company_id) {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }
  if (profile.role === "shift_leader" && employee.role !== "employee") {
    return {
      error: "Zugänge für Schichtleitung und Administration richtet nur die Administration ein.",
    };
  }

  return grantAccess(employee, await siteOrigin());
}
