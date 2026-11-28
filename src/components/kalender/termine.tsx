"use client";

import { restBis, useCountdowns, useJetzt, zeitpunkt } from "@/lib/countdown";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Trash2, X } from "lucide-react";
import type React from "react";
import { useWischZu } from "@/components/privat/blatt";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { Erinnerung, Termin, TerminEingabe, Wiederholung } from "@/lib/data/partner";
import type { Vorlage } from "@/lib/data/todos";
import type { LoeschModus } from "@/lib/data/verbindungen";
import { ErinnerungHinweis } from "./erinnerungen";
import { mitSymbol, STANDARD_TERMINE, useVorlieben } from "./vorschlaege";

/**
 * Termine im Kalender – Formular und Hilfen.
 *
 * Gespeichert in der Datenbank (0139_kalender_partner_termine.sql): eigene
 * Termine sieht nur die Person selbst – und ihr Partner, wenn sie das bei
 * der Einladung freigegeben hat. Termine des Partners sehen beide. Die
 * Firma sieht keine Termine.
 */


export type { Erinnerung, Termin, TerminEingabe, Wiederholung };

/**
 * Termine lagen anfangs nur im Browser. Was dort noch steht, wird einmal in
 * die Datenbank übernommen und danach gelöscht (siehe MeinKalenderGlas).
 */
export function alteLokaleTermine(benutzer: string): TerminEingabe[] | null {
  try {
    const roh = window.localStorage.getItem(`schichtplan.termine.${benutzer}`);
    if (!roh) return null;
    const daten: unknown = JSON.parse(roh);
    if (!Array.isArray(daten)) return [];
    return daten
      .filter((t) => t && typeof t === "object" && typeof t.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.datum))
      .map((t) => ({
        id: null,
        datum: t.datum,
        titel: String(t.titel ?? "").slice(0, 80),
        ganztaegig: t.ganztaegig === true,
        von: typeof t.von === "string" ? t.von : "",
        bis: typeof t.bis === "string" ? t.bis : "",
        wiederholung: (["nie", "taeglich", "werktags", "woechentlich", "zweiwoechentlich", "monatlich", "jaehrlich"].includes(t.wiederholung)
          ? t.wiederholung
          : "nie") as Wiederholung,
        notiz: String(t.notiz ?? "").slice(0, 500),
        ort: String(t.ort ?? "").slice(0, 120),
      }));
  } catch {
    return null;
  }
}

export function vergissLokaleTermine(benutzer: string) {
  try {
    window.localStorage.removeItem(`schichtplan.termine.${benutzer}`);
  } catch {
    // dann beim nächsten Mal – doppelt übernommen wird nichts, weil erst danach gelöscht wird
  }
}

