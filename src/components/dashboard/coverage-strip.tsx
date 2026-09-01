"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { holidayName, WEEKDAY_SHORT, addDays, formatDEShort, fromISO } from "@/lib/dates";
import { holidays, shifts, staffingContext } from "@/lib/demo-data";
import { shiftRunsOn, staffingFor } from "@/lib/staffing";
import type { StaffingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const cellTone: Record<StaffingStatus, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg ring-1 ring-inset ring-warn-dot/30",
  critical: "bg-crit-bg text-crit-fg ring-1 ring-inset ring-crit-dot/40",
};

/**
 * Besetzungsband: 14 Tage im Überblick, eine Zeile je Schicht.
 * Jede Zelle zeigt die anwesenden Mitarbeiter im Verhältnis zur Soll-Besetzung.
 */
export function CoverageStrip({ from, days = 14 }: { from: string; days?: number }) {
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const productionShifts = shifts.filter((s) => s.code !== "FREI");

  return (
    <Card>
      <CardHeader
        title="Besetzungsband"
        hint="Die nächsten 14 Tage. Zahl = anwesende Mitarbeiter, darunter die Soll-Besetzung."
      />
      <CardBody className="overflow-x-auto px-0 py-0">
        <table className="w-full min-w-[720px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Schicht
              </th>
              {dates.map((iso) => {
                const weekday = WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7];
                const feiertag = holidayName(iso, holidays);
                return (
                  <th key={iso} className="px-1 pb-2 pt-3 text-center">
                    <span className="block text-[11px] font-medium text-ink-faint">
                      {weekday}
                    </span>
                    <span
                      className={cn(
                        "tnum block text-[11px]",
                        feiertag ? "text-plan-fg" : "text-ink-muted",
                      )}
                      title={feiertag}
                    >
                      {formatDEShort(iso)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {productionShifts.map((shift) => (
              <tr key={shift.id}>
                <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-5 py-2 text-left">
                  <span className="block text-[13px] font-medium">{shift.name}</span>
                  <span className="tnum block text-[11px] text-ink-faint">
                    {shift.startTime}–{shift.endTime} · Soll {shift.targetHeadcount} / Min{" "}
                    {shift.minHeadcount}
                  </span>
                </th>
                {dates.map((iso) => {
                  if (!shiftRunsOn(shift, iso, holidays)) {
                    return (
                      <td key={iso} className="px-1 py-1.5 text-center">
                        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-[11px] text-ink-faint">
                          –
                        </span>
                      </td>
                    );
                  }
                  const snapshot = staffingFor(iso, shift, staffingContext);
                  return (
                    <td key={iso} className="px-1 py-1.5 text-center">
                      <span
                        className={cn(
                          "tnum mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[13px] font-semibold leading-none",
                          cellTone[snapshot.status],
                        )}
                        title={`${shift.name} am ${formatDEShort(iso)}: ${snapshot.present} von ${snapshot.target} (Mindestbesetzung ${snapshot.min})`}
                      >
                        {snapshot.present}
                        <span className="mt-0.5 text-[10px] font-normal opacity-70">
                          /{snapshot.target}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
      <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3 text-[12px] text-ink-muted">
        <Legend className="bg-ok-dot" label="Soll erfüllt" />
        <Legend className="bg-warn-dot" label="unter Soll" />
        <Legend className="bg-crit-dot" label="unter Mindestbesetzung" />
      </div>
    </Card>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  );
}
