"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Teilt einen Mitarbeiter für einen einzelnen Tag einer Schicht zu – als
 * Ausnahme von der festen Zuordnung (`employees.shift_id`). Ruft die
 * Postgres-Funktion `assign_shift()` auf, die selbst noch einmal prüft,
 * dass Mitarbeiter und Schicht zum selben Unternehmen gehören; die
 * eigentliche Berechtigung (nur Führung) erzwingt die RLS-Policy auf
 * `shift_assignments`.
 */
export async function assignShift(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const shiftId = String(formData.get("shift_id") ?? "");
  const date = String(formData.get("date") ?? "");

  if (!employeeId || !shiftId || !date) {
    return { error: "Bitte Mitarbeiter, Schicht und Datum auswählen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_shift", {
    p_employee_id: employeeId,
    p_shift_id: shiftId,
    p_date: date,
  });

  if (error) {
    if (error.message?.includes("row-level security")) {
      return { error: "Du hast keine Berechtigung für diesen Bereich." };
    }
    if (error.message?.includes("nicht gefunden") || error.message?.includes("unterschiedlichen")) {
      return { error: error.message };
    }
    return { error: dataErrorMessage(error) ?? "Die Zuordnung konnte nicht gespeichert werden." };
  }

  revalidatePath("/schichten");
  revalidatePath("/besetzung");
  revalidatePath("/kalender");
  revalidatePath("/meine-schichten");
  return { success: "Zuordnung gespeichert." };
}

export async function removeShiftAssignment(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Zuordnung konnte nicht entfernt werden." };
  }
  revalidatePath("/schichten");
  revalidatePath("/besetzung");
  revalidatePath("/kalender");
  revalidatePath("/meine-schichten");
  return { success: "Zuordnung entfernt." };
}
