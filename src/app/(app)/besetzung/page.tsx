"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverageStrip } from "@/components/dashboard/coverage-strip";
import { LiveCoverageStrip } from "@/components/dashboard/live-coverage-strip";
import { AddAbsenceForm } from "@/components/leave/add-absence-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY, getEmployee, staffingContext } from "@/lib/demo-data";
import { addDays, formatDE, weekdayLong } from "@/lib/dates";
import { staffingForDay } from "@/lib/staffing";
import { getShift } from "@/lib/demo-data";
import { DataError, fetchStaffingRange } from "@/lib/data/staffing";
import { fetchEmployees } from "@/lib/data/employees";
import type { EmployeeRecord, LiveStaffingSnapshot } from "@/lib/types";

export default function StaffingPage() {
  const { mode } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Führung"
        title="Besetzung"
        description="Alle Schichten der nächsten Wochen. Engpässe stehen unten mit den betroffenen Personen."
      />
      {mode === "live" ? <LiveStaffingSection /> : <DemoStaffingSection />}
    </div>
  );
}

function LiveStaffingSection() {
  const { company } = useSession();
  const [range, setRange] = useState<LiveStaffingSnapshot[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rangeResult, employeesResult] = await Promise.all([
        fetchStaffingRange(company.id, TODAY, 28),
        fetchEmployees(),
      ]);
      setRange(rangeResult);
      setEmployees(employeesResult.filter((e) => e.active));
    } catch (caught) {
      setRange([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [company.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const strip14 = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i));
  const problems = (range ?? []).filter((s) => s.status !== "ok");

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <LiveCoverageStrip
        dates={strip14}
        snapshots={range ? range.filter((s) => strip14.includes(s.date)) : null}
        loading={range === null}
      />

      <Card>
        <CardHeader
          title="Engpässe in den nächsten vier Wochen"
          hint={
            range
              ? `${problems.filter((p) => p.status === "critical").length} Tage unter Mindestbesetzung`
              : "wird geladen …"
          }
        />
        <CardBody className="space-y-2">
          {range === null ? null : problems.length === 0 ? (
            <EmptyState title="Keine Engpässe. Alle Schichten erreichen die Soll-Besetzung." />
          ) : (
            problems.map((snap) => (
              <div
                key={`${snap.date}-${snap.shiftId}`}
                className="flex flex-col gap-2 rounded-xl border border-line px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {snap.shiftName} · {weekdayLong(snap.date).slice(0, 2)}, {formatDE(snap.date)}
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    {snap.absent} von {snap.planned} zugeordneten Mitarbeitern abwesend
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tnum text-sm font-semibold">
                    {snap.present} / {snap.target}
                  </span>
                  <Badge tone={snap.status === "warn" ? "warn" : "critical"}>
                    {snap.status === "warn"
                      ? "unter Soll"
                      : `unter Mindestbesetzung (${snap.minimum})`}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <AddAbsenceForm employees={employees} onSaved={load} />
    </>
  );
}

function DemoStaffingSection() {
  const horizon = Array.from({ length: 28 }, (_, i) => addDays(TODAY, i));
  const problems = horizon
    .flatMap((iso) => staffingForDay(iso, staffingContext))
    .filter((snapshot) => snapshot.status !== "ok");

  return (
    <>
      <CoverageStrip from={TODAY} days={14} />

      <Card>
        <CardHeader
          title="Engpässe in den nächsten vier Wochen"
          hint={`${problems.filter((p) => p.status === "critical").length} Tage unter Mindestbesetzung`}
        />
        <CardBody className="space-y-2">
          {problems.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              Keine Engpässe. Alle Schichten erreichen die Soll-Besetzung.
            </p>
          ) : (
            problems.map((snapshot) => {
              const shift = getShift(snapshot.shiftId);
              const names = snapshot.absentEmployeeIds
                .map((id) => getEmployee(id))
                .filter(Boolean)
                .map((person) => `${person!.firstName} ${person!.lastName}`);

              return (
                <div
                  key={`${snapshot.date}-${snapshot.shiftId}`}
                  className="flex flex-col gap-2 rounded-xl border border-line px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {shift?.name} · {weekdayLong(snapshot.date).slice(0, 2)},{" "}
                      {formatDE(snapshot.date)}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {names.length > 0 ? `Abwesend: ${names.join(", ")}` : "Keine Angaben"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tnum text-sm font-semibold">
                      {snapshot.present} / {snapshot.target}
                    </span>
                    <Badge tone={snapshot.status === "warn" ? "warn" : "critical"}>
                      {snapshot.status === "warn"
                        ? "unter Soll"
                        : `unter Mindestbesetzung (${snapshot.min})`}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </>
  );
}
