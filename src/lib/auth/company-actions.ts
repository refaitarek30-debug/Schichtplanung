"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";
import type { ProfileRow } from "@/lib/supabase/database.types";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Ändert den Firmennamen. Die Policy "Unternehmen aendert Admin" erlaubt das
 * ohnehin nur Administratoren des eigenen Unternehmens – die Prüfung hier
 * sorgt nur für eine verständliche Fehlermeldung statt eines rohen RLS-Fehlers.
 */
export async function updateCompanyName(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Der Firmenname darf nicht leer sein." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<Pick<ProfileRow, "role" | "company_id">[]>()
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const { error } = await supabase
    .from("companies")
    .update({ name })
    .eq("id", profile.company_id);

  if (error) return { error: dataErrorMessage(error) ?? "Speichern fehlgeschlagen." };

  revalidatePath("/einstellungen");
  revalidatePath("/", "layout");
  return { success: "Firmenname gespeichert." };
}
