import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

export interface SetupState {
  /** Null = Einrichtung noch offen. */
  abgeschlossenAm: string | null;
  bundesland: string | null;
  feiertage: number;
  musterVorhanden: boolean;
  gruppen: number;
  mitarbeiter: number;
  mitarbeiterMitGruppe: number;
  /**
   * Hat die angemeldete Person ihre eigenen Stammdaten im Assistenten
   * bestätigt? Eigener Vermerk statt Raten anhand der Werte – „0
   * Urlaubstage" ist eine gültige Antwort, keine fehlende.
   */
  eigenesProfilBestaetigt: boolean;
}

/**
 * Was am Unternehmen schon eingerichtet ist. Speist die Fortschritts-
 * anzeige im Assistenten – der soll zeigen, was steht, nicht blind
 * durchfragen. Nur für die Administration.
 */
export async function fetchSetupState(): Promise<SetupState | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("setup_state");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = (data ?? [])[0] as
    | {
        abgeschlossen_at: string | null;
        bundesland: string | null;
        feiertage: number;
        muster_vorhanden: boolean;
        gruppen: number;
        mitarbeiter: number;
        mitarbeiter_mit_gruppe: number;
        eigenes_profil_bestaetigt: boolean;
      }
    | undefined;
  if (!row) return null;
  return {
    abgeschlossenAm: row.abgeschlossen_at,
    bundesland: row.bundesland,
    feiertage: Number(row.feiertage ?? 0),
    musterVorhanden: Boolean(row.muster_vorhanden),
    gruppen: Number(row.gruppen ?? 0),
    mitarbeiter: Number(row.mitarbeiter ?? 0),
    mitarbeiterMitGruppe: Number(row.mitarbeiter_mit_gruppe ?? 0),
    eigenesProfilBestaetigt: Boolean(row.eigenes_profil_bestaetigt),
  };
}

/** Die eigenen Stammdaten, wie sie der erste Einrichtungsschritt vorbelegt. */
export interface OwnProfile {
  department: string | null;
  vacationDays: number;
  vDays: number;
  shiftWorker: boolean;
  rotationTeam: string | null;
  qualifications: string[];
  bestaetigtAm: string | null;
}

/**
 * Der Personalstammsatz der angemeldeten Person. Der Assistent braucht ihn,
 * um sein Formular vorzubelegen – sonst überschriebe ein zweiter Durchlauf
 * die eigenen Angaben mit leeren Feldern.
 */
export async function fetchOwnProfile(employeeId: string): Promise<OwnProfile | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  // Qualifikationen stehen seit Migration 0050 in eigenen Tabellen. Würde
  // hier weiter die alte Spalte gelesen, verlöre ein zweiter Durchlauf des
  // Assistenten die Haken.
  const [stammResult, qualsResult] = await Promise.all([
    supabase
      .from("employees")
      .select("department, vacation_days, v_days, shift_worker, rotation_team, profile_confirmed_at")
      .eq("id", employeeId)
      .maybeSingle(),
    supabase
      .from("employee_qualifications")
      .select("qualifications ( key )")
      .eq("employee_id", employeeId)
      .returns<{ qualifications: { key: string } | { key: string }[] | null }[]>(),
  ]);

  const { data, error } = stammResult;
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  if (!data) return null;

  const quals = (qualsResult.data ?? [])
    .map((row) => (Array.isArray(row.qualifications) ? row.qualifications[0] : row.qualifications))
    .map((bezug) => bezug?.key)
    .filter((key): key is string => Boolean(key));

  const row = data as {
    department: string | null;
    vacation_days: number | string | null;
    v_days: number | string | null;
    shift_worker: boolean | null;
    rotation_team: string | null;
    profile_confirmed_at: string | null;
  };

  return {
    department: row.department,
    vacationDays: Number(row.vacation_days ?? 0),
    vDays: Number(row.v_days ?? 0),
    // Vorgabe true wie in der Datenbank: die Anwendung ist für den
    // Schichtbetrieb gebaut, die Tagschicht ist der Sonderfall.
    shiftWorker: row.shift_worker ?? true,
    rotationTeam: row.rotation_team,
    qualifications: quals,
    bestaetigtAm: row.profile_confirmed_at,
  };
}
