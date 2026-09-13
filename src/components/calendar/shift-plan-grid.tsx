"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { addDays, formatDE, fromISO, isWeekend, monthName, WEEKDAY_SHORT } from "@/lib/dates";
import { DataError, fetchShiftPlanGrid, fetchBlockedDays } from "@/lib/data/rotation";
import { assignShift, setLeaveForDay } from "@/lib/auth/rotation-actions";
import { createAbsence } from "@/lib/auth/absence-actions";
import {
  fetchShiftDetails,
  fetchShiftOptions,
  type ShiftDetail,
  type ShiftOption,
} from "@/lib/data/shifts";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Farben wie im gewohnten Plan: Früh orange, Spät hellgrün, Nacht blau. */
const cellStyles: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  u: "bg-shift-urlaub/50 text-shift-urlaub-ink ring-1 ring-inset ring-shift-urlaub-ink/40",
  V: "bg-shift-vtag text-shift-vtag-ink",
  v: "bg-shift-vtag/50 text-shift-vtag-ink ring-1 ring-inset ring-shift-vtag-ink/40",
  K: "bg-shift-krank text-shift-krank-ink",
  FB: "bg-shift-schulung text-shift-schulung-ink",
  A: "bg-surface-sunken text-ink-muted",
  // Freier Tag laut Rotationsmuster – bleibt weiß. Ein freier Tag ist nichts
  // Kritisches; die Farbe war irreführend und hat wie "Krank" ausgesehen.
  FREI: "bg-surface text-ink-faint",
};

/** In der Legende braucht Weiß eine Kontur, sonst ist das Feld unsichtbar. */
const legendExtra: Record<string, string> = {
  FREI: "ring-1 ring-inset ring-line",
};

/**
 * Kürzel, bei denen die Person an diesem Tag tatsächlich ausfällt.
 * Beantragt (kleines "u"/"v") zählt bewusst NICHT dazu – solange nichts
 * genehmigt ist, steht die Person im Plan und in der Besetzung.
 */
const ABSENT_CODES = new Set(["U", "V", "K", "FB", "A"]);

/** "Tarek Refai" -> "T. Refai". Spart auf dem Handy die halbe Namensspalte. */
function shortName(name: string): string {
  const teile = name.trim().split(/\s+/);
  if (teile.length < 2) return name;
  return `${teile[0]!.slice(0, 1)}. ${teile[teile.length - 1]}`;
}

/** Was im Kästchen steht. "frei" bekommt ein Haus statt Buchstabe. */
function cellLabel(code: string): string {
  return code === "FREI" ? "⌂" : code;
}

const legend = [
  { code: "F", label: "Frühschicht" },
  { code: "S", label: "Spätschicht" },
  { code: "N", label: "Nachtschicht" },
  { code: "U", label: "Urlaub" },
  { code: "u", label: "beantragt" },
  { code: "V", label: "V-Tag" },
  { code: "v", label: "V beantragt" },
  { code: "K", label: "Krank" },
  { code: "FB", label: "Schulung" },
  { code: "FREI", label: "frei" },
];

/** Eine Mitarbeiterzeile in der Matrix, Tag für Tag. */
interface GridEmployee {
  name: string;
  team: string | null;
  number: string | null;
  cells: Map<string, LiveShiftPlanCell>;
}

