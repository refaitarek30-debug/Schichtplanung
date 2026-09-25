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

/**
 * Freiwillig hinterlegte Geburtsdaten für die Teamübersicht.
 *
 * Wer nichts eingetragen hat, kommt in der Antwort gar nicht vor – die
 * Karte zeigt dann schlicht kein Datum. Die Rollenprüfung steckt in
 * `team_birth_dates()`; scheitert der Aufruf, bleibt die Übersicht ohne
 * Geburtsdaten, statt die ganze Seite mit einem Fehler zu blockieren.
 */
export async function fetchTeamBirthDates(): Promise<Map<string, string>> {
  if (!isSupabaseConfigured) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_birth_dates");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const ergebnis = new Map<string, string>();
  for (const row of (data ?? []) as { employee_id: string; birth_date: string | null }[]) {
    if (row.birth_date) ergebnis.set(row.employee_id, row.birth_date);
  }
  return ergebnis;
}

export interface LiveStundenkontoKurz {
  /** Stichtag des eingetragenen Stands; null = kein Konto. */
  ab: string | null;
  start: number;
  arbeitstage: number;
  angespart: number;
  genommen: number;
  verplant: number;
  stand: number;
  moeglich: number;
}

export interface LiveAfUebersichtZeile {
  employeeId: string;
  employeeName: string;
  rotationTeam: string | null;
  birthDate: string | null;
  alterHeute: number | null;
  hatProfil: boolean;
  af: LiveStundenkontoKurz;
  v: LiveStundenkontoKurz;
}

/** AF- und V-Stundenkonten aller aktiven Mitarbeiter (Führung). */
export async function fetchAfUebersicht(): Promise<LiveAfUebersichtZeile[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("af_uebersicht");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const z = (v: unknown) => Number(v ?? 0);
  const konto = (r: Record<string, unknown>, p: "af" | "v"): LiveStundenkontoKurz => ({
    ab: (r[`${p}_ab`] as string | null) ?? null,
    start: z(r[`${p}_start`]),
    arbeitstage: z(r[`${p}_arbeitstage`]),
    angespart: z(r[`${p}_angespart`]),
    genommen: z(r[`${p}_genommen`]),
    verplant: z(r[`${p}_verplant`]),
    stand: z(r[`${p}_stand`]),
    moeglich: z(r[`${p}_moeglich`]),
  });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    employeeId: String(r.employee_id),
    employeeName: String(r.employee_name ?? ""),
    rotationTeam: (r.rotation_team as string | null) ?? null,
    birthDate: (r.birth_date as string | null) ?? null,
    alterHeute: r.alter_heute === null || r.alter_heute === undefined ? null : Number(r.alter_heute),
    hatProfil: r.hat_profil === true,
    af: konto(r, "af"),
    v: konto(r, "v"),
  }));
}
