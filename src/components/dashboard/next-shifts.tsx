import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  addDays,
  formatDE,
  isHoliday,
  holidayName,
  weekdayLong,
  fromISO,
} from "@/lib/dates";
import { holidays, leaveRequests, absences, getShift } from "@/lib/demo-data";
import type { Employee } from "@/lib/types";

interface Upcoming {
  date: string;
  absent?: string;
}

function upcomingShiftDays(employee: Employee, from: string, count: number): Upcoming[] {
  const shift = getShift(employee.shiftId);
  if (!shift) return [];
  const result: Upcoming[] = [];
  let cursor = from;

  for (let i = 0; i < 60 && result.length < count; i += 1) {
    const day = fromISO(cursor).getDay();
    if (shift.weekdays.includes(day) && !isHoliday(cursor, holidays)) {
      const leave = leaveRequests.find(
        (r) =>
          r.employeeId === employee.id &&
          r.status === "approved" &&
          cursor >= r.startDate &&
          cursor <= r.endDate,
      );
      const absence = absences.find(
        (a) => a.employeeId === employee.id && a.date === cursor,
      );
      result.push({
        date: cursor,
        absent: leave ? "Urlaub" : absence ? absenceLabel(absence.type) : undefined,
      });
    }
    cursor = addDays(cursor, 1);
  }
  return result;
}

function absenceLabel(type: string) {
  const labels: Record<string, string> = {
    krank: "Krank",
    schulung: "Schulung",
    urlaub: "Urlaub",
    sonstiges: "Abwesend",
  };
  return labels[type] ?? "Abwesend";
}

export function NextShifts({ employee, from }: { employee: Employee; from: string }) {
  const shift = getShift(employee.shiftId);
  const days = upcomingShiftDays(employee, from, 4);

  return (
    <Card>
      <CardHeader
        title="Nächste Schichten"
        hint={shift ? `${shift.name} · ${shift.startTime}–${shift.endTime}` : undefined}
      />
      <CardBody className="space-y-2 px-3 py-3">
        {days.map((day) => (
          <div
            key={day.date}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-muted"
          >
            <div className="w-14 shrink-0 text-center">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                {weekdayLong(day.date).slice(0, 2)}
              </p>
              <p className="tnum text-lg font-semibold leading-tight">
                {day.date.slice(8, 10)}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {day.absent ? day.absent : shift?.name}
              </p>
              <p className="tnum text-[12px] text-ink-muted">
                {day.absent
                  ? formatDE(day.date)
                  : `${shift?.startTime}–${shift?.endTime} · ${formatDE(day.date)}`}
              </p>
            </div>
            {day.absent ? (
              <Badge tone={day.absent === "Urlaub" ? "plan" : "warn"}>{day.absent}</Badge>
            ) : holidayName(day.date, holidays) ? (
              <Badge tone="info">{holidayName(day.date, holidays)}</Badge>
            ) : null}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
