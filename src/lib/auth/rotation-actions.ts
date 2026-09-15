"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Teilt einen Mitarbeiter für einen einzelnen Tag einer Schicht zu – als
 * Ausnahme von der festen Zuordnung (`employees.shift_id`). Leeres
 * `shift_id` heißt: der Tag ist ausdrücklich frei.
 *
 * `plan_set_shift()` räumt dabei den Tag frei: ein Urlaubstag, V-Tag oder
 * eine Abwesenheit an genau diesem Tag fällt weg, denn wer eingeteilt ist,
 * arbeitet. Ohne das blieb die Abwesenheit stehen und überdeckte die neue
 * Schicht in der Matrix – die Zuordnung wurde gespeichert, sah aber aus,
 * als wäre nichts passiert.
 */
export async function assignShift(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const shiftId = String(formData.get("shift_id") ?? "");
  const date = String(formData.get("date") ?? "");

  if (!employeeId || !date) {
    return { error: "Bitte Mitarbeiter und Datum auswählen." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("plan_set_shift", {
    p_employee_id: employeeId,
    p_shift_id: shiftId || null,
    p_date: date,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Zuordnung konnte nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
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
  revalidatePath("/verwaltung");
  revalidatePath("/besetzung");
  revalidatePath("/schichtplan");
  revalidatePath("/meine-schichten");
  return { success: "Zuordnung entfernt." };
}

/**
 * Urlaub direkt aus dem Schichtplan setzen oder entfernen (Führung/Admin).
 * "urlaub" legt einen sofort genehmigten Urlaubstag an, der automatisch
 * vom Konto abgezogen wird; "clear" nimmt ihn zurück.
 */
export async function setLeaveForDay(
  employeeId: string,
  date: string,
  mode: "urlaub" | "v_tag" | "clear",
): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Supabase ist nicht konfiguriert." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_leave_for_day", {
    p_employee_id: employeeId,
    p_date: date,
    p_mode: mode,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Urlaub konnte nicht gesetzt werden." };
  }
  return {
    success:
      mode === "clear"
        ? "Eintrag entfernt."
        : mode === "v_tag"
          ? "V-Tag eingetragen."
          : "Urlaub eingetragen.",
  };
}

/**
 * Reihenfolge der Mitarbeiter im Schichtplan festschreiben.
 *
 * Übergeben wird eine ganze Gruppe in der gewünschten Reihenfolge; die
 * Datenbank macht daraus die Plätze 1..n und prüft dabei selbst, ob die
 * aufrufende Person Schichtleitung oder Administration ist.
 */
export async function setEmployeeOrder(employeeIds: string[]): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }
  if (employeeIds.length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employee_order", {
    p_employee_ids: employeeIds,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Reihenfolge konnte nicht gespeichert werden." };
  }

  revalidatePath("/schichtplan");
  return { success: "Reihenfolge gespeichert." };
}