/** Ganze Tage zwischen zwei Daten (lokal, ohne Zeitumstellungsfehler). */
function tageZwischen(a: string, b: string) {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Beginnt der Termin (bzw. eine seiner Wiederholungen) an diesem Tag? */
function beginntAm(t: Termin, iso: string): boolean {
  if (iso < t.datum) return false;
  if (t.ausfaelle?.includes(iso)) return false;
  if (t.serieAb && iso >= t.serieAb) return false;
  switch (t.wiederholung) {
    case "taeglich":
      return true;
    case "werktags": {
      const w = fromISO(iso).getDay();
      return w >= 1 && w <= 5;
    }
    case "woechentlich":
      return tageZwischen(t.datum, iso) % 7 === 0;
    case "zweiwoechentlich":
      return tageZwischen(t.datum, iso) % 14 === 0;
    case "monatlich":
      return fromISO(iso).getDate() === fromISO(t.datum).getDate();
    case "jaehrlich": {
      const a = fromISO(iso);
      const b = fromISO(t.datum);
      return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
    }
    default:
      return iso === t.datum;
  }
}

// ---- Geburtstage ---------------------------------------------------------------
//
// Ein Geburtstag ist ein jährlicher Termin, dessen Titel mit 🎂 beginnt. Das
// Geburtsjahr steckt im Startdatum der Serie: Ist es nicht bekannt, beginnt
// die Serie 1904 (ein Schaltjahr, damit auch der 29.2. geht – so macht es
// auch Apple), dann erscheint der Geburtstag in jedem Jahr, ohne Alter.
// Alles ab 2026 zählt als „Jahr nicht bekannt“: so wurden Geburtstage vor
// dieser Funktion angelegt, mit dem Tag, an dem man sie eingetragen hat.

export const GEBURTSJAHR_UNBEKANNT = 1904;
const FRUEHESTES_GEBURTSJAHR = 1905;
const SPAETESTES_GEBURTSJAHR = 2025;

export const istGeburtstagTitel = (titel: string) => titel.trimStart().startsWith("🎂");

/** Das Geburtsjahr, wenn es bekannt ist. */
export function geburtsjahr(t: Pick<Termin, "titel" | "wiederholung" | "datum">): number | null {
  if (t.wiederholung !== "jaehrlich" || !istGeburtstagTitel(t.titel)) return null;
  const j = Number(t.datum.slice(0, 4));
  return j >= FRUEHESTES_GEBURTSJAHR && j <= SPAETESTES_GEBURTSJAHR ? j : null;
}

const istSchaltjahr = (j: number) => (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;

/** Alter, das jemand an diesem Tag wird (bzw. wurde) – ohne bekanntes Geburtsjahr null. */
export function geburtstagAlter(t: Pick<Termin, "titel" | "wiederholung" | "datum">, iso: string): number | null {
  const j = geburtsjahr(t);
  if (j === null) return null;
  const alter = Number(iso.slice(0, 4)) - j;
  return alter >= 1 && alter <= 130 ? alter : null;
}

/** Titel für die Anzeige: bei Geburtstagen mit Alter („🎂 Anna wird 31“). */
export function terminTitel(t: Pick<Termin, "titel" | "wiederholung" | "datum">, iso: string): string {
  const basis = t.titel || "Termin";
  const alter = geburtstagAlter(t, iso);
  return alter === null ? basis : `${basis} ${iso >= heuteInBerlin() ? "wird" : "wurde"} ${alter}`;
}

/** Wie viele Tage ein ganztägiger Termin über den ersten hinaus dauert. */
export function weitereTage(t: Termin): number {
  if (!t.ganztaegig || !t.bisDatum || t.bisDatum <= t.datum) return 0;
  return Math.min(62, tageZwischen(t.datum, t.bisDatum));
}

/** Erster Tag des Vorkommens, das am Tag `iso` zu sehen ist (bei mehrtägigen früher). */
export function vorkommenAm(t: Termin, iso: string): string {
  const extra = weitereTage(t);
  for (let k = 0; k <= extra; k++) {
    const tag = k ? addDays(iso, -k) : iso;
    if (beginntAm(t, tag)) return tag;
  }
  return iso;
}

/** Alle Termine an einem Tag, auch wiederkehrende und mehrtägige. Ganztägige zuerst. */
export function termineAm(termine: Termin[], iso: string): Termin[] {
  return termine
    .filter((t) => {
      const extra = weitereTage(t);
      for (let k = 0; k <= extra; k++) if (beginntAm(t, k ? addDays(iso, -k) : iso)) return true;
      return false;
    })
    .sort((a, b) => (a.ganztaegig ? "" : a.von).localeCompare(b.ganztaegig ? "" : b.von));
}

function dauer(von: string, bis: string): string {
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  if ([vh, vm, bh, bm].some((n) => n === undefined || Number.isNaN(n))) return "";
  let m = bh! * 60 + bm! - (vh! * 60 + vm!);
  if (m <= 0) m += 24 * 60;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} Std. ${m % 60} Min.` : `${h} Std.`;
}

const feld =
  "flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-[16px]";
const eingabe =
  "min-w-0 flex-1 bg-transparent py-2 text-right text-[16px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md";


/** "HH:MM" plus Minuten (über Mitternacht hinaus wieder von vorn). */
export function zeitPlus(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const gesamt = ((((h ?? 0) * 60 + (m ?? 0) + min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(gesamt / 60)).padStart(2, "0")}:${String(gesamt % 60).padStart(2, "0")}`;
}

/** Minuten zwischen zwei Uhrzeiten (über Mitternacht: bis zum nächsten Tag). */
export function minutenZwischen(von: string, bis: string): number {
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  let m = (bh ?? 0) * 60 + (bm ?? 0) - ((vh ?? 0) * 60 + (vm ?? 0));
  if (m <= 0) m += 1440;
  return m;
}

type Wahl<T> = { id: T; name: string; kurz?: string };
/** Wenige feste Erinnerungen – alles andere stellt man unter „Eigene“ selbst ein. */
const ERINNERUNG_MIT_ZEIT: Wahl<Erinnerung | null>[] = [
  { id: null, name: "Keine" },
  { id: "m10", name: "10 Min. vorher" },
  { id: "h1", name: "1 Std. vorher" },
  { id: "d1", name: "1 Tag vorher" },
];
const ERINNERUNG_GANZ: Wahl<Erinnerung | null>[] = [
  { id: null, name: "Keine" },
  { id: "tag8", name: "Am Tag 8:00" },
  { id: "vortag18", name: "Vortag 18:00" },
];
/** Namen der festen Werte, die es nur noch in alten Terminen gibt (0251). */
const FEST_NAME: Record<string, string> = {
  m0: "Zum Beginn",
  m5: "5 Min. vorher",
  m10: "10 Min. vorher",
  m15: "15 Min. vorher",
  m30: "30 Min. vorher",
  h1: "1 Std. vorher",
  h2: "2 Std. vorher",
  h3: "3 Std. vorher",
  d1: "1 Tag vorher",
  d2: "2 Tage vorher, 8:00",
  w1: "1 Woche vorher, 8:00",
  morgens8: "Am Tag 8:00",
  tag7: "Am Tag 7:00",
  tag8: "Am Tag 8:00",
  vortag18: "Vortag 18:00",
  vortag20: "Vortag 20:00",
};

/** Braucht die Erinnerung eine Uhrzeit des Termins (… vor dem Beginn)? */
function brauchtBeginn(e: Erinnerung): boolean {
  return /^(m\d+|h\d|d1|v\d+)$/.test(e);
}

/** Minuten-Text: 90 → „1 Std. 30 Min.“, 2880 → „2 Tage“. */
function dauerText(min: number): string {
  if (min === 0) return "0 Min.";
  if (min % 1440 === 0) return min === 1440 ? "1 Tag" : `${min / 1440} Tage`;
  if (min % 60 === 0) return `${min / 60} Std.`;
  return min > 60 ? `${Math.floor(min / 60)} Std. ${min % 60} Min.` : `${min} Min.`;
}

/** Eigene Erinnerung „t<Tage>-<HHMM>“ zerlegen. */
function uhrzeitTeile(e: string): { tage: number; zeit: string } | null {
  const m = /^t(\d{1,2})-(\d{2})(\d{2})$/.exec(e);
  return m ? { tage: Number(m[1]), zeit: `${m[2]}:${m[3]}` } : null;
}

const UHRZEIT_TAGE = [
  { tage: 0, name: "Am Tag" },
  { tage: 1, name: "Vortag" },
  { tage: 2, name: "2 Tage vorher" },
  { tage: 7, name: "1 Woche vorher" },
];

const WIEDERHOLUNGEN: Wahl<Wiederholung>[] = [
  { id: "nie", name: "Nie" },
  { id: "taeglich", name: "Täglich" },
  { id: "werktags", name: "Werktags", kurz: "Werktags (Mo–Fr)" },
  { id: "woechentlich", name: "Wöchentlich" },
  { id: "zweiwoechentlich", name: "Alle 2 Wochen" },
  { id: "monatlich", name: "Monatlich" },
  { id: "jaehrlich", name: "Jährlich" },
];

/** Name einer Wiederholung, z. B. „Alle 2 Wochen“. */
export function wiederholungText(w: Wiederholung): string {
  const x = WIEDERHOLUNGEN.find((v) => v.id === w);
  return x?.kurz ?? x?.name ?? "Nie";
}
const DAUERN = [
  { tage: 1, name: "1 Tag" },
  { tage: 2, name: "2 Tage" },
  { tage: 3, name: "3 Tage" },
  { tage: 7, name: "1 Woche" },
];

/** Kurzer Text zur Erinnerung, z. B. für das Tagesblatt. */
export function erinnerungText(e: Erinnerung | null | undefined): string | null {
  if (!e) return null;
  if (FEST_NAME[e]) return FEST_NAME[e]!;
  const v = /^v(\d+)$/.exec(e);
  if (v) return Number(v[1]) === 0 ? "Zum Beginn" : `${dauerText(Number(v[1]))} vorher`;
  const u = uhrzeitTeile(e);
  if (u) return `${u.tage === 0 ? "Am Tag" : u.tage === 1 ? "Vortag" : `${u.tage} Tage vorher,`} ${u.zeit.replace(/^0/, "")}`;
  return null;
}

const pille = (an: boolean) =>
  cn(
    "h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
    an ? "bg-ink text-surface" : "bg-ink/[0.06] text-ink",
  );

/** Neu Aufgetauchtes ganz zeigen, auch wenn es unten aus dem Blatt ragt. */
function InSicht({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}

/** Erinnerung selbst einstellen: so lange vor dem Beginn oder an einem Tag zu einer Uhrzeit. */
function EigeneErinnerung({
  ganz,
  wert,
  onWahl,
}: {
  ganz: boolean;
  wert: Erinnerung | null;
  onWahl: (e: Erinnerung) => void;
}) {
  const u = wert ? uhrzeitTeile(wert) : null;
  const v = wert ? /^v(\d+)$/.exec(wert) : null;
  const startMin = v ? Number(v[1]) : 30;
  const startEinheit: "min" | "std" | "tage" =
    startMin > 0 && startMin % 1440 === 0 ? "tage" : startMin > 0 && startMin % 60 === 0 ? "std" : "min";
  const FAKTOR = { min: 1, std: 60, tage: 1440 } as const;
  const [art, setArt] = useState<"vorher" | "uhrzeit">(ganz || u ? "uhrzeit" : "vorher");
  const [zahl, setZahl] = useState(String(startMin / FAKTOR[startEinheit]));
  const [einheit, setEinheit] = useState(startEinheit);
  const [tage, setTage] = useState(u?.tage ?? 1);
  const [zeit, setZeit] = useState(u?.zeit ?? "19:00");
  const n = Number(zahl.replace(",", "."));
  const minuten = Number.isInteger(n) && n >= 0 ? n * FAKTOR[einheit] : -1;
  const okVorher = minuten >= 0 && minuten <= 20160;
  const okZeit = /^([01]\d|2[0-3]):[0-5]\d$/.test(zeit);
  const vorher = art === "vorher" && !ganz;
  const ok = vorher ? okVorher : okZeit;

  return (
    <InSicht className="space-y-3 rounded-2xl bg-ink/[0.045] p-3" data-eigene-erinnerung>
      {ganz ? null : (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1">
          {(
            [
              ["vorher", "Vor dem Beginn"],
              ["uhrzeit", "Zu einer Uhrzeit"],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              type="button"
              aria-pressed={art === id}
              onClick={() => setArt(id)}
              className={cn("h-8 rounded-full text-[13px] font-semibold", art === id ? "bg-surface text-ink shadow-sm" : "text-ink-muted")}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {vorher ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={zahl}
            onChange={(e) => setZahl(e.target.value)}
            aria-label="Wie lange vorher"
            className="h-9 w-16 rounded-full bg-surface text-center text-[16px] font-semibold text-ink outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          {(
            [
              ["min", "Min."],
              ["std", "Std."],
              ["tage", "Tage"],
            ] as const
          ).map(([id, name]) => (
            <button key={id} type="button" aria-pressed={einheit === id} onClick={() => setEinheit(id)} className={pille(einheit === id)}>
              {name}
            </button>
          ))}
          <span className="text-[13.5px] text-ink-muted">vorher</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {UHRZEIT_TAGE.map((t) => (
              <button key={t.tage} type="button" aria-pressed={tage === t.tage} onClick={() => setTage(t.tage)} className={pille(tage === t.tage)}>
                {t.name}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13.5px] text-ink-muted">
            um
            <input
              type="time"
              value={zeit}
              onChange={(e) => setZeit(e.target.value)}
              aria-label="Uhrzeit der Erinnerung"
              className="h-9 rounded-full bg-surface px-3 text-[16px] font-semibold text-ink outline-none ring-1 ring-line focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </label>
        </div>
      )}
      {vorher && !okVorher ? <p className="text-[12.5px] text-crit-fg">Höchstens 14 Tage vorher, ganze Zahlen.</p> : null}
      <button
        type="button"
        disabled={!ok}
        onClick={() => onWahl(vorher ? (`v${minuten}` as Erinnerung) : (`t${tage}-${zeit.replace(":", "")}` as Erinnerung))}
        className="h-10 w-full rounded-full bg-ink text-[14px] font-bold text-surface disabled:opacity-40"
      >
        Übernehmen
      </button>
    </InSicht>
  );
}

/** Zeile mit gewähltem Wert rechts; Antippen klappt die Auswahl darunter auf. */
function Ausklapp({
  zeile,
  titel,
  wert,
  offen,
  onToggle,
  gesperrt,
  children,
}: {
  zeile: string;
  titel: string;
  wert: string;
  offen: boolean;
  onToggle: () => void;
  gesperrt?: boolean;
  children: React.ReactNode;
}) {
  const auswahl = useRef<HTMLDivElement>(null);
  // Aufgeklappt: die Auswahl ganz zeigen, auch wenn sie unten aus dem Blatt ragt.
  useEffect(() => {
    if (offen) auswahl.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [offen]);
  return (
    <div className={cn(zeile, "flex-col items-stretch gap-0")}>
      <button
        type="button"
        disabled={gesperrt}
        aria-expanded={offen}
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 text-left disabled:opacity-100"
      >
        <span>{titel}</span>
        <span className="flex items-center gap-1.5 text-ink-muted">
          <span className="font-medium text-ink">{wert}</span>
          {gesperrt ? null : (
            <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", offen && "rotate-180")} />
          )}
        </span>
      </button>
      {offen ? (
        <div ref={auswahl} className="space-y-3 pb-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function TerminBlatt({
  datum,
  termin,
  onSpeichern,
  onLoeschen,
  serieLoeschen = false,
  hinweis,
  nurLesen = false,
  glas = false,
  vorschlaege = false,
  startZeit,
  ziele = [],
  onClose,
}: {
  datum: string;
  termin: Termin | null;
  onSpeichern: (t: TerminEingabe) => void;
  /** Löschen; bei einer Wiederholung mit Wahl (modus) und dem betroffenen Tag. */
  onLoeschen: (id: string, modus?: LoeschModus, datum?: string) => void;
  /** Bei wiederholenden Terminen fragen: nur dieser, ab hier oder alle. */
  serieLoeschen?: boolean;
  /** Zeile unter den Feldern – wer den Termin sieht. */
  hinweis: string;
  /** Nur ansehen (Termin der anderen Person). */
  nurLesen?: boolean;
  /** Glas-Stil des Privatbereichs (schwebende Karte). */
  glas?: boolean;
  /** Vorschläge je nach Person (Schule, Studium, …) und eigene Vorlagen. */
  vorschlaege?: boolean;
  /** Beginn für einen neuen Termin (z. B. aus der Tagesansicht). */
  startZeit?: string;
  /** Verbundene Konten, bei denen man eintragen darf (neuer Termin). */
  ziele?: { id: string; name: string }[];
  onClose: () => void;
}) {
  const id = useId();
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [titel, setTitel] = useState(termin?.titel ?? "");
  const zeile = glas ? feld.replace("border-line", "glas-linie") : feld;
  const [ganz, setGanz] = useState(termin?.ganztaegig ?? false);
  const [von, setVon] = useState(termin?.von || startZeit || "12:00");
  const [bis, setBis] = useState(termin?.bis || zeitPlus(startZeit ?? "12:00", 60));
  const [wdh, setWdh] = useState<Wiederholung>(termin?.wiederholung ?? "nie");
  const [notiz, setNotiz] = useState(termin?.notiz ?? "");
  const [ort, setOrt] = useState(termin?.ort ?? "");
  const tag = termin?.datum ?? datum;
  const [bisDatum, setBisDatum] = useState<string>(termin?.bisDatum && termin.bisDatum > tag ? termin.bisDatum : tag);
  const [erinnerung, setErinnerung] = useState<Erinnerung | null>(termin?.erinnerung ?? null);
  /** Welche Auswahl gerade aufgeklappt ist. */
  const [offen, setOffen] = useState<"erinnerung" | "wdh" | null>(null);
  /** Letzter Tag einer Wiederholung (null = ohne Ende). */
  const altEnde = termin?.serieAb ? addDays(termin.serieAb, -1) : null;
  const [ende, setEnde] = useState<string | null>(altEnde);
  /** „Eigene …“ angetippt: Erinnerung selbst einstellen. */
  const [eigenOffen, setEigenOffen] = useState(false);
  const titelFeld = useRef<HTMLInputElement>(null);
  // Geburtstag: jährlich, 🎂 vorn – dann fragt das Formular nach dem Geburtsjahr.
  const geburt = wdh === "jaehrlich" && istGeburtstagTitel(titel);
  const [gjahr, setGjahr] = useState(() => (termin ? String(geburtsjahr(termin) ?? "") : ""));
  const tagMonat = (termin?.datum ?? datum).slice(5);
  const gjahrZahl = /^\d{4}$/.test(gjahr) && Number(gjahr) >= FRUEHESTES_GEBURTSJAHR && Number(gjahr) <= SPAETESTES_GEBURTSJAHR ? Number(gjahr) : null;
  /** null = mein Kalender, sonst das Konto einer verbundenen Person */
  const [ziel, setZiel] = useState<string | null>(null);

  const mitVorschlaegen = vorschlaege && !termin && !nurLesen;
  const { vorlieben, setzen } = useVorlieben();
  const [eigeneNeu, setEigeneNeu] = useState<{ titel: string; min: number } | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [vorlagenFehler, setVorlagenFehler] = useState<string | null>(null);

  function waehle(v: Vorlage) {
    if (v.jaehrlich) {
      // Geburtstag: nur die Torte, den Namen schreibt man dahinter. Ganztägig,
      // jedes Jahr, und morgens eine Erinnerung.
      setTitel(`${v.icon} `);
      setWdh("jaehrlich");
      setGanz(true);
      setBisDatum(tag);
      setErinnerung((alt) => alt ?? "tag8");
      window.setTimeout(() => titelFeld.current?.focus(), 0);
      return;
    }
    setTitel(mitSymbol(v));
    if (v.min > 0) {
      setGanz(false);
      setBis(zeitPlus(von, v.min));
    } else {
      setGanz(true);
    }
  }

  /** Geburtstag an/aus: jährlich, ganztägig, morgens erinnern – ohne die Torte von Hand. */
  const ohneTorte = (t: string) => t.replace(/^\s*🎂\s*/, "");
  function setzeGeburtstag(an: boolean) {
    if (an) {
      setTitel(`🎂 ${ohneTorte(titel)}`);
      setWdh("jaehrlich");
      setGanz(true);
      setBisDatum(tag);
      setErinnerung((alt) => alt ?? "tag8");
    } else {
      setTitel(ohneTorte(titel));
      setWdh("nie");
    }
  }

  async function vorlagenSpeichern(liste: Vorlage[]) {
    setVorlagenFehler(null);
    try {
      await setzen(null, liste);
    } catch (e) {
      setVorlagenFehler(e instanceof Error ? e.message : "Die Vorlage konnte nicht gespeichert werden.");
    }
  }

  // Täglich/werktags und mehrtägig zugleich ergibt keinen Sinn: dann nur ein Tag je Wiederholung.
  const mehrtaegigGeht = wdh !== "taeglich" && wdh !== "werktags";
  const tageAnzahl = mehrtaegigGeht ? tageZwischen(tag, bisDatum) + 1 : 1;
  const erinnerungen = ganz ? ERINNERUNG_GANZ : ERINNERUNG_MIT_ZEIT;
  // Passt die gewählte Erinnerung nicht mehr (ganztägig: nichts „vor dem Beginn“), keine.
  const erinnerungGueltig = erinnerung && !(ganz && brauchtBeginn(erinnerung)) ? erinnerung : null;
  const eigeneGewaehlt = !!erinnerungGueltig && !erinnerungen.some((e) => e.id === erinnerungGueltig);

  // Beim Geburtstag beginnt die Serie im Geburtsjahr (oder 1904, wenn es unbekannt ist).
  const startJahr = gjahrZahl && !(tagMonat === "02-29" && !istSchaltjahr(gjahrZahl)) ? gjahrZahl : GEBURTSJAHR_UNBEKANNT;
  const startDatum = geburt ? `${startJahr}-${tagMonat}` : tag;
  // Alter beim nächsten Geburtstag (ab heute gerechnet).
  const heuteIso = heuteInBerlin();
  const naechstesJahr = Number(heuteIso.slice(0, 4)) + (tagMonat < heuteIso.slice(5) ? 1 : 0);
  const alterVorschau = geburt && gjahrZahl ? naechstesJahr - gjahrZahl : null;

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    onSpeichern({
      id: termin?.id ?? null,
      datum: startDatum,
      bisDatum: !geburt && ganz && mehrtaegigGeht && bisDatum > tag ? bisDatum : null,
      titel: titel.trim(),
      ganztaegig: ganz,
      von,
      bis,
      wiederholung: wdh,
      notiz: notiz.trim(),
      ort: ort.trim(),
      erinnerung: ziel ? null : erinnerungGueltig,
      ziel,
      // Ende der Wiederholung nur mitschicken, wenn es sich geändert hat.
      serieEnde: wdh !== "nie" && ende !== altEnde ? (ende && ende >= startDatum ? ende : null) : undefined,
    });
  }

  const wisch = useRef<HTMLFormElement>(null);
  useWischZu(wisch, "kopf", onClose);

  // An den Body gehängt: der Kalender steht auf dem Handy fest (eigene
  // Ebene unter der Navigation) – im Kalender selbst läge das Blatt sonst
  // unter der Navigationsleiste, und „Speichern“ wäre nicht zu erreichen.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center lg:items-center",
        glas && "privat-schrift px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      <button
        type="button"
        aria-label="Schließen"
        className={cn("absolute inset-0 cursor-default", glas ? "bg-black/20" : "bg-black/40")}
        onClick={onClose}
      />
      <form
        ref={wisch}
        onSubmit={speichern}
        role="dialog"
        aria-label={termin ? "Termin bearbeiten" : "Neuer Termin"}
        className={cn(
          "relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden",
          glas ? "glas-dicht max-h-[90dvh] rounded-[30px]" : "rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl",
        )}
      >
        <div data-wisch-kopf className={cn("flex items-baseline justify-between px-5 py-4", glas ? "bg-ink/[0.05]" : "bg-surface-sunken")}>
          <span className="text-[17px] font-semibold">
            {geburt ? (
              `${Number(tagMonat.slice(3))}. ${monthName(Number(tagMonat.slice(0, 2)) - 1)}`
            ) : (
              <>
                {termin?.wiederholung && termin.wiederholung !== "nie" ? "ab " : ""}
                {formatDE(tag)}
                {ganz && tageAnzahl > 1 ? ` – ${formatDE(bisDatum)}` : ""}
              </>
            )}
          </span>
          <span className="tnum text-[15px] text-ink-muted">
            {geburt ? "jedes Jahr" : ganz ? (tageAnzahl > 1 ? `${tageAnzahl} Tage` : "Ganztägig") : dauer(von, bis)}
          </span>
        </div>

        {termin && !geburt ? <TerminCountdown termin={termin} /> : null}

        <div className="overflow-y-auto px-5">
          {mitVorschlaegen ? (
            <div className="space-y-3 pt-4">
              <div
                aria-label="Vorschläge"
                className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {STANDARD_TERMINE.map((v) => (
                  <button key={v.titel} type="button" onClick={() => waehle(v)} className={pille(v.jaehrlich ? geburt : titel === mitSymbol(v))}>
                    {mitSymbol(v)}
                  </button>
                ))}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[12.5px] font-semibold text-ink-muted">Meine Vorlagen</p>
                  {vorlieben?.vorlagen.length ? (
                    <button
                      type="button"
                      onClick={() => setBearbeiten(!bearbeiten)}
                      className="text-[12.5px] font-semibold text-brand-600"
                    >
                      {bearbeiten ? "Fertig" : "Bearbeiten"}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(vorlieben?.vorlagen ?? []).map((v, i) => (
                    <span key={`${v.titel}-${i}`} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          bearbeiten
                            ? void vorlagenSpeichern((vorlieben?.vorlagen ?? []).filter((_, j) => j !== i))
                            : waehle(v)
                        }
                        aria-label={bearbeiten ? `${v.titel} entfernen` : undefined}
                        className={cn(pille(!bearbeiten && titel === mitSymbol(v)), bearbeiten && "pr-8")}
                      >
                        {mitSymbol(v)}
                      </button>
                      {bearbeiten ? (
                        <X aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-crit-fg" />
                      ) : null}
                    </span>
                  ))}
                  {!eigeneNeu && (vorlieben?.vorlagen.length ?? 0) < 12 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBearbeiten(false);
                        setEigeneNeu({ titel: titel.trim(), min: ganz ? 0 : Math.min(minutenZwischen(von, bis), 1440) });
                      }}
                      className="h-9 rounded-full border-[1.5px] border-dashed border-ink/25 px-3.5 text-[13.5px] font-semibold text-ink-muted"
                    >
                      ＋ Eigene
                    </button>
                  ) : null}
                </div>
                {eigeneNeu ? (
                  <div className="mt-2 space-y-2 rounded-[16px] bg-ink/[0.04] p-3">
                    <input
                      autoFocus
                      value={eigeneNeu.titel}
                      onChange={(e) => setEigeneNeu({ ...eigeneNeu, titel: e.target.value })}
                      placeholder="z. B. 🏋️ Gym"
                      maxLength={48}
                      aria-label="Name der Vorlage"
                      className="h-11 w-full rounded-[12px] bg-surface/80 px-3 text-[16px] outline-none ring-1 ring-inset ring-ink/10 focus-visible:ring-2 focus-visible:ring-brand-500"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { min: 30, name: "30 Min." },
                        { min: 60, name: "1 Std." },
                        { min: 90, name: "1,5 Std." },
                        { min: 120, name: "2 Std." },
                        { min: 0, name: "Ganztägig" },
                      ].map((d) => (
                        <button
                          key={d.min}
                          type="button"
                          onClick={() => setEigeneNeu({ ...eigeneNeu, min: d.min })}
                          className={pille(eigeneNeu.min === d.min)}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEigeneNeu(null)}
                        className="h-10 flex-1 rounded-[12px] text-[14px] font-semibold text-ink-muted"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        disabled={!eigeneNeu.titel.trim()}
                        onClick={() => {
                          const roh = eigeneNeu.titel.trim();
                          // Ein Symbol am Anfang wird zum Symbol der Vorlage.
                          const treffer = /^(\p{Extended_Pictographic}[‍️\p{Extended_Pictographic}]*)\s*(.*)$/u.exec(roh);
                          const v: Vorlage = treffer && treffer[2]
                            ? { icon: treffer[1]!, titel: treffer[2], min: eigeneNeu.min }
                            : { icon: "", titel: roh, min: eigeneNeu.min };
                          setEigeneNeu(null);
                          void vorlagenSpeichern([...(vorlieben?.vorlagen ?? []), v]);
                          waehle(v);
                        }}
                        className="h-10 flex-1 rounded-[12px] bg-ink text-[14px] font-bold text-surface disabled:opacity-40"
                      >
                        Merken
                      </button>
                    </div>
                  </div>
                ) : null}
                {vorlagenFehler ? <p className="mt-2 text-[12.5px] text-crit-fg">{vorlagenFehler}</p> : null}
              </div>
            </div>
          ) : null}

          {!termin && !nurLesen && ziele.length ? (
            <div className="space-y-1.5 pt-4">
              <p className="text-[12.5px] font-semibold text-ink-muted">Für</p>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: null as string | null, name: "Mir" }, ...ziele].map((z) => (
                  <button key={z.id ?? "ich"} type="button" onClick={() => setZiel(z.id)} className={pille(ziel === z.id)}>
                    {z.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <fieldset disabled={nurLesen} className="m-0 min-w-0 border-0 p-0">
          <label className={zeile}>
            <span className="shrink-0">Titel</span>
            <input
              ref={titelFeld}
              id={`${id}-titel`}
              value={geburt ? ohneTorte(titel) : titel}
              onChange={(e) => setTitel(geburt ? `🎂 ${ohneTorte(e.target.value)}` : e.target.value)}
              placeholder={geburt ? "Wessen Geburtstag?" : "Ohne Titel"}
              maxLength={80}
              // Neuer Termin: gleich lostippen (die Tagesansicht hält die Tastatur dafür offen).
              autoFocus={!termin && !nurLesen}
              autoComplete="off"
              className={eingabe}
            />
          </label>
          <div className={zeile}>
            <span id={`${id}-geburt`}>🎂 Geburtstag</span>
            <button
              type="button"
              role="switch"
              aria-checked={geburt}
              aria-labelledby={`${id}-geburt`}
              data-geburtstag-schalter
              onClick={() => setzeGeburtstag(!geburt)}
              className={cn(
                "relative h-8 w-[52px] shrink-0 rounded-full transition-colors",
                geburt ? "bg-brand-500" : glas ? "bg-ink/[0.12]" : "bg-surface-sunken ring-1 ring-inset ring-line",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
                  geburt ? "left-1 translate-x-5" : "left-1",
                )}
              />
            </button>
          </div>
          {geburt ? (
            <>
              <label className={zeile}>
                <span className="shrink-0">
                  Geburtsjahr <span className="text-[13px] text-ink-muted">(freiwillig)</span>
                </span>
                <input
                  id={`${id}-gjahr`}
                  value={gjahr}
                  onChange={(e) => setGjahr(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="z. B. 1995"
                  autoComplete="off"
                  className={eingabe}
                />
              </label>
              <p className="pb-2 pt-1.5 text-[12.5px] text-ink-muted">
                {titel.replace("🎂", "").trim() === ""
                  ? "Wessen Geburtstag? Trag oben den Namen ein – er kommt dann jedes Jahr."
                  : alterVorschau && alterVorschau >= 1
                    ? `Im Kalender steht dann „${ohneTorte(titel).trim()} wird ${alterVorschau}“ – und jedes Jahr ein Jahr mehr.`
                    : "Mit dem Geburtsjahr zeigt der Kalender auch das Alter."}
              </p>
            </>
          ) : null}
          <div className={zeile}>
            <span id={`${id}-ganz`}>Ganztägig</span>
            <button
              type="button"
              role="switch"
              aria-checked={ganz}
              aria-labelledby={`${id}-ganz`}
              onClick={() => setGanz((g) => !g)}
              className={cn(
                "relative h-8 w-[52px] shrink-0 rounded-full transition-colors",
                ganz ? "bg-brand-500" : glas ? "bg-ink/[0.12]" : "bg-surface-sunken ring-1 ring-inset ring-line",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
                  ganz ? "left-1 translate-x-5" : "left-1",
                )}
              />
            </button>
          </div>
          {!ganz ? (
            <>
              <label className={zeile}>
                <span>Start</span>
                <input
                  id={`${id}-von`}
                  type="time"
                  value={von}
                  onChange={(e) => {
                    // Die Dauer bleibt gleich, wenn der Beginn wandert.
                    const laenge = minutenZwischen(von, bis);
                    setVon(e.target.value);
                    if (e.target.value) setBis(zeitPlus(e.target.value, laenge));
                  }}
                  className={cn(eingabe, "flex-none")}
                  required
                />
              </label>
              <label className={zeile}>
                <span>Ende</span>
                <input
                  id={`${id}-bis`}
                  type="time"
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  className={cn(eingabe, "flex-none")}
                  required
                />
              </label>
            </>
          ) : vorschlaege && !geburt && mehrtaegigGeht ? (
            <div className={cn(zeile, "flex-col items-stretch gap-2 py-3")}>
              <span>Wie lange?</span>
              <div className="flex flex-wrap gap-1.5">
                {DAUERN.map((d) => (
                  <button
                    key={d.tage}
                    type="button"
                    onClick={() => setBisDatum(addDays(tag, d.tage - 1))}
                    className={pille(tageAnzahl === d.tage)}
                  >
                    {d.name}
                  </button>
                ))}
                <label className={cn(pille(!DAUERN.some((d) => d.tage === tageAnzahl)), "relative flex items-center gap-1")}>
                  Bis
                  <input
                    type="date"
                    value={bisDatum}
                    min={tag}
                    max={addDays(tag, 62)}
                    onChange={(e) => {
                      const w = e.target.value;
                      if (/^\d{4}-\d{2}-\d{2}$/.test(w) && w >= tag && w <= addDays(tag, 62)) setBisDatum(w);
                    }}
                    aria-label="Letzter Tag"
                    className="w-[7.4rem] bg-transparent text-[13.5px] font-semibold outline-none"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {vorschlaege && !ziel && !termin?.inhaber ? (
          <>
          <Ausklapp
            zeile={zeile}
            titel="🔔 Erinnerung"
            wert={erinnerungText(erinnerungGueltig) ?? "Keine"}
            offen={offen === "erinnerung"}
            onToggle={() => setOffen((o) => (o === "erinnerung" ? null : "erinnerung"))}
            gesperrt={nurLesen}
          >
            <div className="flex flex-wrap gap-1.5">
              {erinnerungen.map((e) => (
                <button
                  key={e.id ?? "keine"}
                  type="button"
                  aria-pressed={!eigenOffen && erinnerungGueltig === e.id}
                  onClick={() => {
                    setErinnerung(e.id);
                    setEigenOffen(false);
                    setOffen(null);
                  }}
                  className={pille(!eigenOffen && erinnerungGueltig === e.id)}
                >
                  {e.name}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={eigenOffen || eigeneGewaehlt}
                onClick={() => setEigenOffen(true)}
                className={pille(eigenOffen || eigeneGewaehlt)}
              >
                Eigene …
              </button>
            </div>
            {eigenOffen || eigeneGewaehlt ? (
              <EigeneErinnerung
                key={ganz ? "ganz" : "zeit"}
                ganz={ganz}
                wert={eigeneGewaehlt ? erinnerungGueltig : null}
                onWahl={(e) => {
                  setErinnerung(e);
                  setEigenOffen(false);
                  setOffen(null);
                }}
              />
            ) : null}
          </Ausklapp>
          {erinnerungGueltig && !nurLesen ? <ErinnerungHinweis klein /> : null}
          </>
          ) : null}

          <Ausklapp
            zeile={zeile}
            titel="🔁 Wiederholen"
            wert={wdh !== "nie" && ende ? `${wiederholungText(wdh).replace(/ \(.*\)$/, "")} · bis ${formatDE(ende).slice(0, 6)}` : wiederholungText(wdh)}
            offen={offen === "wdh"}
            onToggle={() => setOffen((o) => (o === "wdh" ? null : "wdh"))}
            gesperrt={nurLesen}
          >
            <div className="flex flex-wrap gap-1.5">
              {WIEDERHOLUNGEN.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={wdh === w.id}
                  onClick={() => {
                    setWdh(w.id);
                    // Mit Wiederholung bleibt die Auswahl offen – darunter kann man das Ende setzen.
                    if (w.id === "nie") setOffen(null);
                  }}
                  className={pille(wdh === w.id)}
                >
                  {w.name}
                </button>
              ))}
            </div>
            {wdh !== "nie" ? (
              <InSicht className="space-y-1.5" data-serie-ende>
                <p className="text-[12.5px] font-semibold text-ink-muted">Endet</p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" aria-pressed={!ende} onClick={() => setEnde(null)} className={pille(!ende)}>
                    Nie
                  </button>
                  <label className={cn(pille(!!ende), "relative flex items-center gap-1.5")}>
                    Am
                    <input
                      type="date"
                      value={ende ?? ""}
                      min={startDatum}
                      onChange={(e) => {
                        const w = e.target.value;
                        if (/^\d{4}-\d{2}-\d{2}$/.test(w) && w >= startDatum) setEnde(w);
                        else if (!w) setEnde(null);
                      }}
                      aria-label="Letzter Tag der Wiederholung"
                      className="w-[7.4rem] bg-transparent text-[13.5px] font-semibold outline-none"
                    />
                  </label>
                </div>
              </InSicht>
            ) : null}

          </Ausklapp>

          <div className={cn("my-4 overflow-hidden rounded-2xl", glas ? "bg-ink/[0.05]" : "border border-line")}>
            <textarea
              id={`${id}-notiz`}
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Notizen"
              rows={2}
              maxLength={500}
              className="block w-full resize-none bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-ink-faint"
            />
            <input
              id={`${id}-ort`}
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder="Ort"
              maxLength={120}
              autoComplete="off"
              className={cn("block w-full border-t bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-ink-faint", glas ? "glas-linie" : "border-line")}
            />
          </div>
          </fieldset>
          <p className="pb-3 text-[12px] text-ink-faint">
            {hinweis}
          </p>
        </div>

        <div className={cn("flex items-center border-t", glas ? "glas-linie" : "border-line pb-[env(safe-area-inset-bottom)]")}>
          {termin && !nurLesen ? (
            <button
              type="button"
              // Vor dem Löschen wird immer gefragt.
              onClick={() => setLoeschFrage(true)}
              aria-label="Termin löschen"
              className="flex h-14 w-14 items-center justify-center text-crit-fg"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 text-[16px] font-semibold text-ink-muted"
          >
            Schließen
          </button>
          {!nurLesen ? (
            <button type="submit" className="h-14 flex-1 text-[16px] font-semibold text-brand-600">
              Speichern
            </button>
          ) : null}
        </div>
      </form>
      {loeschFrage && termin ? (
        <TerminLoeschenFrage
          termin={serieLoeschen ? termin : { ...termin, wiederholung: "nie" }}
          datum={vorkommenAm(termin, datum)}
          onJa={(modus) => onLoeschen(termin.id, serieLoeschen ? modus : "alle", vorkommenAm(termin, datum))}
          onClose={() => setLoeschFrage(false)}
        />
      ) : null}
    </div>,
    document.body,
  );
}

/**
 * Nachfrage vor dem Löschen eines Termins. Bei einer Wiederholung mit Wahl:
 * nur der Termin an diesem Tag, dieser und alle folgenden oder die ganze Serie.
 */
export function TerminLoeschenFrage({
  termin,
  datum,
  onJa,
  onClose,
}: {
  termin: Termin;
  /** Erster Tag des betroffenen Vorkommens. */
  datum: string;
  onJa: (modus: LoeschModus) => void;
  onClose: () => void;
}) {
  const serie = termin.wiederholung !== "nie";
  const erster = datum <= termin.datum;
  const [modus, setModus] = useState<LoeschModus>(serie ? "dieser" : "alle");
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);
  const name = `„${termin.titel || "Termin"}“`;
  const optionen: { id: LoeschModus; name: string; text: string }[] = [
    { id: "dieser", name: "Nur diesen Termin", text: `${formatDE(datum)} fällt aus, die anderen bleiben.` },
    ...(erster ? [] : [{ id: "ab" as const, name: "Diesen und alle folgenden", text: "Die Serie endet davor, frühere Termine bleiben." }]),
    { id: "alle", name: "Alle Termine der Serie", text: "Auch die vergangenen." },
  ];
  const wisch = useRef<HTMLDivElement>(null);
  useWischZu(wisch, true, onClose);
  return createPortal(
    <div
      className="privat privat-schrift fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        ref={wisch}
        role="alertdialog"
        aria-label="Termin löschen"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[24px] bg-surface p-4 shadow-[0_20px_50px_rgba(31,41,77,0.3)]"
      >
        <p className="text-[17px] font-bold">🗑️ Termin löschen?</p>
        {serie ? (
          <div className="mt-2 space-y-2" role="radiogroup" aria-label="Was soll gelöscht werden?">
            <p className="text-[14px] text-ink-muted">{name} wiederholt sich.</p>
            {optionen.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={modus === o.id}
                onClick={() => setModus(o.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[14px] border-[1.5px] px-3 py-2.5 text-left",
                  modus === o.id ? "border-ink bg-ink/[0.05]" : "border-ink/15",
                )}
              >
                <span
                  aria-hidden
                  className={cn("mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2", modus === o.id ? "border-ink bg-[radial-gradient(#1F294D_45%,transparent_50%)]" : "border-ink-faint")}
                />
                <span>
                  <span className="block text-[15px] font-semibold">{o.name}</span>
                  <span className="block text-[12.5px] text-ink-muted">{o.text}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[14px] text-ink-muted">
            {name} wird gelöscht.{termin.inhaber ? " Die Person bekommt kurz Bescheid." : ""}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-12 rounded-[16px] bg-ink/[0.07] text-[15px] font-semibold">
            Abbrechen
          </button>
          <button type="button" onClick={() => onJa(modus)} className="h-12 rounded-[16px] bg-[#e5484d] text-[15px] font-bold text-white">
            Löschen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Im Termin: wie lange noch (Tage, Stunden, Minuten) und „Countdown merken“ für die Countdown-Seite. */
function TerminCountdown({ termin }: { termin: Termin }) {
  const jetzt = useJetzt(30_000);
  const { countdowns, setze } = useCountdowns();
  if (termin.wiederholung && termin.wiederholung !== "nie") return null;
  const r = restBis(zeitpunkt(termin.datum, termin.ganztaegig ? "00:00" : termin.von), jetzt);
  if (r.ms <= 0) return null;
  const gemerkt = countdowns.termine.includes(termin.id);
  return (
    <div className="flex items-center gap-2 px-5 pt-3" data-termin-countdown>
      {(
        [
          [r.tage, "Tage"],
          [r.std, "Std"],
          [r.min, "Min"],
        ] as const
      ).map(([n, t]) => (
        <span key={t} className="flex-1 rounded-[12px] bg-ink/[0.05] py-1.5 text-center">
          <span className="tnum block text-[18px] font-bold leading-tight">{t === "Tage" ? n : String(n).padStart(2, "0")}</span>
          <span className="block text-[10.5px] text-ink-muted">{t}</span>
        </span>
      ))}
      <button
        type="button"
        onClick={() =>
          setze((c) => ({ ...c, termine: gemerkt ? c.termine.filter((x) => x !== termin.id) : [...c.termine, termin.id] }))
        }
        aria-pressed={gemerkt}
        className={cn("h-[46px] shrink-0 rounded-[12px] px-3 text-[12.5px] font-semibold", gemerkt ? "bg-brand-500 text-white" : "bg-brand-500/10 text-brand-600")}
      >
        {gemerkt ? "Gemerkt ✓" : "Countdown"}
      </button>
    </div>
  );
}
