/** Zentrale Domänen-Typen. Spiegeln das Supabase-Schema (supabase/migrations). */

export type Role = "employee" | "shift_leader" | "admin";

export type ShiftCode = "FRUEH" | "SPAET" | "NACHT" | "FREI";

export type LeaveStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type AbsenceType = "urlaub" | "krank" | "schulung" | "sonstiges";

/** Ampelstatus der Besetzung – die einzige Statusskala der App. */
export type StaffingStatus = "ok" | "warn" | "critical";

export interface Company {
  id: string;
  name: string;
  region: string;
  logoUrl?: string | null;
  active?: boolean;
}

/** Angemeldete Person: Auth-Benutzer + Zeile aus `profiles` (+ `employees`). */
export interface SessionProfile {
  id: string;
  companyId: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  active: boolean;
  /** Stammdaten aus `employees`, sofern verknüpft. */
  personnelNumber?: string | null;
  department?: string | null;
  shiftName?: string | null;
}

/** Zeile aus `employees` – Personalstammdaten, unabhängig vom Login. */
export interface EmployeeRecord {
  id: string;
  companyId: string;
  personnelNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  department: string | null;
  shiftId: string | null;
  shiftName: string | null;
  vacationDays: number;
  active: boolean;
  /** Hat diese Person bereits einen Login (Zeile in `profiles`)? */
  hasAccount: boolean;
  qualifications: string[];
}

export interface ShiftAssignment {
  id: string;
  companyId: string;
  employeeId: string;
  shiftId: string;
  date: string;
}

export type SessionMode = "demo" | "live";

/**
 * Urlaubsantrag aus Supabase (Phase 3). Eigener Typ statt Wiederverwendung
 * von `LeaveRequest`, weil die Demo-Daten aus Phase 1 andere Feldnamen
 * verwenden (`comment`, `decidedBy`, …) und weiterhin unverändert laufen.
 */
export interface LiveLeaveRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  shiftName?: string | null;
  startDate: string;
  endDate: string;
  halfDayPeriod: "vormittag" | "nachmittag" | null;
  requestedDays: number;
  reason: string | null;
  status: LeaveStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface LiveLeaveBalance {
  year: number;
  entitlement: number;
  carriedOver: number;
  usedDays: number;
  plannedDays: number;
  pendingDays: number;
  remainingDays: number;
}

/** Besetzung einer Schicht an einem Tag, aus `staffing_for_day`/`staffing_snapshot`. */
export interface LiveStaffingSnapshot {
  shiftId: string;
  shiftName?: string;
  date: string;
  target: number;
  minimum: number;
  planned: number;
  absent: number;
  present: number;
  status: StaffingStatus;
}

export interface LiveLeaveImpact {
  overlappingEmployees: number;
  criticalDays: number;
  worstStatus: StaffingStatus;
}

export interface LiveAbsence {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  type: AbsenceType;
  note: string | null;
}

/** Urlaubssperre aus `staffing_rules` (key = 'urlaubssperre'). */
export interface LiveLeaveBlock {
  id: string;
  shiftId: string | null;
  startDate: string;
  endDate: string;
  reason: string;
}

/** Ein Eintrag aus `my_shift_leave()` – wer aus der eigenen Schicht hat wann Urlaub. */
export interface LiveShiftLeaveEntry {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  isMe: boolean;
}
export interface LiveShiftPlanDay {
  date: string;
  shiftId: string | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  isFree: boolean;
}

/** Rotationsmuster: Kette von Blöcken, die sich nach der Summe der Tage wiederholt. */
export interface LiveRotationPattern {
  id: string;
  name: string;
  anchorDate: string;
  cycleLength: number;
  steps: { shiftId: string | null; days: number }[];
}

/** Tagesgenaue Ausnahme von der festen Schichtzuordnung (Phase 5). */
export interface LiveShiftAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  defaultShiftId: string | null;
  shiftId: string;
  shiftName: string;
  date: string;
}

export interface Shift {
  id: string;
  companyId: string;
  name: string;
  code: ShiftCode;
  startTime: string; // "06:00"
  endTime: string; // "14:00"
  /** Soll-Besetzung an einem regulären Arbeitstag. */
  targetHeadcount: number;
  /** Mindestbesetzung – darunter darf nicht gefahren werden. */
  minHeadcount: number;
  /** Wochentage, an denen die Schicht gefahren wird (0 = So … 6 = Sa). */
  weekdays: number[];
}

export interface Employee {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  shiftId: string;
  jobTitle: string;
  /** Jahresanspruch in Urlaubstagen. */
  entitlement: number;
  /** Aus dem Vorjahr übertragene Tage. */
  carryOver: number;
  active: boolean;
  entryDate: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string; // ISO "YYYY-MM-DD"
  endDate: string;
  halfDay: boolean;
  days: number;
  comment?: string;
  status: LeaveStatus;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface Absence {
  id: string;
  employeeId: string;
  date: string;
  type: AbsenceType;
  note?: string;
}

export interface Holiday {
  date: string;
  name: string;
  region: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  level: "info" | "warn";
}

export interface StaffingSnapshot {
  date: string;
  shiftId: string;
  target: number;
  min: number;
  planned: number;
  absent: number;
  present: number;
  status: StaffingStatus;
  absentEmployeeIds: string[];
}
