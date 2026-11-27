"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Info, Paintbrush, Plus } from "lucide-react";
import { addDays, fromISO, monthName } from "@/lib/dates";
import { textFarbe } from "@/lib/privat/daten";
import type { Todo } from "@/lib/data/todos";
import type { LoeschModus } from "@/lib/data/verbindungen";
import { cn } from "@/lib/utils";
import { useWischZu } from "@/components/privat/blatt";
import { minutenZwischen, terminTitel, TerminLoeschenFrage, vorkommenAm, type Termin } from "./termine";

/**
 * Tagesansicht (Privat und Betrieb): oben die Woche, darunter Ganztägiges und
 * die Uhrzeiten. Der Pinsel oben blendet die Schichten zum Antippen ein.
 *
 * - Nach links/rechts wischen: anderer Tag (die Woche oben: andere Woche)
 * - Termin antippen: öffnen · darüber scrollen geht wie überall
 * - Termin halten: anheben und verschieben, danach an den
 *   Punkten oben/unten Beginn oder Ende ziehen
 * - Lang in eine freie Uhrzeit drücken: neuer Termin dort
 */

export interface Band {
  name: string;
  /** "HH:MM" */
  beginn: string;
  ende: string;
  farbe: string;
}

/** Schichten zum schnellen Setzen – eigene oder die einer Person, die es erlaubt. */
export interface LeisteDaten {
  personen: { key: string; name: string }[];
  person: string;
  onPerson: (key: string) => void;
  eintraege: { id: string; name: string; farbe: string }[];
  aktiv: string[];
  onWahl: (id: string) => void;
  hinweis?: string;
  laedt?: boolean;
}

/** Schicht einer anderen Person an diesem Tag (ohne Uhrzeit). */
export interface AndereSchicht {
  key: string;
  kurz: string;
  farbe: string;
  text: string;
}

const STUNDE = 56;
const RASTER = 15;
const WT_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WT_BUCHSTABE = ["M", "D", "M", "D", "F", "S", "S"];
const EIGEN = "#6C8CFF";
const karte = (farbe: string) => `color-mix(in srgb, ${farbe} 20%, rgb(var(--c-surface)))`;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const minuten = (z: string) => {
  const [h, m] = z.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const vibrieren = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    // ohne Vibration
  }
};

interface Lage {
  t: Termin;
  start: number;
  ende: number;
  spalte: number;
  spalten: number;
}

/** Termine nebeneinander, wenn sie sich überschneiden. */
function anordnen(termine: Termin[]): Lage[] {
  const liste = termine
    .filter((t) => !t.ganztaegig && t.von)
    .map((t) => {
      const start = minuten(t.von);
      const dauer = t.bis ? minutenZwischen(t.von, t.bis) : 60;
      return { t, start, ende: Math.min(1440, start + Math.max(dauer, 20)), spalte: 0, spalten: 1 };
    })
    .sort((a, b) => a.start - b.start || b.ende - a.ende);
  let gruppe: Lage[] = [];
  let gruppenEnde = -1;
  const fertig = (g: Lage[]) => {
    const n = Math.max(1, ...g.map((x) => x.spalte + 1));
    for (const x of g) x.spalten = n;
  };
  for (const x of liste) {
    if (x.start >= gruppenEnde && gruppe.length) {
      fertig(gruppe);
      gruppe = [];
    }
    const belegt = new Set(gruppe.filter((g) => g.ende > x.start).map((g) => g.spalte));
    let s = 0;
    while (belegt.has(s)) s++;
    x.spalte = s;
    gruppe.push(x);
    gruppenEnde = Math.max(gruppenEnde, x.ende);
  }
  if (gruppe.length) fertig(gruppe);
  return liste;
}

/** Schichten als Flächen an diesem Tag – auch der Rest einer Nacht vom Vortag. */
function flaechen(heute: Band[], gestern: Band[]) {
  const aus: { name: string; start: number; ende: number; farbe: string; zeit: string }[] = [];
  for (const b of heute) {
    if (!b.beginn || !b.ende) continue;
    const s = minuten(b.beginn);
    const e = minuten(b.ende);
    aus.push({ name: b.name, start: s, ende: e > s ? e : 1440, farbe: b.farbe, zeit: `${b.beginn}–${b.ende}` });
  }
  for (const b of gestern) {
    if (!b.beginn || !b.ende) continue;
    const s = minuten(b.beginn);
    const e = minuten(b.ende);
    if (e <= s && e > 0) aus.push({ name: b.name, start: 0, ende: e, farbe: b.farbe, zeit: `bis ${b.ende}` });
  }
  return aus;
}

