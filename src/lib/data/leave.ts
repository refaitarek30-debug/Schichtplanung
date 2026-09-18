import { createClient } from "@/lib/supabase/client";
import { currentIdentity } from "@/lib/supabase/identity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type {
  LeaveBalanceViewRow,
  LeaveRequestWithEmployee,
} from "@/lib/supabase/database.types";
import type {
  LiveAutoDay,
  LiveTeamBalance,
  LiveLeaveBalance,
  LiveLeaveKindSuggestion,
  LiveLeaveRequest,
  LiveShiftLeaveEntry,
} from "@/lib/types";

export class DataError extends Error {}

function mapRequest(row: LeaveRequestWithEmployee): LiveLeaveRequest {
  const employee = row.employees;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: employee ? `${employee.first_name} ${employee.last_name}` : undefined,
    shiftName: employee?.shifts?.name ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    halfDayPeriod: row.half_day_period,
    requestedDays: row.requested_days,
    reason: row.reason,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

const SELECT_WITH_EMPLOYEE =
  "id, company_id, employee_id, start_date, end_date, half_day, half_day_period, requested_days, reason, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at, employees ( first_name, last_name, shift_id, shifts ( name ) )";

/** Eigene Anträge – Reihenfolge neueste zuerst. */
export async function fetchMyLeaveRequests(): Promise<LiveLeaveRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const ich = await currentIdentity();
  if (!ich) throw new DataError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  if (!ich.employeeId) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select(SELECT_WITH_EMPLOYEE)
    .eq("employee_id", ich.employeeId)
    .order("start_date", { ascending: false })
    .returns<LeaveRequestWithEmployee[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map(mapRequest);
}

/**
 * Anträge zur Entscheidung / Übersicht für Führungskräfte.
 * RLS liefert automatisch nur, was die Rolle sehen darf.
 */
export async function fetchReviewLeaveRequests(): Promise<LiveLeaveRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(SELECT_WITH_EMPLOYEE)
    .order("start_date", { ascending: true })
    .returns<LeaveRequestWithEmployee[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map(mapRequest);
}

/** Urlaubskonto des angemeldeten Benutzers für ein Jahr (Standard: laufendes Jahr). */
export async function fetchMyLeaveBalance(
  year = new Date().getFullYear(),
): Promise<LiveLeaveBalance | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const ich = await currentIdentity();
  if (!ich) throw new DataError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
  if (!ich.employeeId) return null;

  // Legt das Konto des Jahres an, falls es noch fehlt, und zieht den
  // Übertrag nach, solange das Vorjahr noch läuft. Damit stimmt die Zahl
  // auch dann, wenn jemand im Herbst schon das kommende Jahr plant.
  await supabase.rpc("ensure_leave_balance", {
    p_employee_id: ich.employeeId,
    p_year: year,
  });

  const { data, error } = await supabase
    .from("leave_balances_view")
    .select(
      "year, entitlement, carried_over, used_days, planned_days, pending_days, remaining_days, v_entitlement, v_carried_over, v_used_days, v_pending_days, v_remaining_days",
    )
    .eq("employee_id", ich.employeeId)
    .eq("year", year)
    .returns<LeaveBalanceViewRow[]>()
    .maybeSingle();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  if (!data) return null;

  return {
    year: data.year,
    entitlement: data.entitlement,
    carriedOver: data.carried_over,
    usedDays: data.used_days,
    plannedDays: data.planned_days,
    pendingDays: data.pending_days,
    remainingDays: data.remaining_days,
    vEntitlement: data.v_entitlement ?? 0,
    vCarriedOver: data.v_carried_over ?? 0,
    vUsedDays: data.v_used_days ?? 0,
    vPendingDays: data.v_pending_days ?? 0,
    vRemainingDays: data.v_remaining_days ?? 0,
  };
}

interface SuggestLeaveKindRow {
  kind: string;
  grund: string;
  u_rest: number;
  v_rest: number;
}

