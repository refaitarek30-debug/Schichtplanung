import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type {
  LiveRotationPattern,
  LiveShiftAssignment,
  LiveShiftPlanDay,
} from "@/lib/types";

export class DataError extends Error {}

/**
 * Tagesgenaue Ausnahmen von der festen Schichtzuordnung in einem Zeitraum.
 * Nur Führung/Admin (RPC prüft es selbst) – dieselbe Begründung wie bei
 * `fetchStaffingForDay`: wer wo eingeteilt ist, ist kein Datum, das ein
 * einzelner Mitarbeiter über sich selbst hinaus sehen soll.
 */
export async function fetchShiftAssignments(
  companyId: string,
  fromISO: string,
  toISO: string,
): Promise<LiveShiftAssignment[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shift_assignments_for_range", {
    p_company_id: companyId,
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as ShiftAssignmentRangeRow[]).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    defaultShiftId: row.default_shift_id,
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    date: row.date,
  }));
}

interface ShiftAssignmentRangeRow {
  id: string;
  employee_id: string;
  employee_name: string;
  default_shift_id: string | null;
  shift_id: string;
  shift_name: string;
  date: string;
}

interface ShiftPlanRow {
  date: string;
  shift_id: string | null;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  is_free: boolean;
}

/**
 * Eigener Schichtplan Tag für Tag – berücksichtigt Tagesausnahme,
 * Rotationsmuster und feste Zuordnung in genau dieser Rangfolge
 * (`effective_shift_id()` in der Datenbank).
 */
export async function fetchMyShiftPlan(
  fromISO: string,
  days: number,
): Promise<LiveShiftPlanDay[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_shift_plan", {
    p_from: fromISO,
    p_days: days,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as ShiftPlanRow[]).map((row) => ({
    date: row.date,
    shiftId: row.shift_id,
    shiftName: row.shift_name,
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
    isFree: row.is_free,
  }));
}

interface RotationPatternRow {
  id: string;
  name: string;
  anchor_date: string;
  steps: { shift: string | null; days: number }[];
}

/** Rotationsmuster des eigenen Unternehmens. */
export async function fetchRotationPatterns(): Promise<LiveRotationPattern[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rotation_patterns")
    .select("id, name, anchor_date, steps")
    .eq("active", true)
    .order("name", { ascending: true })
    .returns<RotationPatternRow[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => {
    const steps = (row.steps ?? []).map((s) => ({ shiftId: s.shift, days: s.days }));
    return {
      id: row.id,
      name: row.name,
      anchorDate: row.anchor_date,
      cycleLength: steps.reduce((sum, s) => sum + s.days, 0),
      steps,
    };
  });
}
