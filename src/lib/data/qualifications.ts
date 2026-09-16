import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

/** Eine Funktion oder Befähigung, wie sie das Unternehmen führt. */
export interface QualificationRecord {
  id: string;
  key: string;
  label: string;
  active: boolean;
  sortOrder: number | null;
  /** Wie viele aktive Mitarbeiter sie abdecken. */
  anzahl: number;
}

/**
 * Der Qualifikationskatalog des eigenen Unternehmens.
 *
 * Bis Migration 0050 war das ein fester Postgres-Enum mit fünf Werten,
 * gespiegelt in `src/lib/qualifications.ts`. Eine sechste Funktion hätte
 * einen Code-Eingriff gebraucht, und jedes Unternehmen bekam dieselben
 * fünf – ob sie passten oder nicht. Jetzt sind es Daten.
 */
export async function fetchQualifications(): Promise<QualificationRecord[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("company_qualifications");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as {
    id: string;
    key: string;
    label: string;
    active: boolean;
    sort_order: number | null;
    anzahl: number | string | null;
  }[]).map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    active: row.active,
    sortOrder: row.sort_order,
    anzahl: Number(row.anzahl ?? 0),
  }));
}

/**
 * Anlegen oder ändern. Der Schlüssel entsteht in der Datenbank aus der
 * Bezeichnung und bleibt danach fest – an ihm hängen die Zuordnungen,
 * eine spätere Umbenennung ändert nur die Anzeige.
 */
export async function saveQualification(
  id: string | null,
  label: string,
  active = true,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new DataError("Im Demo-Modus lassen sich keine Daten ändern.");
  }
  const supabase = createClient();
  const { error } = await supabase.rpc("save_qualification", {
    p_id: id,
    p_label: label,
    p_active: active,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Speichern fehlgeschlagen.");
}
