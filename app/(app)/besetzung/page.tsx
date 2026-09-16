"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverageStrip } from "@/components/dashboard/coverage-strip";
import { LiveCoverageStrip } from "@/components/dashboard/live-coverage-strip";
import { CoverageGaps } from "@/components/staffing/coverage-gaps";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { addDays } from "@/lib/dates";
import { DataError, fetchStaffingRange } from "@/lib/data/staffing";
import type { LiveStaffingSnapshot } from "@/lib/types";

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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRange(await fetchStaffingRange(company.id, TODAY, 14));
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

      {/* Der Streifen oben zählt Köpfe. Diese Karte prüft, ob jede
          benötigte Funktion tatsächlich besetzt ist – eine Schicht kann
          vollzählig sein und trotzdem niemanden mit B-Schein haben. */}
      <CoverageGaps />
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