type Geste =
  | { art: "termin"; t: Termin; x0: number; y0: number; uhr: number }
  | { art: "leer"; x0: number; y0: number; min: number; uhr: number }
  | { art: "wisch"; x0: number; woche: boolean; x: number; t: number; vx: number }
  | { art: "woche"; x0: number; y0: number; woche?: boolean };

interface Zug {
  id: string;
  art: "verschieben" | "start" | "ende";
  start: number;
  ende: number;
  neuStart: number;
  neuEnde: number;
  y0: number;
  scroll0: number;
}

export function Tagesansicht({
  iso,
  heute,
  onIso,
  baender,
  ganztaegig,
  termineAm,
  todos,
  terminVon,
  onTermin,
  onVerschieben,
  onLoeschen,
  darfLoeschen,
  darfVerschieben,
  onTodos,
  onClose,
  leiste,
  andere,
  onDetails,
}: {
  iso: string;
  heute: string;
  onIso: (iso: string) => void;
  /** Schichten eines Tages mit Uhrzeit. */
  baender: (iso: string) => Band[];
  /** Ganztägige Einträge des Tages (z. B. Urlaub, Frei, Feiertag). */
  ganztaegig: (iso: string) => { name: string; farbe: string }[];
  termineAm: (iso: string) => Termin[];
  todos: Todo[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  /** Termin öffnen; ohne Termin: neuer Termin ab startZeit. */
  onTermin: (t: Termin | null, startZeit?: string) => void;
  onVerschieben: (t: Termin, von: string, bis: string) => void;
  onLoeschen?: (t: Termin, modus: LoeschModus, datum: string) => void;
  darfLoeschen?: (t: Termin) => boolean;
  darfVerschieben?: (t: Termin) => boolean;
  onTodo?: (id: string, an: boolean) => void;
  onTodos: () => void;
  onClose: () => void;
  leiste?: LeisteDaten | null;
  andere?: (iso: string) => AndereSchicht[];
  /** Alles zu diesem Tag (das bisherige Tagesblatt). */
  onDetails?: () => void;
}) {
  const darfWeg = (t: Termin) => !!onLoeschen && (darfLoeschen ? darfLoeschen(t) : !t.vonPartner);
  const darfZiehen = (t: Termin) => (darfVerschieben ? darfVerschieben(t) : darfWeg(t) && t.wiederholung === "nie");

  const termine = termineAm(iso);
  const ganzeTermine = termine.filter((t) => t.ganztaegig);
  const lagen = anordnen(termine);
  const schichten = flaechen(baender(iso), baender(addDays(iso, -1)));
  const ganzeSchichten = ganztaegig(iso);
  const andereHeute = andere?.(iso) ?? [];
  const tagTodos = todos.filter((t) => t.datum === iso);
  const offen = tagTodos.filter((t) => !t.erledigt).length;

  const flaeche = useRef<HTMLDivElement>(null);
  const fokus = useRef<HTMLInputElement>(null);
  const breite = useRef(390);
  const [versatz, setVersatz] = useState(0);
  const [weich, setWeich] = useState(false);
  const [wocheVersatz, setWocheVersatz] = useState(0);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [zug, setZug] = useState<Zug | null>(null);
  const [neu, setNeu] = useState<number | null>(null);
  const [frage, setFrage] = useState<Termin | null>(null);
  /** Pinsel oben: zeigt die Schichten zum Antippen (bleibt beim Wischen offen). */
  const [pinsel, setPinsel] = useState(false);
  const geste = useRef<Geste | null>(null);
  const zugRef = useRef(zug);
  const neuRef = useRef(neu);
  useEffect(() => {
    zugRef.current = zug;
    neuRef.current = neu;
  });

  // Beim Öffnen zum ersten Eintrag (oder eine Stunde vor jetzt) scrollen – beim Blättern bleibt die Uhrzeit stehen.
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    breite.current = el.clientWidth || 390;
    const starts = [...lagen.map((l) => l.start), ...schichten.map((s) => s.start)];
    const jetzt = new Date();
    const ziel = iso === heute ? jetzt.getHours() * 60 - 60 : starts.length ? Math.min(...starts) - 30 : 7 * 60;
    el.scrollTop = Math.max(0, (ziel / 60) * STUNDE);
    // nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ausgewählter Termin weg (gelöscht, anderer Tag): Auswahl aufheben.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (auswahl && !termine.some((t) => t.id === auswahl)) setAuswahl(null);
  }, [termine, auswahl]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || zugRef.current || frage) return;
      if (auswahl) setAuswahl(null);
      else onClose();
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose, auswahl, frage]);

  /** Tag wechseln mit Gleiten: raus zur Seite, neuer Tag kommt von der anderen. */
  function wechsle(richtung: 1 | -1, woche = false) {
    const w = breite.current;
    setAuswahl(null);
    setWeich(true);
    if (woche) setWocheVersatz(-richtung * w);
    else setVersatz(-richtung * w);
    window.setTimeout(() => {
      setWeich(false);
      onIso(addDays(iso, richtung * (woche ? 7 : 1)));
      if (woche) setWocheVersatz(richtung * w * 0.6);
      else setVersatz(richtung * w * 0.6);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setWeich(true);
          setVersatz(0);
          setWocheVersatz(0);
        }),
      );
    }, 170);
  }

  function neuOeffnen(min: number) {
    // Tastatur: im selben Tipp ein Feld fokussieren, das Blatt übernimmt den Fokus.
    fokus.current?.focus({ preventScroll: true });
    onTermin(null, hhmm(min));
  }

  // Termine lassen sich normal scrollen (pan-y); erst wenn einer angehoben ist,
  // hält die Seite still, damit nur der Termin wandert.
  // Auf dem Handy läuft ein angehobener Termin über die Touch-Ereignisse: iOS
  // bricht die Pointer-Ereignisse dabei gern ab (pointercancel) – dann blieb der
  // Termin zwar optisch verschoben, gespeichert wurde aber nicht.
  const finger = useRef(false);

  // Alle Bewegungen laufen über das Fenster – auch wenn der Finger den Termin verlässt.
  useEffect(() => {
    /** Angehobenen Termin der Fingerhöhe nachführen (15-Minuten-Raster). */
    function ziehen(z: Zug, y: number) {
      const el = flaeche.current;
      if (!el) return;
      {
        const r = el.getBoundingClientRect();
        if (y < r.top + 32) el.scrollTop -= 6;
        else if (y > r.bottom - 32) el.scrollTop += 6;
        const delta = ((y - z.y0 + (el.scrollTop - z.scroll0)) / STUNDE) * 60;
        const auf = (m: number) => Math.round(m / RASTER) * RASTER;
        let s = z.start;
        let en = z.ende;
        if (z.art === "verschieben") {
          s = Math.max(0, Math.min(1440 - (z.ende - z.start), auf(z.start + delta)));
          en = s + (z.ende - z.start);
        } else if (z.art === "start") s = Math.max(0, Math.min(z.ende - RASTER, auf(z.start + delta)));
        else en = Math.min(1440, Math.max(z.start + RASTER, auf(z.ende + delta)));
        if (s !== z.neuStart || en !== z.neuEnde) {
          if (s !== z.neuStart && z.art !== "ende") vibrieren();
          const neu = { ...z, neuStart: s, neuEnde: en };
          zugRef.current = neu; // sofort, damit das Loslassen die letzte Stelle kennt
          setZug(neu);
        }
      }
    }
    /** Termin absetzen und speichern – genau einmal, egal welches Ereignis zuerst kommt. */
    function absetzen(z: Zug) {
      zugRef.current = null;
      setZug(null);
      const t = termine.find((x) => x.id === z.id);
      if (t && (z.neuStart !== z.start || z.neuEnde !== z.ende)) onVerschieben(t, hhmm(z.neuStart), hhmm(Math.min(1439, z.neuEnde)));
    }
    function bewegen(e: PointerEvent) {
      const g = geste.current;
      const z = zugRef.current;
      if (z) {
        e.preventDefault();
        // Finger auf dem Glas: das übernehmen die Touch-Ereignisse.
        if (!(finger.current && e.pointerType === "touch")) ziehen(z, e.clientY);
        return;
      }
      if (!g) return;
      const dx = e.clientX - g.x0;
      if (g.art === "wisch") {
        // Tempo merken: ein kurzer schneller Wisch reicht zum Blättern.
        const jetztT = performance.now();
        const dt = Math.max(1, jetztT - g.t);
        geste.current = { ...g, x: e.clientX, t: jetztT, vx: 0.6 * ((e.clientX - g.x) / dt) + 0.4 * g.vx };
        // Am Ende weicher (Gummiband-Gefühl).
        const v = Math.abs(dx) > 120 ? Math.sign(dx) * (120 + (Math.abs(dx) - 120) * 0.5) : dx;
        if (g.woche) setWocheVersatz(v);
        else setVersatz(v);
        return;
      }
      if (g.art === "termin" || g.art === "leer" || g.art === "woche") {
        const dy = e.clientY - g.y0;
        if (Math.hypot(dx, dy) < 7) return;
        if (g.art === "termin" || g.art === "leer") window.clearTimeout(g.uhr);
        if (Math.abs(dx) > Math.abs(dy)) {
          geste.current = { art: "wisch", x0: g.x0, woche: g.art === "woche" && g.woche !== false, x: e.clientX, t: performance.now(), vx: 0 };
          setWeich(false);
        } else {
          geste.current = null;
        }
      }
    }
    function los(e: PointerEvent) {
      const g = geste.current;
      geste.current = null;
      const z = zugRef.current;
      if (z) {
        if (!(finger.current && e.pointerType === "touch")) absetzen(z);
        return;
      }
      const n = neuRef.current;
      if (n !== null) {
        setNeu(null);
        neuOeffnen(n);
        return;
      }
      if (!g) return;
      if (g.art === "wisch") {
        // Bei Abbruch (pointercancel) zählt die letzte bekannte Position.
        const dx = (e.type === "pointerup" ? e.clientX : g.x) - g.x0;
        const schnell = Math.abs(g.vx) > 0.3 && Math.abs(dx) > 20 && Math.sign(g.vx) === Math.sign(dx);
        if (Math.abs(dx) > Math.min(60, breite.current * 0.15) || schnell) wechsle(dx < 0 ? 1 : -1, g.woche);
        else {
          setWeich(true);
          setVersatz(0);
          setWocheVersatz(0);
        }
        return;
      }
      if (g.art === "termin") {
        window.clearTimeout(g.uhr);
        // Kurz getippt: öffnen.
        if (e.type === "pointerup") onTermin(g.t);
        return;
      }
      if (g.art === "leer") {
        window.clearTimeout(g.uhr);
        if (e.type === "pointerup") setAuswahl(null);
      }
    }
    function fingerAn() {
      finger.current = true;
    }
    function fingerZieht(e: TouchEvent) {
      const z = zugRef.current;
      if (!z) return;
      // Die Seite hält still, nur der Termin wandert.
      if (e.cancelable) e.preventDefault();
      const p = e.touches[0];
      if (p) ziehen(z, p.clientY);
    }
    function fingerWeg(e: TouchEvent) {
      if (e.touches.length) return;
      finger.current = false;
      const z = zugRef.current;
      if (z) absetzen(z);
    }
    window.addEventListener("pointermove", bewegen, { passive: false });
    window.addEventListener("pointerup", los);
    window.addEventListener("pointercancel", los);
    window.addEventListener("touchstart", fingerAn, { passive: true });
    window.addEventListener("touchmove", fingerZieht, { passive: false });
    window.addEventListener("touchend", fingerWeg);
    window.addEventListener("touchcancel", fingerWeg);
    return () => {
      window.removeEventListener("touchstart", fingerAn);
      window.removeEventListener("touchmove", fingerZieht);
      window.removeEventListener("touchend", fingerWeg);
      window.removeEventListener("touchcancel", fingerWeg);
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", los);
      window.removeEventListener("pointercancel", los);
    };
    // wechsle/neuOeffnen hängen nur an Props und Refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termine, iso, onTermin, onVerschieben, onIso]);

  function terminDruck(e: React.PointerEvent, l: Lage) {
    e.stopPropagation();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const uhr = window.setTimeout(() => {
      const g = geste.current;
      if (!g || g.art !== "termin") return;
      geste.current = null;
      if (!darfZiehen(l.t)) {
        // Nicht verschiebbar (z. B. Serie oder fremd): nur öffnen.
        onTermin(l.t);
        return;
      }
      vibrieren();
      setAuswahl(l.t.id);
      const z: Zug = { id: l.t.id, art: "verschieben", start: l.start, ende: l.ende, neuStart: l.start, neuEnde: l.ende, y0, scroll0: flaeche.current?.scrollTop ?? 0 };
      zugRef.current = z; // sofort, damit die Seite ab dem ersten Zucken stillhält
      setZug(z);
    }, 320);
    geste.current = { art: "termin", t: l.t, x0, y0, uhr };
  }

  function griffDruck(e: React.PointerEvent, l: Lage, welcher: "start" | "ende") {
    e.stopPropagation();
    e.preventDefault();
    vibrieren();
    const z: Zug = { id: l.t.id, art: welcher, start: l.start, ende: l.ende, neuStart: l.start, neuEnde: l.ende, y0: e.clientY, scroll0: flaeche.current?.scrollTop ?? 0 };
    zugRef.current = z;
    setZug(z);
  }

  function leerDruck(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const min = Math.max(0, Math.min(23 * 60, Math.floor((((e.clientY - r.top) / STUNDE) * 60) / RASTER) * RASTER));
    const uhr = window.setTimeout(() => {
      const g = geste.current;
      if (!g || g.art !== "leer") return;
      geste.current = null;
      vibrieren();
      setAuswahl(null);
      setNeu(min);
    }, 450);
    geste.current = { art: "leer", x0: e.clientX, y0: e.clientY, min, uhr };
  }

  const blattRef = useRef<HTMLDivElement>(null);
  useWischZu(blattRef, "kopf", onClose);

  const d = fromISO(iso);
  const montag = addDays(iso, -((d.getDay() + 6) % 7));
  const jetzt = (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();
  const kollision = (s: number, e: number) => schichten.some((x) => s < x.ende && e > x.start);
  const gewaehlt = auswahl ? lagen.find((l) => l.t.id === auswahl) ?? null : null;
  const zeitAnzeige = zug ? { start: zug.neuStart, ende: zug.neuEnde } : null;
  // Griffe am ausgewählten Termin: oben rechts Beginn, unten links Ende.
  const griffe =
    gewaehlt && darfZiehen(gewaehlt.t)
      ? {
          l: gewaehlt,
          sp: 100 / gewaehlt.spalten,
          start: zug?.id === gewaehlt.t.id ? zug.neuStart : gewaehlt.start,
          ende: zug?.id === gewaehlt.t.id ? zug.neuEnde : gewaehlt.ende,
          farbe: terminVon(gewaehlt.t)?.farbe ?? EIGEN,
        }
      : null;

  const inhalt = (
    <div
      ref={blattRef}
      className="privat privat-schrift fixed inset-0 z-50 flex select-none flex-col bg-[rgb(var(--c-surface))] pt-[max(0.6rem,env(safe-area-inset-top))] [-webkit-touch-callout:none]"
      role="dialog"
      aria-label="Tagesansicht"
      data-tagesansicht={iso}
    >
      {/* Unsichtbares Feld: hält die Tastatur offen, bis das Termin-Blatt da ist. */}
      <input ref={fokus} aria-hidden tabIndex={-1} className="pointer-events-none fixed left-0 top-0 h-px w-px text-[16px] opacity-0" />

      <header data-wisch-kopf className="flex items-center justify-between gap-2 px-3 pb-2">
        <button type="button" onClick={onClose} aria-label="Zurück zum Monat" className="glas flex h-10 items-center gap-0.5 rounded-full pl-2 pr-3.5 text-[15.5px] font-semibold">
          <ChevronLeft className="h-5 w-5" /> {monthName(d.getMonth())}
        </button>
        <div className="glas flex h-10 items-center rounded-full px-1">
          {leiste ? (
            <button
              type="button"
              onClick={() => setPinsel((p) => !p)}
              aria-label="Schicht eintragen"
              aria-expanded={pinsel}
              className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-colors", pinsel && "bg-brand-500 text-white")}
              data-tag-pinsel
            >
              <Paintbrush className="h-[18px] w-[18px]" />
            </button>
          ) : null}
          {onDetails ? (
            <button type="button" onClick={onDetails} aria-label="Alles zu diesem Tag" className="flex h-9 w-9 items-center justify-center rounded-full" data-tag-details>
              <Info className="h-[19px] w-[19px]" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => neuOeffnen(iso === heute ? Math.min(23 * 60, Math.ceil((jetzt + 1) / 60) * 60) : 9 * 60)}
            aria-label="Neuer Termin"
            className="flex h-9 w-9 items-center justify-center rounded-full"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>
      </header>

      {/* Woche: antippen = Tag, wischen = andere Woche */}
      <div
        className="touch-pan-y overflow-hidden px-1.5"
        onPointerDown={(e) => {
          geste.current = { art: "woche", x0: e.clientX, y0: e.clientY };
        }}
      >
        <div
          className={cn("grid grid-cols-7", weich && "transition-transform duration-200 ease-out")}
          style={{ transform: `translateX(${wocheVersatz}px)` }}
        >
          {Array.from({ length: 7 }, (_, i) => addDays(montag, i)).map((t, i) => {
            const an = t === iso;
            const punkte = [...baender(t).map((b) => b.farbe), ...ganztaegig(t).map((g) => g.farbe)].slice(0, 3);
            return (
              <button
                key={t}
                type="button"
                onClick={() => !an && onIso(t)}
                aria-pressed={an}
                aria-label={`${WT_LANG[fromISO(t).getDay()]}, ${fromISO(t).getDate()}.`}
                className="flex flex-col items-center py-0.5"
              >
                <span className={cn("text-[11px] font-semibold", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>{WT_BUCHSTABE[i]}</span>
                <span
                  className={cn(
                    "tnum mt-0.5 flex h-9 w-9 items-center justify-center rounded-[12px] text-[18px] font-semibold transition-colors",
                    an ? "bg-brand-500 text-white" : t === heute ? "text-[#e5484d]" : i >= 5 ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {fromISO(t).getDate()}
                </span>
                <span className="mt-0.5 flex h-1.5 gap-[3px]" aria-hidden>
                  {punkte.map((f, k) => (
                    <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: f }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glas-linie border-b pb-2 pt-1.5 text-center text-[15px] font-bold" aria-live="polite">
        {WT_LANG[d.getDay()]} · {d.getDate()}. {monthName(d.getMonth())}
        {d.getFullYear() !== fromISO(heute).getFullYear() ? ` ${d.getFullYear()}` : ""}
      </div>

      {/* Alles darunter gleitet beim Wischen mit */}
      <div
        className={cn("flex min-h-0 flex-1 flex-col", weich && "transition-transform duration-200 ease-out")}
        style={{ transform: `translateX(${versatz}px)` }}
        onPointerDown={(e) => {
          // Überall im Tag wischen – Termine und freie Zeit setzen ihre Geste vorher selbst.
          if (!geste.current && !zugRef.current) geste.current = { art: "woche", x0: e.clientX, y0: e.clientY, woche: false };
        }}
      >
        {leiste && pinsel ? (
          <div className="px-3 pt-2" data-tag-leiste>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {leiste.personen.length > 1 ? (
                <span className="flex shrink-0 rounded-full bg-ink/[0.06] p-0.5" role="radiogroup" aria-label="Schichten von">
                  {leiste.personen.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={leiste.person === p.key}
                      onClick={() => leiste.onPerson(p.key)}
                      className={cn("h-7 rounded-full px-2.5 text-[12.5px] font-bold", leiste.person === p.key ? "bg-surface shadow-sm" : "text-ink-muted")}
                    >
                      {p.name}
                    </button>
                  ))}
                </span>
              ) : null}
              {leiste.laedt ? <span className="px-2 text-[12.5px] text-ink-muted">Lädt …</span> : null}
              {leiste.eintraege.map((a) => {
                const an = leiste.aktiv.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => leiste.onWahl(a.id)}
                    aria-pressed={an}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-[transform,background-color,color] active:scale-95",
                      an ? "" : "bg-ink/[0.06] text-ink",
                    )}
                    style={an ? { backgroundColor: a.farbe, color: textFarbe(a.farbe) } : undefined}
                  >
                    {an ? null : <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.farbe }} />}
                    {a.name}
                  </button>
                );
              })}
            </div>
            {leiste.hinweis ? <p className="pb-1 text-[12px] text-ink-muted">{leiste.hinweis}</p> : null}
          </div>
        ) : null}

        <div className="glas-linie flex items-center gap-1.5 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="w-[3.4rem] shrink-0 text-[11px] text-ink-faint">ganztägig</span>
          {ganzeSchichten.map((g, i) => (
            <span key={`g-${i}`} className="flex h-7 shrink-0 items-center rounded-[9px] px-2.5 text-[12.5px] font-bold" style={{ backgroundColor: karte(g.farbe), boxShadow: `inset 3px 0 0 ${g.farbe}` }}>
              {g.name}
            </span>
          ))}
          {andereHeute.map((a) => (
            <span key={`a-${a.key}`} className="flex h-7 shrink-0 items-center gap-1 rounded-[9px] px-2 text-[12.5px] font-bold" style={{ backgroundColor: karte(a.farbe) }}>
              <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full text-[9px] text-white" style={{ backgroundColor: a.farbe }}>
                {a.kurz.slice(0, 2)}
              </span>
              {a.text}
            </span>
          ))}
          {ganzeTermine.map((t) => {
            const von = terminVon(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTermin(t)}
                className="flex h-7 max-w-[60%] shrink-0 items-center gap-1 truncate rounded-[9px] px-2.5 text-[12.5px] font-bold"
                style={{ backgroundColor: karte(von?.farbe ?? EIGEN), boxShadow: `inset 3px 0 0 ${von?.farbe ?? EIGEN}` }}
              >
                {von ? (
                  <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full text-[9px] text-white" style={{ backgroundColor: von.farbe }}>
                    {von.name.slice(0, 1)}
                  </span>
                ) : null}
                <span className="truncate">{terminTitel(t, iso)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onTodos}
            className={cn("ml-auto flex h-7 shrink-0 items-center rounded-[9px] px-2.5 text-[12.5px] font-semibold", offen ? "bg-ok-bg text-ink" : "text-ink-muted")}
          >
            ✓ {offen ? `${offen} To-do${offen === 1 ? "" : "s"}` : "To-dos"}
          </button>
        </div>

        <div
          ref={flaeche}
          className={cn("relative min-h-0 flex-1 overscroll-contain", zug ? "touch-none overflow-hidden" : "touch-pan-y overflow-y-auto")}
          data-tag-raster
        >
          <div className="relative" style={{ height: 24 * STUNDE + 24 }}>
            {Array.from({ length: 25 }, (_, h) => {
              const nahe = (m: number | undefined) => m !== undefined && Math.abs(m - h * 60) < 20;
              const versteckt = nahe(zeitAnzeige?.start) || nahe(zeitAnzeige?.ende) || (iso === heute && Math.abs(jetzt - h * 60) < 16);
              return (
                <div key={h} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: 12 + h * STUNDE }}>
                  <span className={cn("tnum w-[3.4rem] shrink-0 pr-2 text-right text-[11px] text-ink-faint", versteckt && "opacity-0")}>
                    {String(h % 24).padStart(2, "0")}:00
                  </span>
                  <span className="h-px flex-1 bg-ink/[0.08]" />
                </div>
              );
            })}

            {zeitAnzeige ? (
              <>
                <span className="tnum pointer-events-none absolute z-[5] w-[3.4rem] pr-2 text-right text-[11px] font-bold text-brand-600" style={{ top: 12 + (zeitAnzeige.start / 60) * STUNDE - 8 }}>
                  {hhmm(zeitAnzeige.start)}
                </span>
                <span className="tnum pointer-events-none absolute z-[5] w-[3.4rem] pr-2 text-right text-[11px] font-bold text-brand-600" style={{ top: 12 + (zeitAnzeige.ende / 60) * STUNDE - 8 }}>
                  {hhmm(zeitAnzeige.ende % 1440)}
                </span>
              </>
            ) : null}

            <div
              className="absolute bottom-3 left-[3.4rem] right-2 top-3 [-webkit-touch-callout:none]"
              onPointerDown={leerDruck}
              onContextMenu={(e) => e.preventDefault()}
              data-tag-flaeche
            >
              {schichten.map((s, i) => (
                <div
                  key={`s-${i}`}
                  className="pointer-events-none absolute inset-x-0 rounded-[10px] px-2.5 py-1.5"
                  style={{
                    top: (s.start / 60) * STUNDE,
                    height: Math.max(22, ((s.ende - s.start) / 60) * STUNDE),
                    backgroundColor: `color-mix(in srgb, ${s.farbe} 16%, transparent)`,
                    boxShadow: `inset 4px 0 0 ${s.farbe}`,
                  }}
                >
                  <span className="block text-[12.5px] font-bold leading-tight">{s.name}</span>
                  <span className="tnum block text-[11px] text-ink-muted">{s.zeit}</span>
                </div>
              ))}

              {iso === heute ? (
                <div className="pointer-events-none absolute -left-[3.4rem] right-0 z-[4] flex items-center" style={{ top: (jetzt / 60) * STUNDE }}>
                  <span className="tnum ml-1 rounded-full bg-[#e5484d] px-1.5 py-[1px] text-[10.5px] font-bold text-white">{hhmm(jetzt)}</span>
                  <span className="h-[2px] flex-1 bg-[#e5484d]" />
                </div>
              ) : null}

              {neu !== null ? (
                <div
                  className="pointer-events-none absolute inset-x-1 z-[6] rounded-[10px] bg-brand-500 px-2.5 py-1 text-white shadow-[0_12px_28px_rgba(0,0,0,0.25)]"
                  style={{ top: (neu / 60) * STUNDE, height: STUNDE - 2 }}
                  data-neuer-termin
                >
                  <span className="block text-[13px] font-bold">Neuer Termin</span>
                  <span className="tnum block text-[11.5px] opacity-90">
                    {hhmm(neu)}–{hhmm(Math.min(1439, neu + 60))}
                  </span>
                </div>
              ) : null}

              {lagen.map((l) => {
                const zieht = zug?.id === l.t.id;
                const an = auswahl === l.t.id;
                const von = terminVon(l.t);
                const farbe = von?.farbe ?? EIGEN;
                const sp = 100 / l.spalten;
                const start = zieht && zug ? zug.neuStart : l.start;
                const ende = zieht && zug ? zug.neuEnde : l.ende;
                return (
                  <div
                    key={l.t.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => terminDruck(e, l)}
                    onKeyDown={(e) => e.key === "Enter" && onTermin(l.t)}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={`${terminTitel(l.t, iso)}, ${l.t.von}${l.t.bis ? ` bis ${l.t.bis}` : ""}${von ? `, ${von.name}` : ""}`}
                    data-termin-block={l.t.id}
                    className={cn(
                      "absolute flex touch-pan-y select-none flex-col overflow-hidden rounded-[10px] px-2.5 py-1 text-left [-webkit-touch-callout:none]",
                      an || zieht ? "z-[5] shadow-[0_14px_30px_rgba(31,41,77,0.3)]" : "z-[2]",
                      zieht ? "scale-[1.015]" : "transition-[top,height] duration-150",
                    )}
                    style={{
                      top: (start / 60) * STUNDE + 1,
                      height: Math.max(24, ((ende - start) / 60) * STUNDE - 2),
                      left: `calc(${l.spalte * sp}% + 2px)`,
                      width: `calc(${sp}% - 4px)`,
                      backgroundColor: an || zieht ? farbe : karte(farbe),
                      color: an || zieht ? textFarbe(farbe) : undefined,
                      boxShadow: an || zieht ? undefined : `inset 4px 0 0 ${farbe}`,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-1 truncate text-[13px] font-bold leading-tight">
                      {von ? (
                        <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[9px] text-white" style={{ backgroundColor: farbe }}>
                          {von.name.slice(0, 1)}
                        </span>
                      ) : null}
                      <span className="truncate">{terminTitel(l.t, iso)}</span>
                    </span>
                    <span className={cn("tnum truncate text-[11.5px]", an || zieht ? "opacity-90" : "text-ink-muted")}>
                      {hhmm(start)}–{hhmm(ende % 1440)}
                      {zieht && kollision(start, ende) ? " · ⚠︎ in der Schicht" : ""}
                    </span>
                  </div>
                );
              })}

              {/* Griffe am ausgewählten Termin: oben rechts Beginn, unten links Ende */}
              {griffe ? (
                <>
                  <span
                    className="absolute z-[7] flex h-8 w-8 touch-none items-center justify-center"
                    style={{ top: (griffe.start / 60) * STUNDE - 15, left: `calc(${(griffe.l.spalte + 1) * griffe.sp}% - 26px)` }}
                    onPointerDown={(e) => griffDruck(e, griffe.l, "start")}
                    aria-label="Beginn ziehen"
                    data-griff="start"
                  >
                    <span className="h-[11px] w-[11px] rounded-full border-2 bg-surface" style={{ borderColor: griffe.farbe }} />
                  </span>
                  <span
                    className="absolute z-[7] flex h-8 w-8 touch-none items-center justify-center"
                    style={{ top: (griffe.ende / 60) * STUNDE - 17, left: `calc(${griffe.l.spalte * griffe.sp}% - 6px)` }}
                    onPointerDown={(e) => griffDruck(e, griffe.l, "ende")}
                    aria-label="Ende ziehen"
                    data-griff="ende"
                  >
                    <span className="h-[11px] w-[11px] rounded-full border-2 bg-surface" style={{ borderColor: griffe.farbe }} />
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Unten: zurück zu heute – oder, mit Auswahl, Bearbeiten und Löschen */}
      <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.8rem,env(safe-area-inset-bottom))] z-[8] flex items-end justify-between">
        {gewaehlt ? (
          <div className="glas pointer-events-auto mx-auto flex items-center gap-1 rounded-full p-1 text-[14px] font-semibold" data-auswahl-leiste>
            <button type="button" onClick={() => onTermin(gewaehlt.t)} className="h-9 rounded-full px-3.5">
              Bearbeiten
            </button>
            {darfWeg(gewaehlt.t) ? (
              <button type="button" onClick={() => setFrage(gewaehlt.t)} className="h-9 rounded-full px-3.5 text-crit-fg">
                Löschen
              </button>
            ) : null}
            <button type="button" onClick={() => setAuswahl(null)} className="h-9 rounded-full bg-ink px-3.5 text-surface">
              Fertig
            </button>
          </div>
        ) : (
          <>
            {iso !== heute ? (
              <button type="button" onClick={() => onIso(heute)} className="glas pointer-events-auto h-10 rounded-full px-4 text-[15px] font-semibold">
                Heute
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClose} className="glas pointer-events-auto h-10 rounded-full px-4 text-[15px] font-semibold">
              Monat
            </button>
          </>
        )}
      </div>

      {frage ? (
        <TerminLoeschenFrage
          termin={frage}
          datum={vorkommenAm(frage, iso)}
          onJa={(modus) => {
            const t = frage;
            setFrage(null);
            setAuswahl(null);
            onLoeschen?.(t, modus, vorkommenAm(t, iso));
          }}
          onClose={() => setFrage(null)}
        />
      ) : null}
    </div>
  );
  return createPortal(inhalt, document.body);
}
