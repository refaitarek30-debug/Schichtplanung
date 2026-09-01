"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { RotationEditor } from "@/components/leave/rotation-editor";
import { useSession } from "@/context/session";
import { employeesOfShift, shifts as demoShifts } from "@/lib/demo-data";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { fetchEmployees, DataError } from "@/lib/data/employees";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ShiftsPage() {
  const { mode, company } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title="Schichten"
        description="Schichtmodelle, Zeiten und Besetzungsvorgaben. Änderungen wirken sich sofort auf alle Prüfungen aus."
        action={
          <Button variant="secondary" disabled={mode === "demo"}>
            Schicht anlegen
          </Button>
        }
      />

      {mode === "live" ? <LiveShiftCards /> : <DemoShiftCards />}

      {mode === "live" ? <RotationEditor companyId={company.id} /> : null}
    </div>
  );
}

function LiveShiftCards() {
  const [details, setDetails] = useState<ShiftDetail[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detailResult, employeeResult] = await Promise.all([
        fetchShiftDetails(),
        fetchEmployees(),
      ]);
      setDetails(detailResult);
      setEmployees(employeeResult.filter((e) => e.active));
    } catch (caught) {
      setDetails([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (details === null) return <p className="text-sm text-ink-muted">wird geladen …</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {details.map((shift) => {
        const assigned = employees.filter((e) => e.shiftName === shift.name).length;
        return (
          <Card key={shift.id}>
            <CardHeader title={shift.name} hint={`${shift.startTime}–${shift.endTime} Uhr`} />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Zugeordnet" value={assigned} />
                <Metric label="Soll" value={shift.targetStaff} />
                <Metric label="Mindest" value={shift.minimumStaff} />
              </div>
              <WeekdayRow weekdays={shift.weekdays} />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function DemoShiftCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {demoShifts.map((shift) => {
        const people = employeesOfShift(shift.id);
        return (
          <Card key={shift.id}>
            <CardHeader title={shift.name} hint={`${shift.startTime}–${shift.endTime} Uhr`} />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Zugeordnet" value={people.length} />
                <Metric label="Soll" value={shift.targetHeadcount} />
                <Metric label="Mindest" value={shift.minHeadcount} />
              </div>
              <WeekdayRow weekdays={shift.weekdays} />
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function WeekdayRow({ weekdays }: { weekdays: number[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Gefahren an
      </p>
      <div className="flex gap-1.5">
        {WEEKDAY_SHORT.map((day, index) => {
          const weekday = (index + 1) % 7;
          const active = weekdays.includes(weekday);
          return (
            <span
              key={day}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-medium",
                active ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint",
              )}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-muted px-2 py-2.5">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="tnum mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}
