"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

export type { FormState };

/**
 * Altersfreizeit verbindlich festlegen.
 *
 * Die Prüfung der Rolle, des Mandanten und der Wertebereiche steckt in
 * `confirm_age_leave()` in der Datenbank – dort, wo sie sich nicht umgehen
 * lässt. Hier wird nur das Formular in Zahlen übersetzt; was hier steht,
 * ist Bequemlichkeit, keine Absicherung.
 */
export async function confirmAgeLeave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }

  const employeeId = String(formData.get("employee_id") ?? "");
  const jahr = Number(formData.get("year"));
  const tageRoh = String(formData.get("days") ?? "").replace(",", ".");
  const tage = Number(tageRoh);
  const notiz = String(formData.get("note") ?? "");

  if (!employeeId) return { error: "Kein Mitarbeiter ausgewählt." };
  if (!Number.isInteger(jahr)) return { error: "Ungültiges Jahr." };
  if (!Number.isFinite(tage) || tage < 0 || tage > 60) {
    return { error: "Bitte eine Tageszahl zwischen 0 und 60 angeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_age_leave", {
    p_employee_id: employeeId,
    p_year: jahr,
    p_days: tage,
    p_note: notiz.trim() || null,
  });

  if (error) {
    return {
      error: dataErrorMessage(error) ?? "Die Altersfreizeit konnte nicht gespeichert werden.",
    };
  }

  revalidatePath("/altersfreizeit");
  revalidatePath("/profil");
  return { success: "Altersfreizeit verbindlich festgelegt." };
}