interface GridRow extends GridEmployee {
  employeeId: string;
}

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
  // Fensterbreite in Tagen. Rollend sind es die mitgegebenen Tage, bei
  // Monatsauswahl genau die Tage des Monats.
  const [span, setSpan] = useState(days);
  const [cells, setCells] = useState<LiveShiftPlanCell[] | null>(null);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [shiftDetails, setShiftDetails] = useState<ShiftDetail[]>([]);
  const [blocked, setBlocked] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveShiftPlanCell | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [grid, shiftOptions, details, blockedDays] = await Promise.all([
        fetchShiftPlanGrid(companyId, start, span),
        fetchShiftOptions(),
        fetchShiftDetails(),
        fetchBlockedDays(start, addDays(start, span - 1)),
      ]);
      setCells(grid);
      setShifts(shiftOptions);
      setShiftDetails(details);
      setBlocked(blockedDays);
    } catch (caught) {
      setCells([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [companyId, start, span]);

  useEffect(() => {
    void load();
  }, [load]);

  const dates = useMemo(
    () => Array.from({ length: span }, (_, i) => addDays(start, i)),
    [start, span],
  );

  /** Zeilen nach Schichtgruppe gruppieren – wie die Blöcke A/B/C/D im Excel. */
  const groups = useMemo(() => {
    const byEmployee = new Map<string, GridEmployee>();
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

    const teams = new Map<string, GridRow[]>();
    for (const [employeeId, value] of byEmployee) {
      const key = value.team ? `Schicht ${value.team}` : "Ohne Schichtgruppe";
      if (!teams.has(key)) teams.set(key, []);
      teams.get(key)!.push({ employeeId, ...value });
    }
    return [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cells]);

  /** Mindestbesetzung je Schicht, nachschlagbar über den Schichtnamen. */
  const minimumByShift = useMemo(() => {
    const map = new Map<string, number>();
    for (const detail of shiftDetails) map.set(detail.name, detail.minimumStaff);
    return map;
  }, [shiftDetails]);

  /**
   * Ist- und Mindestbesetzung je Schichtgruppe und Tag.
   *
   * Welche Schicht eine Gruppe an einem Tag fährt, steht nicht in einer
   * Spalte – im Rotationsbetrieb ergibt sie sich aus dem Muster. Deshalb wird
   * sie aus den Zellen der Gruppe abgeleitet (die Schicht, auf der die meisten
   * Mitglieder stehen). Gezählt werden nur Mitglieder genau dieser Schicht,
   * die nicht ausfallen. Gruppe hat frei = keine Mindestbesetzung.
   */
  const coverage = useMemo(() => {
    const result = new Map<string, Map<string, { present: number; minimum: number | null }>>();
    for (const [teamName, members] of groups) {
      const perDay = new Map<string, { present: number; minimum: number | null }>();
      for (const iso of dates) {
        const counts = new Map<string, number>();
        for (const member of members) {
          const shiftName = member.cells.get(iso)?.shiftName;
          if (shiftName) counts.set(shiftName, (counts.get(shiftName) ?? 0) + 1);
        }
        let dominant: string | null = null;
        let best = 0;
        for (const [shiftName, count] of counts) {
          if (count > best) {
            best = count;
            dominant = shiftName;
          }
        }
        if (!dominant) {
          perDay.set(iso, { present: 0, minimum: null });
          continue;
        }
        let present = 0;
        for (const member of members) {
          const cell = member.cells.get(iso);
          if (!cell || cell.shiftName !== dominant) continue;
          if (cell.absenceCode && ABSENT_CODES.has(cell.absenceCode)) continue;
          present += 1;
        }
        perDay.set(iso, { present, minimum: minimumByShift.get(dominant) ?? null });
      }
      result.set(teamName, perDay);
    }
    return result;
  }, [groups, dates, minimumByShift]);

  // Auswahlliste: das laufende Jahr und das kommende, dazu der Dezember
  // davor – mehr braucht die Planung im Betrieb nicht.
  const viewYear = fromISO(start).getFullYear();
  const viewMonth = fromISO(start).getMonth();
  const monthOptions = useMemo(() => {
    const base = fromISO(from).getFullYear();
    const list: { value: string; label: string }[] = [];
    for (let y = base - 1; y <= base + 1; y += 1) {
      for (let m = 0; m < 12; m += 1) {
        list.push({ value: `${y}-${m}`, label: `${monthName(m)} ${y}` });
      }
    }
    // Der angezeigte Monat muss in der Liste stehen, sonst springt das Feld
    // beim Blättern über den Rand auf einen falschen Eintrag.
    if (!list.some((o) => o.value === `${viewYear}-${viewMonth}`)) {
      list.push({
        value: `${viewYear}-${viewMonth}`,
        label: `${monthName(viewMonth)} ${viewYear}`,
      });
      list.sort((a, b) => a.value.localeCompare(b.value, "de", { numeric: true }));
    }
    return list;
  }, [from, viewYear, viewMonth]);

  function applyChange(
    action: "shift" | "absence" | "free" | "urlaub" | "v_tag" | "clear",
    value: string,
  ) {
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
      } else if (action === "urlaub" || action === "v_tag" || action === "clear") {
        // Sofort genehmigt – wird automatisch vom jeweiligen Konto abgezogen.
        // "clear" löst genau diesen einen Tag wieder heraus, ein mehrtägiger
        // Antrag drumherum bleibt bestehen.
        result = await setLeaveForDay(selected.employeeId, selected.day, action);
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
            {formatDE(start)} – {formatDE(addDays(start, span - 1))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Monat gezielt ansteuern statt sich in Wochenschritten dorthin
              zu klicken – bei Jahresplanung der schnellste Weg. */}
          <select
            value={`${viewYear}-${viewMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setStart(`${y}-${String(m + 1).padStart(2, "0")}-01`);
              setSpan(new Date(y, m + 1, 0).getDate());
            }}
            aria-label="Monat auswählen"
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px]"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setStart(addDays(start, -span))}
              className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
              aria-label="Vorheriger Zeitraum"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setStart(from);
                setSpan(days);
              }}
              className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-muted hover:bg-surface-muted"
            >
              Heute
            </button>
            <button
              onClick={() => setStart(addDays(start, span))}
              className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
              aria-label="Nächster Zeitraum"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => applyChange("urlaub", "")}
              className="bg-shift-urlaub text-shift-urlaub-ink hover:brightness-95"
            >
              Urlaub
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => applyChange("v_tag", "")}
              className="bg-shift-vtag text-shift-vtag-ink hover:brightness-95"
            >
              V-Tag
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
            {selected.absenceCode && "UuVv".includes(selected.absenceCode) ? (
              <Button variant="ghost" disabled={pending} onClick={() => applyChange("clear", "")}>
                Eintrag entfernen
              </Button>
            ) : null}
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
                <th className="sticky left-0 z-20 min-w-[84px] bg-surface px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint sm:min-w-[180px] sm:px-4">
                  <span className="sm:hidden">Name</span>
                  <span className="hidden sm:inline">Mitarbeiter</span>
                </th>
                {dates.map((iso) => {
                  const blockReason = blocked.get(iso);
                  return (
                    <th
                      key={iso}
                      title={blockReason ? `Urlaubssperre: ${blockReason}` : undefined}
                      className={cn(
                        "min-w-[24px] px-0.5 py-2 text-center sm:min-w-[42px] sm:px-1",
                        isWeekend(iso) && "bg-surface-sunken/60",
                        blockReason && "bg-crit-bg",
                      )}
                    >
                      <span className="block text-[10px] font-medium text-ink-faint">
                        {/* Auf dem Handy nur der Anfangsbuchstabe – sonst
                            passen keine zwei Wochen nebeneinander. */}
                        <span className="sm:hidden">
                          {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7].slice(0, 1)}
                        </span>
                        <span className="hidden sm:inline">
                          {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]}
                        </span>
                      </span>
                      <span className="tnum block text-[11px] text-ink-muted">
                        <span className="sm:hidden">{Number(iso.slice(8, 10))}</span>
                        <span className="hidden sm:inline">
                          {iso.slice(8, 10)}.{iso.slice(5, 7)}.
                        </span>
                      </span>
                      {blockReason ? (
                        <Lock className="mx-auto mt-0.5 h-3 w-3 text-crit-fg" />
                      ) : null}
                    </th>
                  );
                })}
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
                      <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-1 text-left text-[12px] font-normal sm:px-4 sm:text-[13px]">
                        {/* Kurzform auf dem Handy: "T. Refai" statt "Tarek Refai". */}
                        <span className="block truncate sm:hidden">{shortName(member.name)}</span>
                        <span className="hidden truncate sm:block">{member.name}</span>
                        {member.number ? (
                          <span className="tnum hidden text-[10px] text-ink-faint sm:block">
                            {member.number}
                          </span>
                        ) : null}
                      </th>
                      {dates.map((iso) => {
                        const cell = member.cells.get(iso);
                        // Rangfolge: Abwesenheit > Schicht > (Zelle da, aber
                        // ohne Schicht = frei laut Muster). Kein cell = kein Tag.
                        const code = cell
                          ? (cell.absenceCode ?? cell.shiftCode ?? "FREI")
                          : null;
                        return (
                          <td key={iso} className="p-px text-center sm:p-0.5">
                            <button
                              disabled={!canEdit || !cell}
                              onClick={() => cell && setSelected(cell)}
                              title={
                                cell
                                  ? `${member.name} · ${formatDE(iso)}${cell.shiftName ? ` · ${cell.shiftName}` : " · frei"}`
                                  : undefined
                              }
                              className={cn(
                                "flex h-7 w-full items-center justify-center rounded text-[11px] font-semibold sm:h-8 sm:text-[13px]",
                                code ? cellStyles[code] : "bg-surface-muted/40 text-ink-faint",
                                canEdit && cell && "hover:ring-2 hover:ring-brand-500",
                              )}
                            >
                              {code ? cellLabel(code) : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th className="sticky left-0 z-10 whitespace-nowrap bg-surface-sunken px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint sm:px-4 sm:text-[11px]">
                      <span className="sm:hidden">Ist/Min</span>
                      <span className="hidden sm:inline">Besetzung Ist/Min</span>
                    </th>
                    {dates.map((iso) => {
                      const day = coverage.get(teamName)?.get(iso);
                      const below =
                        day != null && day.minimum !== null && day.present < day.minimum;
                      return (
                        <td key={iso} className="bg-surface-sunken/60 p-px text-center sm:p-0.5">
                          {day == null || day.minimum === null ? (
                            <span className="text-[11px] text-ink-faint">–</span>
                          ) : (
                            <span
                              title={
                                below
                                  ? `Mindestbesetzung unterschritten: ${day.present} von ${day.minimum}`
                                  : `${day.present} von mindestens ${day.minimum}`
                              }
                              className={cn(
                                "tnum flex h-6 w-full items-center justify-center rounded text-[9px] font-semibold sm:text-[11px]",
                                below ? "bg-crit-bg text-crit-fg" : "text-ink-muted",
                              )}
                            >
                              {day.present}/{day.minimum}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legende: auf dem Handy bewusst klein und eng – sie soll erklären,
          nicht die halbe Ansicht belegen. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-2 py-1.5 text-[10px] text-ink-faint sm:gap-x-3 sm:gap-y-2 sm:px-4 sm:py-3 sm:text-[12px] sm:text-ink-muted">
        {legend.map((item) => (
          <span key={item.code} className="inline-flex items-center gap-1">
            <span
              className={cn(
                "flex h-3.5 w-4 items-center justify-center rounded-sm text-[9px] font-semibold sm:h-5 sm:w-6 sm:rounded sm:text-[11px]",
                cellStyles[item.code],
                legendExtra[item.code],
              )}
            >
              {cellLabel(item.code)}
            </span>
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="flex h-3.5 w-4 items-center justify-center rounded-sm bg-surface-muted/40 sm:h-5 sm:w-6 sm:rounded" />
          frei
        </span>
      </div>
    </Card>
  );
}
