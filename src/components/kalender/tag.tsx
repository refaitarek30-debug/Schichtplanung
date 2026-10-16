"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, ListTodo, Plus, Trash2, X } from "lucide-react";
import { addDays, formatDE, fromISO, monthName } from "@/lib/dates";
import { textFarbe } from "@/lib/privat/daten";
import type { Todo } from "@/lib/data/todos";
import type { Rolle } from "@/lib/data/todos";
import { cn } from "@/lib/utils";
import { Blatt } from "@/components/privat/blatt";
import { erinnerungText, minutenZwischen, type Termin } from "./termine";
import { TODO_VORSCHLAEGE } from "./vorschlaege";
import { ErinnerungHinweis } from "./erinnerungen";

/**
 * Bausteine rund um einen Tag: die Schicht-Leiste im Tagesblatt, die
 * Schnellauswahl beim langen Drücken, die Tagesansicht mit Zeitleiste und
 * die To-do-Liste. Für den Privat- und den Firmenkalender.
 */

const WT_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Farbe als Fläche: Schrift passend dazu. */
export const farbFlaeche = (farbe: string): React.CSSProperties => ({ backgroundColor: farbe, color: textFarbe(farbe) });

/** „Heute“, „Morgen“, „Gestern“ – sonst das Jahr. */
function tagName(iso: string, heute: string): string {
  if (iso === heute) return "Heute";
  if (iso === addDays(heute, 1)) return "Morgen";
  if (iso === addDays(heute, -1)) return "Gestern";
  return String(fromISO(iso).getFullYear());
}

// ---- Schicht-Leiste ---------------------------------------------------------------

export interface LeistenEintrag {
  id: string;
  name: string;
  farbe: string;
  /** 1 = erster Eintrag des Tages, 2 = zweiter, 0 = nicht gesetzt */
  rang: 0 | 1 | 2;
}

export function SchichtLeiste({
  eintraege,
  onTipp,
  nachricht,
  ende,
}: {
  eintraege: LeistenEintrag[];
  onTipp: (id: string) => void;
  nachricht: string;
  /** Etwas am Ende der Leiste, z. B. „＋ Neu“. */
  ende?: ReactNode;
}) {
  return (
    <div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {eintraege.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onTipp(e.id)}
            aria-pressed={e.rang > 0}
            className={cn(
              "relative h-11 min-w-[4.6rem] shrink-0 rounded-full px-4 text-[14.5px] font-bold transition-transform active:scale-[0.96]",
              e.rang === 1 && "ring-[2.5px] ring-ink ring-offset-2 ring-offset-surface",
              e.rang === 2 && "ring-[2.5px] ring-ink/45 ring-offset-2 ring-offset-surface",
            )}
            style={farbFlaeche(e.farbe)}
          >
            {e.name}
            {e.rang === 2 ? (
              <span aria-hidden className="absolute -right-1 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-surface">
                2
              </span>
            ) : null}
          </button>
        ))}
        {ende}
      </div>
      <p className="mt-1 min-h-[17px] text-[12.5px] text-ink-muted" aria-live="polite">
        {nachricht}
      </p>
    </div>
  );
}

