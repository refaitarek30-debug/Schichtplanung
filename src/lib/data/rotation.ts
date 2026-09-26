import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage, istVoruebergehendeStoerung } from "@/lib/errors";
import type {
  LiveRotationPattern,
  LiveShiftAssignment,
  LiveShiftPlanCell,
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

/** Rotationsmuster des eigenen Unternehmens. */export async function fetchRotationPatterns(): Promise<LiveRotationPattern[]> {
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

/** Eine Person aus `schichtplan_kompakt()`: die Tage als Liste. */
interface SchichtplanKompaktZeile {
  employee_id: string;
  employee_name: string;
  rotation_team: string | null;
  personnel_number: string | null;
  is_me: boolean;
  is_apprentice: boolean;
  /** Je Tag: [Tag, Schichtname, Schichtkürzel, Abwesenheitskürzel]. */
  tage: [string, string | null, string | null, string | null][];
}

/** Meldung, wenn der Plan wegen einer echten Störung nicht kommt. */
export const PLAN_STOERUNG =
  "Der Schichtplan kann momentan nicht geladen werden. Bitte in einigen Minuten erneut versuchen.";

/**
 * Komplette Schichtplan-Matrix (alle Mitarbeiter × Zeitraum) in einem
 * Aufruf – die Grundlage für die Excel-artige Übersichtsansicht.
 *
 * Früher kam je Person und Tag eine Zeile (bei 50 Personen über vier
 * Wochen 1500) – mehr, als PostgREST auf einmal herausgibt. Der Plan wurde
 * deshalb in Seiten zu 1000 Zeilen geholt, und jede Seite rechnete den
 * ganzen Plan in der Datenbank neu. `schichtplan_kompakt()` liefert eine
 * Zeile je Person mit allen Tagen: ein Aufruf, ein Rechengang, ein
 * Bruchteil der Datenmenge. Dieselben Regeln – die Funktion fasst
 * `shift_plan_grid()` nur zusammen.
 */
export async function fetchShiftPlanGrid(
  companyId: string,
  fromISO: string,
  days: number,
): Promise<LiveShiftPlanCell[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();

  const { data, error, status } = await supabase.rpc("schichtplan_kompakt", {
    p_company_id: companyId,
    p_from: fromISO,
    p_days: days,
  });
  if (error) {
    // Überlastung oder Ausfall: eine klare Meldung statt Technik.
    if (istVoruebergehendeStoerung({ ...error, status })) throw new DataError(PLAN_STOERUNG);
    throw new DataError(dataErrorMessage(error) ?? "Der Schichtplan konnte nicht geladen werden.");
  }

  const zellen: LiveShiftPlanCell[] = [];
  for (const person of (data ?? []) as SchichtplanKompaktZeile[]) {
    for (const [day, shiftName, shiftCode, absenceCode] of person.tage ?? []) {
      zellen.push({
        employeeId: person.employee_id,
        employeeName: person.employee_name,
        rotationTeam: person.rotation_team,
        personnelNumber: person.personnel_number,
        day,
        shiftName,
        shiftCode,
        absenceCode,
        isMe: person.is_me,
        isApprentice: person.is_apprentice === true,
      });
    }
  }
  return zellen;
}

interface CurrentPatternRow {
  id: string;
  name: string;
  anchor_date: string;
  blocks: { code: string; days: number }[];
}

/** Aktuelles Schichtmuster des Unternehmens – zum Vorbelegen des Editors. */
export async function fetchCurrentPattern(): Promise<{
  id: string;
  name: string;
  anchorDate: string;
  blocks: { code: string; days: number }[];
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("current_rotation_pattern");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = ((data ?? []) as CurrentPatternRow[])[0];
  if (!row) return null;
  return { id: row.id, name: row.name, anchorDate: row.anchor_date, blocks: row.blocks };
}

interface BlockedDayRow {
  day: string;
  reason: string;
}

/** Tage mit Urlaubssperre im Zeitraum – für die Markierung im Schichtplan. */
export async function fetchBlockedDays(
  fromISO: string,
  toISO: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!isSupabaseConfigured) return result;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("blocked_days", { p_from: fromISO, p_to: toISO });
  if (error) return result;
  for (const row of (data ?? []) as BlockedDayRow[]) {
    result.set(row.day, row.reason);
  }
  return result;
}
