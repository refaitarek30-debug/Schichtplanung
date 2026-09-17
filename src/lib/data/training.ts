import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

export type TrainingStatus = "geplant" | "laeuft" | "abgeschlossen" | "abgebrochen";

export const STATUS_TEXT: Record<TrainingStatus, string> = {
  geplant: "geplant",
  laeuft: "läuft",
  abgeschlossen: "abgeschlossen",
  abgebrochen: "abgebrochen",
};

/** Ein Ausbildungsabschnitt im gewählten Zeitraum. */
export interface TrainingAssignment {
  id: string;
  employeeId: string;
  name: string;
  startDate: string;
  endDate: string;
  area: string;
  shiftId: string | null;
  shiftName: string | null;
  note: string | null;
  status: TrainingStatus;
  /** Tage des Abschnitts, an denen die Person ausfällt. */
  abwesendTage: number;
}

/**
 * Ausbildungsabschnitte, die einen Zeitraum berühren.
 *
 * Die Abwesenheitstage kommen aus `employees_absent_on()` – derselben
 * Quelle wie im Schichtplan und in der Auswertung. Sonst stünde ein
 * Abschnitt als bespielt da, während die Person im Urlaub ist.
 */
export async function fetchTrainingPlan(
  from: string,
  to: string,
): Promise<TrainingAssignment[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("training_plan", { p_from: from, p_to: to });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    employeeId: String(row.employee_id),
    name: String(row.name),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    area: String(row.area),
    shiftId: (row.shift_id as string) ?? null,
    shiftName: (row.shift_name as string) ?? null,
    note: (row.note as string) ?? null,
    status: row.status as TrainingStatus,
    abwesendTage: Number(row.abwesend_tage ?? 0),
  }));
}

export async function saveTrainingAssignment(eingabe: {
  id: string | null;
  employeeId: string;
  start: string;
  end: string;
  area: string;
  shiftId: string | null;
  note: string;
  status: TrainingStatus;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new DataError("Im Demo-Modus lassen sich keine Daten ändern.");
  }
  const supabase = createClient();
  const { error } = await supabase.rpc("save_training_assignment", {
    p_id: eingabe.id,
    p_employee_id: eingabe.employeeId,
    p_start: eingabe.start,
    p_end: eingabe.end,
    p_area: eingabe.area,
    p_shift_id: eingabe.shiftId,
    p_note: eingabe.note,
    p_status: eingabe.status,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Speichern fehlgeschlagen.");
}

export async function deleteTrainingAssignment(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new DataError("Im Demo-Modus lassen sich keine Daten ändern.");
  }
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_training_assignment", { p_id: id });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Löschen fehlgeschlagen.");
}
