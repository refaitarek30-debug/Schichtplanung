"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { addDays, monthName } from "@/lib/dates";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { buildShiftPlanCsv, downloadCsv } from "@/lib/export/shift-plan-csv";
import { ROTATION_TEAMS } from "@/lib/qualifications";

type Range = "month" | "year";

/** Tage im Monat, ohne Zeitzonen-Ärger. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Schichtplan als Tabellendatei herunterladen – wahlweise ein Monat oder
 * ein ganzes Jahr.
 *
 * Der Monat ist die Voreinstellung: 31 Spalten passen noch auf ein
 * Handydisplay und sind in einem Zug geladen. Ein Jahr hat 365 Spalten und
 * muss in Blöcken geholt werden, weil `shift_plan_grid` aus gutem Grund
 * höchstens 62 Tage je Aufruf liefert.
 */
export function ShiftPlanExport({
  companyId,
  ownTeam,
  canExportAllTeams,
}: {
  companyId: string;
  /** Schichtgruppe der angemeldeten Person – Vorauswahl für die Schichtleitung. */
  ownTeam: string | null;
  /** Admin darf alle Gruppen ziehen, Schichtleitung die eigene. */
  canExportAllTeams: boolean;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [range, setRange] = useState<Range>("month");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(now.getMonth());
  const [team, setTeam] = useState<string>(ownTeam ?? "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPlan() {
    setBusy(true);
    setError(null);
    try {
      const from = range === "month" ? `${year}-${pad(month + 1)}-01` : `${year}-01-01`;
      const total =
        range === "month"
          ? daysInMonth(year, month)
          : (new Date(year, 11, 31).getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1;

      // Höchstens 60 Tage je Abfrage – beim Monat ist das genau ein Aufruf.
      const chunkSize = 60;
      const all = [];
      for (let offset = 0; offset < total; offset += chunkSize) {
        all.push(
          ...(await fetchShiftPlanGrid(
            companyId,
            addDays(from, offset),
            Math.min(chunkSize, total - offset),
          )),
        );
      }

      const filtered = team === "all" ? all : all.filter((c) => c.rotationTeam === team);

      if (filtered.length === 0) {
        setError(
          team === "all"
            ? "Für diesen Zeitraum sind keine Schichtdaten hinterlegt."
            : `Für Schicht ${team} sind keine Mitarbeiter mit Rotationsmuster hinterlegt.`,
        );
        return;
      }

      const zeitraum = range === "month" ? `${monthName(month)} ${year}` : String(year);
      const gruppe = team === "all" ? "alle Schichten" : `Schicht ${team}`;
      const dateiname =
        range === "month"
          ? `Schichtplan_${year}-${pad(month + 1)}`
          : `Schichtplan_${year}`;

      await downloadCsv(
        `${dateiname}${team === "all" ? "" : `_Schicht-${team}`}.csv`,
        buildShiftPlanCsv({
          title: `Schichtplan ${zeitraum} – ${gruppe}`,
          dates: [...new Set(filtered.map((c) => c.day))].sort(),
          cells: filtered,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof DataError ? caught.message : "Die Datei konnte nicht erstellt werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  const teilen =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <Card>
      <CardHeader
        title="Plan herunterladen"
        hint="Als Tabellendatei für Excel – ein Monat oder das ganze Jahr."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Zeitraum">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="month">Ein Monat</option>
              <option value="year">Ganzes Jahr</option>
            </select>
          </Field>

          {range === "month" ? (
            <Field label="Monat">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {monthName(i)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Jahr">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Schichtgruppe">
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              {canExportAllTeams ? <option value="all">Alle Schichten</option> : null}
              {ROTATION_TEAMS.map((t) => (
                <option key={t} value={t}>
                  Schicht {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Button onClick={exportPlan} disabled={busy} className="w-full sm:w-auto">
          {teilen ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {busy ? "Wird erstellt …" : teilen ? "Erstellen und teilen" : "Herunterladen"}
        </Button>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <p className="text-[12px] leading-snug text-ink-faint">
          Je Mitarbeiter eine Zeile, je Tag eine Spalte, dazu eine Legende.
          {teilen
            ? " Auf dem Handy öffnet sich das Teilen-Menü – dort „In Dateien sichern“ wählen."
            : " Die Datei lässt sich in Excel öffnen und frei weiterbearbeiten."}
        </p>
      </CardBody>
    </Card>
  );
}
