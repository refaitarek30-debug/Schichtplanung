"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEKDAY_SHORT,
  fromISO,
  holidayName,
  isSameMonth,
  isWeekend,
  monthGrid,
  monthName,
  toISO,
} from "@/lib/dates";
import type { Holiday } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Große, klickbare Monatsansicht zur Zeitraumauswahl – ersetzt die kleinen
 * nativen Datumsfelder im Urlaubsantrag. Erster Klick setzt den Start
 * (und zeigt sofort einen einzelnen Tag als Vorschau), zweiter Klick
 * vervollständigt den Zeitraum; ein Klick vor dem Start tauscht die Seiten.
 */
export function DateRangeCalendar({
  startDate,
  endDate,
  onChange,
  minDate,
  holidays = [],
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
  holidays?: Holiday[];
}) {
  const start = fromISO(startDate);
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [pendingStart, setPendingStart] = useState<string | null>(null);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  function handleClick(iso: string) {
    if (minDate && iso < minDate) return;

    if (!pendingStart) {
      setPendingStart(iso);
      onChange(iso, iso);
      return;
    }

    if (iso >= pendingStart) {
      onChange(pendingStart, iso);
    } else {
      onChange(iso, pendingStart);
    }
    setPendingStart(null);
  }

  return (
    <div className="select-none rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="text-lg font-semibold tracking-tight">
          {monthName(month)} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Nächster Monat"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((day) => (
            <div
              key={day}
              className="pb-1.5 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
            >
              {day}
            </div>
          ))}

          {grid.map((iso) => {
            const inMonth = isSameMonth(iso, year, month);
            const disabled = Boolean(minDate && iso < minDate);
            const inRange = iso >= startDate && iso <= endDate;
            const isEdge = iso === startDate || iso === endDate;
            const feiertag = holidayName(iso, holidays);
            const today = toISO(new Date());

            return (
              <button
                type="button"
                key={iso}
                disabled={disabled}
                onClick={() => handleClick(iso)}
                title={feiertag}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl text-[15px] transition-colors sm:text-base",
                  !inMonth && "text-ink-faint/50",
                  inMonth && !disabled && "text-ink",
                  disabled && "cursor-not-allowed text-ink-faint/30",
                  !disabled && (isWeekend(iso) || feiertag) && !inRange && "bg-surface-sunken/60",
                  inRange && !isEdge && "bg-brand-50 text-brand-700",
                  isEdge && "bg-brand-500 font-semibold text-white",
                  !inRange && !disabled && "hover:bg-surface-muted",
                  iso === today && !isEdge && "font-bold ring-1 ring-inset ring-brand-500/40",
                )}
              >
                <span className="tnum leading-none">{Number(iso.slice(8, 10))}</span>
                {feiertag ? (
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 rounded-full",
                      isEdge ? "bg-white" : "bg-plan-dot",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3 text-[12px] text-ink-muted">
        <Legend className="bg-brand-500" label="Start / Ende" />
        <Legend className="bg-brand-50" label="ausgewählter Zeitraum" />
        <Legend className="bg-plan-dot" label="Feiertag" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}
