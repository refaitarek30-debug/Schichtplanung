import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { AbsenceWithEmployee } from "@/lib/supabase/database.types";
import type { LiveAbsence } from "@/lib/types";

export class DataError extends Error {}

function mapAbsence(row: AbsenceWithEmployee): LiveAbsence {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees
      ? `${row.employees.first_name} ${row.employees.last_name}`
      : undefined,
    date: row.date,
    type: row.type,
    note: row.note,
  };
}

/**
 * Abwesenheiten (Krankheit, Schulung, Sonstiges) in einem Zeitraum.
 * RLS liefert Mitarbeitenden nur die eigenen Einträge, Führung das ganze
 * Unternehmen – der Grund einer Abwesenheit bleibt so privat, wo es zählt.
 */
export async function fetchAbsences(
  fromDate: string,
  toDate: string,
): Promise<LiveAbsence[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("absences")
    .select("id, company_id, employee_id, date, type, note, created_at, employees ( first_name, last_name )")
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true })
    .returns<AbsenceWithEmployee[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map(mapAbsence);
}
