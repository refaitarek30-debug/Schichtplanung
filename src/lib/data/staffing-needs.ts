import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

/** Eine Zelle der Matrix Schicht × Funktion. */
export interface NeedCell {
  shiftId: string;
  shiftName: string;
  qualificationId: string;
  qualificationLabel: string;
  minimum: number;
}

/**
 * Die vollständige Matrix aus Schichten und Funktionen.
 *
 * Auch Kombinationen ohne Eintrag kommen mit `minimum = 0` zurück – sonst
 * müsste das Formular die Lücken selbst zusammensetzen und dabei raten,
 * welche Schichten und Funktionen es überhaupt gibt.
 */
export async function fetchNeedMatrix(): Promise<NeedCell[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shift_qualification_matrix");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    shiftId: String(row.shift_id),
    shiftName: String(row.shift_name),
    qualificationId: String(row.qualification_id),
    qualificationLabel: String(row.qualification_label),
    minimum: Number(row.minimum),
  }));
}

/** Bedarf setzen. Eine 0 löscht den Eintrag – das erledigt die Datenbank. */
export async function setNeed(
  shiftId: string,
  qualificationId: string,
  minimum: number,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new DataError("Im Demo-Modus lassen sich keine Daten ändern.");
  }
  const supabase = createClient();
  const { error } = await supabase.rpc("set_shift_qualification_need", {
    p_shift_id: shiftId,
    p_qualification_id: qualificationId,
    p_minimum: minimum,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Speichern fehlgeschlagen.");
}
