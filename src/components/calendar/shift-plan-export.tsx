"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { addDays } from "@/lib/dates";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { buildShiftPlanCsv, downloadCsv } from "@/lib/export/shift-plan-csv";
import { ROTATION_TEAMS } from "@/lib/qualifications";

/**
 * Jahresübersicht als Tabellendatei herunterladen.
 *
 * Ein ganzes Jahr sind 365 Spalten – `shift_plan_grid` erlaubt aus gutem
 * Grund höchstens 62 Tage je Aufruf (sonst würde die Datenbank bei vielen
 * Mitarbeitern zu lange rechnen). Deshalb wird das Jahr hier in Blöcken
 * geladen und anschließend zusammengesetzt.
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
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [team, setTeam] = useState<string>(ownTeam ?? "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportYear() {
    setBusy(true);
    setError(null);
    try {
      const from = `${year}-01-01`;
      const daysInYear =
        (new Date(year, 11, 31).getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1;

      const chunkSize = 60;
      const all = [];
      for (let offset = 0; offset < daysInYear; offset += chunkSize) {
        const chunkStart = addDays(from, offset);
        const chunkDays = Math.min(chunkSize, daysInYear - offset);
        all.push(...(await fetchShiftPlanGrid(companyId, chunkStart, chunkDays)));
      }

      const filtered = team === "all" ? all : all.filter((c) => c.rotationTeam === team);

      if (filtered.length === 0) {
        setError(
          team === "all"
            ? "Für dieses Jahr sind keine Schichtdaten hinterlegt."
            : `Für Schicht ${team} sind keine Mitarbeiter mit Rotationsmuster hinterlegt.`,
        );
        return;
      }

      const dates = [...new Set(filtered.map((c) => c.day))].sort();
      const title =
        team === "all"
          ? `Schichtplan ${year} – alle Schichten`
          : `Schichtplan ${year} – Schicht ${team}`;

      downloadCsv(
        `Schichtplan_${year}${team === "all" ? "" : `_Schicht-${team}`}.csv`,
        buildShiftPlanCsv({ title, dates, cells: filtered }),
      );
    } catch (caught) {
      setError(
        caught instanceof DataError
          ? caught.message
          : "Die Datei konnte nicht erstellt werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Jahresübersicht herunterladen"
        hint="Als Tabellendatei zum Öffnen in Excel – ein ganzes Jahr auf einen Blick."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
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

          <div className="flex items-end">
            <Button onClick={exportYear} disabled={busy} className="w-full">
              <Download className="h-4 w-4" />
              {busy ? "Wird erstellt …" : "Herunterladen"}
            </Button>
          </div>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <p className="text-[12px] leading-snug text-ink-faint">
          Die Datei enthält je Mitarbeiter eine Zeile und je Tag eine Spalte, dazu eine
          Legende. Sie lässt sich in Excel öffnen und frei weiterbearbeiten.
        </p>
      </CardBody>
    </Card>
  );
}
