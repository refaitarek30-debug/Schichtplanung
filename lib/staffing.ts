import { eachDay, fromISO, isHoliday, isWeekend } from "./dates";
import type {
  Absence,
  Employee,
  Holiday,
  LeaveRequest,
  Shift,
  StaffingSnapshot,
  StaffingStatus,
} from "./types";

export interface StaffingContext {
  employees: Employee[];
  shifts: Shift[];
  absences: Absence[];
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
}

/** Wird die Schicht an diesem Tag überhaupt gefahren? */
export function shiftRunsOn(shift: Shift, iso: string, holidays: Holiday[]): boolean {
  if (isHoliday(iso, holidays)) return false;
  return shift.weekdays.includes(fromISO(iso).getDay());
}

/**
 * Alle Mitarbeiter, die an einem Tag ausfallen – genehmigter Urlaub und
 * erfasste Abwesenheiten. Optional werden auch offene Anträge einbezogen,
 * um eine Vorschau ("wenn ich das jetzt genehmige") zu rechnen.
 */
export function absentOn(
  iso: string,
  ctx: Pick<StaffingContext, "absences" | "leaveRequests">,
  options: { includePending?: boolean; includeRequestId?: string } = {},
): string[] {
  const ids = new Set<string>();

  for (const absence of ctx.absences) {
    if (absence.date === iso) ids.add(absence.employeeId);
  }

  for (const request of ctx.leaveRequests) {
    const counts =
      request.status === "approved" ||
      (options.includePending && request.status === "pending") ||
      request.id === options.includeRequestId;
    if (!counts) continue;
    if (iso >= request.startDate && iso <= request.endDate) ids.add(request.employeeId);
  }

  return [...ids];
}

export function statusFor(present: number, target: number, min: number): StaffingStatus {
  if (present < min) return "critical";
  if (present < target) return "warn";
  return "ok";
}

/** Besetzung einer Schicht an einem Tag. */
export function staffingFor(
  iso: string,
  shift: Shift,
  ctx: StaffingContext,
  options: { includePending?: boolean; includeRequestId?: string } = {},
): StaffingSnapshot {
  const assigned = ctx.employees.filter((e) => e.active && e.shiftId === shift.id);
  const absentIds = absentOn(iso, ctx, options).filter((id) =>
    assigned.some((e) => e.id === id),
  );
  const planned = assigned.length;
  const present = planned - absentIds.length;

  return {
    date: iso,
    shiftId: shift.id,
    target: shift.targetHeadcount,
    min: shift.minHeadcount,
    planned,
    absent: absentIds.length,
    present,
    status: statusFor(present, shift.targetHeadcount, shift.minHeadcount),
    absentEmployeeIds: absentIds,
  };
}

/** Besetzung aller an diesem Tag laufenden Schichten. */
export function staffingForDay(
  iso: string,
  ctx: StaffingContext,
  options: { includePending?: boolean; includeRequestId?: string } = {},
): StaffingSnapshot[] {
  return ctx.shifts
    .filter((shift) => shift.code !== "FREI" && shiftRunsOn(shift, iso, ctx.holidays))
    .map((shift) => staffingFor(iso, shift, ctx, options));
}

/** Schlechtester Status des Tages – für Kalenderzellen. */
export function dayStatus(
  iso: string,
  ctx: StaffingContext,
  options: { includePending?: boolean } = {},
): StaffingStatus | null {
  const snapshots = staffingForDay(iso, ctx, options);
  if (snapshots.length === 0) return null;
  if (snapshots.some((s) => s.status === "critical")) return "critical";
  if (snapshots.some((s) => s.status === "warn")) return "warn";
  return "ok";
}

export interface LeaveCheck {
  status: StaffingStatus;
  /** Tage, an denen die Mindestbesetzung reißen würde. */
  criticalDays: StaffingSnapshot[];
  warnDays: StaffingSnapshot[];
  overlappingColleagues: number;
  headline: string;
  hints: string[];
}

/**
 * Kernfunktion: prüft, was ein Urlaubswunsch mit der Besetzung macht.
 * Rechnet den Antragsteller testweise als abwesend ein.
 */
