import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Ist eine noch nicht allgemein freigegebene Funktion für die angemeldete
 * Person frei? (funktionen / funktionen_zugang, Migration 0143.) Im Zweifel
 * – Fehler, keine Sitzung, Demo – nein: dann bleibt alles wie bisher.
 */
export async function hatFunktionServer(name: "kalender_neu"): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  // Außerhalb von try: Next.js signalisiert über cookies() dynamisches
  // Rendern – das darf nicht abgefangen werden.
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("hat_funktion", { p_name: name });
    return !error && data === true;
  } catch {
    return false;
  }
}