/** Kleine Pille oben im Tagesblatt: was gerade eingetragen ist. */
export function EintragPille({
  name,
  zeit,
  farbe,
  marke,
  onEntfernen,
}: {
  name: string;
  zeit?: string | null;
  farbe: string;
  marke?: string;
  onEntfernen?: () => void;
}) {
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-ink/[0.06] pl-2.5 pr-1 text-[13px] font-semibold">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: farbe }} />
      <span className="truncate">
        {name}
        {zeit ? <span className="tnum font-normal text-ink-muted"> · {zeit}</span> : null}
        {marke ? <span className="font-normal text-ink-faint"> · {marke}</span> : null}
      </span>
      {onEntfernen ? (
        <button
          type="button"
          onClick={onEntfernen}
          aria-label={`${name} entfernen`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted active:bg-ink/10"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </span>
  );
}

// ---- Am Tag: Termine und To-dos ---------------------------------------------------

export function AmTag({
  termine,
  todos,
  terminVon,
  onTermin,
  onTodo,
}: {
  termine: Termin[];
  todos: Todo[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  onTermin: (t: Termin) => void;
  onTodo: (id: string, an: boolean) => void;
}) {
  if (!termine.length && !todos.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[12.5px] font-semibold text-ink-muted">Am Tag</p>
      <ul className="space-y-1.5">
        {termine.map((t) => {
          const von = terminVon(t);
          const erinnerung = erinnerungText(t.erinnerung);
          return (
            <li key={`t-${t.id}`}>
              <button
                type="button"
                onClick={() => onTermin(t)}
                className="flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.045] px-3.5 py-2.5 text-left active:bg-ink/[0.08]"
              >
                <span
                  aria-hidden
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", !von && (t.vonPartner ? "bg-brand-500" : "bg-ink-faint"))}
                  style={von ? { backgroundColor: von.farbe } : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {t.titel || "Termin"}
                    {t.vonPartner ? <span className="ml-1 text-[12px] font-medium text-brand-600">· {von?.name ?? "Eingeladen"}</span> : null}
                  </span>
                  <span className="tnum block text-[12.5px] text-ink-muted">
                    {t.ganztaegig ? "ganztägig" : `${t.von}${t.bis ? `–${t.bis}` : ""}`}
                    {erinnerung ? ` · 🔔 ${erinnerung}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {todos.map((t) => (
          <li key={`d-${t.id}`}>
            <label className="flex items-center gap-3 rounded-[16px] bg-ink/[0.045] px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={t.erledigt}
                onChange={(e) => onTodo(t.id, e.target.checked)}
                className="h-5 w-5 shrink-0 accent-[#22A06B]"
              />
              <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", t.erledigt && "text-ink-faint line-through")}>
                {t.titel}
              </span>
              {t.uhrzeit ? <span className="tnum shrink-0 text-[12.5px] text-ink-muted">🔔 {t.uhrzeit}</span> : null}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TagKnoepfe({ onTermin, onTodo, onTag }: { onTermin: () => void; onTodo: () => void; onTag: () => void }) {
  const knopf = "flex h-[50px] items-center justify-center gap-1.5 rounded-[16px] text-[14.5px] font-semibold";
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      <button type="button" onClick={onTermin} className={cn(knopf, "bg-ink text-surface")}>
        <CalendarPlus className="h-[18px] w-[18px]" /> Termin
      </button>
      <button type="button" onClick={onTodo} className={cn(knopf, "bg-ink/[0.07] text-ink")}>
        <ListTodo className="h-[18px] w-[18px]" /> To-do
      </button>
      <button type="button" onClick={onTag} className={cn(knopf, "bg-ink/[0.07] text-ink")}>
        <Clock className="h-[18px] w-[18px]" /> Tag
      </button>
    </div>
  );
}

// ---- Lange drücken: Schnellauswahl -------------------------------------------------

/**
 * Langes Drücken auf einen Tag. Gibt die Ereignisse für die Zelle und eine
 * Prüfung, ob der Klick danach geschluckt werden soll.
 */
export function useLangDruck(onLang: (iso: string, rect: DOMRect) => void) {
  const uhr = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const ausgeloest = useRef(false);
  const lang = useRef(onLang);
  useEffect(() => {
    lang.current = onLang;
  });

  function abbrechen() {
    if (uhr.current) window.clearTimeout(uhr.current);
    uhr.current = null;
  }

  return {
    zelle: (iso: string) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        ausgeloest.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        const el = e.currentTarget;
        abbrechen();
        uhr.current = window.setTimeout(() => {
          uhr.current = null;
          ausgeloest.current = true;
          try {
            navigator.vibrate?.(12);
          } catch {
            // ohne Vibration
          }
          lang.current(iso, el.getBoundingClientRect());
        }, 430);
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (s && uhr.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) abbrechen();
      },
      onPointerUp: abbrechen,
      onPointerCancel: abbrechen,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    /** Nach langem Drücken den folgenden Klick schlucken. */
    geschluckt: () => {
      if (!ausgeloest.current) return false;
      ausgeloest.current = false;
      return true;
    },
  };
}

export interface SchnellEintrag {
  id: string;
  name: string;
  farbe: string;
}

/** Die Farben über dem gedrückten Tag: Finger draufziehen und loslassen – oder antippen. */
export function SchnellWahl({
  rect,
  titel,
  eintraege,
  aktiv,
  mitLeeren,
  onWahl,
  onClose,
}: {
  rect: DOMRect;
  titel: string;
  eintraege: SchnellEintrag[];
  aktiv: string | null;
  mitLeeren: boolean;
  /** null = Tag leeren */
  onWahl: (id: string | null) => void;
  onClose: () => void;
}) {
  const [ueber, setUeber] = useState<string | null>(null);
  const ziehen = useRef(true);
  const wahl = useRef(onWahl);
  useEffect(() => {
    wahl.current = onWahl;
  });

  useEffect(() => {
    function finden(x: number, y: number): string | null {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-schnell]");
      return el?.dataset.schnell ?? null;
    }
    function bewegen(e: PointerEvent) {
      if (ziehen.current) setUeber(finden(e.clientX, e.clientY));
    }
    function los(e: PointerEvent) {
      if (!ziehen.current) return;
      ziehen.current = false;
      const id = finden(e.clientX, e.clientY);
      setUeber(null);
      if (id) wahl.current(id === "leer" ? null : id);
    }
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", los);
    window.addEventListener("pointercancel", () => (ziehen.current = false));
    window.addEventListener("keydown", taste);
    return () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", los);
      window.removeEventListener("keydown", taste);
    };
  }, [onClose]);

  const breite = Math.min(window.innerWidth - 24, 380);
  const links = Math.max(12, Math.min(rect.left + rect.width / 2 - breite / 2, window.innerWidth - breite - 12));
  const hoehe = 112;
  const oben = rect.top - hoehe - 10 > 12 ? rect.top - hoehe - 10 : rect.bottom + 10;
  const liste: SchnellEintrag[] = mitLeeren ? [...eintraege, { id: "leer", name: "Leeren", farbe: "" }] : eintraege;

  return createPortal(
    <div className="privat-schrift fixed inset-0 z-[55] select-none [-webkit-touch-callout:none]">
      <button type="button" aria-label="Schließen" className="absolute inset-0 cursor-default bg-black/10" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Schnell wechseln: ${titel}`}
        className="absolute rounded-[26px] bg-surface p-3 shadow-[0_14px_40px_rgba(31,41,77,0.28)] ring-1 ring-ink/5"
        style={{ left: links, top: oben, width: breite }}
      >
        <p className="mb-2 text-center text-[12px] font-semibold text-ink-muted">{titel} · auf Farbe ziehen &amp; loslassen</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {liste.map((e) => {
            const hervor = ueber === e.id;
            const gesetzt = aktiv === e.id;
            return (
              <button
                key={e.id}
                type="button"
                data-schnell={e.id}
                onClick={() => onWahl(e.id === "leer" ? null : e.id)}
                className="flex w-[52px] shrink-0 flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full text-[14px] font-extrabold transition-all",
                    hervor ? "h-[50px] w-[50px]" : "h-[42px] w-[42px]",
                    (hervor || gesetzt) && "ring-[2.5px] ring-ink ring-offset-2 ring-offset-surface",
                    e.id === "leer" && "bg-ink/[0.07] text-ink-muted",
                  )}
                  style={e.id === "leer" ? undefined : farbFlaeche(e.farbe)}
                >
                  {e.id === "leer" ? <X className="h-5 w-5" /> : e.name.slice(0, 2)}
                </span>
                <span className={cn("max-w-full truncate text-[11px]", hervor ? "font-extrabold text-ink" : "font-semibold text-ink-muted")}>
                  {e.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---- Tagesansicht ---------------------------------------------------------------

export interface Band {
  name: string;
  /** "HH:MM" */
  beginn: string;
  ende: string;
  farbe: string;
}

const STUNDE = 52;

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
      const [h, m] = t.von.split(":").map(Number);
      const start = (h ?? 0) * 60 + (m ?? 0);
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

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const minuten = (z: string) => {
  const [h, m] = z.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Schichten als Flächen an diesem Tag – auch der Rest einer Nacht vom Vortag. */
function flaechen(heute: Band[], gestern: Band[]): { name: string; start: number; ende: number; farbe: string }[] {
  const aus: { name: string; start: number; ende: number; farbe: string }[] = [];
  for (const b of heute) {
    if (!b.beginn || !b.ende) continue;
    const s = minuten(b.beginn);
    const e = minuten(b.ende);
    aus.push({ name: b.name, start: s, ende: e > s ? e : 1440, farbe: b.farbe });
  }
  for (const b of gestern) {
    if (!b.beginn || !b.ende) continue;
    const s = minuten(b.beginn);
    const e = minuten(b.ende);
    if (e <= s && e > 0) aus.push({ name: b.name, start: 0, ende: e, farbe: b.farbe });
  }
  return aus;
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
  onTodo,
  onTodos,
  onClose,
}: {
  iso: string;
  heute: string;
  onIso: (iso: string) => void;
  /** Schichten eines Tages mit Uhrzeit. */
  baender: (iso: string) => Band[];
  /** Ganztägige Einträge des Tages (z. B. Urlaub, Frei) als Hinweis oben. */
  ganztaegig: (iso: string) => { name: string; farbe: string }[];
  termineAm: (iso: string) => Termin[];
  todos: Todo[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  /** Termin öffnen; ohne Termin: neuer Termin ab startZeit. */
  onTermin: (t: Termin | null, startZeit?: string) => void;
  onVerschieben: (t: Termin, von: string, bis: string) => void;
  onTodo: (id: string, an: boolean) => void;
  onTodos: () => void;
  onClose: () => void;
}) {
  const termine = termineAm(iso);
  const ganzeTermine = termine.filter((t) => t.ganztaegig);
  const lagen = anordnen(termine);
  const schichten = flaechen(baender(iso), baender(addDays(iso, -1)));
  const ganzeSchichten = ganztaegig(iso);
  const tagTodos = todos.filter((t) => t.datum === iso);
  const offen = tagTodos.filter((t) => !t.erledigt).length;

  const flaeche = useRef<HTMLDivElement>(null);
  const [zug, setZug] = useState<{ id: string; start: number; dauer: number; neu: number; y0: number; scroll0: number } | null>(null);
  const halten = useRef<{ uhr: number; x: number; y: number; t: Termin; lage: Lage } | null>(null);
  const zugRef = useRef(zug);
  useEffect(() => {
    zugRef.current = zug;
  });

  // Beim Öffnen zum ersten Termin oder zur Schicht scrollen, sonst 7 Uhr.
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const starts = [...lagen.map((l) => l.start), ...schichten.map((s) => s.start)];
    const ziel = starts.length ? Math.min(...starts) : 7 * 60;
    el.scrollTop = Math.max(0, (ziel / 60) * STUNDE - 30);
    // nur beim Wechsel des Tages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && !zugRef.current && onClose();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);

  // Ziehen: Termin gedrückt halten, dann hoch oder runter.
  useEffect(() => {
    function bewegen(e: PointerEvent) {
      const h = halten.current;
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) {
        window.clearTimeout(h.uhr);
        halten.current = null;
      }
      const z = zugRef.current;
      const el = flaeche.current;
      if (!z || !el) return;
      e.preventDefault();
      // Am Rand weiterscrollen.
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top + 28) el.scrollTop -= 5;
      else if (e.clientY > r.bottom - 28) el.scrollTop += 5;
      const delta = ((e.clientY - z.y0 + (el.scrollTop - z.scroll0)) / STUNDE) * 60;
      const neu = Math.max(0, Math.min(1440 - z.dauer, Math.round((z.start + delta) / 15) * 15));
      if (neu !== z.neu) setZug({ ...z, neu });
    }
    function los() {
      const h = halten.current;
      if (h) {
        // Kurz getippt: öffnen.
        window.clearTimeout(h.uhr);
        halten.current = null;
        onTermin(h.t);
        return;
      }
      const z = zugRef.current;
      if (!z) return;
      setZug(null);
      const t = termine.find((x) => x.id === z.id);
      if (t && z.neu !== z.start) onVerschieben(t, hhmm(z.neu), hhmm(Math.min(1439, z.neu + z.dauer)));
    }
    window.addEventListener("pointermove", bewegen, { passive: false });
    window.addEventListener("pointerup", los);
    window.addEventListener("pointercancel", los);
    return () => {
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", los);
      window.removeEventListener("pointercancel", los);
    };
  }, [termine, onTermin, onVerschieben]);

  function druck(e: React.PointerEvent, l: Lage) {
    e.stopPropagation();
    const y0 = e.clientY;
    const x = e.clientX;
    const uhr = window.setTimeout(() => {
      halten.current = null;
      if (l.t.vonPartner) {
        onTermin(l.t);
        return;
      }
      try {
        navigator.vibrate?.(12);
      } catch {
        // ohne Vibration
      }
      setZug({ id: l.t.id, start: l.start, dauer: l.ende - l.start, neu: l.start, y0, scroll0: flaeche.current?.scrollTop ?? 0 });
    }, 280);
    halten.current = { uhr, x, y: y0, t: l.t, lage: l };
  }

  function leerGetippt(e: React.MouseEvent<HTMLDivElement>) {
    if (zug) return;
    const r = e.currentTarget.getBoundingClientRect();
    const min = Math.max(0, Math.min(23 * 60 + 30, Math.floor((((e.clientY - r.top) / STUNDE) * 60) / 30) * 30));
    onTermin(null, hhmm(min));
  }

  const kollision = (start: number, ende: number) => schichten.some((s) => start < s.ende && ende > s.start);
  const d = fromISO(iso);
  const montag = addDays(iso, -((d.getDay() + 6) % 7));
  const jetzt = (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();

  return createPortal(
    <div className="privat privat-schrift fixed inset-0 z-50 flex flex-col pt-[max(0.75rem,env(safe-area-inset-top))]" role="dialog" aria-label="Tagesansicht">
      <header className="flex items-center justify-between gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Zurück zum Kalender"
          className="glas flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[12.5px] font-semibold text-ink-muted">{tagName(iso, heute)}</p>
          <h1 className="truncate text-[19px] font-bold tracking-[-0.01em]">
            {WT_KURZ[d.getDay()]}, {d.getDate()}. {monthName(d.getMonth())}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onTermin(null)}
          aria-label="Neuer Termin"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-surface"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </button>
      </header>

      <div className="flex items-center gap-1 px-2 pb-2">
        <button type="button" aria-label="Woche vorher" onClick={() => onIso(addDays(iso, -7))} className="flex h-9 w-7 shrink-0 items-center justify-center text-ink-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => addDays(montag, i)).map((t) => {
            const an = t === iso;
            const punkt = baender(t)[0]?.farbe ?? ganztaegig(t)[0]?.farbe;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onIso(t)}
                aria-pressed={an}
                aria-label={formatDE(t)}
                className={cn(
                  "flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[16px]",
                  an ? "bg-ink text-surface" : t === heute ? "text-[#e5484d]" : "text-ink",
                )}
              >
                <span className="text-[11px] font-semibold opacity-75">{WT_KURZ[fromISO(t).getDay()]}</span>
                <span className="tnum text-[16px] font-bold">{fromISO(t).getDate()}</span>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: punkt ?? "transparent" }} />
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Woche danach" onClick={() => onIso(addDays(iso, 7))} className="flex h-9 w-7 shrink-0 items-center justify-center text-ink-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {ganzeSchichten.length || ganzeTermine.length || tagTodos.length ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {ganzeSchichten.map((g, i) => (
            <span key={`g-${i}`} className="flex h-9 items-center rounded-[12px] px-3 text-[13.5px] font-bold" style={farbFlaeche(g.farbe)}>
              {g.name}
            </span>
          ))}
          {ganzeTermine.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTermin(t)}
              className="flex h-9 max-w-full items-center gap-1.5 truncate rounded-[12px] bg-[#FCE7D6] px-3 text-[13.5px] font-semibold text-ink"
            >
              {t.titel || "Termin"} <span className="font-normal text-ink-muted">· ganztägig</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onTodos}
            className="flex h-9 items-center gap-1.5 rounded-[12px] bg-[#E6F1E9] px-3 text-[13.5px] font-semibold text-ink"
          >
            ✅ {offen ? `${offen} To-do${offen === 1 ? "" : "s"}` : tagTodos.length ? "Alles erledigt" : "To-dos"}
          </button>
        </div>
      ) : null}

      {tagTodos.some((t) => !t.erledigt) ? (
        <ul className="space-y-1 px-3 pb-2">
          {tagTodos
            .filter((t) => !t.erledigt)
            .slice(0, 3)
            .map((t) => (
              <li key={t.id}>
                <label className="glas flex items-center gap-3 rounded-[14px] px-3 py-2">
                  <input type="checkbox" checked={false} onChange={() => onTodo(t.id, true)} className="h-5 w-5 accent-[#22A06B]" />
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{t.titel}</span>
                  {t.uhrzeit ? <span className="tnum text-[12px] text-ink-muted">🔔 {t.uhrzeit}</span> : null}
                </label>
              </li>
            ))}
        </ul>
      ) : null}

      {!lagen.length ? (
        <p className="px-4 pb-1.5 text-[12px] text-ink-muted">Uhrzeit antippen = neuer Termin · Termin halten &amp; ziehen = verschieben</p>
      ) : null}
      <div
        ref={flaeche}
        className={cn("glas relative mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] min-h-0 flex-1 rounded-[22px]", zug ? "overflow-hidden" : "overflow-y-auto overscroll-contain")}
      >
        <div className="relative" style={{ height: 24 * STUNDE + 16 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: 8 + h * STUNDE }}>
              <span className="tnum w-12 shrink-0 pr-2 text-right text-[11px] font-semibold text-ink-faint">{String(h).padStart(2, "0")}:00</span>
              <span className="h-px flex-1 bg-ink/[0.07]" />
            </div>
          ))}

          <div className="absolute bottom-2 left-12 right-1.5 top-2" onClick={leerGetippt}>
            {schichten.map((s, i) => (
              <div
                key={`s-${i}`}
                className="pointer-events-none absolute inset-x-0 rounded-[12px] px-2.5 py-1.5"
                style={{
                  top: (s.start / 60) * STUNDE,
                  height: ((s.ende - s.start) / 60) * STUNDE,
                  backgroundColor: `color-mix(in srgb, ${s.farbe} 22%, transparent)`,
                  boxShadow: `inset 3px 0 0 ${s.farbe}`,
                }}
              >
                <span className="text-[12px] font-bold">
                  {s.name} · {hhmm(s.start)}–{hhmm(s.ende % 1440)}
                </span>
              </div>
            ))}

            {iso === heute ? (
              <div className="pointer-events-none absolute inset-x-0 z-[3] flex items-center" style={{ top: (jetzt / 60) * STUNDE }}>
                <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-[#ff3b30]" />
                <span className="h-[2px] flex-1 bg-[#ff3b30]" />
              </div>
            ) : null}

            {lagen.map((l) => {
              const zieht = zug?.id === l.t.id;
              const von = terminVon(l.t);
              const breite = 100 / l.spalten;
              const box = (start: number) => ({
                top: (start / 60) * STUNDE + 1,
                height: Math.max(26, ((l.ende - l.start) / 60) * STUNDE - 2),
                left: `calc(${l.spalte * breite}% + 4px)`,
                width: `calc(${breite}% - 8px)`,
              });
              return (
                <div key={l.t.id}>
                  {zieht ? (
                    <div
                      className="pointer-events-none absolute rounded-[12px] border-2 border-dashed border-ink/30"
                      style={box(l.start)}
                    />
                  ) : null}
                  <button
                    type="button"
                    onPointerDown={(e) => druck(e, l)}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Mit der Tastatur: öffnen (Maus und Finger laufen über pointerdown).
                      if (e.detail === 0) onTermin(l.t);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={`${l.t.titel || "Termin"}, ${l.t.von}${l.t.bis ? ` bis ${l.t.bis}` : ""}${l.t.vonPartner ? "" : ". Gedrückt halten zum Verschieben."}`}
                    className={cn(
                      "absolute z-[2] flex touch-none select-none flex-col overflow-hidden rounded-[12px] px-2.5 py-1 text-left [-webkit-touch-callout:none]",
                      zieht ? "z-[4] bg-[#FFF4E0] shadow-[0_14px_30px_rgba(31,41,77,0.28)] ring-2 ring-ink" : "bg-surface shadow-[0_2px_8px_rgba(31,41,77,0.1)] ring-1 ring-ink/[0.06]",
                    )}
                    style={{
                      ...box(zieht && zug ? zug.neu : l.start),
                      ...(von && !zieht ? { boxShadow: `inset 3px 0 0 ${von.farbe}, 0 2px 8px rgba(31,41,77,0.1)` } : null),
                    }}
                  >
                    <span className="truncate text-[13.5px] font-bold leading-tight">{l.t.titel || "Termin"}</span>
                    <span className="tnum truncate text-[11.5px] text-ink-muted">
                      {zieht && zug ? `${hhmm(zug.neu)}–${hhmm(Math.min(1439, zug.neu + zug.dauer))}` : `${l.t.von}${l.t.bis ? `–${l.t.bis}` : ""}`}
                      {von ? ` · ${von.name}` : ""}
                    </span>
                    {zieht && zug ? (
                      <span className={cn("text-[11.5px] font-bold", kollision(zug.neu, zug.neu + zug.dauer) ? "text-[#B4501A]" : "text-[#1C6E49]")}>
                        {kollision(zug.neu, zug.neu + zug.dauer) ? "⚠︎ in der Schicht" : "✓ passt"}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---- To-dos -------------------------------------------------------------------------

export function TodoBlatt({
  todos,
  heute,
  datum,
  rollen,
  onNeu,
  onErledigt,
  onLoeschen,
  onClose,
}: {
  todos: Todo[];
  heute: string;
  /** Vorgeschlagener Tag für neue To-dos (aus dem Tagesblatt). */
  datum: string | null;
  rollen: Rolle[];
  onNeu: (t: { titel: string; datum: string | null; uhrzeit: string | null }) => Promise<void>;
  onErledigt: (id: string, an: boolean) => void;
  onLoeschen: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<string | null>(datum);
  const [uhrzeit, setUhrzeit] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const vorschlaege = useMemo(() => {
    const quellen: Rolle[] = [...rollen.filter((r) => r !== "anders"), "anders"];
    const alle = quellen.flatMap((r) => TODO_VORSCHLAEGE[r]);
    return [...new Set(alle)].slice(0, 10);
  }, [rollen]);

  async function hinzufuegen(titel = text) {
    const t = titel.trim();
    if (!t) return;
    setLaeuft(true);
    setFehler(null);
    try {
      await onNeu({ titel: t, datum: tag, uhrzeit: tag && uhrzeit ? uhrzeit : null });
      setText("");
      setUhrzeit("");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das To-do konnte nicht gespeichert werden.");
    } finally {
      setLaeuft(false);
    }
  }

  const ende = addDays(heute, 7);
  const offen = todos.filter((t) => !t.erledigt);
  const gruppen: { titel: string; liste: Todo[] }[] = [
    { titel: "Überfällig", liste: offen.filter((t) => t.datum && t.datum < heute) },
    { titel: `Heute · ${formatDE(heute)}`, liste: offen.filter((t) => t.datum === heute) },
    { titel: "Diese Woche", liste: offen.filter((t) => t.datum && t.datum > heute && t.datum <= ende) },
    { titel: "Später", liste: offen.filter((t) => t.datum && t.datum > ende) },
    { titel: "Irgendwann", liste: offen.filter((t) => !t.datum) },
    { titel: "Erledigt", liste: todos.filter((t) => t.erledigt) },
  ].filter((g) => g.liste.length);

  const tagWahl: { wert: string | null; name: string }[] = [
    { wert: heute, name: "Heute" },
    { wert: addDays(heute, 1), name: "Morgen" },
    ...(datum && datum !== heute && datum !== addDays(heute, 1) ? [{ wert: datum, name: formatDE(datum) }] : []),
    { wert: null, name: "Ohne Tag" },
  ];

  return (
    <Blatt titel="✅ To-dos" unter={offen.length ? `${offen.length} offen` : "Alles erledigt 🎉"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void hinzufuegen();
        }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 rounded-[16px] bg-ink/[0.05] py-1 pl-3.5 pr-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Was steht an?"
            maxLength={120}
            aria-label="Neues To-do"
            className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={laeuft || !text.trim()}
            aria-label="Hinzufügen"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-ink text-surface disabled:opacity-40"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tagWahl.map((w) => (
            <button
              key={w.name}
              type="button"
              onClick={() => setTag(w.wert)}
              className={cn(
                "h-8 rounded-full px-3 text-[13px] font-semibold",
                tag === w.wert ? "bg-ink text-surface" : "bg-ink/[0.06] text-ink",
              )}
            >
              {w.name}
            </button>
          ))}
          {tag ? (
            <label className="flex h-8 items-center gap-1 rounded-full bg-ink/[0.06] px-3 text-[13px] font-semibold">
              🔔
              <input
                type="time"
                value={uhrzeit}
                onChange={(e) => setUhrzeit(e.target.value)}
                aria-label="Erinnern um"
                className="w-[5.2rem] bg-transparent outline-none"
              />
            </label>
          ) : null}
        </div>
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {vorschlaege.map((v) => (
            <button
              key={v}
              type="button"
              disabled={laeuft}
              onClick={() => void hinzufuegen(v)}
              className="h-8 shrink-0 rounded-full bg-[#F1EBE2] px-3 text-[13px] font-semibold text-ink"
            >
              {v}
            </button>
          ))}
        </div>
        {tag && uhrzeit ? <ErinnerungHinweis /> : null}
        {fehler ? <p className="rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}
      </form>

      <div className="mt-4 space-y-4">
        {gruppen.map((g) => (
          <div key={g.titel}>
            <p className={cn("mb-1.5 text-[12.5px] font-bold", g.titel === "Überfällig" ? "text-[#B4501A]" : "text-ink-muted")}>{g.titel}</p>
            <ul className="space-y-1.5">
              {g.liste.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-[16px] bg-ink/[0.045] py-2 pl-3.5 pr-1.5">
                  <input
                    type="checkbox"
                    checked={t.erledigt}
                    onChange={(e) => onErledigt(t.id, e.target.checked)}
                    aria-label={`${t.titel} erledigt`}
                    className="h-5 w-5 shrink-0 accent-[#22A06B]"
                  />
                  <span className={cn("min-w-0 flex-1 truncate text-[15px] font-medium", t.erledigt && "text-ink-faint line-through")}>
                    {t.titel}
                  </span>
                  <span className="tnum shrink-0 text-[12px] text-ink-muted">
                    {t.datum && g.titel !== `Heute · ${formatDE(heute)}` ? formatDE(t.datum).slice(0, 6) : ""}
                    {t.uhrzeit ? ` 🔔 ${t.uhrzeit}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => onLoeschen(t.id)}
                    aria-label={`${t.titel} löschen`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint active:bg-ink/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!todos.length ? (
          <p className="text-center text-[13.5px] text-ink-muted">Noch nichts hier. Tipp oben einen Vorschlag an oder schreib selbst etwas.</p>
        ) : null}
      </div>
    </Blatt>
  );
}

