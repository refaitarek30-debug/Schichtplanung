import { createClient } from "@/lib/supabase/client";
import { currentIdentity } from "@/lib/supabase/identity";
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

/**
 * Eigene Kranktage im angegebenen Jahr – für die Dashboard-Kachel.
 * Bewusst nur die eigenen: RLS gibt Führungskräften zwar alle Abwesenheiten
 * frei, gezählt wird hier trotzdem ausdrücklich nur der eigene Datensatz.
 */
export async function fetchMySickDays(
  year = new Date().getFullYear(),
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = createClient();
  const ich = await currentIdentity();
  if (!ich?.employeeId) return 0;

  const { count, error } = await supabase
    .from("absences")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", ich.employeeId)
    .eq("type", "krank")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`);

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return count ?? 0;
}
