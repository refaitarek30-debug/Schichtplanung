import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { DataError } from "./leave";
import type { LiveAgeLeaveRow, LiveMyAgeLeave } from "@/lib/types";

interface UebersichtZeile {
  employee_id: string;
  employee_name: string;
  rotation_team: string | null;
  birth_date: string | null;
  alter_im_jahr: number | null;
  automatisch_moeglich: boolean;
  vorschlag_tage: number;
  bestaetigt: boolean;
  bestaetigte_tage: number;
  bestaetigt_von: string | null;
  bestaetigt_am: string | null;
  notiz: string | null;
}

/**
 * Altersfreizeit aller aktiven Personen für ein Jahr – nur für die Führung.
 *
 * Die Datenbank weist den Aufruf ab, wenn die Rolle nicht passt; hier wird
 * das nicht noch einmal geprüft, damit es nur eine maßgebliche Stelle gibt.
 */
export async function fetchAgeLeaveOverview(jahr: number): Promise<LiveAgeLeaveRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("age_leave_overview", { p_year: jahr });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as UebersichtZeile[]).map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    rotationTeam: row.rotation_team,
    birthDate: row.birth_date,
    ageInYear: row.alter_im_jahr,
    autoPossible: row.automatisch_moeglich,
    suggestedDays: Number(row.vorschlag_tage ?? 0),
    confirmed: row.bestaetigt,
    confirmedDays: Number(row.bestaetigte_tage ?? 0),
    confirmedBy: row.bestaetigt_von,
    confirmedAt: row.bestaetigt_am,
    note: row.notiz,
  }));
}

interface EigeneZeile {
  alter_im_jahr: number | null;
  automatisch_moeglich: boolean;
  vorschlag_tage: number;
  bestaetigt: boolean;
  bestaetigte_tage: number;
  bestaetigt_am: string | null;
}

/** Der eigene Stand. Ohne hinterlegtes Geburtsdatum bleibt alles leer. */
export async function fetchMyAgeLeave(jahr: number): Promise<LiveMyAgeLeave | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_age_leave", { p_year: jahr });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  const zeile = ((data ?? []) as EigeneZeile[])[0];
  if (!zeile) return null;
  return {
    ageInYear: zeile.alter_im_jahr,
    autoPossible: zeile.automatisch_moeglich,
    suggestedDays: Number(zeile.vorschlag_tage ?? 0),
    confirmed: zeile.bestaetigt,
    confirmedDays: Number(zeile.bestaetigte_tage ?? 0),
    confirmedAt: zeile.bestaetigt_am,
  };
}
