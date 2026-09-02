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
 * Wer aus der eigenen Schicht wann Urlaub hat – mit Namen. Für alle
 * Rollen gedacht (nicht nur Führung): jeder soll sehen, wer in seiner
 * eigenen Schicht schon frei hat, um selbst besser planen zu können.
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
        title="Urlaub in meiner Schicht"
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
          <EmptyState title="Aktuell niemand aus deiner Schicht im Urlaub." />
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
              <Badge tone={leaveStatusTone[entry.status]}>{leaveStatusLabel[entry.status]}</Badge>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
