import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type {
  LeaveBalanceViewRow,
  LeaveRequestWithEmployee,
} from "@/lib/supabase/database.types";
import type { LiveLeaveBalance, LiveLeaveRequest } from "@/lib/types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new DataError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id")
    .eq("id", user.id)
    .returns<{ employee_id: string | null }[]>()
    .maybeSingle();

  if (!profile?.employee_id) return [];

  const { data, error } = await supabase
    .from("leave_requests")
    .select(SELECT_WITH_EMPLOYEE)
    .eq("employee_id", profile.employee_id)
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new DataError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("employee_id")
    .eq("id", user.id)
    .returns<{ employee_id: string | null }[]>()
    .maybeSingle();

  if (!profile?.employee_id) return null;

  const { data, error } = await supabase
    .from("leave_balances_view")
    .select("year, entitlement, carried_over, used_days, planned_days, pending_days, remaining_days")
    .eq("employee_id", profile.employee_id)
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
  };
}

/**
 * Überschneidung mit Kolleginnen/Kollegen und Mindestbesetzung – ersetzt
 * durch `fetchLeaveImpact()` in `src/lib/data/staffing.ts`, das seit
 * Phase 4 auch den kritischen Status zurückgibt, nicht nur die Anzahl.
 */
