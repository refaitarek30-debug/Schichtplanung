"use client";

import Link from "next/link";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { addDays, formatDE, fromISO, isWeekend, WEEKDAY_SHORT } from "@/lib/dates";
import { DataError, fetchShiftPlanGrid, fetchBlockedDays } from "@/lib/data/rotation";
import { assignShift, setEmployeeOrder, setLeaveForDay } from "@/lib/auth/rotation-actions";
import { createAbsence } from "@/lib/auth/absence-actions";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { fetchHolidays, fetchSchoolHolidays } from "@/lib/data/holidays";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn, gruppenName } from "@/lib/utils";
import { gemerkteAnsicht, istPlausiblesDatum, merkeAnsicht } from "@/lib/view-state";
import { PlanLeaveRequest } from "./plan-leave-request";
import { useSession } from "@/context/session";
import { useAktualisierung } from "@/lib/live-refresh";
import { ausZwischenspeicher, inZwischenspeicher } from "@/lib/zwischenspeicher";
import { WischLeiste } from "@/components/ui/wisch-leiste";
import { fetchPlanKommentare, type PlanKommentar } from "@/lib/data/plan-comments";
import { addPlanKommentar, deletePlanKommentar } from "@/lib/auth/comment-actions";
import { nachSchichtfolge, schichtFarbe } from "@/lib/shift-style";
import { setzeAnzeige, useAnzeige } from "@/lib/anzeige";
import { ladeFarben } from "@/lib/data/kalender-eigene";
import { planZellStil } from "@/lib/kalender-farben";
import { PlanAnsichtWahl, PlanFarbenSchalter, WochenendeWahl } from "@/components/kalender/anzeige-wahl";
import { useBegriffe, useZeitausgleich } from "@/lib/begriffe";
import { scrolleUm } from "@/lib/app-scroller";

/** Was ein Abruf des Plans liefert – als Ganzes zwischengespeichert. */
interface PlanStand {
  grid: LiveShiftPlanCell[];
  details: ShiftDetail[];
  blocked: Map<string, string>;
  ferien: Map<string, string>;
  kommentare: PlanKommentar[];
}

/** Schlüssel einer Zelle für die Kommentare: Person und Tag. */
function zellSchluessel(employeeId: string, tag: string): string {
  return `${employeeId}|${tag}`;
}

/**
 * Monatsauswahl kurz: „Sept. 2026“ statt „September 2026“ – sonst passt die
 * Zeile mit dem Antragsknopf auf dem Handy nicht.
 */
