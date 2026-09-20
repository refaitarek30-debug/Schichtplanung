"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { DataError, fetchAbsences } from "@/lib/data/absences";
import { formatDE } from "@/lib/dates";
import type { LiveAbsence } from "@/lib/types";

/**
 * Kranktage als Liste, zu zusammenhängenden Zeiträumen gebündelt.
 *
 * Einzelne Tage untereinander sind bei einer längeren Krankheit unlesbar –
 * „14.–21. März, 8 Tage“ sagt dasselbe in einer Zeile.
 */
function buendeln(tage: LiveAbsence[]) {
  const sortiert = [...tage].sort((a, b) =>
    a.employeeId === b.employeeId
      ? a.date.localeCompare(b.date)
      : (a.employeeName ?? "").localeCompare(b.employeeName ?? ""),
  );

  const bloecke: { name: string; von: string; bis: string; tage: number }[] = [];

  for (const eintrag of sortiert) {
    const letzter = bloecke[bloecke.length - 1];
    const name = eintrag.employeeName ?? "";
    // Schliesst der Tag lückenlos an den vorigen derselben Person an?
    const folgetag =
      letzter &&
      letzter.name === name &&
      new Date(`${letzter.bis}T00:00:00Z`).getTime() + 86_400_000 ===
        new Date(`${eintrag.date}T00:00:00Z`).getTime();

    if (folgetag) {
      letzter.bis = eintrag.date;
      letzter.tage += 1;
    } else {
      bloecke.push({ name, von: eintrag.date, bis: eintrag.date, tage: 1 });
    }
  }

  return bloecke;
}

export function SickDayList({ jahr, fuehrung }: { jahr: number; fuehrung: boolean }) {
  const [tage, setTage] = useState<LiveAbsence[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const alle = await fetchAbsences(`${jahr}-01-01`, `${jahr}-12-31`);
      setTage(alle.filter((a) => a.type === "krank"));
    } catch (caught) {
      setTage([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [jahr]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const bloecke = tage ? buendeln(tage) : [];

  return (
    <Card>
      <CardHeader
        title={`Kranktage ${jahr}`}
        hint={tage === null ? undefined : `${tage.length} Tage in ${bloecke.length} Zeiträumen`}
      />
      {fehler ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{fehler}</Alert>
        </div>
      ) : null}
      <CardBody className="space-y-2 px-3 py-3">
        {tage === null ? (
          <RowSkeleton rows={4} />
        ) : bloecke.length === 0 ? (
          <EmptyState
            title={fuehrung ? "Keine Kranktage erfasst." : "Du hattest keine Kranktage."}
          />
        ) : (
          bloecke.map((b) => (
            <div
              key={`${b.name}-${b.von}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {fuehrung && b.name ? <span className="font-medium">{b.name} · </span> : null}
                <span className="tnum text-ink-muted">
                  {b.von === b.bis ? formatDE(b.von) : `${formatDE(b.von)} – ${formatDE(b.bis)}`}
                </span>
              </span>
              <span className="shrink-0 tnum text-[13px] text-ink-muted">
                {b.tage} {b.tage === 1 ? "Tag" : "Tage"}
              </span>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
