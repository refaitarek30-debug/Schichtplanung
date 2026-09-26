"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
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
import { fetchHolidays, fetchSchoolHolidays } from "@/lib/data/holidays";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";
import { gemerkteAnsicht, istPlausiblesDatum, merkeAnsicht } from "@/lib/view-state";
import { PlanLeaveRequest } from "./plan-leave-request";
import { useSession } from "@/context/session";
import { useAktualisierung } from "@/lib/live-refresh";
import { ausZwischenspeicher, inZwischenspeicher } from "@/lib/zwischenspeicher";

/** Was ein Abruf des Plans liefert – als Ganzes zwischengespeichert. */
interface PlanStand {
  grid: LiveShiftPlanCell[];
  details: ShiftDetail[];
  blocked: Map<string, string>;
  ferien: Map<string, string>;
}

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

/**
 * Feste Breite der Personalnummern-Spalte und der Versatz der Namensspalte
 * dahinter. Beide Spalten bleiben beim seitlichen Wischen stehen (sticky);
 * dafür muss der Versatz exakt der Breite der ersten Spalte entsprechen.
 * Bis sechs Ziffern passen ohne Kürzung, längere Nummern werden mit „…“
 * abgeschnitten und stehen vollständig im Tooltip.
 */
const NUMMER_SPALTE = "w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] sm:w-[4.25rem] sm:min-w-[4.25rem] sm:max-w-[4.25rem]";
const NAME_NACH_NUMMER = "left-[3.25rem] sm:left-[4.25rem]";

/** Eine Mitarbeiterzeile in der Matrix, Tag für Tag. */
interface GridEmployee {
  name: string;
  team: string | null;
  number: string | null;
  isMe: boolean;
  /** Azubi: steht im Plan, zählt aber nicht zur Besetzung. */
  isApprentice: boolean;
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
  personalnummern = false,
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
   * Spalte mit Personalnummern zeigen. Nur im Bereich „Plan" für die
   * Schichtleitung – auf der Startseite nie, auch nicht für die Führung.
   */
  personalnummern?: boolean;
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
    // Kommt man zum Beantragen (?antrag=1), soll der Plan nicht in einem
    // vergangenen Monat stehen – dort ist kein Tag mehr wählbar.
    let zumAntrag = false;
    try {
      zumAntrag = new URLSearchParams(window.location.search).get("antrag") === "1";
    } catch {
      // ohne lesbare Adresse wie gewohnt
    }
    if (gemerkt && !(zumAntrag && gemerkt < from)) setStart(gemerkt);
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