/**
 * Empfehlung der Datenbank, ob für einen Tag Urlaub oder ein V-Tag genommen
 * werden sollte (`suggest_leave_kind()`). An Sonn-/Feiertagen und in der
 * Nachtschicht lohnt sich Urlaub, weil die Zuschläge mitbezahlt werden – an
 * normalen Tagen ist der V-Tag günstiger. Nur ein Vorschlag: die Entscheidung
 * trifft weiterhin die antragstellende Person im Formular.
 */
export async function fetchLeaveKindSuggestion(
  employeeId: string,
  dateISO: string,
): Promise<LiveLeaveKindSuggestion | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("suggest_leave_kind", {
    p_employee_id: employeeId,
    p_date: dateISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  const row = ((data ?? []) as SuggestLeaveKindRow[])[0];
  if (!row) return null;
  return {
    kind: row.kind === "urlaub" || row.kind === "v_tag" ? row.kind : "keins",
    reason: row.grund,
    remainingLeave: Number(row.u_rest ?? 0),
    remainingV: Number(row.v_rest ?? 0),
  };
}

/**
 * Überschneidung mit Kolleginnen/Kollegen und Mindestbesetzung – ersetzt
 * durch `fetchLeaveImpact()` in `src/lib/data/staffing.ts`, das seit
 * Phase 4 auch den kritischen Status zurückgibt, nicht nur die Anzahl.
 */

interface ShiftLeaveRow {
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  status: string;
  is_me: boolean;
  reason_visible: boolean;
}

/**
 * Wer aus der eigenen Schicht (feste Zuordnung oder gleiches Rotationsmuster)
 * fehlt im angegebenen Zeitraum – mit Namen.
 *
 * Absichtlich nur Urlaub (`leave_requests`), keine Krankmeldungen: der Grund
 * einer krankheitsbedingten Abwesenheit bleibt Sache der Führung.
 *
 * Ob der Grund „Urlaub“ überhaupt genannt werden darf, entscheidet die
 * betroffene Person über ihre Datenschutzeinstellung. Die Datenbank liefert
 * das Ergebnis dieser Entscheidung in `reason_visible` mit und lässt ohne
 * Freigabe noch nicht genehmigte Anträge ganz weg.
 */
export async function fetchMyShiftLeave(
  fromISO: string,
  toISO: string,
): Promise<LiveShiftLeaveEntry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_shift_leave", {
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as ShiftLeaveRow[]).map((row) => ({
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as LiveShiftLeaveEntry["status"],
    isMe: row.is_me,
    // Die Datenbank entscheidet, nicht der Browser. Fehlt das Feld (alter
    // Server), gilt die restriktive Annahme.
    reasonVisible: row.reason_visible === true,
  }));
}

interface AutoPreviewRow {
  tag: string;
  art: string;
  grund: string;
}

/**
 * Vorschau: welcher Tag im Zeitraum würde auf welches Konto gehen?
 * Rechnet dieselbe Logik wie `submit_leave_auto()`, schreibt aber nichts.
 */
export async function fetchAutoPreview(
  startISO: string,
  endISO: string,
): Promise<LiveAutoDay[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("preview_leave_auto", {
    p_start_date: startISO,
    p_end_date: endISO,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as AutoPreviewRow[]).map((row) => ({
    date: row.tag,
    kind: row.art === "urlaub" ? "urlaub" : row.art === "v_tag" ? "v_tag" : "keins",
    reason: row.grund,
  }));
}

interface TeamBalanceRow {
  employee_id: string;
  rest: number;
  anspruch: number;
  v_rest: number;
  v_anspruch: number;
}

/** Rest-Urlaub und Rest-V-Tage je Mitarbeiter, Schlüssel ist die Mitarbeiter-ID. */
export async function fetchTeamBalances(
  year?: number,
): Promise<Map<string, LiveTeamBalance>> {
  if (!isSupabaseConfigured) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("team_leave_balances", {
    p_year: year ?? null,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  const map = new Map<string, LiveTeamBalance>();
  for (const row of (data ?? []) as TeamBalanceRow[]) {
    map.set(row.employee_id, {
      remainingDays: Number(row.rest ?? 0),
      entitlement: Number(row.anspruch ?? 0),
      vRemainingDays: Number(row.v_rest ?? 0),
      vEntitlement: Number(row.v_anspruch ?? 0),
    });
  }
  return map;
}
