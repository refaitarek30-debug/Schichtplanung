"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type React from "react";
import { CalendarPlus, Clock, Plus, Trash2, X } from "lucide-react";
import { addDays, formatDE } from "@/lib/dates";
import { textFarbe } from "@/lib/privat/daten";
import type { Todo } from "@/lib/data/todos";
import type { Rolle } from "@/lib/data/todos";
import { cn } from "@/lib/utils";
import { Blatt } from "@/components/privat/blatt";
import { erinnerungText, terminTitel, TerminLoeschenFrage, vorkommenAm, type Termin } from "./termine";
import type { LoeschModus } from "@/lib/data/verbindungen";
import { TODO_VORSCHLAEGE } from "./vorschlaege";
import { ErinnerungHinweis } from "./erinnerungen";

/**
 * Bausteine rund um einen Tag: die Schicht-Leiste im Tagesblatt, langes
 * Drücken für einen neuen Termin, die Tagesansicht mit Zeitleiste und die
 * To-do-Liste. Für den Privat- und den Firmenkalender.
 */

/** Farbe als Fläche: Schrift passend dazu. */
export const farbFlaeche = (farbe: string): React.CSSProperties => ({ backgroundColor: farbe, color: textFarbe(farbe) });

// ---- Schicht-Leiste ---------------------------------------------------------------

export interface LeistenEintrag {
  id: string;
  name: string;
  farbe: string;
  /** 1 = erster Eintrag des Tages, 2 = zweiter, 3 = dritter, 0 = nicht gesetzt */
  rang: 0 | 1 | 2 | 3;
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
              e.rang >= 2 && "ring-[2.5px] ring-ink/45 ring-offset-2 ring-offset-surface",
            )}
            style={farbFlaeche(e.farbe)}
          >
            {e.name}
            {e.rang >= 2 ? (
              <span aria-hidden className="absolute -right-1 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-surface">
                {e.rang}
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

const WISCH_OFFEN = 96;

/** Farbe eigener Termine, wenn keine Person dahintersteht. */
const EIGEN_TERMIN_FARBE = "#6C8CFF";
/** Kartenfarbe zu einer Personenfarbe: deckend, im Hellen hell und im Dunkeln dunkel getönt. */
const karteFarbe = (farbe: string) => `color-mix(in srgb, ${farbe} 20%, rgb(var(--c-surface)))`;

/**
 * Eine Termin-Zeile: antippen = öffnen, nach links wischen = „Löschen“ zeigen,
 * lange drücken = Nachfrage zum Löschen.
 */
function TerminZeile({
  t,
  tag,
  von,
  darfLoeschen,
  onTermin,
  onLoeschen,
  onFrage,
}: {
  t: Termin;
  /** Der Tag, an dem die Zeile steht (für das Alter bei Geburtstagen). */
  tag: string;
  von: { name: string; farbe: string } | null;
  darfLoeschen: boolean;
  onTermin: (t: Termin) => void;
  onLoeschen: (t: Termin) => void;
  onFrage: (t: Termin) => void;
}) {
  const erinnerung = erinnerungText(t.erinnerung);
  const [dx, setDx] = useState(0);
  const [zieht, setZieht] = useState(false);
  const offen = dx <= -WISCH_OFFEN / 2 && !zieht;
  const g = useRef<{ x: number; y: number; dx0: number; modus: "?" | "wischen" | "scroll"; uhr: number | null; lang: boolean } | null>(null);
  const geschluckt = useRef(false);

  function uhrStopp() {
    if (g.current?.uhr) window.clearTimeout(g.current.uhr);
    if (g.current) g.current.uhr = null;
  }

  function runter(e: React.PointerEvent<HTMLElement>) {
    if (!darfLoeschen || (e.pointerType === "mouse" && e.button !== 0)) return;
    geschluckt.current = false;
    const uhr = window.setTimeout(() => {
      if (!g.current) return;
      g.current.uhr = null;
      g.current.lang = true;
      geschluckt.current = true;
      try {
        navigator.vibrate?.(12);
      } catch {
        // ohne Vibration
      }
      onFrage(t);
    }, 500);
    g.current = { x: e.clientX, y: e.clientY, dx0: dx, modus: "?", uhr, lang: false };
  }
  function bewegt(e: React.PointerEvent<HTMLElement>) {
    const s = g.current;
    if (!s || s.modus === "scroll" || s.lang) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.modus === "?") {
      if (Math.hypot(mx, my) < 8) return;
      uhrStopp();
      if (Math.abs(mx) > Math.abs(my) * 1.4) {
        s.modus = "wischen";
        setZieht(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ohne Capture
        }
      } else {
        s.modus = "scroll";
        return;
      }
    }
    setDx(Math.max(-WISCH_OFFEN - 24, Math.min(0, s.dx0 + mx)));
  }
  function hoch() {
    const s = g.current;
    g.current = null;
    if (s?.uhr) window.clearTimeout(s.uhr);
    if (s?.modus === "wischen") {
      geschluckt.current = true;
      setZieht(false);
      setDx((d) => (d <= -WISCH_OFFEN / 2 ? -WISCH_OFFEN : 0));
    }
  }
  function abbruch() {
    uhrStopp();
    g.current = null;
    setZieht(false);
    setDx((d) => (d <= -WISCH_OFFEN / 2 ? -WISCH_OFFEN : 0));
  }

  return (
    <li className="relative overflow-hidden rounded-[16px]">
      {darfLoeschen ? (
        <button
          type="button"
          onClick={() => (t.wiederholung !== "nie" ? onFrage(t) : onLoeschen(t))}
          tabIndex={offen ? 0 : -1}
          aria-hidden={!offen}
          aria-label={`${t.titel || "Termin"} löschen`}
          className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-[#e5484d] pl-3 text-[14px] font-bold text-white"
          style={{ width: WISCH_OFFEN }}
        >
          <Trash2 className="h-[18px] w-[18px]" /> Löschen
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (geschluckt.current) {
            geschluckt.current = false;
            return;
          }
          if (dx !== 0) {
            setDx(0);
            return;
          }
          onTermin(t);
        }}
        onPointerDown={runter}
        onPointerMove={bewegt}
        onPointerUp={hoch}
        onPointerCancel={abbruch}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative flex w-full touch-pan-y select-none items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left [-webkit-touch-callout:none] active:brightness-95",
          !zieht && "transition-transform duration-200",
        )}
        style={{
          transform: `translateX(${dx}px)`,
          backgroundColor: karteFarbe(von?.farbe ?? EIGEN_TERMIN_FARBE),
          boxShadow: `inset 4px 0 0 ${von?.farbe ?? EIGEN_TERMIN_FARBE}`,
        }}
      >
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: von?.farbe ?? EIGEN_TERMIN_FARBE }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {terminTitel(t, tag)}
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
}

