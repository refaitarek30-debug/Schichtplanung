/**
 * Handgepflegte Typen für die Supabase-Tabellen.
 * Alternativ generierbar mit:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */
import type { Role } from "@/lib/types";

export type LeaveStatusDb = "pending" | "approved" | "rejected" | "withdrawn";
export type HalfDayPeriod = "vormittag" | "nachmittag";
export type StaffingStatusDb = "ok" | "warn" | "critical";

export interface StaffingSnapshotRow {
  shift_id: string;
  shift_name?: string;
  date: string;
  target: number;
  minimum: number;
  planned: number;
  absent: number;
  present: number;
  status: StaffingStatusDb;
}

export interface StaffingMonthRow {
  day: string;
  status: StaffingStatusDb;
}

export interface AbsenceRow {
  id: string;
  company_id: string;
  employee_id: string;
  date: string;
  type: "urlaub" | "krank" | "schulung" | "sonstiges";
  note: string | null;
  created_at: string;
}

export interface AbsenceWithEmployee extends AbsenceRow {
  employees: { first_name: string; last_name: string } | null;
}

export interface StaffingRuleRow {
  id: string;
  company_id: string;
  shift_id: string | null;
  key: string;
  value: { start: string; end: string; reason: string };
  active: boolean;
  created_at: string;
}

export interface CompanyRow {
  id: string;
  name: string;
  logo_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  company_id: string;
  employee_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRow {
  id: string;
  company_id: string;
  personnel_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  department: string | null;
  shift_id: string | null;
  vacation_days: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftRow {
  id: string;
  company_id: string;
  name: string;
  short_name: string;
  start_time: string;
  end_time: string;
  color: string | null;
  minimum_staff: number;
  target_staff: number;
  weekdays: number[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftAssignmentRow {
  id: string;
  company_id: string;
  employee_id: string;
  shift_id: string;
  date: string;
  created_at: string;
}

export interface LeaveBalanceViewRow {
  id: string;
  company_id: string;
  employee_id: string;
  year: number;
  entitlement: number;
  carried_over: number;
  used_days: number;
  planned_days: number;
  pending_days: number;
  remaining_days: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestRow {
  id: string;
  company_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  half_day_period: HalfDayPeriod | null;
  requested_days: number;
  reason: string | null;
  status: LeaveStatusDb;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Antrag inklusive Name/Schicht der antragstellenden Person – für die Führungsansicht. */
export interface LeaveRequestWithEmployee extends LeaveRequestRow {
  employees: {
    first_name: string;
    last_name: string;
    shift_id: string | null;
    shifts: { name: string } | null;
  } | null;
}

export interface NotificationRow {
  id: string;
  company_id: string;
  employee_id: string;
  type: string;
  title: string;
  body: string;
  related_entity: string | null;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
}

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      companies: Table<CompanyRow>;
      profiles: Table<ProfileRow>;
      employees: Table<EmployeeRow>;
      shifts: Table<ShiftRow>;
      shift_assignments: Table<ShiftAssignmentRow>;
      leave_requests: Table<LeaveRequestRow>;
      leave_balances: Table<LeaveBalanceViewRow>;
      notifications: Table<NotificationRow>;
      absences: Table<AbsenceRow>;
      staffing_rules: Table<StaffingRuleRow>;
    };
    Views: {
      leave_balances_view: { Row: LeaveBalanceViewRow; Relationships: [] };
    };
    Functions: {
      decide_leave_request: {
        Args: { p_request_id: string; p_decision: LeaveStatusDb; p_rejection_reason: string | null };
        Returns: LeaveRequestRow;
      };
      withdraw_leave_request: {
        Args: { p_request_id: string };
        Returns: LeaveRequestRow;
      };
      shift_leave_overlap: {
        Args: { p_employee_id: string; p_start_date: string; p_end_date: string };
        Returns: { overlapping_employees: number; critical_days: number; worst_status: StaffingStatusDb }[];
      };
      staffing_snapshot: {
        Args: { p_shift_id: string; p_date: string };
        Returns: StaffingSnapshotRow[];
      };
      staffing_for_day: {
        Args: { p_company_id: string; p_date: string };
        Returns: StaffingSnapshotRow[];
      };
      staffing_range: {
        Args: { p_company_id: string; p_from: string; p_days: number };
        Returns: StaffingSnapshotRow[];
      };
      staffing_month_overview: {
        Args: { p_company_id: string; p_year: number; p_month: number };
        Returns: StaffingMonthRow[];
      };
      check_leave_staffing_impact: {
        Args: { p_employee_id: string; p_start_date: string; p_end_date: string };
        Returns: { date: string; present: number; target: number; minimum: number; status: StaffingStatusDb }[];
      };
      assign_shift: {
        Args: { p_employee_id: string; p_shift_id: string; p_date: string };
        Returns: ShiftAssignmentRow;
      };
      my_shift_plan: {
        Args: { p_from: string; p_days: number };
        Returns: {
          date: string;
          shift_id: string | null;
          shift_name: string | null;
          start_time: string | null;
          end_time: string | null;
          is_free: boolean;
        }[];
      };
      rotation_preview: {
        Args: { p_pattern_id: string; p_offset_days: number; p_from: string; p_days: number };
        Returns: { date: string; shift_id: string | null; shift_name: string | null; is_free: boolean }[];
      };
      shift_assignments_for_range: {
        Args: { p_company_id: string; p_from: string; p_to: string };
        Returns: {
          id: string;
          employee_id: string;
          employee_name: string;
          default_shift_id: string | null;
          shift_id: string;
          shift_name: string;
          date: string;
        }[];
      };
    };
    Enums: { app_role: Role };
    CompositeTypes: Record<string, never>;
  };
}

/** Profil samt verknüpftem Unternehmen und Mitarbeiterdatensatz. */
export interface ProfileWithRelations extends ProfileRow {
  companies: Pick<CompanyRow, "id" | "name" | "logo_url" | "active"> | null;
  employees:
    | (Pick<EmployeeRow, "personnel_number" | "department"> & {
        shifts: Pick<ShiftRow, "name"> | null;
      })
    | null;
}

/** Mitarbeiterzeile inklusive Schichtname. */
export interface EmployeeWithShift extends EmployeeRow {
  shifts: Pick<ShiftRow, "name"> | null;
}
