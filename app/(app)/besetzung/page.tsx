"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverageStrip } from "@/components/dashboard/coverage-strip";
import { LiveCoverageStrip } from "@/components/dashboard/live-coverage-strip";
import { AddAbsenceForm } from "@/components/leave/add-absence-form";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { addDays } from "@/lib/dates";
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
        description="Alle Schichten der nächsten zwei Wochen im Überblick."
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
        fetchStaffingRange(company.id, TODAY, 14),
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

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <LiveCoverageStrip
        dates={strip14}
        snapshots={range ? range.filter((s) => strip14.includes(s.date)) : null}
        loading={range === null}
      />

      <AddAbsenceForm employees={employees} onSaved={load} />
    </>
  );
}

function DemoStaffingSection() {
  return (
    <>
      <CoverageStrip from={TODAY} days={14} />
    </>
  );
}