export function AmTag({
  termine,
  todos,
  terminVon,
  onTermin,
  onTodo,
  datum,
  onLoeschen,
  darfLoeschen,
}: {
  termine: Termin[];
  todos: Todo[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  onTermin: (t: Termin) => void;
  onTodo: (id: string, an: boolean) => void;
  /** Der Tag, den das Blatt zeigt. */
  datum: string;
  /** Termin löschen (Wischen nach links oder langes Drücken). */
  onLoeschen?: (t: Termin, modus: LoeschModus, datum: string) => void;
  /** Welche Termine man löschen darf; ohne Angabe: alle, wenn onLoeschen da ist. */
  darfLoeschen?: (t: Termin) => boolean;
}) {
  const [frage, setFrage] = useState<Termin | null>(null);
  if (!termine.length && !todos.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[12.5px] font-semibold text-ink-muted">Am Tag</p>
      <ul className="space-y-1.5">
        {termine.map((t) => (
          <TerminZeile
            key={`t-${t.id}`}
            t={t}
            tag={datum}
            von={terminVon(t)}
            darfLoeschen={!!onLoeschen && (darfLoeschen ? darfLoeschen(t) : true)}
            onTermin={onTermin}
            onLoeschen={(x) => onLoeschen?.(x, "alle", datum)}
            onFrage={setFrage}
          />
        ))}
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
      {frage ? (
        <TerminLoeschenFrage
          termin={frage}
          datum={vorkommenAm(frage, datum)}
          onJa={(modus) => {
            const t = frage;
            setFrage(null);
            onLoeschen?.(t, modus, vorkommenAm(t, datum));
          }}
          onClose={() => setFrage(null)}
        />
      ) : null}
    </div>
  );
}

/** Unten im Tagesblatt: neuer Termin und der ganze Tag. */
export function TagKnoepfe({ onTermin, onTag }: { onTermin: () => void; onTag: () => void }) {
  const knopf = "flex h-[50px] items-center justify-center gap-1.5 rounded-[16px] text-[14.5px] font-semibold";
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={onTermin} className={cn(knopf, "bg-ink text-surface")}>
        <CalendarPlus className="h-[18px] w-[18px]" /> Neuer Termin
      </button>
      <button type="button" onClick={onTag} className={cn(knopf, "bg-ink/[0.07] text-ink")}>
        <Clock className="h-[18px] w-[18px]" /> Tag ansehen
      </button>
    </div>
  );
}

// ---- Lange drücken ----------------------------------------------------------------

/**
 * Langes Drücken auf einen Tag (öffnet einen neuen Termin). Gibt die
 * Ereignisse für die Zelle und eine Prüfung, ob der Klick danach geschluckt
 * werden soll.
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

// ---- Tagesansicht: eigene Datei (tagesansicht.tsx) ---------------------------------

export { Tagesansicht } from "./tagesansicht";
export type { AndereSchicht, Band, LeisteDaten } from "./tagesansicht";

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
    <Blatt wischZu="kopf" titel="✅ To-dos" unter={offen.length ? `${offen.length} offen` : "Alles erledigt 🎉"} onClose={onClose}>
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
            <label className="flex h-8 items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 text-[13px] font-semibold">
              🔔 <span className="text-ink-muted">Erinnern um</span>
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
              className="h-8 shrink-0 rounded-full bg-warn-bg px-3 text-[13px] font-semibold text-ink"
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
            <p className={cn("mb-1.5 text-[12.5px] font-bold", g.titel === "Überfällig" ? "text-warn-fg" : "text-ink-muted")}>{g.titel}</p>
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

