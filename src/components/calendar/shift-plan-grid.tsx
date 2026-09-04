"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { addDays, formatDE, fromISO, isWeekend, WEEKDAY_SHORT } from "@/lib/dates";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { assignShift } from "@/lib/auth/rotation-actions";
import { createAbsence } from "@/lib/auth/absence-actions";
import { fetchShiftOptions, type ShiftOption } from "@/lib/data/shifts";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Farben wie im gewohnten Plan: Früh orange, Spät hellgrün, Nacht blau. */
const cellStyles: Record<string, string> = {
  F: "bg-[#FBD7A6] text-[#7A4A05]",
  S: "bg-[#D7EFB0] text-[#3F5D12]",
  N: "bg-[#BBD9F7] text-[#123E68]",
  U: "bg-[#FCE96A] text-[#6B5900]",
  u: "bg-[#FCE96A]/50 text-[#6B5900] ring-1 ring-inset ring-[#C7A800]",
  K: "bg-[#F5A3A3] text-[#7A1010]",
  FB: "bg-[#D6C4F0] text-[#42227A]",
  A: "bg-surface-sunken text-ink-muted",
};

const legend = [
  { code: "F", label: "Frühschicht" },
  { code: "S", label: "Spätschicht" },
  { code: "N", label: "Nachtschicht" },
  { code: "U", label: "Urlaub" },
  { code: "u", label: "Urlaub beantragt" },
  { code: "K", label: "Krank" },
  { code: "FB", label: "Schulung" },
];