export function checkLeaveImpact(
  employee: Employee,
  startDate: string,
  endDate: string,
  ctx: StaffingContext,
): LeaveCheck {
  const shift = ctx.shifts.find((s) => s.id === employee.shiftId);
  const days = eachDay(startDate, endDate);
  const criticalDays: StaffingSnapshot[] = [];
  const warnDays: StaffingSnapshot[] = [];
  const overlapping = new Set<string>();

  if (shift) {
    for (const iso of days) {
      if (isWeekend(iso) || !shiftRunsOn(shift, iso, ctx.holidays)) continue;

      const alreadyAbsent = absentOn(iso, ctx).filter(
        (id) =>
          id !== employee.id &&
          ctx.employees.some((e) => e.id === id && e.shiftId === shift.id),
      );
      alreadyAbsent.forEach((id) => overlapping.add(id));

      const base = staffingFor(iso, shift, ctx);
      const present = base.present - (base.absentEmployeeIds.includes(employee.id) ? 0 : 1);
      const snapshot: StaffingSnapshot = {
        ...base,
        absent: base.planned - present,
        present,
        status: statusFor(present, shift.targetHeadcount, shift.minHeadcount),
      };

      if (snapshot.status === "critical") criticalDays.push(snapshot);
      else if (snapshot.status === "warn") warnDays.push(snapshot);
    }
  }

  const status: StaffingStatus =
    criticalDays.length > 0 ? "critical" : warnDays.length > 0 ? "warn" : "ok";

  const hints: string[] = [];
  if (overlapping.size > 0) {
    hints.push(
      overlapping.size === 1
        ? "In diesem Zeitraum ist bereits eine Kollegin oder ein Kollege der gleichen Schicht abwesend."
        : `In diesem Zeitraum sind bereits ${overlapping.size} weitere Personen der gleichen Schicht abwesend.`,
    );
  }
  for (const day of criticalDays.slice(0, 3)) {
    hints.push(
      `Am ${day.date.split("-").reverse().join(".")} wäre die ${shift?.name} mit ${day.present} von ${day.min} erforderlichen Mitarbeitern besetzt.`,
    );
  }
  for (const day of warnDays.slice(0, 2)) {
    hints.push(
      `Am ${day.date.split("-").reverse().join(".")} liegt die ${shift?.name} mit ${day.present} von ${day.target} unter der Soll-Besetzung, die Mindestbesetzung bleibt aber erfüllt.`,
    );
  }

  const headline =
    status === "critical"
      ? "Mindestbesetzung wird unterschritten."
      : status === "warn"
        ? "Besetzung ausreichend, aber knapp."
        : "Besetzung ausreichend.";

  if (status === "ok") {
    hints.push(
      "Der Antrag kann voraussichtlich ohne Auswirkungen auf die Mindestbesetzung genehmigt werden.",
    );
  }

  return {
    status,
    criticalDays,
    warnDays,
    overlappingColleagues: overlapping.size,
    headline,
    hints,
  };
}

export interface LeaveBalance {
  entitlement: number;
  carryOver: number;
  taken: number;
  planned: number;
  pending: number;
  available: number;
}

/** Urlaubskonto: Anspruch minus verbrauchte, geplante und beantragte Tage. */
export function leaveBalance(
  employee: Employee,
  requests: LeaveRequest[],
  today: string,
): LeaveBalance {
  const own = requests.filter((r) => r.employeeId === employee.id);
  const approved = own.filter((r) => r.status === "approved");
  const taken = approved
    .filter((r) => r.endDate < today)
    .reduce((sum, r) => sum + r.days, 0);
  const planned = approved
    .filter((r) => r.endDate >= today)
    .reduce((sum, r) => sum + r.days, 0);
  const pending = own
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.days, 0);
  const total = employee.entitlement + employee.carryOver;

  return {
    entitlement: employee.entitlement,
    carryOver: employee.carryOver,
    taken,
    planned,
    pending,
    available: total - taken - planned - pending,
  };
}
