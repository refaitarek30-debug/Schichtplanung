"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  WEEKDAY_SHORT,
  eachDay,
  formatDE,
  fromISO,
  holidayName,
  isSameMonth,
  isWeekend,
  monthGrid,
  monthName,
  weekdayLong,
} from "@/lib/dates";
import {
  DataError,
  fetchStaffingForDay,
  fetchStaffingMonthOverview,
  fetchWhoIsAbsent,
} from "@/lib/data/staffing";
import { fetchHolidays } from "@/lib/data/holidays";
import { fetchMyLeaveRequests } from "@/lib/data/leave";
import type {
  Holiday,
  LiveAbsentToday,
  LiveLeaveRequest,
  LiveStaffingSnapshot,
  Role,
  StaffingStatus,
} from "@/lib/types";
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

export function LiveMonthCalendar({
  today,
  role,
  companyId,
}: {
  today: string;
  role: Role;
  companyId: string;
}) {
  const start = fromISO(today);
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [selected, setSelected] = useState(today);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState<string | null>(null);

  const showStaffing = role !== "employee";

  // Führung: Ampel je Tag für den ganzen Monat.
  const [monthStatuses, setMonthStatuses] = useState<Record<string, StaffingStatus>>({});
  const [dayDetail, setDayDetail] = useState<LiveStaffingSnapshot[] | null>(null);

  // Mitarbeiter: eigene Anträge, als Punkte im Monat markiert.
  const [myRequests, setMyRequests] = useState<LiveLeaveRequest[] | null>(null);

  useEffect(() => {
    fetchHolidays()
      .then(setHolidays)
      .catch(() => setHolidays([]));
  }, []);

  const loadMonth = useCallback(async () => {
    setError(null);
    try {
      if (showStaffing) {
        setMonthStatuses(await fetchStaffingMonthOverview(companyId, year, month + 1));
      } else if (myRequests === null) {
        setMyRequests(await fetchMyLeaveRequests());
      }
    } catch (caught) {
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, year, month, showStaffing]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (!showStaffing) return;
    setDayDetail(null);
    fetchStaffingForDay(companyId, selected)
      .then(setDayDetail)
      .catch(() => setDayDetail([]));
  }, [companyId, selected, showStaffing]);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const requestsOnSelected = (myRequests ?? []).filter(
    (r) => r.status !== "withdrawn" && selected >= r.startDate && selected <= r.endDate,
  );
  const requestDatesInMonth = new Set(
    (myRequests ?? [])
      .filter((r) => r.status !== "withdrawn")
      .flatMap((r) => eachDay(r.startDate, r.endDate)),
  );

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

        {error ? (
          <div className="px-4 pt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

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
              const status = showStaffing ? monthStatuses[iso] : undefined;
              const feiertag = holidayName(iso, holidays);
              const hasOwnRequest = !showStaffing && requestDatesInMonth.has(iso);
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
                    isSelected ? "ring-2 ring-brand-500" : "hover:bg-surface-muted",
                    iso === today ? "font-bold" : "",
                  )}
                >
                  <span className="tnum leading-none">{Number(iso.slice(8, 10))}</span>
                  {status && inMonth ? (
                    <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", dotTone[status])} />
                  ) : hasOwnRequest && inMonth ? (
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
            dayDetail === null ? (
              <p className="text-sm text-ink-muted">wird geladen …</p>
            ) : dayDetail.length === 0 ? (
              <p className="text-sm text-ink-muted">An diesem Tag wird nicht produziert.</p>
            ) : (
              <div className="space-y-2">
                {dayDetail.map((snap) => (
                  <div
                    key={snap.shiftId}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"
                  >
                    <p className="text-[13px] font-medium">{snap.shiftName}</p>
                    <div className="text-right">
                      <p className="tnum text-sm font-semibold">
                        {snap.present} / {snap.target}
                      </p>
                      <p className="tnum text-[11px] text-ink-faint">Min. {snap.minimum}</p>
                    </div>
                    <span
                      className={cn("ml-3 h-2.5 w-2.5 rounded-full", dotTone[snap.status])}
                      aria-hidden
                    />
                  </div>
                ))}
              </div>
            )
          ) : null}

          {showStaffing ? <WhoIsAbsent date={selected} /> : null}

          {!showStaffing ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Mein Urlaub an diesem Tag
              </p>
              {requestsOnSelected.length === 0 ? (
                <p className="text-sm text-ink-muted">Kein Eintrag für diesen Tag.</p>
              ) : (
                <ul className="space-y-1.5">
                  {requestsOnSelected.map((r) => (
                    <li key={r.id} className="text-sm text-ink-muted">
                      {formatDE(r.startDate)}–{formatDE(r.endDate)}
                      <span className="text-ink-faint"> · {r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

/** Wer an diesem Tag fehlt – mit Namen und Grund. Nur für Führung sichtbar. */
function WhoIsAbsent({ date }: { date: string }) {
  const [entries, setEntries] = useState<LiveAbsentToday[] | null>(null);

  useEffect(() => {
    setEntries(null);
    fetchWhoIsAbsent(date)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [date]);

  return (
    <div className="border-t border-line pt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Wer fehlt
      </p>
      {entries === null ? (
        <p className="text-sm text-ink-muted">wird geladen …</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-muted">Niemand fehlt an diesem Tag.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry, index) => (
            <li
              key={`${entry.employeeId}-${index}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="min-w-0 truncate">
                {entry.employeeName}
                {entry.shiftName ? (
                  <span className="text-ink-faint"> · {entry.shiftName}</span>
                ) : null}
              </span>
              <Badge tone={entry.reason === "Urlaub" ? "plan" : "warn"}>{entry.reason}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
