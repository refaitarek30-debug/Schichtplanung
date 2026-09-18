"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { addDays, formatRange } from "@/lib/dates";
import { DataError, fetchMyShiftLeave } from "@/lib/data/leave";
import type { LiveShiftLeaveEntry } from "@/lib/types";

/**
 * Wer aus der eigenen Schicht wann fehlt – mit Namen. Für alle Rollen
 * gedacht (nicht nur Führung): jeder soll sehen, wer in seiner eigenen
 * Schicht schon frei hat, um selbst besser planen zu können.
 *
 * Ob dabei „Urlaub“ oder nur „Abwesend“ steht, entscheidet die betroffene
 * Person selbst unter Profil → Datenschutz. Die Entscheidung fällt in der
 * Datenbank (`my_shift_leave.reason_visible`), nicht hier – dieser Baustein
 * zeigt nur an, was der Server herausgibt. Ohne Freigabe kommt auch der
 * Status nicht mit: „offen“ oder „genehmigt“ würde sonst wieder verraten,
 * dass es um einen Urlaubsantrag geht.
 */
export function ShiftLeaveList({ from, days = 60 }: { from: string; days?: number }) {
  const [entries, setEntries] = useState<LiveShiftLeaveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await fetchMyShiftLeave(from, addDays(from, days)));
    } catch (caught) {
      setEntries([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [from, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader
        title="Abwesend in meiner Schicht"
        hint="Kolleginnen und Kollegen der eigenen Schicht bzw. Rotationsgruppe"
      />
      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <CardBody className="space-y-2 px-3 py-3">
        {entries === null ? (
          <RowSkeleton rows={3} />
        ) : entries.length === 0 ? (
          <EmptyState title="Aktuell fehlt niemand aus deiner Schicht." />
        ) : (
          entries.map((entry) => (
            <div
              key={`${entry.employeeId}-${entry.startDate}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {entry.isMe ? "Du" : entry.employeeName}
                <span className="tnum text-ink-faint">
                  {" "}
                  · {formatRange(entry.startDate, entry.endDate)}
                </span>
              </span>
              {entry.reasonVisible ? (
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[12px] text-ink-muted">Urlaub</span>
                  <Badge tone={leaveStatusTone[entry.status]}>
                    {leaveStatusLabel[entry.status]}
                  </Badge>
                </span>
              ) : (
                <Badge tone="neutral">Abwesend</Badge>
              )}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
