"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { CoverageStrip } from "@/components/dashboard/coverage-strip";
import { LiveCoverageStrip, type SchichtZeiten } from "@/components/dashboard/live-coverage-strip";
import { ReplacementDialog } from "@/components/staffing/replacement-dialog";
import { ShiftStaffingCards } from "@/components/staffing/shift-staffing-cards";
import { Alert } from "@/components/ui/alert";
import { Blatt } from "@/components/privat/blatt";
import { PageHeader } from "@/components/ui/page-header";
import { PlanReiter } from "@/components/layout/plan-reiter";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { addDays } from "@/lib/dates";
import { DataError, fetchStaffingRange } from "@/lib/data/staffing";
import { fetchShiftDetails } from "@/lib/data/shifts";
import type { LiveStaffingSnapshot } from "@/lib/types";

export default function StaffingPage() {
  const { mode } = useSession();
  /** Soll & Mindest je Schicht – hinter dem Zahnrad, damit oben das Band Platz hat. */
  const [einstellungen, setEinstellungen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Führung" title="Besetzung" />
      {/* Reiter links, Soll & Mindest rechts daneben (auf dem Handy darunter). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlanReiter />
        {mode === "live" ? (
          <button
            type="button"
            onClick={() => setEinstellungen(true)}
            data-besetzung-einstellungen
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink-muted hover:text-ink"
          >
            <Settings2 className="h-4 w-4" />
            Soll &amp; Mindest
          </button>
        ) : null}
      </div>
      {mode === "live" ? (
        <LiveStaffingSection einstellungen={einstellungen} onEinstellungenZu={() => setEinstellungen(false)} />
      ) : (
        <DemoStaffingSection />
      )}
    </div>
  );
}

function LiveStaffingSection({
  einstellungen,
  onEinstellungenZu,
}: {
  einstellungen: boolean;
  onEinstellungenZu: () => void;
}) {
  const { company, role } = useSession();
  const [range, setRange] = useState<LiveStaffingSnapshot[] | null>(null);
  const [zeiten, setZeiten] = useState<SchichtZeiten | undefined>(undefined);
  /** Angetippte Schicht an einem Tag → Vorschläge, wer einspringen kann. */
  const [gewaehlt, setGewaehlt] = useState<LiveStaffingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [band, details] = await Promise.all([
        fetchStaffingRange(company.id, TODAY, 14),
        // Nur für Reihenfolge und „schon vorbei“ – ohne Zeiten bleibt das Band wie bisher.
        fetchShiftDetails().catch(() => []),
      ]);
      setZeiten(
        details.length
          ? Object.fromEntries(details.map((d) => [d.id, { start: d.startTime, end: d.endTime }]))
          : undefined,
      );
      setRange(band);
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
        zeiten={zeiten}
        onWaehle={setGewaehlt}
      />

      {/* Vorschläge: wer an diesem Tag in diese Schicht einspringen kann –
          mit Grund für alle, die nicht in Frage kommen. Anfragen und
          Einplanen wie bisher in der Ersatzsuche. */}
      {gewaehlt ? (
        <ReplacementDialog
          date={gewaehlt.date}
          shiftId={gewaehlt.shiftId}
          shiftName={gewaehlt.shiftName ?? ""}
          qualificationId={null}
          qualificationLabel={null}
          ueberschrift={
            gewaehlt.status === "critical"
              ? "Besetzung nicht ausreichend"
              : gewaehlt.present < gewaehlt.target
                ? "Unter Soll"
                : "Mitarbeiter vorschlagen"
          }
          onClose={() => {
            setGewaehlt(null);
            void load();
          }}
        />
      ) : null}

      {/* Soll und Mindest je Schicht. Sie steuern jede Warnung auf dieser
          Seite und jede Urlaubsentscheidung. Die Schichtleitung darf sie
          ändern wie bisher – deshalb hier und nicht in der Verwaltung. */}
      {einstellungen ? (
        <Blatt
          titel="Soll & Mindest"
          unter="Je Schicht: wie viele sollen da sein, wie viele mindestens."
          onClose={() => {
            onEinstellungenZu();
            void load();
          }}
          wischZu="kopf"
        >
          <ShiftStaffingCards canEdit={role === "admin" || role === "shift_leader"} einspaltig />
        </Blatt>
      ) : null}
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
