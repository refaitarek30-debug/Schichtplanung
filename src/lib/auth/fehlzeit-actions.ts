"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fehlzeit eintragen: früher gegangen oder später gekommen. Wer das darf
 * (Schichtleitung für die eigene Schicht, Administration für alle) und ob
 * an dem Tag überhaupt eine Schicht war, prüft die Datenbank
 * (`fehlzeit_speichern`). Dieselbe Person, derselbe Tag, dieselbe Art
 * überschreibt den alten Wert.
 */
export async function saveFehlzeit(
  employeeId: string,
  tag: string,
  art: string,
  stunden: number,
  notiz: string,
  abzug: string = "v",
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (!employeeId) return { error: "Bitte eine Person auswählen." };
  if (!DATUM.test(tag)) return { error: "Bitte einen Tag angeben." };
  if (art !== "frueher_gegangen" && art !== "spaeter_gekommen") return { error: "Ungültige Art." };
  if (!Number.isFinite(stunden) || stunden <= 0 || stunden >= 8 || Math.round(stunden * 4) !== stunden * 4) {
    return { error: "Bitte Stunden in Viertelstunden zwischen 0,25 und 7,75 angeben." };
  }
  if (abzug !== "v" && abzug !== "af") return { error: "Ungültiger Abzug." };
  if (notiz.length > 200) return { error: "Die Notiz ist zu lang (höchstens 200 Zeichen)." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fehlzeit_speichern", {
    p_employee_id: employeeId,
    p_tag: tag,
    p_art: art,
    p_stunden: stunden,
    p_notiz: notiz.trim() || null,
    p_abzug: abzug,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Fehlzeit konnte nicht gespeichert werden." };
  }
  revalidatePath("/dashboard");
  return { success: "Fehlzeit gespeichert." };
}

/** Fehlzeit löschen – Konten rechnen danach wieder ohne sie. */
export async function deleteFehlzeit(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("fehlzeit_loeschen", { p_id: id });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Fehlzeit konnte nicht gelöscht werden." };
  }
  revalidatePath("/dashboard");
  return { success: "Fehlzeit gelöscht." };
}
