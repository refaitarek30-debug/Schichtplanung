"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kommentar zu einem Tag einer Person schreiben. Jeder im Unternehmen darf
 * das. Unternehmen, Autor und Autorname setzt die Datenbank selbst
 * (Trigger `plan_kommentar_vorbereiten`) – hier kommt nur an, zu wem, an
 * welchem Tag und was.
 */
export async function addPlanKommentar(
  employeeId: string,
  tag: string,
  text: string,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const inhalt = text.trim();
  if (!inhalt) return { error: "Bitte einen Text eingeben." };
  if (inhalt.length > 500) return { error: "Der Kommentar ist zu lang (höchstens 500 Zeichen)." };
  if (!employeeId || !DATUM.test(tag)) return { error: "Ungültiger Tag." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_kommentare")
    .insert({ employee_id: employeeId, tag, text: inhalt });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Kommentar konnte nicht gespeichert werden." };
  }
  return { success: "Kommentar gespeichert." };
}

/**
 * Kommentar löschen. Ob das erlaubt ist (eigener Kommentar oder Führung),
 * entscheidet die Policy – nicht der ausgeblendete Knopf.
 */
export async function deletePlanKommentar(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_kommentare")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Kommentar konnte nicht gelöscht werden." };
  }
  if (!data || data.length === 0) {
    return { error: "Diesen Kommentar kannst du nicht löschen." };
  }
  return { success: "Kommentar gelöscht." };
}
