"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { WEEKDAY_SHORT, formatDEShort, fromISO } from "@/lib/dates";
import type { LiveStaffingSnapshot, StaffingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const cellTone: Record<StaffingStatus, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg ring-1 ring-inset ring-warn-dot/30",
  critical: "bg-crit-bg text-crit-fg ring-1 ring-inset ring-crit-dot/40",
};

/** Wie CoverageStrip (Phase 1), aber gespeist mit echten Werten aus Supabase. */
export function LiveCoverageStrip({
  dates,
  snapshots,
  loading,
}: {
  dates: string[];
  snapshots: LiveStaffingSnapshot[] | null;
  loading: boolean;
}) {
  const shiftNames = [...new Set((snapshots ?? []).map((s) => s.shiftName ?? ""))].filter(
    Boolean,
  );

  return (
    <Card>
      <CardHeader
        title="Besetzungsband"
        hint="Die nächsten 14 Tage. Zahl = anwesende Mitarbeiter, darunter die Soll-Besetzung."
      />
      <CardBody className="overflow-x-auto px-0 py-0">
        {loading ? (
          <RowSkeleton rows={3} />
        ) : shiftNames.length === 0 ? (
          <EmptyState title="Keine Schichten mit Sollwert gefunden." />
        ) : (
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                  Schicht
                </th>
                {dates.map((iso) => (
                  <th key={iso} className="px-1 pb-2 pt-3 text-center">
                    <span className="block text-[11px] font-medium text-ink-faint">
                      {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]}
                    </span>
                    <span className="tnum block text-[11px] text-ink-muted">
                      {formatDEShort(iso)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shiftNames.map((name) => (
                <tr key={name}>
                  <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-5 py-2 text-left">
                    <span className="block text-[13px] font-medium">{name}</span>
                  </th>
                  {dates.map((iso) => {
                    const snap = (snapshots ?? []).find(
                      (s) => s.shiftName === name && s.date === iso,
                    );
                    if (!snap) {
                      return (
                        <td key={iso} className="px-1 py-1.5 text-center">
                          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-[11px] text-ink-faint">
                            –
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={iso} className="px-1 py-1.5 text-center">
                        <span
                          className={cn(
                            "tnum mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[13px] font-semibold leading-none",
                            cellTone[snap.status],
                          )}
                          title={`${name} am ${formatDEShort(iso)}: ${snap.present} von ${snap.target} (Mindestbesetzung ${snap.minimum})`}
                        >
                          {snap.present}
                          <span className="mt-0.5 text-[10px] font-normal opacity-70">
                            /{snap.target}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
