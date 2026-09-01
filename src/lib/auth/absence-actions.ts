"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

const TYPE_LABELS: Record<string, string> = {
  krank: "Krankheit",
  schulung: "Schulung",
  sonstiges: "Sonstiges",
};

/**
 * Erfasst eine Abwesenheit (Krankheit, Schulung, Sonstiges) für einen
 * Mitarbeiter. Nur Führung/Admin – RLS auf `absences` ("Abwesenheiten
 * pflegt Führung") erzwingt das serverseitig ohnehin, hier kommt nur die
 * verständliche Fehlermeldung dazu, falls es doch jemand versucht.
 */
export async function createAbsence(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "krank");
  const note = String(formData.get("note") ?? "").trim();

  if (!employeeId || !date) {
    return { error: "Bitte Mitarbeiter und Datum auswählen." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .returns<{ company_id: string }[]>()
    .maybeSingle();

  if (!profile) return { error: "Dein Profil konnte nicht geladen werden." };

  const { error } = await supabase.from("absences").insert({
    company_id: profile.company_id,
    employee_id: employeeId,
    date,
    type,
    note: note || null,
  });

  if (error) {
    if (error.code === "42501" || error.message?.includes("row-level security")) {
      return { error: "Du hast keine Berechtigung für diesen Bereich." };
    }
    if (error.code === "23505") {
      return { error: "Für diesen Tag ist bereits ein Eintrag dieser Art erfasst." };
    }
    return { error: dataErrorMessage(error) ?? "Die Abwesenheit konnte nicht gespeichert werden." };
  }

  revalidatePath("/besetzung");
  revalidatePath("/kalender");
  revalidatePath("/dashboard");
  return { success: `${TYPE_LABELS[type] ?? "Abwesenheit"} erfasst.` };
}

export async function deleteAbsence(absenceId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.from("absences").delete().eq("id", absenceId);
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Eintrag konnte nicht entfernt werden." };
  }

  revalidatePath("/besetzung");
  revalidatePath("/kalender");
  revalidatePath("/dashboard");
  return { success: "Eintrag entfernt." };
}
