"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

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
  const from = String(formData.get("date_from") ?? "");
  // Ohne Ende gilt der eine Tag – so bleibt ein alter Aufruf mit nur
  // einem Datum weiterhin gültig.
  const to = String(formData.get("date_to") ?? "") || from;
  const type = String(formData.get("type") ?? "krank");
  const note = String(formData.get("note") ?? "").trim();

  if (!employeeId || !from) {
    return { error: "Bitte Mitarbeiter und Zeitraum auswählen." };
  }
  if (to < from) {
    return { error: "Das Ende darf nicht vor dem Beginn liegen." };
  }

  const supabase = await createClient();

  // Der ganze Zeitraum entsteht in einem Aufruf und in einer Transaktion.
  // Tage, an denen die Person ohnehin frei hat, überspringt die Datenbank –
  // eine Krankmeldung an einem Freitag aus dem Rotationsmuster ändert
  // nichts und würde die Besetzungsrechnung nur verwirren.
  const { data, error } = await supabase.rpc("create_absence_range", {
    p_employee_id: employeeId,
    p_from: from,
    p_to: to,
    p_type: type,
    p_note: note || null,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Abwesenheit konnte nicht gespeichert werden." };
  }

  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  revalidatePath("/dashboard");

  const tage = Number(data ?? 0);
  const art = TYPE_LABELS[type] ?? "Abwesenheit";
  return {
    success:
      tage === 1
        ? `${art} für einen Tag erfasst.`
        : `${art} für ${tage} Arbeitstage erfasst.`,
  };
}

export async function deleteAbsence(absenceId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.from("absences").delete().eq("id", absenceId);
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Eintrag konnte nicht entfernt werden." };
  }

  revalidatePath("/besetzung");

  revalidatePath("/schichtplan");
  revalidatePath("/dashboard");
  return { success: "Eintrag entfernt." };
}