function monatKurz(jahr: number, monat: number): string {
  return new Date(jahr, monat, 1).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

/**
 * Der Plan scrollt durchgehend: Das Fenster wächst von selbst, sobald man sich
 * dem Rand nähert. So gibt es kein Blättern in Zeiträumen mehr.
 *  - CHUNK: so viele Tage kommen auf einmal dazu,
 *  - RECHTS_TAGE / LINKS_TAGE: ab so wenigen Tagen bis zum Rand wird nachgeladen
 *    (links früher als rechts nötig – dort scrollt man selten),
 *  - MIN_MAX_TAGE: so viele Tage hält das Fenster höchstens; darüber hinaus
 *    wandert es mit (die Gegenseite fällt weg), damit der Plan leicht bleibt.
 */
const CHUNK = 30;
const RECHTS_TAGE = 14;
const LINKS_TAGE = 10;
const MIN_MAX_TAGE = 90;
/** So weit zurück und voraus lässt sich durchscrollen. */
const TAGE_ZURUECK = 400;
const TAGE_VORAUS = 800;

/** Ab so vielen Millisekunden Drücken gilt es als „lang gedrückt“. */
const LANG_DRUECKEN_MS = 500;

/** Farben wie im gewohnten Plan: Früh orange, Spät hellgrün, Nacht blau. */
const cellStyles: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  u: "bg-shift-urlaub/50 text-shift-urlaub-ink ring-1 ring-inset ring-shift-urlaub-ink/40",
  V: "bg-shift-vtag text-shift-vtag-ink",
  v: "bg-shift-vtag/50 text-shift-vtag-ink ring-1 ring-inset ring-shift-vtag-ink/40",
  // VJ (ab 2027): V-Tag aus der Jahresplanung – fest wie Urlaub, eigenes Grün.
  VJ: "bg-[#b6d7a8] text-[#274e13] dark:bg-[#38761d] dark:text-[#d9ead3]",
  vj: "bg-[#b6d7a8]/50 text-[#274e13] ring-1 ring-inset ring-[#274e13]/40 dark:text-[#d9ead3]",
  AF: "bg-shift-altersfrei text-shift-altersfrei-ink",
  // Beantragt: helles Grün mit dunkelgrüner Schrift. Die helle Schrift der
  // genehmigten Zelle wäre auf halb durchsichtigem Dunkelgrün kaum lesbar.
  af: "bg-shift-altersfrei/15 text-shift-altersfrei-offen ring-1 ring-inset ring-shift-altersfrei-offen/60",
  SU: "bg-shift-sonderurlaub text-shift-sonderurlaub-ink",
  su: "bg-shift-sonderurlaub/50 text-shift-sonderurlaub-ink ring-1 ring-inset ring-shift-sonderurlaub-ink/40",
  BU: "bg-shift-bildungsurlaub text-shift-bildungsurlaub-ink",
  bu: "bg-shift-bildungsurlaub/50 text-shift-bildungsurlaub-ink ring-1 ring-inset ring-shift-bildungsurlaub-ink/40",
  G: "bg-shift-gewerkschaft text-shift-gewerkschaft-ink",
  g: "bg-shift-gewerkschaft/50 text-shift-gewerkschaft-ink ring-1 ring-inset ring-shift-gewerkschaft-ink/40",
  K: "bg-shift-krank text-shift-krank-ink",
  FB: "bg-shift-schulung text-shift-schulung-ink",
  BS: "bg-[#e0e7ff] text-[#3730a3] dark:bg-[#312e81] dark:text-[#c7d2fe]",
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

/**
 * Beantragt, noch nicht genehmigt. Die Datenbank liefert dafür das Kürzel
 * kleingeschrieben (u, v, g, su, af, bu).
 */
const BEANTRAGT = new Set(["u", "v", "g", "su", "af", "bu"]);

/**
 * Was im Kästchen steht. "frei" bekommt ein Haus statt Buchstabe.
 *
 * Die zweibuchstabigen Kürzel stehen auch beantragt groß da: „su" oder
 * „af" war auf dem Handy nicht als Sonderurlaub bzw. Altersfreizeit zu
 * erkennen. Dass der Tag erst beantragt ist, zeigt die Zelle weiterhin am
 * hellen Hintergrund mit Rahmen. U, V und G bleiben beantragt klein, wie
 * man es gewohnt ist.
 */
function cellLabel(code: string): string {
  if (code === "FREI") return "⌂";
  if (code === "su" || code === "af" || code === "bu") return code.toUpperCase();
  return code;
}

/**
 * Tageskopf: "28.9." an jedem Tag – Tag und Monat, ohne führende Nullen,
 * damit es auch in den schmalen Spalten der Monatsansicht passt.
 */
function dayHeader(iso: string): string {
  return `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
}

/** Zwei Stücke desselben Plans aneinanderfügen (a vor b). */
function fuegeZusammen(a: PlanStand, b: PlanStand): PlanStand {
  return {
    grid: [...a.grid, ...b.grid],
    details: a.details.length ? a.details : b.details,
    blocked: new Map([...a.blocked, ...b.blocked]),
    ferien: new Map([...a.ferien, ...b.ferien]),
    kommentare: [...a.kommentare, ...b.kommentare],
  };
}

/** Nur die Tage von bis bis behalten – wenn das Fenster seine Höchstgröße hat. */
function kuerze(stand: PlanStand, von: string, bis: string): PlanStand {
  const drin = (tag: string) => tag >= von && tag <= bis;
  return {
    grid: stand.grid.filter((z) => drin(z.day)),
    details: stand.details,
    blocked: new Map([...stand.blocked].filter(([tag]) => drin(tag))),
    ferien: new Map([...stand.ferien].filter(([tag]) => drin(tag))),
    kommentare: stand.kommentare.filter((k) => drin(k.tag)),
  };
}

/**
 * Welche Tage gerade im Bild sind – aus der Scrollstellung gerechnet. Jeder
 * Baustein, der das zeigt, hat seinen eigenen kleinen Zustand: beim Scrollen
 * wird nur er neu gezeichnet, nicht die ganze Tabelle.
 */
function useSichtbar(box: RefObject<HTMLDivElement | null>, start: string, span: number, geladen: boolean) {
  const [von, setVon] = useState(start);
  const [anzahl, setAnzahl] = useState(Math.min(span, 14));
  useEffect(() => {
    const el = box.current;
    if (!el || !geladen) {
      setVon(start);
      return;
    }
    let bild = 0;
    const messen = () => {
      bild = 0;
      const name = el.querySelector<HTMLElement>("thead th");
      if (!name) return;
      const breite = (el.scrollWidth - name.offsetWidth) / span;
      if (!(breite > 0)) return;
      const index = Math.min(span - 1, Math.max(0, Math.floor(el.scrollLeft / breite + 0.001)));
      setVon(addDays(start, index));
      setAnzahl(Math.max(1, Math.floor((el.clientWidth - name.offsetWidth) / breite)));
    };
    const aufScrollen = () => {
      if (!bild) bild = requestAnimationFrame(messen);
    };
    el.addEventListener("scroll", aufScrollen, { passive: true });
    window.addEventListener("resize", aufScrollen);
    messen();
    return () => {
      el.removeEventListener("scroll", aufScrollen);
      window.removeEventListener("resize", aufScrollen);
      if (bild) cancelAnimationFrame(bild);
    };
  }, [box, start, span, geladen]);
  const bis = addDays(von, Math.max(0, Math.min(anzahl, span) - 1));
  return { von, bis };
}

/** „24.11. – 14.12.“ – der Zeitraum, der gerade im Bild ist. */
function SichtbarerZeitraum(props: { box: RefObject<HTMLDivElement | null>; start: string; span: number; geladen: boolean }) {
  const { von, bis } = useSichtbar(props.box, props.start, props.span, props.geladen);
  return <>{`${dayHeader(von)} – ${dayHeader(bis)}`}</>;
}

/** „Heute“ leuchtet, solange der heutige Tag im Bild ist. */
function HeuteKnopf(props: {
  box: RefObject<HTMLDivElement | null>;
  start: string;
  span: number;
  geladen: boolean;
  from: string;
  onClick: () => void;
}) {
  const { von, bis } = useSichtbar(props.box, props.start, props.span, props.geladen);
  const heuteDa = props.from >= von && props.from <= bis;
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-bold transition-colors",
        heuteDa ? "bg-brand-600 text-white shadow-card" : "border border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100",
      )}
    >
      Heute
    </button>
  );
}

/** Monat groß (zugleich die Monatsauswahl) – folgt dem, was im Bild steht. */
function MonatsKopf(props: {
  box: RefObject<HTMLDivElement | null>;
  start: string;
  span: number;
  geladen: boolean;
  from: string;
  onWahl: (iso: string) => void;
}) {
  const { von } = useSichtbar(props.box, props.start, props.span, props.geladen);
  // Der Monat wechselt etwas früher als die erste Spalte – wie in jedem Kalender.
  const massgeblich = fromISO(addDays(von, 3));
  const viewYear = massgeblich.getFullYear();
  const viewMonth = massgeblich.getMonth();
  // Auswahlliste: das laufende Jahr und das kommende. Vergangene Jahre stehen
  // nicht mehr darin; zurück geht es durch Scrollen.
  const monthOptions = useMemo(() => {
    const base = fromISO(props.from).getFullYear();
    const list: { value: string; label: string }[] = [];
    for (let y = base; y <= base + 1; y += 1) {
      for (let m = 0; m < 12; m += 1) {
        list.push({ value: `${y}-${m}`, label: monatKurz(y, m) });
      }
    }
    // Der angezeigte Monat muss in der Liste stehen, sonst springt das Feld
    // beim Scrollen über den Rand auf einen falschen Eintrag.
    if (!list.some((o) => o.value === `${viewYear}-${viewMonth}`)) {
      list.push({ value: `${viewYear}-${viewMonth}`, label: monatKurz(viewYear, viewMonth) });
      list.sort((a, b) => a.value.localeCompare(b.value, "de", { numeric: true }));
    }
    return list;
  }, [props.from, viewYear, viewMonth]);
  return (
    <label className="relative mr-auto flex min-w-0 cursor-pointer items-baseline gap-1.5">
      <span className="truncate text-[24px] font-bold leading-tight tracking-tight sm:text-[26px]">
        {new Date(viewYear, viewMonth, 1).toLocaleDateString("de-DE", { month: "long" })}
      </span>
      <span className="text-[17px] font-medium text-ink-muted">{viewYear}</span>
      <ChevronDown className="h-4 w-4 shrink-0 self-center text-ink-faint" strokeWidth={2.4} />
      {/* Monat gezielt ansteuern statt sich dorthin zu scrollen – bei
          Jahresplanung der schnellste Weg. Unsichtbar über dem Monatsnamen,
          damit das System-Auswahlfeld aufgeht. */}
      <select
        value={`${viewYear}-${viewMonth}`}
        onChange={(e) => {
          const [y, m] = e.target.value.split("-").map(Number);
          props.onWahl(`${y}-${String(m + 1).padStart(2, "0")}-01`);
        }}
        aria-label="Monat auswählen"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {monthOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Was die Führung direkt im Plan eintragen kann.
 *
 * Die Arten sind dieselben wie im Antrag (`leave_kind`) bzw. in der
 * Abwesenheitserfassung (`absence_type`) – hier entsteht kein zweiter
 * Statuswert. Die Farbe je Knopf ist dieselbe wie das Kürzel in der
 * Tabelle, damit man vor dem Tippen sieht, was danach in der Zelle steht.
 *
 * Auch hier gelten alle Regeln der Datenbank weiter: eine Altersfreizeit
 * ohne Festlegung oder ein Bildungsurlaub ohne Haken in der Verwaltung
 * werden abgewiesen, mit Meldung.
 */
const LEAVE_AKTIONEN = [
  "urlaub",
  "v_tag",
  "vj",
  "v",
  "altersfreizeit",
  "sonderurlaub",
  "bildungsurlaub",
  "gewerkschaftstag",
] as const;

type PlanAktion = "shift" | "absence" | "free" | "clear" | (typeof LEAVE_AKTIONEN)[number];

const leaveKnoepfe: { aktion: (typeof LEAVE_AKTIONEN)[number]; label: string; code: string }[] = [
  { aktion: "urlaub", label: "Urlaub", code: "U" },
  { aktion: "v_tag", label: "V-Tag", code: "V" },
  { aktion: "altersfreizeit", label: "Altersfreizeit", code: "AF" },
  { aktion: "sonderurlaub", label: "Sonderurlaub", code: "SU" },
  { aktion: "bildungsurlaub", label: "Bildungsurlaub", code: "BU" },
  { aktion: "gewerkschaftstag", label: "Gewerkschaftstag", code: "G" },
];

/** Kleine runde Schalter unter der Bedienleiste („Legende“, „Groß“ …). */
const chip =
  "inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-muted";
const chipAn = "border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100";

/** Einheitliche Knöpfe in der Bearbeitungsleiste – alle gleich hoch und breit. */
const bearbeitKnopf =
  "inline-flex min-h-[2.5rem] items-center justify-center gap-1 rounded-lg px-2 text-[13px] font-medium transition hover:brightness-95 disabled:opacity-50";

/** Ein beschrifteter Block in der Bearbeitungsleiste. */
function Abschnitt({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        {titel}
        {hinweis ? <span className="ml-1 font-normal normal-case tracking-normal">· {hinweis}</span> : null}
      </p>
      {children}
    </section>
  );
}

const legend = [
  { code: "F", label: "Frühschicht" },
  { code: "S", label: "Spätschicht" },
  { code: "N", label: "Nachtschicht" },
  { code: "U", label: "Urlaub" },
  { code: "V", label: "V-Tag (ab 2027: widerrufbar)" },
  { code: "VJ", label: "VJ-Tag – V-Tag aus der Jahresplanung, fest wie Urlaub (ab 2027)" },
  { code: "AF", label: "Altersfreizeit" },
  { code: "SU", label: "Sonderurlaub" },
  { code: "BU", label: "Bildungsurlaub" },
  { code: "G", label: "Gewerkschaftstag" },
  { code: "K", label: "Krank" },
  { code: "FB", label: "Schulung" },
  { code: "BS", label: "Berufsschule" },
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

/**
 * Feste Breite der Personalnummern-Spalte und der Versatz der Namensspalte
 * dahinter. Beide Spalten bleiben beim seitlichen Wischen stehen (sticky);
 * dafür muss der Versatz exakt der Breite der ersten Spalte entsprechen.
 * Bis sechs Ziffern passen ohne Kürzung, längere Nummern werden mit „…“
 * abgeschnitten und stehen vollständig im Tooltip.
 */

/** Eine Mitarbeiterzeile in der Matrix, Tag für Tag. */
interface GridEmployee {
  name: string;
  team: string | null;
  number: string | null;
  isMe: boolean;
  /** Azubi: steht im Plan, zählt aber nicht zur Besetzung. */
  isApprentice: boolean;
  /** Ohne Namen (Migration 0237): graue Zeile, nicht antippbar. */
  verborgen: boolean;
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
  employeeId = null,
  antragSchalter = true,
  nurLesen = false,
  merkName = "schichtplan-start",
  hilfe,
  randlos = false,
  antragLink,
}: {
  companyId: string;
  from: string;
  days?: number;
  canEdit: boolean;
  /** Eigener Personalstammsatz – ohne ihn gibt es keinen Antrag aus dem Plan. */
  employeeId?: string | null;
  /**
   * Schalter „Urlaub beantragen" für die Führung. Auf der Startseite aus –
   * dort führt der große Knopf über den Kacheln zum Antrag.
   */
  antragSchalter?: boolean;
  /**
   * Nur ansehen: keine Zelle antippbar, kein Antrag. So auf der Startseite –
   * zum Beantragen gibt es dort den großen Knopf darüber.
   */
  nurLesen?: boolean;
  /**
   * Unter diesem Namen merkt sich der Plan in der Sitzung, wo man zuletzt
   * war. Startseite und Bereich „Plan“ getrennt – Blättern auf der
   * Startseite verschiebt nicht den Plan.
   */
  merkName?: string;
  /**
   * Kleiner Knopf „Urlaub beantragen“ vorn in der Knopfleiste, der zu diesem
   * Ziel führt – für die Startseite „Kompakt“ statt des großen Knopfs.
   */
  antragLink?: string;
  /** Kurze Anleitung im Menü „Mehr“ (statt eines langen Texts über dem Plan). */
  hilfe?: string;
  /** Auf dem Handy von Rand zu Rand – jeder Pixel ist ein sichtbarer Tag mehr. */
  randlos?: boolean;
}) {
  const t = useBegriffe();
  const za = useZeitausgleich();
  /**
   * Erster angezeigter Tag.
   *
   * Beim Öffnen gilt der zuletzt angesehene Zeitraum dieser Sitzung, sonst
   * `from`. Sonst springt die Ansicht bei jedem Bereichswechsel zurück auf
   * heute, und wer den März 2027 plant, muss sich jedes Mal neu
   * dorthinblättern.
   */
  const [start, setStart] = useState(from);
  const merkSchluessel = merkName;

  useEffect(() => {
    const gemerkt = gemerkteAnsicht(merkSchluessel, istPlausiblesDatum);
    // Kommt man zum Beantragen (?antrag=1), soll der Plan nicht in einem
    // vergangenen Monat stehen – dort ist kein Tag mehr wählbar.
    let zumAntrag = false;
    try {
      zumAntrag = new URLSearchParams(window.location.search).get("antrag") === "1";
    } catch {
      // ohne lesbare Adresse wie gewohnt
    }
    if (gemerkt && !(zumAntrag && gemerkt < from)) {
      springen.current = true;
      setStart(gemerkt);
    }
    // Nur beim ersten Rendern: ein späteres Blättern soll sich nicht selbst
    // überschreiben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    merkeAnsicht(merkSchluessel, start);
  }, [merkSchluessel, start]);
  // Beim Verlassen: nicht den linken Rand des Fensters merken, sondern den Tag,
  // der im Bild stand.
  useEffect(
    () => () => {
      if (ersterSichtbar.current) merkeAnsicht(merkSchluessel, ersterSichtbar.current);
    },
    [merkSchluessel],
  );
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
  /**
   * Die Pfeile springen immer um genau die angezeigte Zahl an Tagen weiter
   * (30 Tage) – nicht erst zum nächsten Monatsersten. Die
   * Monatsauswahl setzt den Start auf den Ersten, ab dort gilt dasselbe.
   */
  const [tage, setTage] = useState(days);
  const span = tage;

  /** Der Rahmen, in dem der Plan seitlich scrollt. */
  const scrollBox = useRef<HTMLDivElement>(null);
  /** Am PC: kleines Schild am Mauszeiger mit Name und Tag. */
  const zeigerSchild = useRef<HTMLDivElement>(null);

  // Am PC: Das Mausrad schiebt den Plan zur Seite. Steht er am Rand, scrollt
  // wieder die Seite. Quer-Wischen am Trackpad macht der Browser selbst.
  useEffect(() => {
    const box = scrollBox.current;
    if (!box || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    const rad = (e: WheelEvent) => {
      if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = box.scrollWidth - box.clientWidth;
      if (max <= 1) return;
      const d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * box.clientWidth : e.deltaY;
      if ((d > 0 && box.scrollLeft >= max - 1) || (d < 0 && box.scrollLeft <= 0)) return;
      e.preventDefault();
      box.scrollLeft += d;
    };
    box.addEventListener("wheel", rad, { passive: false });
    return () => box.removeEventListener("wheel", rad);
  }, []);

  // Am PC: Fährt die Maus über den Plan, leuchten Tageskopf und Name auf, und
  // ein Schild nennt beides. Direkt im DOM – ohne den Plan neu zu zeichnen.
  useEffect(() => {
    const box = scrollBox.current;
    const schild = zeigerSchild.current;
    if (!box || !schild || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let kopf: Element | null = null;
    const weg = () => {
      kopf?.classList.remove("plan-spalte-hover");
      kopf = null;
      schild.hidden = true;
    };
    const bewegt = (e: MouseEvent) => {
      const zelle = (e.target as Element | null)?.closest?.("td[data-tag]");
      const zeile = zelle?.closest("tr[data-name]");
      if (!zelle || !zeile) return weg();
      const iso = zelle.getAttribute("data-tag")!;
      const neuerKopf = box.querySelector(`thead th[data-tag="${iso}"]`);
      if (neuerKopf !== kopf) {
        kopf?.classList.remove("plan-spalte-hover");
        neuerKopf?.classList.add("plan-spalte-hover");
        kopf = neuerKopf;
      }
      const tag = new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
      schild.textContent = `${zeile.getAttribute("data-name")} · ${tag}`;
      schild.style.left = `${Math.min(e.clientX + 14, window.innerWidth - schild.offsetWidth - 8)}px`;
      schild.style.top = `${e.clientY + 18}px`;
      schild.hidden = false;
    };
    box.addEventListener("mousemove", bewegt);
    box.addEventListener("mouseleave", weg);
    return () => {
      box.removeEventListener("mousemove", bewegt);
      box.removeEventListener("mouseleave", weg);
      weg();
    };
  }, []);

  const [mehrOffen, setMehrOffen] = useState(false);
  useEffect(() => {
    if (!mehrOffen) return;
    const taste = (e: KeyboardEvent) => e.key === "Escape" && setMehrOffen(false);
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [mehrOffen]);

  // Persönliche Anzeige: groß oder kompakt, eigene Farben (anzeige.ts).
  const anzeige = useAnzeige();
  const gross = anzeige.planAnsicht === "gross";
  const [eigeneFarben, setEigeneFarben] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!anzeige.planEigeneFarben) return;
    let aus = false;
    ladeFarben()
      .then((f) => !aus && setEigeneFarben(f))
      .catch(() => !aus && setEigeneFarben({}));
    return () => {
      aus = true;
    };
  }, [anzeige.planEigeneFarben]);
  /** Eigene Farbe einer Zelle – null heißt: Farbe des Plans. */
  const zellFarbe = useMemo(() => {
    const farben = anzeige.planEigeneFarben ? eigeneFarben : null;
    if (!farben) return null;
    const merk = new Map<string, React.CSSProperties | null>();
    return (code: string) => {
      if (!merk.has(code)) merk.set(code, planZellStil(code, farben));
      return merk.get(code) ?? null;
    };
  }, [anzeige.planEigeneFarben, eigeneFarben]);
  const [cells, setCells] = useState<LiveShiftPlanCell[] | null>(null);
  const [shiftDetails, setShiftDetails] = useState<ShiftDetail[]>([]);
  const [blocked, setBlocked] = useState<Map<string, string>>(new Map());
  /** Ferientag → Name des Zeitraums, für die dezente Markierung im Kopf. */
  const [ferien, setFerien] = useState<Map<string, string>>(new Map());
  /** Fehler beim Speichern einer Änderung aus der Bearbeitungsleiste. */
  const [error, setError] = useState<string | null>(null);
  /**
   * Fehler beim Laden – getrennt vom Speicherfehler: Bisher löschte das
   * Neuladen nach dem Speichern die Speichermeldung sofort wieder, sie war
   * nie zu sehen.
   */
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  /** Gesetzliche Feiertage: Tag → Name. Einmal geladen, sie ändern sich nicht. */
  const [feiertage, setFeiertage] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<LiveShiftPlanCell | null>(null);
  /** Kommentare im angezeigten Zeitraum. */
  const [kommentare, setKommentare] = useState<PlanKommentar[]>([]);
  /** Geöffnete Kommentarleiste: zu welcher Person an welchem Tag. */
  const [kommentarZelle, setKommentarZelle] = useState<
    { employeeId: string; name: string; tag: string } | null
  >(null);
  const [kommentarText, setKommentarText] = useState("");
  const [kommentarFehler, setKommentarFehler] = useState<string | null>(null);
  /** Kommentar beim Überfahren mit der Maus – schwebt unter der Zelle. */
  const [schwebe, setSchwebe] = useState<{ x: number; y: number; liste: PlanKommentar[] } | null>(
    null,
  );
  /**
   * Langes Drücken: Zeitgeber, Startpunkt und ob es ausgelöst hat. Hat es,
   * wird der folgende Klick verschluckt – sonst öffnete sich zusätzlich die
   * Bearbeitung oder ein Urlaubstag würde gewählt.
   */
  const druck = useRef<{ zeit: number; x: number; y: number; ausgeloest: boolean } | null>(null);
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

  /**
   * Urlaub direkt aus der eigenen Zeile beantragen.
   *
   * Mitarbeiter können das immer – ihre Zeile ist sonst nicht antippbar.
   * Die Führung tippt Zellen zum Bearbeiten an; für sie gibt es deshalb
   * einen Schalter, sonst wüsste der Plan nicht, ob ein Tipp auf die eigene
   * Zeile „bearbeiten" oder „beantragen" heißt.
   *
   * `?antrag=1` in der Adresse (Knopf auf der Startseite) schaltet ihn
   * gleich ein.
   */
  const [antragsModus, setAntragsModus] = useState(false);
  const [auswahl, setAuswahl] = useState<{ von: string; bis: string; fertig: boolean } | null>(
    null,
  );
  const [antragMeldung, setAntragMeldung] = useState<string | null>(null);
  // Eintragen erst nach einem Tipp auf „Urlaub beantragen" – für alle,
  // nicht nur für die Führung. So löst ein versehentlicher Tipp in die
  // eigene Zeile nichts aus.
  const antragAktiv = !nurLesen && Boolean(employeeId) && antragsModus;
  const [zurEigenenZeile, setZurEigenenZeile] = useState(false);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("antrag") === "1") {
        setAntragsModus(true);
        setZurEigenenZeile(true);
      }
    } catch {
      // Ohne lesbare Adresse bleibt es beim normalen Plan.
    }
  }, []);

  /** Tipp auf einen Tag der eigenen Zeile: erster Tipp Start, zweiter Ende. */
  function tippeTag(iso: string) {
    setAntragMeldung(null);
    // Liegt die eigene Zeile so tief, dass die Leiste unten sie verdeckt,
    // wandert sie nach oben – sonst trifft der zweite Tipp die Leiste.
    const zeile = document.getElementById("eigene-zeile");
    if (zeile && zeile.getBoundingClientRect().bottom > window.innerHeight - 200) {
      scrolleUm(zeile.getBoundingClientRect().top - window.innerHeight * 0.3);
    }
    setAuswahl((bisher) => {
      if (!bisher || bisher.fertig) return { von: iso, bis: iso, fertig: false };
      const [von, bis] = iso < bisher.von ? [iso, bisher.von] : [bisher.von, iso];
      return { von, bis, fertig: true };
    });
  }

  const { profile } = useSession();
  // Je Benutzer getrennt: die Führung sieht andere Zeilen als ein Mitarbeiter.
  const schluesselFuer = useCallback(
    (s: string, n: number = span) => `${profile.id}:plan:${companyId}:${s}:${n}`,
    [profile.id, companyId, span],
  );
  const speicherSchluessel = schluesselFuer(start);

  /**
   * Blättern ohne Ruckeln.
   *
   * Vorher baute jeder Wisch den Plan zweimal komplett auf: erst leer für
   * den neuen Zeitraum, dann noch einmal, wenn die Daten kamen – auf dem
   * Handy zwei Hänger von je 0,3–0,4 s mit einer leeren Tabelle dazwischen.
   * Jetzt
   *   * liegen der vorige und der nächste Zeitraum schon bereit (vorladen),
   *     Zeitraum und Daten wechseln in einem einzigen Aufbau,
   *   * läuft dieser Aufbau als Übergang: der alte Zeitraum bleibt stehen,
   *     bis der neue fertig ist, und der Finger hängt nicht fest,
   *   * fehlt ein Zeitraum doch einmal, steht kurz die leichte Ladeanzeige
   *     statt 1.260 leerer Kästchen,
   *   * wird nichts neu gezeichnet, wenn beim Auffrischen dasselbe kommt.
   */
  const [, startBlaettern] = useTransition();
  /** Fingerabdruck des angezeigten Stands – gleich = nicht neu zeichnen. */
  const angezeigt = useRef<string | null>(null);
  /** Der Stand, der gerade im Bild ist – die Grundlage fürs Anfügen neuer Stücke. */
  const aktuellerStand = useRef<PlanStand | null>(null);
  /** Aktuelles Fenster, damit eine langsame Antwort erkennt, ob sie noch passt. */
  const fenster = useRef({ start, tage: days });
  /** Hat die Person den Plan schon angefasst? Erst dann wächst er nach links. */
  const angefasst = useRef(false);
  /** Erster Tag im Bild – damit das Öffnen dort weitermacht, wo man war. */
  const ersterSichtbar = useRef<string | null>(null);
  /** Springen statt wachsen: nach einem Sprung steht der erste Tag links. */
  const springen = useRef(true);
  /** Zählt Sprünge – ein Wachsen, das noch unterwegs ist, wird dann verworfen. */
  const fensterNr = useRef(0);
  /** Fenster wächst gerade (nur eine Erweiterung zur Zeit). */
  const waechst = useRef(false);
  /** Spalte, die beim Wachsen an derselben Stelle im Bild bleiben soll. */
  const anker = useRef<{ iso: string; links: number } | null>(null);
  /** Schlüssel des Stands, der gerade frisch geholt wurde – kein zweiter Abruf nötig. */
  const frisch = useRef<string | null>(null);

  function zeige(stand: PlanStand) {
    aktuellerStand.current = stand;
    const abdruck = JSON.stringify([
      stand.grid,
      stand.details,
      [...stand.blocked],
      [...stand.ferien],
      stand.kommentare ?? [],
    ]);
    if (abdruck === angezeigt.current) return;
    angezeigt.current = abdruck;
    setCells(stand.grid);
    setShiftDetails(stand.details);
    setBlocked(stand.blocked);
    setFerien(stand.ferien);
    setKommentare(stand.kommentare ?? []);
  }

  /** Sanft zu einem Tag scrollen, der schon im Fenster liegt. */
  function scrolleZuTag(iso: string): boolean {
    const box = scrollBox.current;
    const th = box?.querySelector<HTMLElement>(`thead th[data-tag="${iso}"]`);
    const name = box?.querySelector<HTMLElement>("thead th");
    if (!box || !th || !name) return false;
    box.scrollTo({ left: Math.max(0, th.offsetLeft - name.offsetWidth), behavior: "smooth" });
    return true;
  }

  /** Pfeile: eine Bildschirmbreite weiter scrollen – der Plan wächst dabei von selbst. */
  function blaettere(richtung: 1 | -1) {
    const box = scrollBox.current;
    const name = box?.querySelector<HTMLElement>("thead th");
    if (!box || !name) return;
    const seite = Math.max(200, (box.clientWidth - name.offsetWidth) * 0.85);
    box.scrollBy({ left: richtung * seite, behavior: "smooth" });
  }

  /**
   * Zu einem Tag gehen: liegt er schon im Fenster, scrollt der Plan sanft
   * hin; sonst springt das Fenster dorthin (Monatswahl in ein fernes Jahr).
   */
  function geheZu(neu: string) {
    if (neu >= start && neu <= addDays(start, span - 1) && scrolleZuTag(neu)) return;
    fensterNr.current += 1;
    springen.current = true;
    setError(null);
    const gemerkt = ausZwischenspeicher<PlanStand>(schluesselFuer(neu, days));
    startBlaettern(() => {
      setStart(neu);
      setTage(days);
      if (gemerkt) {
        zeige(gemerkt);
      } else {
        angezeigt.current = null;
        setCells(null);
      }
    });
  }

  /**
   * Nummer des zuletzt gestellten Abrufs.
   *
   * Beim Öffnen laufen zwei Abrufe los: einer für heute und einer für den
   * gemerkten Monat. Kam die Antwort für heute ZULETZT an (auf dem Handy
   * über Mobilfunk gut möglich), standen die Zellen von heute unter dem
   * Kopf des gemerkten Monats – nichts passte, alle Zellen blieben leer und
   * nichts war antippbar. Nachgestellt mit einer um 2,5 s verzögerten
   * Antwort. Jetzt zählt nur die Antwort auf die zuletzt gestellte Frage.
   */
  const letzterAbruf = useRef(0);
  /** Die Karte selbst – zum mittigen Einblenden beim Urlaubsantrag. */
  const planRef = useRef<HTMLElement>(null);

  /**
   * Schichtdetails und Ferien des angezeigten Zeitraums. Sie ändern sich im
   * laufenden Betrieb nicht durch Kollegen – geholt werden sie beim Öffnen
   * und beim Blättern, nicht bei jeder Änderung im Plan.
   */
  const rahmen = useRef<{ schluessel: string; details: ShiftDetail[]; ferien: Map<string, string> } | null>(
    null,
  );

  /**
   * Plan laden. `nurDaten`: nur, was andere geändert haben können – Plan und
   * Urlaubssperren. So kostet eine Aktualisierung zwei Abfragen statt vier,
   * bei vielen gleichzeitig angemeldeten Mitarbeitern ein spürbarer
   * Unterschied für die Datenbank.
   */
  /** Alles, was ein Zeitraum braucht, in einem Rutsch holen. */
  const holeStand = useCallback(
    async (s: string, n: number, alterRahmen: typeof rahmen.current) => {
      const schluessel = schluesselFuer(s, n);
      const bis = addDays(s, n - 1);
      const rahmenDa = alterRahmen?.schluessel === schluessel;
      const [grid, blockedDays, neueKommentare, neuerRahmen] = await Promise.all([
        fetchShiftPlanGrid(companyId, s, n),
        fetchBlockedDays(s, bis),
        fetchPlanKommentare(s, bis),
        rahmenDa
          ? Promise.resolve(alterRahmen!)
          : (async () => {
              // Die Schichtdetails liefern Name und Id gleich mit – eine
              // zweite Abfrage nur für die Auswahlliste braucht es nicht.
              // Die Schichtdetails hängen nicht vom Fenster ab – beim Wachsen
              // bleiben sie, nur die Ferien des neuen Fensters kommen dazu.
              const [details, ferienZeitraeume] = await Promise.all([
                alterRahmen ? Promise.resolve(alterRahmen.details) : fetchShiftDetails(),
                fetchSchoolHolidays(s, bis),
              ]);
              // Zeiträume auf einzelne Tage aufziehen, damit der Tabellenkopf
              // je Spalte nachschlagen kann, statt für jeden Tag alle
              // Zeiträume zu durchsuchen.
              const tage = new Map<string, string>();
              for (const zeitraum of ferienZeitraeume) {
                for (let tag = zeitraum.startDate; tag <= zeitraum.endDate; tag = addDays(tag, 1)) {
                  tage.set(tag, zeitraum.name);
                }
              }
              return { schluessel, details, ferien: tage };
            })(),
      ]);
      const stand: PlanStand = {
        grid,
        details: neuerRahmen.details,
        blocked: blockedDays,
        ferien: neuerRahmen.ferien,
        kommentare: neueKommentare,
      };
      return { stand, rahmen: neuerRahmen };
    },
    [companyId, schluesselFuer],
  );

  /** Wie weit das Fenster höchstens reicht: so viele Tage, wie im Bild sind, plus Luft. */
  const maxTage = useCallback(() => {
    const box = scrollBox.current;
    const name = box?.querySelector<HTMLElement>("thead th");
    const spalte = box?.querySelector<HTMLElement>("thead th[data-tag]");
    if (!box || !name || !spalte || !spalte.offsetWidth) return MIN_MAX_TAGE;
    const imBild = Math.ceil((box.clientWidth - name.offsetWidth) / spalte.offsetWidth);
    return Math.max(MIN_MAX_TAGE, imBild + CHUNK + RECHTS_TAGE + LINKS_TAGE + CHUNK);
  }, []);

  /** Das Fenster nach einer Erweiterung – oder null, wenn es nicht weiter geht. */
  const naechstesFenster = useCallback(
    (seite: "rechts" | "links"): { start: string; tage: number } | null => {
      const grenze = maxTage();
      if (seite === "rechts") {
        let neuTage = span + CHUNK;
        let neuStart = start;
        if (neuTage > grenze) {
          neuStart = addDays(start, neuTage - grenze);
          neuTage = grenze;
        }
        if (addDays(neuStart, neuTage) > addDays(from, TAGE_VORAUS)) return null;
        return { start: neuStart, tage: neuTage };
      }
      if (start <= addDays(from, -TAGE_ZURUECK)) return null;
      return { start: addDays(start, -CHUNK), tage: Math.min(span + CHUNK, grenze) };
    },
    [maxTage, span, start, from],
  );

  /** Das nächste Stück rechts im Hintergrund holen, damit das Weiterscrollen nicht wartet. */
  const imVorladen = useRef(new Set<string>());
  const vorladen = useCallback(
    (stueckStart: string) => {
      const schluessel = schluesselFuer(stueckStart, CHUNK);
      if (ausZwischenspeicher<PlanStand>(schluessel) || imVorladen.current.has(schluessel)) return;
      if (document.visibilityState !== "visible") return;
      imVorladen.current.add(schluessel);
      holeStand(stueckStart, CHUNK, rahmen.current)
        .then(({ stand }) => inZwischenspeicher<PlanStand>(schluessel, stand))
        .catch(() => {
          // Vorladen ist Beiwerk – klappt es nicht, wird beim Wachsen geholt.
        })
        .finally(() => imVorladen.current.delete(schluessel));
    },
    [holeStand, schluesselFuer],
  );
  const vorladeUhr = useRef<number | undefined>(undefined);

  /**
   * Plan laden. `nurDaten`: nur, was andere geändert haben können – Plan und
   * Urlaubssperren. So kostet eine Aktualisierung zwei Abfragen statt vier,
   * bei vielen gleichzeitig angemeldeten Mitarbeitern ein spürbarer
   * Unterschied für die Datenbank.
   */
  const load = useCallback(async (nurDaten = false) => {
    // Gerade erst für dieses Fenster geholt (beim Wachsen): nicht gleich noch einmal.
    if (!nurDaten && frisch.current === speicherSchluessel) {
      frisch.current = null;
      window.clearTimeout(vorladeUhr.current);
      vorladeUhr.current = window.setTimeout(() => vorladen(addDays(start, span)), 600);
      return;
    }
    const meiner = ++letzterAbruf.current;
    setLadeFehler(null);
    // Schon einmal geladen? Dann sofort zeigen und im Hintergrund auffrischen.
    // Beim Zurückblättern oder Seitenwechsel steht der Plan damit ohne
    // Wartezeit da.
    const gemerkt = nurDaten ? null : ausZwischenspeicher<PlanStand>(speicherSchluessel);
    if (gemerkt) zeige(gemerkt);
    try {
      // Auf dem Handy reißt die Verbindung oft für einen Moment ab (WLAN-
      // Wechsel, Funkloch, App kurz im Hintergrund). Lesen ist gefahrlos
      // wiederholbar – also zweimal still nachfassen, bevor eine Meldung
      // erscheint.
      let versuch = 0;
      let ergebnis: Awaited<ReturnType<typeof holeStand>>;
      for (;;) {
        try {
          ergebnis = await holeStand(start, span, nurDaten ? rahmen.current : null);
          break;
        } catch (fehler) {
          if (versuch >= 2 || meiner !== letzterAbruf.current) throw fehler;
          await new Promise((weiter) => window.setTimeout(weiter, versuch === 0 ? 1_000 : 3_000));
          if (meiner !== letzterAbruf.current) return;
          versuch += 1;
        }
      }
      const { stand, rahmen: neuerRahmen } = ergebnis;
      // Inzwischen wurde weitergeblättert: diese Antwort ist überholt.
      if (meiner !== letzterAbruf.current) return;
      rahmen.current = neuerRahmen;
      zeige(stand);
      inZwischenspeicher<PlanStand>(speicherSchluessel, stand);
      if (!nurDaten) {
        // Kurz warten, damit das Vorladen nicht mit dem Aufbau der Tabelle
        // um die Leitung konkurriert.
        window.clearTimeout(vorladeUhr.current);
        // Nur nach rechts vorladen – dort scrollt man meistens hin – und nur,
        // wenn die Person den Plan schon bewegt hat. Nach links kommt er bei Bedarf.
        vorladeUhr.current = window.setTimeout(() => {
          if (angefasst.current) vorladen(addDays(start, span));
        }, 600);
      }
    } catch (caught) {
      if (meiner !== letzterAbruf.current) return;
      // Steht schon ein Stand da, bleibt er sichtbar – lieber der Plan von
      // vor einer Minute als ein leerer Bildschirm.
      if (gemerkt || nurDaten) {
        setLadeFehler("Der Plan konnte gerade nicht aufgefrischt werden – angezeigt wird der letzte Stand.");
        return;
      }
      angezeigt.current = null;
      setCells([]);
      setLadeFehler(
        caught instanceof DataError ? caught.message : "Der Schichtplan kann momentan nicht geladen werden. Bitte in einigen Minuten erneut versuchen.",
      );
    }
  }, [start, span, speicherSchluessel, holeStand, vorladen]);

  useEffect(() => () => window.clearTimeout(vorladeUhr.current), []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Steht eine Fehlermeldung, wird von selbst weiter versucht: sobald das
   * Netz zurück ist, die App wieder vorne liegt und sonst alle 20 Sekunden.
   * Vorher blieb die Meldung nach einem kurzen Funkloch stehen, bis jemand
   * die Seite wechselte – obwohl längst wieder alles ging.
   */
  useEffect(() => {
    if (!ladeFehler) return;
    const nochmal = () => {
      if (document.visibilityState === "visible") void load();
    };
    const uhr = window.setInterval(nochmal, 20_000);
    window.addEventListener("online", nochmal);
    window.addEventListener("focus", nochmal);
    document.addEventListener("visibilitychange", nochmal);
    return () => {
      window.clearInterval(uhr);
      window.removeEventListener("online", nochmal);
      window.removeEventListener("focus", nochmal);
      document.removeEventListener("visibilitychange", nochmal);
    };
  }, [ladeFehler, load]);

  useEffect(() => {
    let abgebrochen = false;
    fetchHolidays()
      .then((liste) => {
        if (!abgebrochen) setFeiertage(new Map(liste.map((h) => [h.date, h.name])));
      })
      .catch(() => {
        // Ohne Feiertage fehlt nur die Umrandung – der Plan geht trotzdem.
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  // Hat jemand anderes etwas geändert (Antrag, Genehmigung, Krankmeldung,
  // Schichttausch)? Dann neu laden – sonst nicht.
  // Nur die Daten, nicht Schichtdetails und Ferien.
  useAktualisierung(["plan", "antraege", "abwesenheiten"], () => void load(true));

  const dates = useMemo(
    () => Array.from({ length: span }, (_, i) => addDays(start, i)),
    [start, span],
  );

  /**
   * Nach einem Sprung (Heute, Monatswahl, Öffnen) steht der erste Tag ganz
   * links. Wächst das Fenster nach links, bleibt die Spalte im Bild, die vorher
   * schon dort stand – gemessen an ihrer Lage in der Tabelle, nicht am Bild,
   * damit ein Weiterscrollen währenddessen nichts verschiebt.
   */
  const geladen = cells !== null;
  // Vor dem Zeichnen, sonst blitzt kurz der falsche Ausschnitt auf.
  useLayoutEffect(() => {
    fenster.current = { start, tage: span };
    const box = scrollBox.current;
    if (!box) return;
    const a = anker.current;
    if (a) {
      anker.current = null;
      const th = box.querySelector<HTMLElement>(`thead th[data-tag="${a.iso}"]`);
      if (th) box.scrollLeft += th.offsetLeft - a.links;
      return;
    }
    if (springen.current && geladen) {
      springen.current = false;
      box.scrollLeft = 0;
    }
  }, [start, span, geladen]);

  /** Erste Spalte, die rechts neben dem Namen sichtbar ist. */
  const ersteSichtbare = useCallback((): { iso: string; links: number } | null => {
    const box = scrollBox.current;
    const name = box?.querySelector<HTMLElement>("thead th");
    if (!box || !name) return null;
    const rand = box.scrollLeft + name.offsetWidth + 1;
    for (const th of box.querySelectorAll<HTMLElement>("thead th[data-tag]")) {
      if (th.offsetLeft + th.offsetWidth > rand) return { iso: th.dataset.tag!, links: th.offsetLeft };
    }
    return null;
  }, []);

  /**
   * Fenster nach rechts oder links wachsen lassen: nur das neue Stück (30
   * Tage) wird geholt und angefügt. Der alte Ausschnitt bleibt stehen, bis es
   * da ist; dann kommen Spalten dazu, ohne dass sich das Bild bewegt. Hat das
   * Fenster seine Höchstgröße, wandert es mit – die Gegenseite fällt weg.
   */
  const waechse = useCallback(
    async (seite: "rechts" | "links") => {
      if (waechst.current) return;
      const ziel = naechstesFenster(seite);
      const alt = fenster.current;
      if (!ziel) return;
      const nr = fensterNr.current;
      waechst.current = true;
      try {
        const stueckStart = seite === "rechts" ? addDays(alt.start, alt.tage) : addDays(alt.start, -CHUNK);
        const stueckKey = schluesselFuer(stueckStart, CHUNK);
        let stueck = ausZwischenspeicher<PlanStand>(stueckKey);
        if (!stueck) {
          const r = await holeStand(stueckStart, CHUNK, rahmen.current);
          stueck = r.stand;
          inZwischenspeicher<PlanStand>(stueckKey, stueck);
        }
        // Inzwischen woandershin gesprungen oder neu geladen: das Stück passt nicht mehr.
        const jetzt = fenster.current;
        const basis = aktuellerStand.current;
        if (nr !== fensterNr.current || !basis || jetzt.start !== alt.start || jetzt.tage !== alt.tage) return;

        let neu = seite === "rechts" ? fuegeZusammen(basis, stueck) : fuegeZusammen(stueck, basis);
        const bis = addDays(ziel.start, ziel.tage - 1);
        // Höchstgröße: die Gegenseite wegnehmen.
        if (ziel.tage < alt.tage + CHUNK) neu = kuerze(neu, ziel.start, bis);
        const schluessel = schluesselFuer(ziel.start, ziel.tage);
        anker.current = ersteSichtbare();
        frisch.current = schluessel;
        rahmen.current = { schluessel, details: neu.details, ferien: neu.ferien };
        inZwischenspeicher<PlanStand>(schluessel, neu);
        const fertig = neu;
        startBlaettern(() => {
          setStart(ziel.start);
          setTage(ziel.tage);
          zeige(fertig);
        });
      } catch {
        // Wachsen ist Beiwerk: klappt es nicht, bleibt der Plan, wie er ist.
        // Beim nächsten Scrollen wird es noch einmal versucht.
      } finally {
        waechst.current = false;
      }
    },
    [naechstesFenster, schluesselFuer, holeStand, ersteSichtbare],
  );
  const waechseRef = useRef(waechse);
  useEffect(() => {
    waechseRef.current = waechse;
  });

  // Nähert sich der Plan dem Rand, wächst das Fenster – auch ohne Scrollen,
  // solange noch Platz im Bild ist (breiter Bildschirm).
  useEffect(() => {
    const box = scrollBox.current;
    if (!box || !geladen) return;
    let bild = 0;
    const pruefe = () => {
      bild = 0;
      const name = box.querySelector<HTMLElement>("thead th");
      const spalte = box.querySelector<HTMLElement>("thead th[data-tag]");
      if (!name || !spalte || !spalte.offsetWidth) return;
      const breite = spalte.offsetWidth;
      const links = box.scrollLeft / breite;
      const rechts = (box.scrollWidth - box.clientWidth - box.scrollLeft) / breite;
      const grenze = maxTage();
      // Für „Zuletzt angesehen“ beim nächsten Öffnen.
      const erste = ersteSichtbare();
      if (erste) ersterSichtbar.current = erste.iso;
      if (rechts < RECHTS_TAGE) {
        // An der Höchstgröße wandert das Fenster nur, wenn dabei links genug übrig bleibt.
        if (span < grenze || links > CHUNK + LINKS_TAGE) void waechseRef.current("rechts");
      } else if (links < LINKS_TAGE && angefasst.current) {
        if (span < grenze || rechts > CHUNK + RECHTS_TAGE) void waechseRef.current("links");
      }
    };
    const aufScrollen = () => {
      if (!bild) bild = requestAnimationFrame(pruefe);
    };
    // Erst wenn die Person den Plan anfasst, bekommt er auch links Luft – so
    // kostet das bloße Öffnen nur den einen Abruf wie früher.
    const angefasstMelden = () => {
      angefasst.current = true;
      aufScrollen();
    };
    box.addEventListener("scroll", angefasstMelden, { passive: true });
    box.addEventListener("pointerdown", angefasstMelden, { passive: true });
    box.addEventListener("touchstart", angefasstMelden, { passive: true });
    box.addEventListener("wheel", angefasstMelden, { passive: true });
    window.addEventListener("resize", aufScrollen);
    aufScrollen();
    return () => {
      box.removeEventListener("scroll", angefasstMelden);
      box.removeEventListener("pointerdown", angefasstMelden);
      box.removeEventListener("touchstart", angefasstMelden);
      box.removeEventListener("wheel", angefasstMelden);
      window.removeEventListener("resize", aufScrollen);
      if (bild) cancelAnimationFrame(bild);
    };
  }, [geladen, start, span, maxTage, ersteSichtbare]);

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
          isApprentice: cell.isApprentice,
          verborgen: cell.verborgen === true,
          cells: new Map(),
        });
      }
      const zeile = byEmployee.get(cell.employeeId)!;
      zeile.cells.set(cell.day, cell);
      // Zellen kommen in Tagesfolge: die letzte entscheidet über die Gruppe,
      // wie im 30-Tage-Fenster (Gruppenwechsel mitten im Fenster).
      zeile.team = cell.rotationTeam;
    }

    const teams = new Map<string, GridRow[]>();
    for (const [employeeId, value] of byEmployee) {
      const key = value.team ? gruppenName(value.team) : "Tagschicht";
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
    // Alle Schichtgruppen für alle: jeder darf den ganzen Plan ansehen.
    // Ansehen ist nicht Bearbeiten – geändert wird nur über die geprüften
    // Funktionen der Führung. Welche Gruppe offen steht, regelt
    // `standardOffen` weiter unten.
    return [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cells, ordnung]);

  /**
   * Welche Schichtgruppen aufgeklappt sind. `null` heißt: noch nichts von Hand
   * umgestellt, dann gilt die Vorgabe.
   *
   * Für alle – auch für Schichtleitung und Administration – ist nur die
   * eigene Gruppe aufgeklappt; die anderen stehen eingeklappt darunter und
   * lassen sich per Tipp öffnen. Das ist nur die Voreinstellung der Ansicht,
   * keine Sperre: Ansehen dürfen alle den ganzen Plan.
   * Findet sich keine eigene Gruppe (z. B. Führung ohne eigene Zeile), ist
   * alles offen: lieber zu viel Plan als ein leerer Bildschirm.
   */
  const standardOffen = useMemo(() => {
    const alle = () => new Set(groups.map(([teamName]) => teamName));
    if (groups.length <= 1) return alle();
    const eigene = groups.find(([, members]) => members.some((m) => m.isMe));
    return eigene ? new Set([eigene[0]]) : alle();
  }, [groups]);

  const offeneGruppen = aufgeklappt ?? standardOffen;

  /**
   * Spalten vor den Tagen: nur der Name. Die Personalnummer steht nicht im
   * Plan – auf dem Handy kostet jede Spalte sichtbare Tage. Sie steht bei
   * den Mitarbeiterdetails (AF-Stunden & V-Tage) neben Geburtsdatum und
   * V-Tagen.
   */
  const vorspalten = 1;

  // Kommt man über „Urlaub beantragen" von der Startseite, steht die eigene
  // Zeile sofort im Bild – bei fünfzig Zeilen sucht man sie sonst.
  useEffect(() => {
    if (!zurEigenenZeile || !cells || cells.length === 0 || groups.length === 0) return;
    // Nur die eigene Gruppe aufklappen: dann stehen Datumskopf und eigene
    // Zeile zusammen im Bild, statt dass die Zeile tief unten liegt und die
    // Tage oben aus dem Bild geschoben sind. Zuklappen lässt sich per Tipp.
    const eigene = groups.find(([, members]) => members.some((m) => m.isMe));
    if (eigene) setAufgeklappt(new Set([eigene[0]]));
    setZurEigenenZeile(false);
    // Erst nach dem Zuklappen messen – sonst stimmen die Abstände nicht.
    window.setTimeout(() => {
      planRef.current?.scrollIntoView({ block: "start" });
      const zeile = document.getElementById("eigene-zeile");
      const rect = zeile?.getBoundingClientRect();
      if (rect && rect.bottom > window.innerHeight * 0.85) {
        scrolleUm(rect.top - window.innerHeight * 0.4);
      }
    }, 80);
  }, [zurEigenenZeile, cells, groups]);


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
   * Welche Schicht fährt eine Schichtgruppe an einem Tag?
   *
   * Im Rotationsbetrieb steht das in keiner Spalte, es ergibt sich aus dem
   * Muster. Deshalb wird es aus den Zellen der Gruppe abgeleitet: die
   * Schicht, auf der die meisten Mitglieder stehen. Ein einzelner
   * Schichtwechsel ändert daran nichts.
   */
  const gruppenSchicht = useMemo(() => {
    const result = new Map<string, Map<string, string>>();
    for (const [teamName, members] of groups) {
      const perDay = new Map<string, string>();
      for (const iso of dates) {
        const counts = new Map<string, number>();
        for (const member of members) {
          // Azubis zählen nicht zur Besetzung – auch nicht bei der Frage,
          // welche Schicht die Gruppe an dem Tag fährt.
          if (member.isApprentice) continue;
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
        if (dominant) perDay.set(iso, dominant);
      }
      result.set(teamName, perDay);
    }
    return result;
  }, [groups, dates]);

  /**
   * Ist- und Mindestbesetzung je Schichtgruppe und Tag.
   *
   * Gezählt wird, wer an dem Tag tatsächlich in der Schicht der Gruppe steht
   * und nicht ausfällt – aus allen Gruppen. Wer per Schichtwechsel von A in
   * die Schicht von B gesetzt ist, zählt an dem Tag bei B und nicht mehr bei
   * A. So rechnet auch die Datenbank (je Schicht). Gruppe hat frei = keine
   * Mindestbesetzung.
   */
  const coverage = useMemo(() => {
    const result = new Map<string, Map<string, { present: number; minimum: number | null }>>();
    const alle = groups.flatMap(([, members]) => members);
    for (const [teamName] of groups) {
      const perDay = new Map<string, { present: number; minimum: number | null }>();
      for (const iso of dates) {
        const dominant = gruppenSchicht.get(teamName)?.get(iso) ?? null;
        if (!dominant) {
          perDay.set(iso, { present: 0, minimum: null });
          continue;
        }
        let present = 0;
        for (const member of alle) {
          if (member.isApprentice) continue;
          const cell = member.cells.get(iso);
          if (!cell || cell.shiftName !== dominant) continue;
          if (cell.absenceCode && ABSENT_CODES.has(cell.absenceCode)) continue;
          present += 1;
        }
        // Tagschicht (oder Schicht ohne Mindestbesetzung): keine Besetzung –
        // wer dort steht, hat einen anderen Grund (Stillstand, Projekte …).
        const minimum = minimumByShift.get(dominant) ?? null;
        const detail = shiftDetails.find((d) => d.name === dominant);
        const ohneBesetzung = !minimum || detail?.shortName === "T" || /^tag/i.test(dominant);
        perDay.set(iso, { present, minimum: ohneBesetzung ? null : minimum });
      }
      result.set(teamName, perDay);
    }
    return result;
  }, [groups, dates, gruppenSchicht, minimumByShift, shiftDetails]);

  /**
   * Gruppenwechsel für die angetippte Zelle: in welche Schicht käme die
   * Person, wenn sie an dem Tag mit Gruppe B, C oder D arbeitet? Angeboten
   * werden nur Gruppen, die an dem Tag fahren, und nicht die eigene.
   */
  const gruppenWechsel = useMemo(() => {
    if (!selected) return [];
    const eigene = selected.rotationTeam ? gruppenName(selected.rotationTeam) : null;
    const ziele: { team: string; shiftId: string; shiftName: string; shortName: string }[] = [];
    for (const [teamName] of groups) {
      if (!teamName.startsWith("Schicht ") || teamName === eigene) continue;
      const schicht = gruppenSchicht.get(teamName)?.get(selected.day);
      const detail = schicht ? shiftDetails.find((d) => d.name === schicht) : undefined;
      if (detail) {
        ziele.push({
          team: teamName.slice(8),
          shiftId: detail.id,
          shiftName: detail.name,
          shortName: detail.shortName,
        });
      }
    }
    return ziele;
  }, [selected, groups, gruppenSchicht, shiftDetails]);

  function applyChange(action: PlanAktion, value: string) {
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
      } else if (action !== "absence") {
        // Sofort genehmigt – wird automatisch vom jeweiligen Konto bzw.
        // Kontingent abgezogen. "clear" löst genau diesen einen Tag wieder
        // heraus, ein mehrtägiger Antrag drumherum bleibt bestehen.
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
      void load(true);
    });
  }

  /** Kommentare je Zelle (Person und Tag), älteste zuerst. */
  const kommentareJeZelle = useMemo(() => {
    const map = new Map<string, PlanKommentar[]>();
    for (const k of kommentare) {
      const key = zellSchluessel(k.employeeId, k.tag);
      const liste = map.get(key);
      if (liste) liste.push(k);
      else map.set(key, [k]);
    }
    return map;
  }, [kommentare]);

  function oeffneKommentare(employeeId: string, name: string, tag: string) {
    setSelected(null);
    setSchwebe(null);
    setKommentarFehler(null);
    setKommentarText("");
    setKommentarZelle({ employeeId, name, tag });
  }

  function speichereKommentar() {
    if (!kommentarZelle) return;
    const text = kommentarText.trim();
    if (!text) {
      setKommentarFehler("Bitte einen Text eingeben.");
      return;
    }
    setKommentarFehler(null);
    startTransition(async () => {
      const result = await addPlanKommentar(kommentarZelle.employeeId, kommentarZelle.tag, text);
      if (result.error) {
        setKommentarFehler(result.error);
        return;
      }
      setKommentarText("");
      setKommentare(await fetchPlanKommentare(start, addDays(start, span - 1)));
    });
  }

  function loescheKommentar(id: string) {
    setKommentarFehler(null);
    startTransition(async () => {
      const result = await deletePlanKommentar(id);
      if (result.error) {
        setKommentarFehler(result.error);
        return;
      }
      setKommentare((bisher) => bisher.filter((k) => k.id !== id));
    });
  }

  /**
   * Langes Drücken auf eine Zelle öffnet die Kommentare – für alle, auch
   * dort, wo ein kurzer Tipp nichts tut. Wer dabei den Finger bewegt
   * (wischen, scrollen), löst nichts aus.
   */
  function druckBeginn(e: React.PointerEvent, employeeId: string, name: string, tag: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    druckEnde();
    const zeit = window.setTimeout(() => {
      if (druck.current) druck.current.ausgeloest = true;
      navigator.vibrate?.(15);
      oeffneKommentare(employeeId, name, tag);
    }, LANG_DRUECKEN_MS);
    druck.current = { zeit, x: e.clientX, y: e.clientY, ausgeloest: false };
  }
  function druckBewegung(e: React.PointerEvent) {
    const d = druck.current;
    if (!d || d.ausgeloest) return;
    if (Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8) {
      window.clearTimeout(d.zeit);
      druck.current = null;
    }
  }
  function druckEnde() {
    const d = druck.current;
    if (d && !d.ausgeloest) {
      window.clearTimeout(d.zeit);
      druck.current = null;
    }
  }
  /** Nach langem Drücken den anschließenden Klick verschlucken. */
  function klickNachDruck(): boolean {
    const d = druck.current;
    if (d?.ausgeloest) {
      druck.current = null;
      return true;
    }
    return false;
  }

  /**
   * Bedienfunktionen der Kästchen, einmal gebündelt. Das Bündel selbst bleibt
   * über alle Aufbauten dasselbe; es ruft immer die aktuelle Fassung auf.
   * So muss eine Zeile nur neu gezeichnet werden, wenn sich ihre Daten
   * ändern – nicht bei jedem Antippen irgendwo im Plan.
   */
  const aktuelleAktionen = useRef<ZeilenAktionen | null>(null);
  useLayoutEffect(() => {
    aktuelleAktionen.current = {
      druckBeginn,
      druckBewegung,
      druckEnde,
      klickNachDruck,
      mausRaus: (e) => {
        druckEnde();
        if (e.pointerType === "mouse") setSchwebe(null);
      },
      schwebe: (e, liste) => {
        if (e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        setSchwebe({ x: Math.min(rect.left, window.innerWidth - 330), y: rect.bottom + 4, liste });
      },
      kontextmenue: (employeeId, name, tag) => {
        if (!druck.current?.ausgeloest) oeffneKommentare(employeeId, name, tag);
      },
      waehleTag: (tag) => {
        setSelected(null);
        tippeTag(tag);
      },
      bearbeite: (cell) => {
        setKommentarZelle(null);
        setSelected(cell);
      },
      oeffneKommentare,
      verschiebe: (teamName, index, richtung) => {
        const gruppe = groups.find(([name]) => name === teamName);
        if (gruppe) verschieben(teamName, gruppe[1], index, richtung);
      },
    };
  });
  const aktionen = useMemo<ZeilenAktionen>(
    () => ({
      druckBeginn: (...x) => aktuelleAktionen.current?.druckBeginn(...x),
      druckBewegung: (...x) => aktuelleAktionen.current?.druckBewegung(...x),
      druckEnde: () => aktuelleAktionen.current?.druckEnde(),
      klickNachDruck: () => aktuelleAktionen.current?.klickNachDruck() ?? false,
      mausRaus: (...x) => aktuelleAktionen.current?.mausRaus(...x),
      schwebe: (...x) => aktuelleAktionen.current?.schwebe(...x),
      kontextmenue: (...x) => aktuelleAktionen.current?.kontextmenue(...x),
      waehleTag: (...x) => aktuelleAktionen.current?.waehleTag(...x),
      bearbeite: (...x) => aktuelleAktionen.current?.bearbeite(...x),
      oeffneKommentare: (...x) => aktuelleAktionen.current?.oeffneKommentare(...x),
      verschiebe: (...x) => aktuelleAktionen.current?.verschiebe(...x),
    }),
    [],
  );

  const kommentarListe = kommentarZelle
    ? (kommentareJeZelle.get(zellSchluessel(kommentarZelle.employeeId, kommentarZelle.tag)) ?? [])
    : [];
  const selectedKommentare = selected
    ? (kommentareJeZelle.get(zellSchluessel(selected.employeeId, selected.day)) ?? [])
    : [];

  /**
   * Tageskopf: Wochentag, Datum, Feiertagsrahmen, Ferienfarbe und Schloss
   * der Urlaubssperre. Oben im Kopf und bei jeder weiteren Schichtgruppe
   * dieselbe Zelle – damit beides gleich aussieht.
   */
  const tagesKopf = (iso: string, oben: boolean) => {
    const blockReason = blocked.get(iso);
    const ferienName = ferien.get(iso);
    // Eine Urlaubssperre ist das stärkere Signal und sticht
    // die Ferien -- die sind nur ein Hinweis und dürfen den
    // Plan nicht überfärben.
    const feiertag = feiertage.get(iso);
    const hinweis =
      [
        feiertag ? `Feiertag: ${feiertag}` : null,
        blockReason ? `Urlaubssperre: ${blockReason}` : null,
        !blockReason && ferienName ? `${ferienName} (Schulferien)` : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined;
    return (
      <th
        key={iso}
        data-tag={oben ? iso : undefined}
        scope={oben ? "col" : undefined}
        title={hinweis}
        className={cn(
          "px-0 py-0.5 text-center sm:px-0.5",
          // Der Monatswechsel bekommt eine senkrechte Linie.
          // Der Zeitraum über der Tabelle scrollt weg; die
          // Linie bleibt stehen, wo der Monat umspringt.
          iso.slice(8, 10) === "01" && "border-l-2 border-line",
          // Wochenende: wie stark, wählt jede Person selbst (globals.css).
          isWeekend(iso) && "we-kopf",
          // Feiertag: nur der Tageskopf bekommt einen Rahmen.
          // Durch die ganze Spalte war es zu viel – die Zellen
          // tragen schon Schicht- und Ferienfarben.
          feiertag && "rounded-md ring-2 ring-inset ring-crit-dot",
          ferienName && !blockReason && "bg-ferien-bg text-ferien-fg",
          blockReason && "bg-crit-bg",
        )}
      >
        <span
          className={cn(
            "block font-medium leading-tight text-ink-faint",
            gross ? "text-[11px] sm:text-[12px]" : "text-[9px] sm:text-[10px] lg:text-[11px]",
          )}
        >
          {/* Auf dem Handy nur der Anfangsbuchstabe – sonst
              passen keine zwei Wochen nebeneinander. */}
          <span className="sm:hidden">
            {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7].slice(0, 1)}
          </span>
          <span className="hidden sm:inline">
            {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]}
          </span>
        </span>
        <span
          className={cn(
            "tnum block whitespace-nowrap leading-tight tracking-tight text-ink-muted",
            gross ? "text-[11px] sm:text-[12px]" : "text-[9px] sm:text-[10px]",
          )}
        >
          {dayHeader(iso)}
        </span>
        {/* Die Urlaubssperre behält ihr Schloss – sie ist eine
            Vorschrift und muss auffallen. Die Ferien tragen
            nur noch den Hintergrund durch die ganze Spalte;
            das Koffersymbol hat eine Zeile gekostet und nichts
            erklärt, was die Farbe nicht auch sagt. */}
        {blockReason ? (
          <Lock className="mx-auto mt-0.5 h-3 w-3 text-crit-fg" />
        ) : null}
      </th>
    );
  };

  return (
    <Card
      className={cn(
        "scroll-mt-16 overflow-visible",
        randlos && "max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0",
      )}
      ref={planRef}
    >
      {/* Bedienleiste in drei Ebenen: oben der Monat groß (zugleich die
          Monatsauswahl) und „Mehr“, darunter Blättern und „Heute“, darunter
          die seltener gebrauchten Schalter als kleine Knöpfe. */}
      <div className="relative space-y-2.5 border-b border-line px-3 pb-3 pt-3 sm:px-4">
        <div className="flex items-center gap-2">
          <MonatsKopf box={scrollBox} start={start} span={span} geladen={geladen} from={from} onWahl={geheZu} />
          {/* Der Weg zurück zum heutigen Tag – oben rechts, neben „Mehr“. */}
          <HeuteKnopf box={scrollBox} start={start} span={span} geladen={geladen} from={from} onClick={() => geheZu(from)} />
          <button
            type="button"
            onClick={() => setMehrOffen((v) => !v)}
            aria-expanded={mehrOffen}
            aria-label="Anzeige und mehr"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-surface-muted"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Zeile 2: blättern – daneben die Größe, die man beim Lesen umschaltet. */}
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-line bg-surface-muted/60 sm:max-w-xs">
            <button
              type="button"
              onClick={() => blaettere(-1)}
              className="flex h-full w-11 shrink-0 items-center justify-center rounded-l-full text-ink hover:bg-surface-sunken"
              aria-label="Vorheriger Zeitraum"
            >
              <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
            <span className="tnum min-w-0 flex-1 truncate text-center text-[13.5px] font-semibold">
              <SichtbarerZeitraum box={scrollBox} start={start} span={span} geladen={geladen} />
            </span>
            <button
              type="button"
              onClick={() => blaettere(1)}
              className="flex h-full w-11 shrink-0 items-center justify-center rounded-r-full text-ink hover:bg-surface-sunken"
              aria-label="Nächster Zeitraum"
            >
              <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void setzeAnzeige({ planAnsicht: gross ? "kompakt" : "gross" }).catch(() => undefined)}
            aria-pressed={gross}
            aria-label={gross ? "Kompakt" : "Groß"}
            title={gross ? "Kompakt" : "Groß"}
            className={cn(chip, "h-10 max-sm:w-10 max-sm:justify-center max-sm:px-0", gross && chipAn)}
          >
            {gross ? <Minimize2 className="h-4 w-4" strokeWidth={2.2} /> : <Maximize2 className="h-4 w-4" strokeWidth={2.2} />}
            <span className="max-sm:hidden">{gross ? "Kompakt" : "Groß"}</span>
          </button>
          {/* Reihenfolge: selten gebraucht. Die Pfeile erscheinen erst in
              diesem Modus, sonst verstellen sie jede Namensspalte. */}
          {canEdit && !nurLesen ? (
            <button
              type="button"
              onClick={() => setSortieren((v) => !v)}
              aria-pressed={sortieren}
              // Auf dem Handy nur sichtbar, solange sie läuft (zum Beenden);
              // sonst steht sie im Menü „Mehr“.
              className={cn(chip, sortieren ? chipAn : "hidden sm:inline-flex")}
            >
              <ListOrdered className="h-3.5 w-3.5" strokeWidth={2.2} />
              {sortieren ? "Reihenfolge fertig" : "Reihenfolge"}
            </button>
          ) : null}
        </div>

        {(antragLink && employeeId) || (!nurLesen && employeeId && antragSchalter) ? (
          <div className="flex flex-wrap gap-1.5">
          {antragLink && employeeId ? (
            <Link
              href={antragLink}
              className={cn(chip, "h-10 justify-center border-transparent bg-brand-500/15 font-bold text-brand-700 hover:bg-brand-500/25 max-sm:flex-1")}
            >
              <CalendarPlus className="h-4 w-4" strokeWidth={2.2} />
              Urlaub beantragen
            </Link>
          ) : null}
          {!nurLesen && employeeId && antragSchalter ? (
            <button
              type="button"
              onClick={() => {
                setAntragsModus((v) => !v);
                setAuswahl(null);
                setSelected(null);
              }}
              aria-pressed={antragsModus}
              // Eingeschaltet wird er kräftig, damit „Fertig“ als Rückweg
              // erkennbar ist.
              className={cn(
                chip,
                "h-10 justify-center border-transparent font-bold max-sm:flex-1",
                antragsModus ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-brand-500/15 text-brand-700 hover:bg-brand-500/25",
              )}
            >
              <CalendarPlus className="h-4 w-4" strokeWidth={2.2} />
              {antragsModus ? (
                "Fertig"
              ) : (
                "Urlaub beantragen"
              )}
            </button>
          ) : null}
          </div>
        ) : null}

        {mehrOffen ? (
          <>
            <button
              type="button"
              aria-label="Schließen"
              onClick={() => setMehrOffen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div
              role="dialog"
              aria-label="Anzeige"
              className="absolute right-3 top-[3.3rem] z-40 max-h-[min(70vh,34rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface px-4 py-1.5 shadow-pop sm:right-4"
            >
              {/* Jeder Abschnitt klappt auf; beim Schließen des Menüs klappt alles wieder zu. */}
              <MenueAbschnitte
                abschnitte={[
                  { id: "ansicht", titel: "Ansicht", inhalt: <PlanAnsichtWahl /> },
                  { id: "wochenende", titel: "Wochenende hervorheben", inhalt: <WochenendeWahl vorschau={false} /> },
                  {
                    id: "farben",
                    titel: "Farben",
                    inhalt: (
                      <>
                        <PlanFarbenSchalter />
                        <a href="/meine-schichten?anpassen=1" className="mt-2 block text-[13px] font-semibold text-brand-600">
                          Farben ändern (im Kalender unter „Kalender anpassen“)
                        </a>
                      </>
                    ),
                  },
                  {
                    id: "legende",
                    titel: "Legende",
                    inhalt: (
                <div data-legende className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-ink-muted">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="h-4 w-5 shrink-0 rounded-sm ring-2 ring-inset ring-crit-dot" />
                    <span className="leading-tight">Feiertag (Rahmen am Tag)</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="h-4 w-5 shrink-0 rounded-sm bg-ferien-bg" />
                    <span className="leading-tight">Schulferien NRW</span>
                  </span>
                  {legend.map((item) => (
                    <span key={item.code || "leer"} className="flex min-w-0 items-center gap-1">
                      <span
                        className={cn(
                          "flex h-4 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold",
                          cellStyles[item.code],
                          legendExtra[item.code],
                        )}
                        style={item.code && zellFarbe ? (zellFarbe(item.code) ?? undefined) : undefined}
                      >
                        {cellLabel(item.code)}
                      </span>
                      <span className="leading-tight">{t(item.label)}</span>
                    </span>
                  ))}
                  <span className="col-span-2 flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-8 shrink-0 rounded-full bg-gradient-to-r from-ink/30 via-ink/10 to-ink/30 blur-[1.5px]" />
                    <span className="leading-tight">
                      Graue Zeile ohne Namen: noch nicht angemeldet oder nicht freigegeben (Einstellungen → Was Kollegen sehen)
                    </span>
                  </span>
                  {/* Spart acht Einträge: statt U/u, V/v, AF/af … einmal die Regel. */}
                  <span className="col-span-2 pt-1 leading-snug">
                    Heller Hintergrund mit Rahmen heißt beantragt, noch nicht genehmigt – U, V und G
                    stehen dann zusätzlich klein da (u, v, g).
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    Besetzung:
                    <span className="rounded bg-ok-bg px-1.5 text-ok-fg">genug</span>
                    <span className="rounded bg-warn-bg px-1.5 text-warn-fg">
                      genau Minimum – fällt noch jemand aus, wird es rot
                    </span>
                    <span className="rounded bg-crit-bg px-1.5 text-crit-fg">unterschritten</span>
                  </span>
                </div>
                    ),
                  },
                ]}
              />
              {canEdit && !nurLesen ? (
                <button
                  type="button"
                  onClick={() => {
                    setSortieren(true);
                    setMehrOffen(false);
                  }}
                  className="flex w-full items-center gap-2 border-t border-line py-3 text-left text-[14px] font-semibold text-ink sm:hidden"
                >
                  <ListOrdered className="h-4 w-4" strokeWidth={2.2} /> Reihenfolge ändern
                </button>
              ) : null}
              {hilfe ? <p className="border-t border-line py-3 text-[12.5px] text-ink-muted">{hilfe}</p> : null}
            </div>
          </>
        ) : null}
      </div>

      {(error ?? ladeFehler) ? (
        <div className="px-4 pt-3">
          <Alert tone="error">{error ?? ladeFehler}</Alert>
        </div>
      ) : null}

      {/* Beim Beantragen: der Hinweis schwebt unten über der Leiste – nichts
          über dem Plan, damit nichts nach unten rutscht. */}
      {antragAktiv && (!auswahl || !auswahl.fertig) ? (
        <div
          data-antrag-hinweis
          data-ueber-leiste
          className="fixed inset-x-3 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-2.5 text-surface shadow-pop lg:bottom-6"
        >
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <b className="block font-semibold">{auswahl ? "Letzten Tag antippen" : "Ersten Tag antippen"}</b>
            <span className="opacity-75">{auswahl ? `ab ${formatDE(auswahl.von)} · in deiner Zeile` : "in deiner Zeile (markiert)"}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setAntragsModus(false);
              setAuswahl(null);
            }}
            className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-surface/90 hover:bg-white/10"
          >
            Abbrechen
          </button>
        </div>
      ) : null}

      {antragMeldung ? (
        <div className="px-4 pt-3">
          <Alert tone="success">{antragMeldung}</Alert>
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

      {/* Als Leiste unten, nicht über der Tabelle: vorher schob sich das
          Feld beim Antippen über den Plan, und alles darunter sprang nach
          unten – die angetippte Zelle war danach woanders. */}
      {selected && canEdit ? (
        <WischLeiste
          onClose={() => setSelected(null)}
          role="dialog"
          aria-label="Tag bearbeiten"
          data-ueber-leiste
          className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-h-[65vh] max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface px-3 py-3 shadow-pop sm:px-4 lg:bottom-4 lg:rounded-2xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 text-[13px]">
              <span className="font-semibold">{selected.employeeName}</span>
              <span className="text-ink-muted"> · {formatDE(selected.day)}</span>
              <span className="block text-[12px] text-ink-muted">
                Aktuell: {selected.shiftName ?? "frei"}
                {selected.absenceCode ? ` · ${selected.absenceCode}` : ""}
              </span>
            </p>
            <button
              type="button"
              onClick={() => oeffneKommentare(selected.employeeId, selected.employeeName, selected.day)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-ink-muted hover:bg-surface-muted"
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
              Kommentar{selectedKommentare.length > 0 ? ` (${selectedKommentare.length})` : ""}
            </button>
          </div>
          {selectedKommentare.length > 0 ? (
            <ul className="mb-2 space-y-1 rounded-lg bg-crit-bg/40 px-2.5 py-1.5 text-[12px]">
              {selectedKommentare.map((k) => (
                <li key={k.id}>
                  <span className="font-medium">{k.autorName}:</span> {k.text}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-2.5">
            <Abschnitt titel="Schicht">
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {nachSchichtfolge(shiftDetails.filter((s) => s.active)).map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    disabled={pending}
                    onClick={() => applyChange("shift", shift.id)}
                    aria-pressed={selected.shiftName === shift.name && !selected.absenceCode}
                    className={cn(
                      bearbeitKnopf,
                      schichtFarbe(shift.shortName) ?? "border border-line bg-surface text-ink",
                      selected.shiftName === shift.name &&
                        !selected.absenceCode &&
                        "ring-2 ring-brand-600 ring-offset-1 ring-offset-surface",
                    )}
                  >
                    {shift.name}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => applyChange("free", "")}
                  className={cn(bearbeitKnopf, "border border-line bg-surface text-ink")}
                >
                  Frei
                </button>
              </div>
            </Abschnitt>

            {gruppenWechsel.length > 0 ? (
              <Abschnitt titel="Schichtwechsel" hinweis="an diesem Tag mit einer anderen Gruppe arbeiten">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {gruppenWechsel.map((ziel) => (
                    <button
                      key={ziel.team}
                      type="button"
                      disabled={pending}
                      onClick={() => applyChange("shift", ziel.shiftId)}
                      title={`Zählt an diesem Tag zur Besetzung von Gruppe ${ziel.team}`}
                      className={cn(
                        bearbeitKnopf,
                        "flex-col gap-0 py-1.5 leading-tight",
                        schichtFarbe(ziel.shortName) ?? "border border-line bg-surface text-ink",
                      )}
                    >
                      <span className="font-semibold">Gruppe {ziel.team}</span>
                      <span className="text-[11px] font-normal opacity-90">{ziel.shiftName}</span>
                    </button>
                  ))}
                </div>
              </Abschnitt>
            ) : null}

            <Abschnitt titel="Urlaub und Freistellung" hinweis="sofort genehmigt">
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {(selected.day >= "2027-01-01"
                  ? leaveKnoepfe.flatMap((k) =>
                      k.aktion === "v_tag"
                        ? [
                            { aktion: "vj" as const, label: "VJ-Tag", code: "VJ" },
                            { aktion: "v" as const, label: "V (widerrufbar)", code: "V" },
                          ]
                        : [k],
                    )
                  : leaveKnoepfe
                )
                  .filter((k) => za || (k.aktion !== "v_tag" && k.aktion !== "vj" && k.aktion !== "v"))
                  .map((k) => (
                  <button
                    key={k.aktion}
                    type="button"
                    disabled={pending}
                    onClick={() => applyChange(k.aktion, "")}
                    title={t(k.label)}
                    className={cn(bearbeitKnopf, "flex-col gap-0 py-1.5 leading-tight", cellStyles[k.code])}
                  >
                    <span className="text-[14px] font-bold">{k.code}</span>
                    <span className="w-full truncate text-[10px] font-normal opacity-90">{t(k.label)}</span>
                  </button>
                ))}
              </div>
            </Abschnitt>

            <Abschnitt titel="Abwesenheit">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => applyChange("absence", "krank")}
                  className={cn(bearbeitKnopf, "flex-col gap-0 py-1.5 leading-tight", cellStyles.K)}
                >
                  <span className="text-[14px] font-bold">K</span>
                  <span className="text-[10px] font-normal opacity-90">Krank</span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => applyChange("absence", "schulung")}
                  className={cn(bearbeitKnopf, "flex-col gap-0 py-1.5 leading-tight", cellStyles.FB)}
                >
                  <span className="text-[14px] font-bold">FB</span>
                  <span className="text-[10px] font-normal opacity-90">Schulung</span>
                </button>
                {selected.isApprentice ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => applyChange("absence", "berufsschule")}
                    className={cn(bearbeitKnopf, "flex-col gap-0 py-1.5 leading-tight", cellStyles.BS)}
                    data-berufsschule-knopf
                  >
                    <span className="text-[14px] font-bold">BS</span>
                    <span className="text-[10px] font-normal opacity-90">Berufsschule</span>
                  </button>
                ) : null}
              </div>
            </Abschnitt>
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t border-line pt-2.5 [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[13px]">
            {/* Nur anbieten, wenn wirklich ein Antrag auf dem Tag liegt –
                sonst räumt der Knopf nichts weg und verwirrt bloß. */}
            {selected.absenceCode &&
            ["U", "u", "V", "v", "AF", "af", "SU", "su", "BU", "bu", "G", "g"].includes(
              selected.absenceCode,
            ) ? (
              <Button variant="ghost" disabled={pending} onClick={() => applyChange("clear", "")}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Eintrag entfernen
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Abbrechen
            </Button>
          </div>
        </WischLeiste>
      ) : null}

      {/* Kommentare zu einer Zelle: lesen, schreiben, löschen. Als Leiste
          unten wie die Bearbeitung – so springt oben nichts. */}
      {kommentarZelle ? (
        <WischLeiste
          onClose={() => setKommentarZelle(null)}
          role="dialog"
          aria-label="Kommentare"
          data-ueber-leiste
          className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-h-[60vh] max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface px-3 py-3 shadow-pop sm:px-4 lg:bottom-4 lg:rounded-2xl"
        >
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
            <MessageSquare className="h-4 w-4 text-crit-dot" strokeWidth={2} />
            Kommentare · {kommentarZelle.name} · {formatDE(kommentarZelle.tag)}
          </p>
          {kommentarListe.length === 0 ? (
            <p className="mb-2 text-[12px] text-ink-muted">Noch kein Kommentar zu diesem Tag.</p>
          ) : (
            <ul className="mb-2 space-y-1.5">
              {kommentarListe.map((k) => (
                <li key={k.id} className="flex items-start gap-2 rounded-lg bg-surface-muted px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="block whitespace-pre-wrap break-words">{k.text}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {k.autorName} ·{" "}
                      {new Date(k.erstelltAm).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  {/* Eigene Kommentare löscht jeder selbst, die Führung
                      alle. Die Datenbank prüft es noch einmal. */}
                  {k.autorId === profile.id || canEdit ? (
                    <button
                      type="button"
                      onClick={() => loescheKommentar(k.id)}
                      disabled={pending}
                      aria-label="Kommentar löschen"
                      className="shrink-0 rounded p-1 text-ink-faint hover:bg-surface hover:text-crit-fg disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <textarea
            value={kommentarText}
            onChange={(e) => setKommentarText(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Kommentar schreiben …"
            className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-[16px] sm:text-[13px]"
          />
          <p className="mt-1 text-[11px] text-ink-faint">
            Für alle im Unternehmen sichtbar – bitte keine Krankheitsgründe oder
            andere private Angaben.
          </p>
          {kommentarFehler ? (
            <div className="mt-2">
              <Alert tone="error">{kommentarFehler}</Alert>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5 [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[13px]">
            <Button disabled={pending || !kommentarText.trim()} onClick={speichereKommentar}>
              Speichern
            </Button>
            <Button variant="ghost" onClick={() => setKommentarZelle(null)}>
              Schließen
            </Button>
          </div>
        </WischLeiste>
      ) : null}

      {/* Kommentar beim Überfahren mit der Maus. Fest positioniert, damit
          ihn der seitlich scrollende Plan nicht abschneidet. */}
      {schwebe ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-40 max-w-xs rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-pop"
          style={{ left: schwebe.x, top: schwebe.y }}
        >
          {schwebe.liste.map((k) => (
            <p key={k.id} className="whitespace-pre-wrap break-words">
              <span className="font-medium">{k.autorName}:</span> {k.text}
            </p>
          ))}
        </div>
      ) : null}

      <div
        className={cn("overflow-x-auto overscroll-x-contain rounded-b-card", randlos && "max-sm:rounded-none")}
        ref={scrollBox}
        // Der Browser darf den Stand nicht selbst nachziehen, wenn links Spalten
        // dazukommen – das übernimmt das Fenster (siehe „anker“).
        style={{ overflowAnchor: "none" }}
      >
        <div
          ref={zeigerSchild}
          hidden
          aria-hidden
          data-plan-schild
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[12px] font-semibold text-surface shadow-pop"
        />
        {cells === null ? (
          <RowSkeleton rows={6} />
        ) : groups.length === 0 && ladeFehler ? (
          // Plan kam nicht (Störung) – nicht „keine Mitarbeiter“ behaupten,
          // sondern einen neuen Versuch anbieten.
          <div className="flex justify-center px-4 py-6">
            <Button variant="secondary" disabled={pending} onClick={() => void load()}>
              Erneut versuchen
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState title="Keine Mitarbeiter gefunden." />
        ) : (
          <table data-plan-tabelle className="w-max border-separate border-spacing-0 text-[13px] sm:w-full">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={cn(
                    // Auf dem Handy schmal und fest: jeder Pixel hier ist
                    // ein sichtbarer Tag mehr.
                    "sticky left-0 z-20 w-[4.25rem] min-w-[4.25rem] max-w-[4.25rem] bg-surface px-1 py-1 text-left align-bottom text-[10px] font-medium uppercase tracking-[0.04em] text-ink-faint sm:w-[1%] sm:min-w-[120px] sm:max-w-none sm:whitespace-nowrap sm:px-2",
                  )}
                >
                  <span className="sm:hidden">Name</span>
                  <span className="hidden sm:inline">Mitarbeiter</span>
                </th>
                {dates.map((iso) => tagesKopf(iso, true))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([teamName, members], gruppenIndex) => {
                const offen = offeneGruppen.has(teamName);
                return (
                <Fragment key={teamName}>
                  <tr>
                    <th
                      colSpan={dates.length + vorspalten}
                      className="sticky left-0 bg-brand-50 p-0 text-left"
                    >
                      {/* Zusammenklappen: mit vier oder fünf Gruppen passt sonst nichts
                          anderes mehr auf den Bildschirm. */}
                      <button
                        type="button"
                        onClick={() => toggleGruppe(teamName)}
                        aria-expanded={offen}
                        className="flex w-full items-center gap-1.5 px-3 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-100 lg:py-1.5 lg:text-[13px]"
                      >
                        {/* Die Beschriftung bleibt links stehen, auch wenn
                            der Plan zur Seite gescrollt ist. */}
                        <span className="sticky left-3 flex items-center gap-1.5">
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
                        </span>
                      </button>
                    </th>
                  </tr>
                  {/* Datum bei jeder Schichtgruppe, nicht nur ganz oben – wer
                      bei Schicht D steht, muss sonst hochscrollen, um den Tag
                      zu sehen. Die erste Gruppe hat den Kopf direkt darüber. */}
                  {offen && gruppenIndex > 0 ? (
                    <tr aria-hidden>
                      <th className="sticky left-0 z-10 bg-surface" />
                      {dates.map((iso) => tagesKopf(iso, false))}
                    </tr>
                  ) : null}
                  {offen && members.map((member, memberIndex) => (
                    <PlanZeile
                      key={member.employeeId}
                      member={member}
                      memberIndex={memberIndex}
                      anzahl={members.length}
                      teamName={teamName}
                      dates={dates}
                      from={from}
                      antragHier={antragAktiv && member.isMe}
                      fokus={antragAktiv ? (member.isMe ? "ich" : "blass") : null}
                      auswahl={member.isMe ? auswahl : null}
                      bearbeitbarBasis={!nurLesen && canEdit}
                      blocked={blocked}
                      ferien={ferien}
                      kommentareJeZelle={kommentareJeZelle}
                      sortierbar={sortieren && canEdit}
                      sortierPending={sortieren && canEdit && pending}
                      aktionen={aktionen}
                      gross={gross}
                      zellFarbe={zellFarbe}
                    />
                  ))}
                  {offen && (
                  <tr>
                    <th
                      scope="row"
                      colSpan={vorspalten}
                      title="Anwesend in der Schicht der Gruppe – Azubis zählen nicht mit"
                      className="sticky left-0 z-10 whitespace-nowrap bg-surface-sunken px-2 py-0.5 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint sm:px-3 sm:text-[11px]"
                    >
                      Besetzung
                    </th>
                    {dates.map((iso) => {
                      const day = coverage.get(teamName)?.get(iso);
                      const below =
                        day != null && day.minimum !== null && day.present < day.minimum;
                      // Genau auf der Grenze: noch in Ordnung, aber fällt
                      // noch jemand aus, wird es rot.
                      const knapp =
                        day != null && day.minimum !== null && day.present === day.minimum;
                      return (
                        <td
                          key={iso}
                          className={cn(
                            "bg-surface-sunken/60 p-px text-center sm:p-0.5",
                            isWeekend(iso) && "we-spalte",
                          )}
                        >
                          {day == null || day.minimum === null ? (
                            <span className="text-[11px] text-ink-faint">–</span>
                          ) : (
                            <span
                              title={
                                below
                                  ? `${day.present} anwesend – Mindestbesetzung unterschritten`
                                  : knapp
                                    ? `${day.present} anwesend – genau Mindestbesetzung, fällt noch jemand aus, wird es kritisch`
                                    : `${day.present} anwesend`
                              }
                              className={cn(
                                "tnum mx-auto flex items-center justify-center rounded font-semibold",
                                gross
                                  ? "h-8 w-9 text-[12px] sm:h-9 sm:w-full sm:min-w-[38px] sm:text-[13px]"
                                  : "h-6 w-6 text-[10px] sm:h-7 sm:w-full sm:min-w-[26px] sm:text-[12px]",
                                below
                                  ? "bg-crit-bg text-crit-fg"
                                  : knapp
                                    ? "bg-warn-bg text-warn-fg"
                                    : "bg-ok-bg/60 text-ok-fg",
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

      {/* Platz unter der Tabelle, damit die Leiste unten die letzten
          Zeilen nicht verdeckt – unten angefügt, damit oben nichts springt. */}
      {(selected && canEdit) || kommentarZelle ? <div aria-hidden className="h-80" /> : null}

      {auswahl && employeeId ? (
        <>
          <PlanLeaveRequest
            employeeId={employeeId}
            von={auswahl.von}
            bis={auswahl.bis}
            fertig={auswahl.fertig}
            onEinTag={() => setAuswahl((a) => (a ? { ...a, fertig: true } : a))}
            onClose={() => setAuswahl(null)}
            onDone={(meldung) => {
              setAuswahl(null);
              setAntragMeldung(meldung);
              void load();
            }}
          />
          {/* Platz, damit die Leiste unten die letzten Zeilen nicht verdeckt. */}
          <div aria-hidden className="h-72" />
        </>
      ) : null}

    </Card>
  );
}

interface ZeilenAktionen {
  druckBeginn: (e: React.PointerEvent, employeeId: string, name: string, tag: string) => void;
  druckBewegung: (e: React.PointerEvent) => void;
  druckEnde: () => void;
  klickNachDruck: () => boolean;
  mausRaus: (e: React.PointerEvent) => void;
  schwebe: (e: React.PointerEvent<HTMLButtonElement>, liste: PlanKommentar[]) => void;
  kontextmenue: (employeeId: string, name: string, tag: string) => void;
  waehleTag: (tag: string) => void;
  bearbeite: (cell: LiveShiftPlanCell) => void;
  oeffneKommentare: (employeeId: string, name: string, tag: string) => void;
  verschiebe: (teamName: string, index: number, richtung: -1 | 1) => void;
}

/**
 * Eine Mitarbeiterzeile im Plan. Eigener Baustein, damit der Browser den
 * Aufbau der Tabelle in Häppchen teilen kann (der Finger bleibt beim
 * Blättern nicht hängen) und damit beim Antippen nicht die ganze Tabelle
 * neu gezeichnet wird.
 */
const PlanZeile = memo(function PlanZeile({
  member,
  memberIndex,
  anzahl,
  teamName,
  dates,
  from,
  antragHier,
  fokus = null,
  auswahl,
  bearbeitbarBasis,
  blocked,
  ferien,
  kommentareJeZelle,
  sortierbar,
  sortierPending,
  aktionen,
  gross,
  zellFarbe,
}: {
  /** Beim Urlaub beantragen: die eigene Zeile hervorgehoben, die anderen leicht blass. */
  fokus?: "ich" | "blass" | null;
  member: GridRow;
  memberIndex: number;
  anzahl: number;
  teamName: string;
  dates: string[];
  from: string;
  antragHier: boolean;
  auswahl: { von: string; bis: string; fertig: boolean } | null;
  bearbeitbarBasis: boolean;
  blocked: Map<string, string>;
  ferien: Map<string, string>;
  kommentareJeZelle: Map<string, PlanKommentar[]>;
  sortierbar: boolean;
  sortierPending: boolean;
  aktionen: ZeilenAktionen;
  /** Ansicht „Groß“: größere Zellen, leichter zu treffen. */
  gross: boolean;
  /** Eigene Farben der Person (oder null = Farben des Plans). */
  zellFarbe: ((code: string) => React.CSSProperties | null) | null;
}) {
  return (
    <tr
      id={member.isMe ? "eigene-zeile" : undefined}
      data-name={member.verborgen ? "Ohne Namen" : member.name}
      data-fokus={fokus ?? undefined}
      className={cn(
        "hover:bg-surface-muted/50",
        fokus === "blass" && "opacity-[0.8] transition-opacity",
        fokus === "ich" && "bg-brand-500/[0.14]",
      )}
    >
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 w-[4.25rem] min-w-[4.25rem] max-w-[4.25rem] whitespace-nowrap px-1 py-0.5 text-left font-normal sm:w-[1%] sm:min-w-0 sm:max-w-none sm:px-2",
          fokus === "ich" ? "bg-brand-100 font-semibold text-brand-700" : "bg-surface",
          gross ? "text-[12.5px] sm:text-[14px]" : "text-[11px] sm:text-[12px] lg:text-[13px]",
        )}
      >
        <span className="flex items-center gap-1.5">
          {sortierbar ? (
            <span className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => aktionen.verschiebe(teamName, memberIndex, -1)}
                disabled={memberIndex === 0 || sortierPending}
                aria-label={`${member.name} nach oben`}
                className="rounded px-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink disabled:opacity-25"
              >
                <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => aktionen.verschiebe(teamName, memberIndex, 1)}
                disabled={memberIndex === anzahl - 1 || sortierPending}
                aria-label={`${member.name} nach unten`}
                className="rounded px-0.5 text-ink-faint hover:bg-surface-muted hover:text-ink disabled:opacity-25"
              >
                <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1">
            {/* Kurzform auf dem Handy: "T. Refai" statt "Tarek Refai". */}
            {/* Beim Beantragen steht auf dem Handy statt des Namens „Du“ – passt in die schmale Spalte. */}
            {member.verborgen ? (
              // Kein Name von der Datenbank: ein verschwommener Balken, kein echter Text.
              <span
                data-ohne-namen
                role="img"
                aria-label="Person ohne Namen – noch nicht angemeldet oder nicht freigegeben"
                title="Noch nicht angemeldet oder nicht freigegeben"
                className="block h-2.5 w-14 max-w-full rounded-full bg-gradient-to-r from-ink/30 via-ink/10 to-ink/30 opacity-70 blur-[2px]"
              />
            ) : (
              <>
                <span className={cn("block truncate sm:hidden", fokus === "ich" && "hidden")}>{shortName(member.name)}</span>
                <span className="hidden truncate sm:block">{member.name}</span>
              </>
            )}
            {fokus === "ich" ? (
              <span className="shrink-0 rounded bg-brand-600 px-1.5 text-[10px] font-bold leading-[16px] text-white">Du</span>
            ) : null}
            {/* Azubis stehen im Plan, zählen aber nicht zur Besetzung – das
                soll man sehen. */}
            {member.isApprentice && !member.verborgen ? (
              <span
                title="Azubi – zählt nicht zur Besetzung"
                className="shrink-0 rounded bg-surface-sunken px-1 text-[9px] font-semibold uppercase tracking-[0.04em] text-ink-muted sm:text-[10px]"
              >
                Azubi
              </span>
            ) : null}
          </span>
        </span>
      </th>
      {dates.map((iso) => {
        const cell = member.cells.get(iso);
        // Rangfolge: Abwesenheit > Schicht > (Zelle da, aber ohne Schicht =
        // frei laut Muster). Kein cell = kein Tag.
        const code = cell ? (cell.absenceCode ?? cell.shiftCode ?? "FREI") : null;
        // VJ-Tag (ab 2027): eigenes Kürzel und eigene Farbe, zählt aber wie V.
        const stilCode = code && cell?.isVj && (code === "V" || code === "v") ? (code === "V" ? "VJ" : "vj") : code;
        // In der eigenen Zeile: Tag für den Antrag wählen. Vergangene Tage und
        // Tage ohne Plan gehen nicht.
        const waehlbar = antragHier && Boolean(cell) && iso >= from;
        const gewaehlt = auswahl !== null && iso >= auswahl.von && iso <= auswahl.bis;
        const bearbeitbar = bearbeitbarBasis && Boolean(cell);
        const zellKommentare = kommentareJeZelle.get(zellSchluessel(member.employeeId, iso));
        // Ohne Namen: nur die Schicht in Grau – kein Antippen, kein Kommentar.
        if (member.verborgen) {
          return (
            <td
              key={iso}
              data-tag={iso}
              className={cn(
                "p-px text-center sm:p-0.5",
                iso.slice(8, 10) === "01" && "border-l-2 border-line",
                blocked.has(iso) ? "bg-crit-bg/50" : ferien.has(iso) && "bg-ferien-bg/70",
                isWeekend(iso) && "we-spalte",
              )}
            >
              <span
                className={cn(
                  "mx-auto flex select-none items-center justify-center rounded bg-ink/[0.07] font-semibold text-ink-faint",
                  gross
                    ? "h-8 w-9 text-[13px] sm:h-9 sm:w-full sm:min-w-[38px] sm:text-[14px]"
                    : "h-6 w-6 text-[11px] sm:h-7 sm:w-full sm:min-w-[26px] sm:text-[12px]",
                )}
              >
                {code ? cellLabel(stilCode!) : ""}
              </span>
            </td>
          );
        }
        return (
          <td
            key={iso}
            data-tag={iso}
            className={cn(
              "p-px text-center sm:p-0.5",
              // Dieselbe Linie wie im Kopf, damit der Monatswechsel durch die
              // ganze Tabelle geht.
              iso.slice(8, 10) === "01" && "border-l-2 border-line",
              // Ferien als durchgehender Hintergrund der Spalte; die
              // Urlaubssperre sticht sie, sie ist wichtiger.
              blocked.has(iso) ? "bg-crit-bg/50" : ferien.has(iso) && "bg-ferien-bg/70",
              isWeekend(iso) && "we-spalte",
            )}
          >
            <button
              type="button"
              // Kein `disabled`: auch nicht bearbeitbare Zellen nehmen langes
              // Drücken (Kommentar) und das Überfahren mit der Maus an.
              aria-disabled={!waehlbar && !bearbeitbar && !zellKommentare}
              onPointerDown={(e) => aktionen.druckBeginn(e, member.employeeId, member.name, iso)}
              onPointerMove={aktionen.druckBewegung}
              onPointerUp={aktionen.druckEnde}
              onPointerCancel={aktionen.druckEnde}
              onPointerLeave={aktionen.mausRaus}
              onPointerEnter={(e) => {
                if (zellKommentare) aktionen.schwebe(e, zellKommentare);
              }}
              onContextMenu={(e) => {
                // Rechtsklick am Desktop = Kommentar; auf Android kommt beim
                // langen Drücken dasselbe Ereignis – das Menü des Browsers
                // stört dort.
                e.preventDefault();
                aktionen.kontextmenue(member.employeeId, member.name, iso);
              }}
              onClick={() => {
                if (aktionen.klickNachDruck()) return;
                if (waehlbar) {
                  aktionen.waehleTag(iso);
                } else if (bearbeitbar && cell) {
                  aktionen.bearbeite(cell);
                } else if (zellKommentare) {
                  aktionen.oeffneKommentare(member.employeeId, member.name, iso);
                }
              }}
              aria-pressed={waehlbar ? gewaehlt : undefined}
              title={
                cell && !zellKommentare
                  ? `${member.name} · ${formatDE(iso)}${cell.shiftName ? ` · ${cell.shiftName}` : " · frei"}${code && BEANTRAGT.has(code) ? " · beantragt, noch nicht genehmigt" : ""}`
                  : undefined
              }
              style={code && zellFarbe ? (zellFarbe(code) ?? undefined) : undefined}
              className={cn(
                "relative mx-auto flex select-none items-center justify-center rounded font-semibold [-webkit-touch-callout:none]",
                gross
                  ? "h-8 w-9 text-[13px] sm:h-9 sm:w-full sm:min-w-[38px] sm:text-[14px]"
                  : "h-6 w-6 text-[11px] sm:h-7 sm:w-full sm:min-w-[26px] sm:text-[12px]",
                stilCode ? cellStyles[stilCode] : "bg-surface-muted/40 text-ink-faint",
                (bearbeitbar || waehlbar) && cell && "hover:ring-2 hover:ring-brand-500",
                !waehlbar && !bearbeitbar && !zellKommentare && "cursor-default",
                gewaehlt && "ring-2 ring-brand-600 ring-offset-1 ring-offset-surface",
              )}
            >
              {code ? cellLabel(stilCode!) : ""}
              {/* Kleiner roter Strich: hier steht ein Kommentar. */}
              {zellKommentare ? (
                <span
                  aria-label="Kommentar vorhanden"
                  className="absolute right-0.5 top-0.5 h-[3px] w-2 rounded-full bg-crit-dot sm:w-2.5"
                />
              ) : null}
            </button>
          </td>
        );
      })}
    </tr>
  );
});

/**
 * Abschnitte im Menü „Anzeige und mehr“: alle zu, einer geht auf. Die Liste
 * steht nur, solange das Menü offen ist – beim Schließen ist danach wieder alles zu.
 */
function MenueAbschnitte({ abschnitte }: { abschnitte: { id: string; titel: string; inhalt: React.ReactNode }[] }) {
  const [offen, setOffen] = useState<string | null>(null);
  return (
    <div className="divide-y divide-line">
      {abschnitte.map((a) => (
        <div key={a.id} data-menue-abschnitt={a.id}>
          <button
            type="button"
            onClick={() => setOffen((o) => (o === a.id ? null : a.id))}
            aria-expanded={offen === a.id}
            className="flex w-full items-center justify-between gap-2 py-3 text-left text-[14.5px] font-semibold text-ink"
          >
            {a.titel}
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", offen === a.id && "rotate-180")}
              strokeWidth={2.2}
            />
          </button>
          {offen === a.id ? <div className="pb-3.5">{a.inhalt}</div> : null}
        </div>
      ))}
    </div>
  );
}
