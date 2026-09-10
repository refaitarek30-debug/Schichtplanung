"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  WEEKDAY_SHORT,
  formatDE,
  fromISO,
  holidayName,
  isSameMonth,
  isWeekend,
  monthGrid,
  monthName,
  weekdayLong,
} from "@/lib/dates";
import { getEmployee, holidays, shifts, staffingContext } from "@/lib/demo-data";
import { absentOn, dayStatus, shiftRunsOn, staffingFor } from "@/lib/staffing";
import type { Role, StaffingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const dotTone: Record<StaffingStatus, string> = {
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  critical: "bg-crit-dot",
};

const cellTone: Record<StaffingStatus, string> = {
  ok: "",
  warn: "bg-warn-bg/60",
  critical: "bg-crit-bg/60",
};

export function MonthCalendar({ today, role }: { today: string; role: Role }) {
  const start = fromISO(today);
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [selected, setSelected] = useState(today);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const showStaffing = role !== "employee";

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const selectedShifts = shifts
    .filter((s) => s.code !== "FREI" && shiftRunsOn(s, selected, holidays))
    .map((s) => ({ shift: s, snapshot: staffingFor(selected, s, staffingContext) }));

  const selectedAbsent = absentOn(selected, staffingContext)
    .map((id) => getEmployee(id))
    .filter(Boolean);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold tracking-tight">
            {monthName(month)} {year}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setYear(start.getFullYear());
                setMonth(start.getMonth());
                setSelected(today);
              }}
              className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-muted hover:bg-surface-muted"
            >
              Heute
            </button>
            <button
              onClick={() => shiftMonth(1)}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardBody className="px-3 py-3">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((day) => (
              <div
                key={day}
                className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
              >
                {day}
              </div>
            ))}

            {grid.map((iso) => {
              const inMonth = isSameMonth(iso, year, month);
              const status = showStaffing ? dayStatus(iso, staffingContext) : null;
              const feiertag = holidayName(iso, holidays);
              const absent = absentOn(iso, staffingContext).length;
              const isSelected = iso === selected;

              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  aria-label={`${weekdayLong(iso)}, ${formatDE(iso)}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors",
                    inMonth ? "text-ink" : "text-ink-faint/60",
                    isWeekend(iso) || feiertag ? "bg-surface-sunken/60" : "",
                    status && inMonth ? cellTone[status] : "",
                    isSelected
                      ? "ring-2 ring-brand-500"
                      : "hover:bg-surface-muted",
                    iso === today ? "font-bold" : "",
                  )}
                >
                  <span className="tnum leading-none">{Number(iso.slice(8, 10))}</span>
                  {status && inMonth ? (
                    <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", dotTone[status])} />
                  ) : absent > 0 && inMonth ? (
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-plan-dot" />
                  ) : (
                    <span className="mt-1 h-1.5 w-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="h-fit">
        <div className="border-b border-line px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            {weekdayLong(selected)}
          </p>
          <h2 className="tnum mt-0.5 text-[15px] font-semibold tracking-tight">
            {formatDE(selected)}
          </h2>
          {holidayName(selected, holidays) ? (
            <p className="mt-2">
              <Badge tone="plan">{holidayName(selected, holidays)}</Badge>
            </p>
          ) : null}
        </div>

        <CardBody className="space-y-4">
          {showStaffing ? (
            selectedShifts.length === 0 ? (
              <p className="text-sm text-ink-muted">
                An diesem Tag wird nicht produziert.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedShifts.map(({ shift, snapshot }) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-medium">{shift.name}</p>
                      <p className="tnum text-[12px] text-ink-muted">
                        {shift.startTime}–{shift.endTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-sm font-semibold">
                        {snapshot.present} / {snapshot.target}
                      </p>
                      <p className="tnum text-[11px] text-ink-faint">
                        Min. {snapshot.min}
                      </p>
                    </div>
                    <span
                      className={cn("ml-3 h-2.5 w-2.5 rounded-full", dotTone[snapshot.status])}
                      aria-hidden
                    />
                  </div>
                ))}
              </div>
            )
          ) : null}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Abwesend an diesem Tag
            </p>
            {selectedAbsent.length === 0 ? (
              <p className="text-sm text-ink-muted">Niemand abwesend.</p>
            ) : (
              <ul className="space-y-1.5">
                {selectedAbsent.map((person) =>
                  person ? (
                    <li key={person.id} className="text-sm text-ink-muted">
                      {person.firstName} {person.lastName}
                      <span className="text-ink-faint"> · {person.jobTitle}</span>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