export function ShiftPlanGrid({
  companyId,
  from,
  days = 28,
  canEdit,
}: {
  companyId: string;
  from: string;
  days?: number;
  canEdit: boolean;
}) {
  const [start, setStart] = useState(from);
  const [cells, setCells] = useState<LiveShiftPlanCell[] | null>(null);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveShiftPlanCell | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [grid, shiftOptions] = await Promise.all([
        fetchShiftPlanGrid(companyId, start, days),
        fetchShiftOptions(),
      ]);
      setCells(grid);
      setShifts(shiftOptions);
    } catch (caught) {
      setCells([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [companyId, start, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const dates = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(start, i)),
    [start, days],
  );

  /** Zeilen nach Schichtgruppe gruppieren – wie die Blöcke A/B/C/D im Excel. */
  const groups = useMemo(() => {
    const byEmployee = new Map<
      string,
      { name: string; team: string | null; number: string | null; cells: Map<string, LiveShiftPlanCell> }
    >();
    for (const cell of cells ?? []) {
      if (!byEmployee.has(cell.employeeId)) {
        byEmployee.set(cell.employeeId, {
          name: cell.employeeName,
          team: cell.rotationTeam,
          number: cell.personnelNumber,
          cells: new Map(),
        });
      }
      byEmployee.get(cell.employeeId)!.cells.set(cell.day, cell);
    }

    const teams = new Map<string, { employeeId: string; name: string; number: string | null; cells: Map<string, LiveShiftPlanCell> }[]>();
    for (const [employeeId, value] of byEmployee) {
      const key = value.team ? `Schicht ${value.team}` : "Ohne Schichtgruppe";
      if (!teams.has(key)) teams.set(key, []);
      teams.get(key)!.push({ employeeId, name: value.name, number: value.number, cells: value.cells });
    }
    return [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cells]);

  function applyChange(action: "shift" | "absence" | "free", value: string) {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      let result;
      if (action === "shift") {
        const fd = new FormData();
        fd.set("employee_id", selected.employeeId);
        fd.set("shift_id", value);
        fd.set("date", selected.day);
        result = await assignShift({}, fd);
      } else if (action === "free") {
        const fd = new FormData();
        fd.set("employee_id", selected.employeeId);
        fd.set("shift_id", "");
        fd.set("date", selected.day);
        result = await assignShift({}, fd);
      } else {
        const fd = new FormData();
        fd.set("employee_id", selected.employeeId);
        fd.set("date", selected.day);
        fd.set("type", value);
        result = await createAbsence({}, fd);
      }
      if (result?.error) setError(result.error);
      setSelected(null);
      void load();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Schichtplan</h2>
          <p className="tnum text-[12px] text-ink-muted">
            {formatDE(start)} – {formatDE(addDays(start, days - 1))}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStart(addDays(start, -days))}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Vorheriger Zeitraum"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setStart(from)}
            className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-muted hover:bg-surface-muted"
          >
            Heute
          </button>
          <button
            onClick={() => setStart(addDays(start, days))}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Nächster Zeitraum"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {selected && canEdit ? (
        <div className="border-b border-line bg-surface-muted px-4 py-3">
          <p className="mb-2 text-[13px] font-medium">
            {selected.employeeName} · {formatDE(selected.day)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shifts.map((shift) => (
              <Button
                key={shift.id}
                variant="secondary"
                disabled={pending}
                onClick={() => applyChange("shift", shift.id)}
              >
                {shift.name}
              </Button>
            ))}
            <Button variant="secondary" disabled={pending} onClick={() => applyChange("free", "")}>
              Frei
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => applyChange("absence", "krank")}>
              Krank
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => applyChange("absence", "schulung")}
            >
              Schulung
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        {cells === null ? (
          <RowSkeleton rows={6} />
        ) : groups.length === 0 ? (
          <EmptyState title="Keine Mitarbeiter gefunden." />
        ) : (
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[180px] bg-surface px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                  Mitarbeiter
                </th>
                {dates.map((iso) => (
                  <th
                    key={iso}
                    className={cn(
                      "min-w-[42px] px-1 py-2 text-center",
                      isWeekend(iso) && "bg-surface-sunken/60",
                    )}
                  >
                    <span className="block text-[10px] font-medium text-ink-faint">
                      {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]}
                    </span>
                    <span className="tnum block text-[11px] text-ink-muted">
                      {iso.slice(8, 10)}.{iso.slice(5, 7)}.
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([teamName, members]) => (
                <Fragment key={teamName}>
                  <tr>
                    <th
                      colSpan={dates.length + 1}
                      className="sticky left-0 bg-brand-50 px-4 py-1.5 text-left text-[12px] font-semibold text-brand-700"
                    >
                      {teamName}
                    </th>
                  </tr>
                  {members.map((member) => (
                    <tr key={member.employeeId} className="hover:bg-surface-muted/50">
                      <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-1 text-left font-normal">
                        <span className="block truncate">{member.name}</span>
                        {member.number ? (
                          <span className="tnum block text-[10px] text-ink-faint">
                            {member.number}
                          </span>
                        ) : null}
                      </th>
                      {dates.map((iso) => {
                        const cell = member.cells.get(iso);
                        const code = cell?.absenceCode ?? cell?.shiftCode ?? null;
                        return (
                          <td key={iso} className="p-0.5 text-center">
                            <button
                              disabled={!canEdit || !cell}
                              onClick={() => cell && setSelected(cell)}
                              title={
                                cell
                                  ? `${member.name} · ${formatDE(iso)}${cell.shiftName ? ` · ${cell.shiftName}` : " · frei"}`
                                  : undefined
                              }
                              className={cn(
                                "flex h-8 w-full items-center justify-center rounded text-[12px] font-semibold",
                                code ? cellStyles[code] : "bg-surface-muted/40 text-ink-faint",
                                canEdit && cell && "hover:ring-2 hover:ring-brand-500",
                                isWeekend(iso) && !code && "bg-surface-sunken/60",
                              )}
                            >
                              {code ?? ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-[12px] text-ink-muted">
        {legend.map((item) => (
          <span key={item.code} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "flex h-5 w-6 items-center justify-center rounded text-[11px] font-semibold",
                cellStyles[item.code],
              )}
            >
              {item.code}
            </span>
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-5 w-6 items-center justify-center rounded bg-surface-muted/40" />
          frei
        </span>
      </div>
    </Card>
  );
}
