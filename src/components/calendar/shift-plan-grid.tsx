"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Backpack,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { addDays, formatDE, fromISO, isWeekend, monthName, WEEKDAY_SHORT } from "@/lib/dates";
import { DataError, fetchShiftPlanGrid, fetchBlockedDays } from "@/lib/data/rotation";
import { assignShift, setEmployeeOrder, setLeaveForDay } from "@/lib/auth/rotation-actions";
import { createAbsence } from "@/lib/auth/absence-actions";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { fetchSchoolHolidays } from "@/lib/data/holidays";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";
import { gemerkteAnsicht, istPlausiblesDatum, merkeAnsicht } from "@/lib/view-state";

/** Farben wie im gewohnten Plan: Früh orange, Spät hellgrün, Nacht blau. */
const cellStyles: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  u: "bg-shift-urlaub/50 text-shift-urlaub-ink ring-1 ring-inset ring-shift-urlaub-ink/40",
  V: "bg-shift-vtag text-shift-vtag-ink",
  v: "bg-shift-vtag/50 text-shift-vtag-ink ring-1 ring-inset ring-shift-vtag-ink/40",
  AF: "bg-shift-altersfrei text-shift-altersfrei-ink",
  af: "bg-shift-altersfrei/50 text-shift-altersfrei-ink ring-1 ring-inset ring-shift-altersfrei-ink/40",
  SU: "bg-shift-sonderurlaub text-shift-sonderurlaub-ink",
  su: "bg-shift-sonderurlaub/50 text-shift-sonderurlaub-ink ring-1 ring-inset ring-shift-sonderurlaub-ink/40",
  BU: "bg-shift-bildungsurlaub text-shift-bildungsurlaub-ink",
  bu: "bg-shift-bildungsurlaub/50 text-shift-bildungsurlaub-ink ring-1 ring-inset ring-shift-bildungsurlaub-ink/40",
  G: "bg-shift-gewerkschaft text-shift-gewerkschaft-ink",
  g: "bg-shift-gewerkschaft/50 text-shift-gewerkschaft-ink ring-1 ring-inset ring-shift-gewerkschaft-ink/40",
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
  "": "bg-surface-muted/40 ring-1 ring-inset ring-line",
};

/**
 * Kürzel, bei denen die Person an diesem Tag tatsächlich ausfällt.
 * Beantragt (kleines "u"/"v") zählt bewusst NICHT dazu – solange nichts
 * genehmigt ist, steht die Person im Plan und in der Besetzung.
 */
const ABSENT_CODES = new Set(["U", "V", "AF", "SU", "BU", "G", "K", "FB", "A"]);

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

/**
 * Tageskopf: "21.9." statt nur "21".
 *
 * Ohne Monat ist eine "1" am Monatsanfang nicht einzuordnen – gerade auf
 * dem Handy, wo der Zeitraum über der Tabelle beim Scrollen wegrutscht.
 * Die führende Null entfällt; das spart je Spalte eine Zeichenbreite und
 * liest sich genauso eindeutig.
 */