  /**
   * Wischen blättert: nach links die nächsten Tage, nach rechts die
   * vorigen. Passt der Plan nicht ganz aufs Handy, scrollt er erst bis zum
   * Rand; erst ein Wischen am Rand blättert weiter.
   */
  const wischStart = useRef<{ x: number; y: number; links: number } | null>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  function wischBeginn(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    wischStart.current = { x: t.clientX, y: t.clientY, links: scrollBox.current?.scrollLeft ?? 0 };
  }
  function wischEnde(e: React.TouchEvent) {
    const anfang = wischStart.current;
    wischStart.current = null;
    const t = e.changedTouches[0];
    const box = scrollBox.current;
    if (!anfang || !t || !box) return;
    const dx = t.clientX - anfang.x;
    const dy = t.clientY - anfang.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const maxLinks = box.scrollWidth - box.clientWidth;
    // Stand der Plan beim Anfassen schon am Rand – oder ein kräftiger
    // Wisch hat ihn bis an den Rand gebracht –, wird geblättert.
    const kraeftig = Math.abs(dx) > 150;
    const amEnde = (links: number) => links >= maxLinks - 2;
    const amAnfang = (links: number) => links <= 2;
    if (dx < 0 && (amEnde(anfang.links) || (kraeftig && amEnde(box.scrollLeft)))) {
      setStart((s) => addDays(s, span));
      box.scrollLeft = 0;
    } else if (dx > 0 && (amAnfang(anfang.links) || (kraeftig && amAnfang(box.scrollLeft)))) {
      setStart((s) => addDays(s, -span));
      requestAnimationFrame(() => {
        box.scrollLeft = box.scrollWidth;
      });
    }
  }
  /** Legende zu, bis jemand sie braucht. Spart auf dem Handy zwei Zeilen. */
  const [legendeOffen, setLegendeOffen] = useState(false);
  const [cells, setCells] = useState<LiveShiftPlanCell[] | null>(null);
  const [shiftDetails, setShiftDetails] = useState<ShiftDetail[]>([]);
  const [blocked, setBlocked] = useState<Map<string, string>>(new Map());
  /** Ferientag → Name des Zeitraums, für die dezente Markierung im Kopf. */
  const [ferien, setFerien] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  /** Gesetzliche Feiertage: Tag → Name. Einmal geladen, sie ändern sich nicht. */
  const [feiertage, setFeiertage] = useState<Map<string, string>>(new Map());
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
      window.scrollBy({ top: zeile.getBoundingClientRect().top - window.innerHeight * 0.3 });
    }
    setAuswahl((bisher) => {
      if (!bisher || bisher.fertig) return { von: iso, bis: iso, fertig: false };
      const [von, bis] = iso < bisher.von ? [iso, bisher.von] : [bisher.von, iso];
      return { von, bis, fertig: true };
    });
  }

  const { profile } = useSession();
  // Je Benutzer getrennt: die Führung sieht andere Zeilen als ein Mitarbeiter.
  const speicherSchluessel = `${profile.id}:plan:${companyId}:${start}:${span}`;

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
  const load = useCallback(async (nurDaten = false) => {
    const meiner = ++letzterAbruf.current;
    setError(null);
    // Schon einmal geladen? Dann sofort zeigen und im Hintergrund auffrischen.
    // Beim Zurückblättern oder Seitenwechsel steht der Plan damit ohne
    // Wartezeit da.
    const gemerkt = nurDaten ? null : ausZwischenspeicher<PlanStand>(speicherSchluessel);
    if (gemerkt) {
      setCells(gemerkt.grid);
      setShiftDetails(gemerkt.details);
      setBlocked(gemerkt.blocked);
      setFerien(gemerkt.ferien);
    }
    try {
      const bis = addDays(start, span - 1);
      const rahmenDa = nurDaten && rahmen.current?.schluessel === speicherSchluessel;
      const [grid, blockedDays, neuerRahmen] = await Promise.all([
        fetchShiftPlanGrid(companyId, start, span),
        fetchBlockedDays(start, bis),
        rahmenDa
          ? Promise.resolve(rahmen.current!)
          : (async () => {
              // Die Schichtdetails liefern Name und Id gleich mit – eine
              // zweite Abfrage nur für die Auswahlliste braucht es nicht.
              const [details, ferienZeitraeume] = await Promise.all([
                fetchShiftDetails(),
                fetchSchoolHolidays(start, bis),
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
              return { schluessel: speicherSchluessel, details, ferien: tage };
            })(),
      ]);
      // Inzwischen wurde weitergeblättert: diese Antwort ist überholt.
      if (meiner !== letzterAbruf.current) return;
      rahmen.current = neuerRahmen;
      setCells(grid);
      setShiftDetails(neuerRahmen.details);
      setBlocked(blockedDays);
      setFerien(neuerRahmen.ferien);
      inZwischenspeicher<PlanStand>(speicherSchluessel, {
        grid,
        details: neuerRahmen.details,
        blocked: blockedDays,
        ferien: neuerRahmen.ferien,
      });
    } catch (caught) {
      if (meiner !== letzterAbruf.current) return;
      // Steht schon ein Stand da, bleibt er sichtbar – lieber der Plan von
      // vor einer Minute als ein leerer Bildschirm.
      if (gemerkt || nurDaten) {
        setError("Der Plan konnte gerade nicht aufgefrischt werden – angezeigt wird der letzte Stand.");
        return;
      }
      setCells([]);
      setError(
        caught instanceof DataError ? caught.message : "Der Schichtplan kann momentan nicht geladen werden. Bitte in einigen Minuten erneut versuchen.",
      );
    }
  }, [companyId, start, span, speicherSchluessel]);

  useEffect(() => {
    void load();
  }, [load]);

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
   * Die Führung plant den ganzen Betrieb und bekommt deshalb alle Gruppen
   * offen. Vorher stand auch für sie nur die eigene Gruppe offen – und wer
   * selbst nicht im Schichtdienst ist, hat keine. Seit die Schichtgruppe im
   * Plan nur noch für Schichtarbeiter ausgewiesen wird, fiel eine
   * Betriebsleiterin damit in die Gruppe „Tagschicht“, und A, B, C und D
   * standen alle zugeklappt da.
   *
   * Mitarbeiter sehen alle Gruppen, aufgeklappt ist aber nur die eigene –
   * die anderen stehen eingeklappt darunter und lassen sich per Tipp
   * öffnen. Das ist nur die Voreinstellung der Ansicht, keine Sperre.
   * Findet sich keine eigene Gruppe, ist alles offen: lieber zu viel Plan
   * als ein leerer Bildschirm.
   *
   * Maßgeblich ist die Rolle aus der Sitzung (`canEdit` = Schichtleitung
   * oder Administration laut Profil) – nicht ein Name oder eine Eingabe.
   */
  const standardOffen = useMemo(() => {
    const alle = () => new Set(groups.map(([teamName]) => teamName));
    if (canEdit || groups.length <= 1) return alle();
    const eigene = groups.find(([, members]) => members.some((m) => m.isMe));
    return eigene ? new Set([eigene[0]]) : alle();
  }, [groups, canEdit]);

  const offeneGruppen = aufgeklappt ?? standardOffen;

  /**
   * Eigene Spalte für die Personalnummer – nur, wo sie gewünscht ist
   * (`personalnummern`) und es welche gibt. Die Datenbank liefert sie
   * ausschließlich der Führung; Mitarbeiter sehen keine Personalnummern
   * von Kollegen und bekommen die Spalte gar nicht.
   */
  const mitNummer = useMemo(
    () =>
      personalnummern &&
      groups.some(([, members]) => members.some((m) => Boolean(m.number))),
    [groups, personalnummern],
  );
  /** Spalten vor den Tagen: Personalnummer (falls da) und Name. */
  const vorspalten = mitNummer ? 2 : 1;

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
        window.scrollBy({ top: rect.top - window.innerHeight * 0.4 });
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
        if (!dominant) {
          perDay.set(iso, { present: 0, minimum: null });
          continue;
        }
        let present = 0;
        for (const member of members) {
          if (member.isApprentice) continue;
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

  return (
    <Card className="scroll-mt-16 overflow-hidden" ref={planRef}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Schichtplan</h2>
          <p className="tnum text-[12px] text-ink-muted">
            {formatDE(start)} – {formatDE(addDays(start, span - 1))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!nurLesen && employeeId && antragSchalter ? (
            <button
              type="button"
              onClick={() => {
                setAntragsModus((v) => !v);
                setAuswahl(null);
                setSelected(null);
              }}
              aria-pressed={antragsModus}
              // Gefüllt in der Farbe des großen Knopfs auf der Startseite –
              // es ist dieselbe Handlung. Eingeschaltet wird er hell, damit
              // „Fertig" als Rückweg erkennbar ist.
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition-colors",
                antragsModus
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-brand-600 bg-brand-600 text-white shadow-card hover:bg-brand-700",
              )}
            >
              <CalendarPlus className="h-4 w-4" strokeWidth={2} />
              {antragsModus ? "Fertig" : "Urlaub beantragen"}
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

          {/* Reihenfolge: selten gebraucht, deshalb nur ein kleines Symbol
              ganz rechts. Die Pfeile erscheinen erst in diesem Modus, sonst
              verstellen sie jede Namensspalte. */}
          {canEdit && !nurLesen ? (
            <button
              type="button"
              onClick={() => setSortieren((v) => !v)}
              aria-pressed={sortieren}
              aria-label={sortieren ? "Reihenfolge fertig" : "Reihenfolge ändern"}
              title={sortieren ? "Reihenfolge fertig" : "Reihenfolge ändern"}
              className={cn(
                "ml-auto rounded-md p-1 transition-colors",
                sortieren
                  ? "bg-brand-500 text-white"
                  : "text-ink-faint hover:bg-surface-muted hover:text-ink",
              )}
            >
              <ListOrdered className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="px-4 pt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {antragAktiv && !auswahl ? (
        <div className="px-4 pt-3">
          <Alert tone="info">
            Urlaub beantragen: in deiner Zeile auf den ersten und dann auf den letzten Tag
            tippen.
          </Alert>
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
        <div
          role="dialog"
          aria-label="Tag bearbeiten"
          className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-h-[50vh] max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface px-3 py-3 shadow-pop sm:px-4 lg:bottom-4 lg:rounded-2xl"
        >
          <p className="mb-2 text-[13px] font-medium">
            {selected.employeeName} · {formatDE(selected.day)}
          </p>
          <div className="flex flex-wrap gap-1.5 [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[13px]">
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
            {leaveKnoepfe.map((k) => (
              <Button
                key={k.aktion}
                variant="secondary"
                disabled={pending}
                onClick={() => applyChange(k.aktion, "")}
                className={cn(cellStyles[k.code], "hover:brightness-95")}
              >
                {k.label}
              </Button>
            ))}
            <Button variant="danger" disabled={pending} onClick={() => applyChange("absence", "krank")}>
              Krank
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => applyChange("absence", "schulung")}
              className={cn(cellStyles.FB, "hover:brightness-95")}
            >
              Schulung
            </Button>
            {/* Nur anbieten, wenn wirklich ein Antrag auf dem Tag liegt –
                sonst räumt der Knopf nichts weg und verwirrt bloß. */}
            {selected.absenceCode &&
            ["U", "u", "V", "v", "AF", "af", "SU", "su", "BU", "bu", "G", "g"].includes(
              selected.absenceCode,
            ) ? (
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

      <div
        className="overflow-x-auto overscroll-x-contain"
        ref={scrollBox}
        onTouchStart={wischBeginn}
        onTouchEnd={wischEnde}
      >
        {cells === null ? (
          <RowSkeleton rows={6} />
        ) : groups.length === 0 && error ? (
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
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                {/* Personalnummer in einer eigenen Spalte fester Breite:
                    kurze und lange Nummern stehen bündig untereinander,
                    nichts bricht um, und die Spalte verschiebt den Plan
                    nicht. Sie bleibt beim Wischen stehen wie der Name. */}
                {mitNummer ? (
                  <th
                    scope="col"
                    title="Personalnummer"
                    className={cn(
                      "sticky left-0 z-20 whitespace-nowrap bg-surface px-1.5 py-1 text-left align-bottom text-[10px] font-medium uppercase tracking-[0.04em] text-ink-faint sm:px-2",
                      NUMMER_SPALTE,
                    )}
                  >
                    {/* Auf dem Handy ist die Spalte schmal – „Nr.“ passt in eine Zeile. */}
                    <span className="sm:hidden">Nr.</span>
                    <span className="hidden sm:inline">Pers.-Nr.</span>
                  </th>
                ) : null}
                <th
                  scope="col"
                  className={cn(
                    "sticky z-20 min-w-[80px] bg-surface px-2 py-1 text-left align-bottom text-[10px] font-medium uppercase tracking-[0.04em] text-ink-faint sm:min-w-[150px] sm:px-3 lg:min-w-[190px]",
                    mitNummer ? NAME_NACH_NUMMER : "left-0",
                  )}
                >
                  Mitarbeiter
                </th>
                {dates.map((iso) => {
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
                      title={hinweis}
                      className={cn(
                        "min-w-[28px] px-0.5 py-1 text-center sm:min-w-[38px] sm:px-1 lg:min-w-[42px]",
                        // Der Monatswechsel bekommt eine senkrechte Linie.
                        // Der Zeitraum über der Tabelle scrollt weg; die
                        // Linie bleibt stehen, wo der Monat umspringt.
                        iso.slice(8, 10) === "01" && "border-l-2 border-line",
                        isWeekend(iso) && "bg-surface-sunken/60",
                        // Feiertag: nur der Tageskopf bekommt einen Rahmen.
                        // Durch die ganze Spalte war es zu viel – die Zellen
                        // tragen schon Schicht- und Ferienfarben.
                        feiertag && "rounded-md ring-2 ring-inset ring-crit-dot",
                        ferienName && !blockReason && "bg-plan-bg/40",
                        blockReason && "bg-crit-bg",
                      )}
                    >
                      <span className="block text-[10px] font-medium text-ink-faint lg:text-[11px]">
                        {/* Auf dem Handy nur der Anfangsbuchstabe – sonst
                            passen keine zwei Wochen nebeneinander. */}
                        <span className="sm:hidden">
                          {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7].slice(0, 1)}
                        </span>
                        <span className="hidden sm:inline">
                          {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]}
                        </span>
                      </span>
                      <span className="tnum block text-[11px] text-ink-muted lg:text-[12px]">
                        <span className="sm:hidden">{dayHeader(iso)}</span>
                        <span className="hidden sm:inline">
                          {iso.slice(8, 10)}.{iso.slice(5, 7)}.
                        </span>
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
                      colSpan={dates.length + vorspalten}
                      className="sticky left-0 bg-brand-50 p-0 text-left"
                    >
                      {/* Zusammenklappen: mit vier Gruppen passt sonst nichts
                          anderes mehr auf den Bildschirm. */}
                      <button
                        type="button"
                        onClick={() => toggleGruppe(teamName)}
                        aria-expanded={offen}
                        className="flex w-full items-center gap-1.5 px-3 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-100 lg:py-1.5 lg:text-[13px]"
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
                    <tr
                      key={member.employeeId}
                      id={member.isMe ? "eigene-zeile" : undefined}
                      className="hover:bg-surface-muted/50"
                    >
                      {mitNummer ? (
                        <td
                          title={member.number ?? undefined}
                          className={cn(
                            "tnum sticky left-0 z-10 overflow-hidden text-ellipsis whitespace-nowrap bg-surface px-1.5 py-0.5 text-left text-[11px] text-ink-muted sm:px-2 sm:text-[12px] lg:text-[13px]",
                            NUMMER_SPALTE,
                          )}
                        >
                          {member.number ?? ""}
                        </td>
                      ) : null}
                      <th
                        scope="row"
                        className={cn(
                          "sticky z-10 whitespace-nowrap bg-surface px-2 py-0.5 text-left text-[11px] font-normal sm:px-3 sm:text-[12px] lg:text-[13px]",
                          mitNummer ? NAME_NACH_NUMMER : "left-0",
                        )}
                      >
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
                          <span className="flex min-w-0 items-center gap-1">
                            {/* Kurzform auf dem Handy: "T. Refai" statt "Tarek Refai". */}
                            <span className="block truncate sm:hidden">
                              {shortName(member.name)}
                            </span>
                            <span className="hidden truncate sm:block">{member.name}</span>
                            {/* Azubis stehen im Plan, zählen aber nicht zur
                                Besetzung – das soll man sehen. */}
                            {member.isApprentice ? (
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
                        // Rangfolge: Abwesenheit > Schicht > (Zelle da, aber
                        // ohne Schicht = frei laut Muster). Kein cell = kein Tag.
                        const code = cell
                          ? (cell.absenceCode ?? cell.shiftCode ?? "FREI")
                          : null;
                        // In der eigenen Zeile: Tag für den Antrag wählen.
                        // Vergangene Tage und Tage ohne Plan gehen nicht.
                        const waehlbar = antragAktiv && member.isMe && Boolean(cell) && iso >= from;
                        const gewaehlt =
                          member.isMe && auswahl !== null && iso >= auswahl.von && iso <= auswahl.bis;
                        return (
                          <td
                            key={iso}
                            className={cn(
                              "p-px text-center sm:p-0.5",
                              // Dieselbe Linie wie im Kopf, damit der
                              // Monatswechsel durch die ganze Tabelle geht.
                              iso.slice(8, 10) === "01" && "border-l-2 border-line",
                              // Ferien als durchgehender Hintergrund der
                              // Spalte. Dezent genug, dass die Kürzel in
                              // den Zellen klar lesbar bleiben; die
                              // Urlaubssperre sticht sie, sie ist wichtiger.
                              blocked.has(iso)
                                ? "bg-crit-bg/50"
                                : ferien.has(iso) && "bg-plan-bg/40",
                            )}
                          >
                            <button
                              disabled={waehlbar ? false : nurLesen || !canEdit || !cell}
                              onClick={() => {
                                if (waehlbar) {
                                  setSelected(null);
                                  tippeTag(iso);
                                } else if (!nurLesen && canEdit && cell) {
                                  setSelected(cell);
                                }
                              }}
                              aria-pressed={waehlbar ? gewaehlt : undefined}
                              title={
                                cell
                                  ? `${member.name} · ${formatDE(iso)}${cell.shiftName ? ` · ${cell.shiftName}` : " · frei"}${code && BEANTRAGT.has(code) ? " · beantragt, noch nicht genehmigt" : ""}`
                                  : undefined
                              }
                              className={cn(
                                "flex h-6 w-full items-center justify-center rounded text-[11px] font-semibold sm:h-7 sm:text-[12px] lg:h-8 lg:text-[13px]",
                                code ? cellStyles[code] : "bg-surface-muted/40 text-ink-faint",
                                ((!nurLesen && canEdit) || waehlbar) && cell && "hover:ring-2 hover:ring-brand-500",
                                gewaehlt && "ring-2 ring-brand-600 ring-offset-1 ring-offset-surface",
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
                          className="bg-surface-sunken/60 p-px text-center sm:p-0.5"
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
                                "tnum flex h-5 w-full items-center justify-center rounded text-[10px] font-semibold sm:h-6 sm:text-[12px] lg:h-7 lg:text-[13px]",
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
      {selected && canEdit ? <div aria-hidden className="h-56" /> : null}

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

      {/* Die Legende ist Nachschlagewerk, nicht Dauerinhalt: eingeklappt
          gewinnt der Plan auf dem Handy zwei Zeilen. Die Besetzungszeile
          bleibt davon unberührt – sie gehört zur Tabelle. */}
      <button
        type="button"
        onClick={() => setLegendeOffen((v) => !v)}
        aria-expanded={legendeOffen}
        className="flex w-full items-center justify-between gap-2 border-t border-line px-3 py-2 text-[12px] text-ink-muted hover:bg-surface-muted sm:px-4"
      >
        <span>{legendeOffen ? "Legende ausblenden" : "Legende anzeigen"}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", legendeOffen && "rotate-180")}
          strokeWidth={2}
        />
      </button>

      {legendeOffen ? (
      <div className="grid grid-cols-3 gap-x-2 gap-y-1 border-t border-line px-2 py-2 text-[10px] text-ink-faint sm:grid-cols-6 sm:gap-x-3 sm:px-4 sm:py-2.5 sm:text-[11px] sm:text-ink-muted">
        <span className="flex min-w-0 items-center gap-1">
          <span className="h-3.5 w-4 shrink-0 rounded-sm ring-2 ring-inset ring-crit-dot sm:h-4 sm:w-5" />
          <span className="truncate">Feiertag (Rahmen am Tag)</span>
        </span>
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
          Heller Hintergrund mit Rahmen heißt beantragt, noch nicht genehmigt – U, V und G
          stehen dann zusätzlich klein da (u, v, g).
        </span>
        <span className="col-span-3 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-span-6">
          Besetzung:
          <span className="rounded bg-ok-bg px-1.5 text-ok-fg">genug</span>
          <span className="rounded bg-warn-bg px-1.5 text-warn-fg">
            genau Minimum – fällt noch jemand aus, wird es rot
          </span>
          <span className="rounded bg-crit-bg px-1.5 text-crit-fg">unterschritten</span>
        </span>
      </div>
      ) : null}
    </Card>
  );
}
