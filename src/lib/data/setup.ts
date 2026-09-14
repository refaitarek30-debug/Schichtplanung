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
  };
}