function dayHeader(iso: string): string {
  return `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
}

const legend = [
  { code: "F", label: "Frühschicht" },
  { code: "S", label: "Spätschicht" },
  { code: "N", label: "Nachtschicht" },
  { code: "U", label: "Urlaub" },
  { code: "V", label: "V-Tag" },
  { code: "AF", label: "Altersfreizeit" },
  { code: "SU", label: "Sonderurlaub" },
  { code: "BU", label: "Bildungsurlaub" },
  { code: "G", label: "Gewerkschaftstag" },
  { code: "K", label: "Krank" },
  { code: "FB", label: "Schulung" },
  // "A" steht heute für jede weitere Abwesenheit und zugleich für eine
  // Abwesenheit, deren Grund nicht freigegeben ist. Der Text sagt genau
  // das – "Altersfreizeit" wäre an dieser Stelle falsch, solange dasselbe
  // Zeichen auch den verdeckten Fall abdeckt.
  { code: "A", label: "Abwesend" },
  { code: "FREI", label: "frei laut Muster" },
  // Kein Eintrag: an dem Tag ist die Person nicht eingeplant. Stand vorher
  // ein zweites Mal als "frei" da und war dadurch von der Zeile darüber
  // nicht zu unterscheiden.
  { code: "", label: "nicht eingeplant" },
];

/** Eine Mitarbeiterzeile in der Matrix, Tag für Tag. */
interface GridEmployee {
  name: string;
  team: string | null;
  number: string | null;
  isMe: boolean;
  cells: Map<string, LiveShiftPlanCell>;
}

interface GridRow extends GridEmployee {
  employeeId: string;
}

export function ShiftPlanGrid({
  companyId,
  from,
  days = 30,
  canEdit,
}: {
  companyId: string;
  from: string;
  days?: number;
  canEdit: boolean;
}) {
  /**
   * Erster angezeigter Tag.
   *
   * Beim Öffnen gilt der zuletzt angesehene Zeitraum dieser Sitzung, sonst
   * `from`. Sonst springt die Ansicht bei jedem Bereichswechsel zurück auf
   * heute, und wer den März 2027 plant, muss sich jedes Mal neu
   * dorthinblättern.
   */
  const [start, setStart] = useState(from);

  useEffect(() => {
    const gemerkt = gemerkteAnsicht("schichtplan-start", istPlausiblesDatum);
    if (gemerkt) setStart(gemerkt);
    // Nur beim ersten Rendern: ein späteres Blättern soll sich nicht selbst
    // überschreiben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    merkeAnsicht("schichtplan-start", start);
  }, [start]);
  /**
   * Fensterbreite in Tagen – fest, nicht wählbar.
   *
   * Gemessen an der Röhm GmbH: 14 Tage kosten 27 ms, 30 Tage 49 ms, zwei
   * Monate 99 ms. Der Aufwand wächst linear mit Tagen mal Personen. 30 Tage
   * sind der Punkt, an dem ein voller Monat auf einmal zu sehen ist, ohne
   * dass der Abruf spürbar wird.
   *
   * Weiter schauen geht über die Pfeile oder die Monatsauswahl – der Plan
   * bleibt vollständig erreichbar, er kommt nur in Monatsschritten.
   */
  const span = days;
  const [cells, setCells] = useState<LiveShiftPlanCell[] | null>(null);
  const [shiftDetails, setShiftDetails] = useState<ShiftDetail[]>([]);
  const [blocked, setBlocked] = useState<Map<string, string>>(new Map());
  /** Ferientag → Name des Zeitraums, für die dezente Markierung im Kopf. */
  const [ferien, setFerien] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveShiftPlanCell | null>(null);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string> | null>(null);
  /**
   * Reihenfolge-Modus. Die Pfeile stehen nur dann in den Zeilen – sonst
   * verstellen sie bei fünfzig Mitarbeitern jede Namensspalte.
   */
  const [sortieren, setSortieren] = useState(false);
  /**
   * Von Hand gesetzte Reihenfolge je Gruppe, bis der Plan neu geladen ist.
   * Ohne das springt die Zeile nach einem Klick zurück, weil die Antwort
   * der Datenbank erst später kommt.
   */
  const [ordnung, setOrdnung] = useState<Record<string, string[]>>({});
  const [ordnungFehler, setOrdnungFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      // Die Schichtdetails liefern Name und Id gleich mit – eine zweite
      // Abfrage nur für die Auswahlliste braucht es nicht.
      const bis = addDays(start, span - 1);
      const [grid, details, blockedDays, ferienZeitraeume] = await Promise.all([
        fetchShiftPlanGrid(companyId, start, span),
        fetchShiftDetails(),
        fetchBlockedDays(start, bis),
        fetchSchoolHolidays(start, bis),
      ]);
      setCells(grid);
      setShiftDetails(details);
      setBlocked(blockedDays);

      // Zeiträume auf einzelne Tage aufziehen, damit der Tabellenkopf je
      // Spalte nachschlagen kann, statt für jeden Tag alle Zeiträume zu
      // durchsuchen.
      const tage = new Map<string, string>();
      for (const zeitraum of ferienZeitraeume) {
        for (let tag = zeitraum.startDate; tag <= zeitraum.endDate; tag = addDays(tag, 1)) {
          tage.set(tag, zeitraum.name);
        }
      }
      setFerien(tage);
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
          isMe: cell.isMe,
          cells: new Map(),
        });
      }
      byEmployee.get(cell.employeeId)!.cells.set(cell.day, cell);
    }

    const teams = new Map<string, GridRow[]>();
    for (const [employeeId, value] of byEmployee) {
      const key = value.team ? `Schicht ${value.team}` : "Tagschicht";
      if (!teams.has(key)) teams.set(key, []);
      teams.get(key)!.push({ employeeId, ...value });
    }
    // Wurde in dieser Sitzung von Hand sortiert, gilt das sofort – sonst
    // käme die Zeile erst nach dem nächsten Laden an ihrem Platz an.
    for (const [key, members] of teams) {
      const eigene = ordnung[key];
      if (!eigene) continue;
      members.sort((a, b) => {
        const ia = eigene.indexOf(a.employeeId);
        const ib = eigene.indexOf(b.employeeId);
        return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
      });
    }
    return [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cells, ordnung]);

  /**
   * Welche Schichtgruppen aufgeklappt sind. `null` heißt: noch nichts von Hand
   * umgestellt, dann gilt die Vorgabe.
   *
   * Die Führung plant den ganzen Betrieb und bekommt deshalb alle Gruppen
   * offen. Vorher stand auch für sie nur die eigene Gruppe offen – und wer
   * selbst nicht im Schichtdienst ist, hat keine. Seit die Schichtgruppe im
   * Plan nur noch für Schichtarbeiter ausgewiesen wird, fiel eine
   * Betriebsleiterin damit in die Gruppe „Tagschicht“, und A, B, C und D
   * standen alle zugeklappt da.
   *
   * Für Mitarbeiter bleibt es bei der eigenen Gruppe – mehr betrifft sie
   * nicht. Findet sich keine eigene, wird alles gezeigt: lieber zu viel
   * Plan als ein leerer Bildschirm.
   */
  const standardOffen = useMemo(() => {
    const alle = () => new Set(groups.map(([teamName]) => teamName));
    if (canEdit || groups.length <= 1) return alle();
    const eigene = groups.find(([, members]) => members.some((m) => m.isMe));
    return eigene ? new Set([eigene[0]]) : alle();
  }, [groups, canEdit]);

  const offeneGruppen = aufgeklappt ?? standardOffen;

  function toggleGruppe(teamName: string) {
    setAufgeklappt((bisher) => {
      const naechste = new Set(bisher ?? standardOffen);
      if (naechste.has(teamName)) naechste.delete(teamName);
      else naechste.add(teamName);
      return naechste;
    });
  }

  /**
   * Eine Zeile innerhalb ihrer Gruppe verschieben.
   *
   * Gespeichert wird immer die vollständige Gruppe in ihrer neuen
   * Reihenfolge; die Datenbank macht daraus die Plätze 1..n und prüft
   * dabei selbst, ob die aufrufende Person das darf.
   */
  function verschieben(teamName: string, members: GridRow[], index: number, richtung: -1 | 1) {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= members.length) return;

    const ids = members.map((m) => m.employeeId);
    [ids[index], ids[ziel]] = [ids[ziel], ids[index]];

    setOrdnung((bisher) => ({ ...bisher, [teamName]: ids }));
    setOrdnungFehler(null);
    startTransition(async () => {
      const result = await setEmployeeOrder(ids);
      if (result.error) setOrdnungFehler(result.error);
    });
  }

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
        // `date_from`/`date_to`, seit Abwesenheiten über Zeiträume gehen.
        // Hier ist es immer genau ein Tag – die angetippte Zelle.
        fd.set("date_from", selected.day);
        fd.set("date_to", selected.day);
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
          {/* Die Reihenfolge im Plan ist Sache der Schichtleitung: wer seine
              Mannschaft nach Anlage oder Arbeitsplatz sortiert sehen will,
              stellt sie hier um. Die Pfeile erscheinen nur in diesem Modus,
              sonst verstellen sie bei fünfzig Zeilen jede Namensspalte. */}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setSortieren((v) => !v)}
              aria-pressed={sortieren}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                sortieren
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-line bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <ListOrdered className="h-4 w-4" strokeWidth={2} />
              {sortieren ? "Fertig" : "Reihenfolge"}
            </button>
          ) : null}

          {/* Monat gezielt ansteuern statt sich in Wochenschritten dorthin
              zu klicken – bei Jahresplanung der schnellste Weg. */}
          <select
            value={`${viewYear}-${viewMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              // Nur der Startpunkt springt. Die Fensterbreite bleibt fest –
              // sonst lüde ein 31-Tage-Monat wieder 31 Tage.
              setStart(`${y}-${String(m + 1).padStart(2, "0")}-01`);
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
              onClick={() => setStart(from)}
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

      {ordnungFehler ? (
        <div className="px-4 pt-3">
          <Alert tone="error">{ordnungFehler}</Alert>
        </div>
      ) : null}

      {sortieren && canEdit ? (
        <div className="px-4 pt-3">
          <Alert tone="info">
            Mit den Pfeilen verschiebst du eine Person innerhalb ihrer Schichtgruppe.
            Die Reihenfolge gilt für alle im Unternehmen und wird sofort gespeichert.
          </Alert>
        </div>
      ) : null}

      {selected && canEdit ? (
        <div className="border-b border-line bg-surface-muted px-4 py-3">
          <p className="mb-2 text-[13px] font-medium">
            {selected.employeeName} · {formatDE(selected.day)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shiftDetails.map((shift) => (
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
                {/* Ohne Beschriftung: dass in der ersten Spalte die Namen
                    stehen, sieht man an den Namen. Auf dem Handy sind die
                    gesparten Zeichen eine halbe Spalte Plan mehr. */}
                <th
                  className="sticky left-0 z-20 min-w-[84px] bg-surface px-2 py-2 sm:min-w-[180px] sm:px-4"
                  aria-label="Mitarbeiter"
                />
                {dates.map((iso) => {
                  const blockReason = blocked.get(iso);
                  const ferienName = ferien.get(iso);
                  // Eine Urlaubssperre ist das stärkere Signal und sticht
                  // die Ferien -- die sind nur ein Hinweis und dürfen den
                  // Plan nicht überfärben.
                  const hinweis = blockReason
                    ? `Urlaubssperre: ${blockReason}`
                    : ferienName
                      ? `${ferienName} (Schulferien)`
                      : undefined;
                  return (
                    <th
                      key={iso}
                      title={hinweis}
                      className={cn(
                        "min-w-[30px] px-0.5 py-2 text-center sm:min-w-[42px] sm:px-1",
                        // Der Monatswechsel bekommt eine senkrechte Linie.
                        // Der Zeitraum über der Tabelle scrollt weg; die
                        // Linie bleibt stehen, wo der Monat umspringt.
                        iso.slice(8, 10) === "01" && "border-l-2 border-line",
                        isWeekend(iso) && "bg-surface-sunken/60",
                        ferienName && !blockReason && "bg-plan-bg/40",
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
                        <span className="sm:hidden">{dayHeader(iso)}</span>
                        <span className="hidden sm:inline">
                          {iso.slice(8, 10)}.{iso.slice(5, 7)}.
                        </span>
                      </span>
                      {blockReason ? (
                        <Lock className="mx-auto mt-0.5 h-3 w-3 text-crit-fg" />
                      ) : ferienName ? (
                        <Backpack className="mx-auto mt-0.5 h-3 w-3 text-plan-fg/70" />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map(([teamName, members]) => {
                const offen = offeneGruppen.has(teamName);
                return (
                <Fragment key={teamName}>
                  <tr>
                    <th
                      colSpan={dates.length + 1}
                      className="sticky left-0 bg-brand-50 p-0 text-left"
                    >
                      {/* Zusammenklappen: mit vier Gruppen passt sonst nichts
                          anderes mehr auf den Bildschirm. */}
                      <button
                        type="button"
                        onClick={() => toggleGruppe(teamName)}
                        aria-expanded={offen}
                        className="flex w-full items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-brand-700 hover:bg-brand-100"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform",
                            !offen && "-rotate-90",
                          )}
                        />
                        {teamName}
                        <span className="font-normal text-brand-700/70">
                          · {members.length}
                        </span>
                      </button>
                    </th>
                  </tr>
                  {offen && members.map((member, memberIndex) => (
                    <tr key={member.employeeId} className="hover:bg-surface-muted/50">
                      <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-1 text-left text-[12px] font-normal sm:px-4 sm:text-[13px]">
                        <span className="flex items-center gap-1.5">
                          {sortieren && canEdit ? (
                            <span className="flex shrink-0 flex-col">
                              <button
                                type="button"
                                onClick={() => verschieben(teamName, members, memberIndex, -1)}
                                disabled={memberIndex === 0 || pending}
                                aria-label={`${member.name} nach oben`}
                                className="rounded px-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink disabled:opacity-25"
                              >
                                <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => verschieben(teamName, members, memberIndex, 1)}
                                disabled={memberIndex === members.length - 1 || pending}
                                aria-label={`${member.name} nach unten`}
                                className="rounded px-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink disabled:opacity-25"
                              >
                                <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
                              </button>
                            </span>
                          ) : null}
                          <span className="min-w-0">
                            {/* Kurzform auf dem Handy: "T. Refai" statt "Tarek Refai". */}
                            <span className="block truncate sm:hidden">
                              {shortName(member.name)}
                            </span>
                            <span className="hidden truncate sm:block">{member.name}</span>
                            {member.number ? (
                              <span className="tnum hidden text-[10px] text-ink-faint sm:block">
                                {member.number}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </th>
                      {dates.map((iso) => {
                        const cell = member.cells.get(iso);
                        // Rangfolge: Abwesenheit > Schicht > (Zelle da, aber
                        // ohne Schicht = frei laut Muster). Kein cell = kein Tag.
                        const code = cell
                          ? (cell.absenceCode ?? cell.shiftCode ?? "FREI")
                          : null;
                        return (
                          <td
                            key={iso}
                            className={cn(
                              "p-px text-center sm:p-0.5",
                              // Dieselbe Linie wie im Kopf, damit der
                              // Monatswechsel durch die ganze Tabelle geht.
                              iso.slice(8, 10) === "01" && "border-l-2 border-line",
                            )}
                          >
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
                  {offen && (
                  <tr>
                    <th className="sticky left-0 z-10 whitespace-nowrap bg-surface-sunken px-2 py-1 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint sm:px-4 sm:text-[11px]">
                      Besetzung
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
                                  ? `${day.present} anwesend – Mindestbesetzung unterschritten`
                                  : `${day.present} anwesend`
                              }
                              className={cn(
                                "tnum flex h-6 w-full items-center justify-center rounded text-[10px] font-semibold sm:text-[12px]",
                                below ? "bg-crit-bg text-crit-fg" : "text-ink-muted",
                              )}
                            >
                              {day.present}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legende in festen Spalten statt als umbrechende Reihe: so stehen
          Kästchen und Text untereinander auf einer Linie, statt sich je
          nach Wortlänge zu verschieben. Drei Spalten passen auf jedes
          Handy, ohne dass ein Eintrag umbricht. */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 border-t border-line px-2 py-2 text-[10px] text-ink-faint sm:grid-cols-6 sm:gap-x-3 sm:px-4 sm:py-2.5 sm:text-[11px] sm:text-ink-muted">
        {legend.map((item) => (
          <span key={item.code || "leer"} className="flex min-w-0 items-center gap-1">
            <span
              className={cn(
                "flex h-3.5 w-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold sm:h-4 sm:w-5 sm:text-[10px]",
                cellStyles[item.code],
                legendExtra[item.code],
              )}
            >
              {cellLabel(item.code)}
            </span>
            <span className="truncate">{item.label}</span>
          </span>
        ))}
        {/* Spart acht Einträge: statt U/u, V/v, AF/af … einmal die Regel. */}
        <span className="col-span-3 pt-0.5 sm:col-span-6">
          Kleingeschrieben heißt beantragt, noch nicht genehmigt.
        </span>
      </div>
    </Card>
  );
}
