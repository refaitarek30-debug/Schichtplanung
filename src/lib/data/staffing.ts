import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type {
  StaffingMonthRow,
  StaffingSnapshotRow,
} from "@/lib/supabase/database.types";
import type { LiveLeaveImpact, LiveStaffingSnapshot, StaffingStatus } from "@/lib/types";

export class DataError extends Error {}

function mapSnapshot(row: StaffingSnapshotRow): LiveStaffingSnapshot {
  return {
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    date: row.date,
    target: row.target,
    minimum: row.minimum,
    planned: row.planned,
    absent: row.absent,
    present: row.present,
    status: row.status,
  };
}

/** Besetzung einer einzelnen Schicht an einem Tag – für alle Mitglieder des Unternehmens lesbar. */
export async function fetchShiftStaffing(
  shiftId: string,
  dateISO: string,
): Promise<LiveStaffingSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("staffing_snapshot", {
    p_shift_id: shiftId,
    p_date: dateISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = (data ?? [])[0];
  return row ? mapSnapshot(row) : null;
}

/** Besetzung aller laufenden Schichten eines Tages. Nur Führung/Admin (RPC prüft es selbst). */
export async function fetchStaffingForDay(
  companyId: string,
  dateISO: string,
): Promise<LiveStaffingSnapshot[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("staffing_for_day", {
    p_company_id: companyId,
    p_date: dateISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map(mapSnapshot);
}

/** Wie `fetchStaffingForDay`, aber für mehrere Tage in einem Aufruf. */
export async function fetchStaffingRange(
  companyId: string,
  fromISO: string,
  days: number,
): Promise<LiveStaffingSnapshot[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("staffing_range", {
    p_company_id: companyId,
    p_from: fromISO,
    p_days: days,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map(mapSnapshot);
}

/** Schlechtester Status je Tag eines Monats – für die Kalender-Heatmap. */
export async function fetchStaffingMonthOverview(
  companyId: string,
  year: number,
  month: number,
): Promise<Record<string, StaffingStatus>> {
  if (!isSupabaseConfigured) return {};
  const supabase = createClient();
  const { data, error } = await supabase.rpc("staffing_month_overview", {
    p_company_id: companyId,
    p_year: year,
    p_month: month,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const result: Record<string, StaffingStatus> = {};
  for (const row of (data ?? []) as StaffingMonthRow[]) {
    result[row.day] = row.status;
  }
  return result;
}

/**
 * Auswirkung eines Urlaubszeitraums auf die Besetzung der eigenen Schicht.
 * Für die eigene employeeId (Live-Prüfung im Antragsformular) oder – als
 * Führungskraft – für die Person, deren Antrag gerade entschieden wird.
 */
export async function fetchLeaveImpact(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<LiveLeaveImpact> {
  if (!isSupabaseConfigured) {
    return { overlappingEmployees: 0, criticalDays: 0, worstStatus: "ok" };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shift_leave_overlap", {
    p_employee_id: employeeId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = (data ?? [])[0];
  return {
    overlappingEmployees: row?.overlapping_employees ?? 0,
    criticalDays: row?.critical_days ?? 0,
    worstStatus: row?.worst_status ?? "ok",
  };
}
