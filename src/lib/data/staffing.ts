import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { StaffingSnapshotRow } from "@/lib/supabase/database.types";
import type {
  LiveAbsentToday,
  LiveLeaveImpact,
  LiveStaffingSnapshot,
} from "@/lib/types";

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

interface AbsentTodayRow {
  employee_id: string;
  employee_name: string;
  shift_name: string | null;
  reason: string;
}

/** Wer an einem Tag fehlt – mit Namen und Grund. Nur Führung/Admin. */
export async function fetchWhoIsAbsent(dateISO: string): Promise<LiveAbsentToday[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("who_is_absent", { p_date: dateISO });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as AbsentTodayRow[]).map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    shiftName: row.shift_name,
    reason: row.reason,
  }));
}

/** Ein Tag aus der Besetzungsprüfung, mit Schichtname und Qualifikationslücken. */
export interface LiveStaffingDetailDay {
  date: string;
  shiftName: string | null;
  present: number;
  target: number;
  minimum: number;
  status: "ok" | "warn" | "critical";
  /** Was an diesem Tag fehlt – kommt aus `shift_qualification_needs`. */
  gaps: { label: string; fehlt: number }[];
}

interface StaffingDetailRow {
  tag: string;
  shift_name: string | null;
  present: number;
  target: number;
  minimum: number;
  status: "ok" | "warn" | "critical";
  luecken: { label: string; fehlt: number }[] | null;
}

/**
 * Warum wird die Besetzung knapp? Tag für Tag, mit den konkreten
 * Qualifikationen, die reissen.
 *
 * Dieselbe Rechnung wie `fetchLeaveImpact` – nur ausführlicher. Die
 * Anforderungen kommen aus der Konfiguration in `shift_qualification_needs`,
 * nichts davon steht im Frontend.
 */
export async function fetchLeaveStaffingDetail(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<LiveStaffingDetailDay[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("leave_staffing_detail", {
    p_employee_id: employeeId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as StaffingDetailRow[]).map((row) => ({
    date: row.tag,
    shiftName: row.shift_name,
    present: Number(row.present),
    target: Number(row.target),
    minimum: Number(row.minimum),
    status: row.status,
    gaps: (row.luecken ?? []).filter((g) => g.fehlt > 0),
  }));
}

/** Zugeordnet, Soll und Mindest je Schicht – Zugeordnet aus dem echten Plan. */
export interface LiveShiftStaffing {
  shiftId: string;
  shiftName: string;
  shortName: string | null;
  target: number;
  minimum: number;
  assigned: number;
  runsToday: boolean;
}

export async function fetchShiftStaffingOverview(
  dateISO?: string,
): Promise<LiveShiftStaffing[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shift_staffing_overview", {
    p_date: dateISO ?? null,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (
    (data ?? []) as {
      shift_id: string;
      shift_name: string;
      short_name: string | null;
      target: number;
      minimum: number;
      zugeordnet: number;
      laeuft_heute: boolean;
    }[]
  ).map((row) => ({
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    shortName: row.short_name,
    target: Number(row.target),
    minimum: Number(row.minimum),
    assigned: Number(row.zugeordnet),
    runsToday: row.laeuft_heute,
  }));
}
