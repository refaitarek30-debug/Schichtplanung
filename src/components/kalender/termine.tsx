"use client";

import { useCallback, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { formatDE, fromISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Eigene Termine im Kalender – nur auf diesem Gerät.
 *
 * Bewusst nicht in der Datenbank: Termine sind privat und haben mit dem
 * Betrieb nichts zu tun. So sieht sie weder die Firma noch die
 * Schichtleitung, und es gibt keine neuen Daten, für die die
 * Datenschutzerklärung gelten müsste. Der Preis: Sie sind nur auf dem
 * Gerät da, auf dem sie eingetragen wurden, und verschwinden mit den
 * Website-Daten des Browsers. Das steht so auch im Formular.
 *
 * Der Schlüssel enthält die Benutzer-Id – meldet sich auf demselben Gerät
 * jemand anderes an, sieht er die Termine der ersten Person nicht.
 */

export type Wiederholung = "nie" | "taeglich" | "woechentlich" | "monatlich";

export interface Termin {
  id: string;
  /** Erster Tag, "YYYY-MM-DD". */
  datum: string;
  titel: string;
  ganztaegig: boolean;
  von: string;
  bis: string;
  wiederholung: Wiederholung;
  notiz: string;
  ort: string;
}

const LEER: Termin[] = [];
const zuhoerer = new Set<() => void>();
const lesecache = new Map<string, { roh: string | null; liste: Termin[] }>();

function speicherSchluessel(benutzer: string) {
  return `schichtplan.termine.${benutzer}`;
}

function lesen(schluessel: string): Termin[] {
  let roh: string | null = null;
  try {
    roh = window.localStorage.getItem(schluessel);
  } catch {
    return LEER;
  }
  const alt = lesecache.get(schluessel);
  if (alt && alt.roh === roh) return alt.liste;
  let liste: Termin[] = LEER;
  if (roh) {
    try {
      const daten: unknown = JSON.parse(roh);
      if (Array.isArray(daten)) {
        liste = daten.filter(
          (t): t is Termin =>
            !!t && typeof t === "object" && typeof t.id === "string" && typeof t.datum === "string",
        );
      }
    } catch {
      liste = LEER;
    }
  }
  lesecache.set(schluessel, { roh, liste });
  return liste;
}

function abonnieren(rueckruf: () => void) {
  zuhoerer.add(rueckruf);
  // Änderungen aus einem zweiten Tab.
  window.addEventListener("storage", rueckruf);
  return () => {
    zuhoerer.delete(rueckruf);
    window.removeEventListener("storage", rueckruf);
  };
}

export function useTermine(benutzer: string) {
  const schluessel = speicherSchluessel(benutzer);
  const termine = useSyncExternalStore(
    abonnieren,
    () => lesen(schluessel),
    () => LEER,
  );

  const schreiben = useCallback(
    (liste: Termin[]) => {
      try {
        window.localStorage.setItem(schluessel, JSON.stringify(liste));
      } catch {
        // Speicher voll oder gesperrt (privater Modus) – dann bleibt es beim alten Stand.
      }
      for (const z of zuhoerer) z();
    },
    [schluessel],
  );

  const speichern = useCallback(
    (t: Termin) => {
      const aktuell = lesen(schluessel);
      const vorhanden = aktuell.some((x) => x.id === t.id);
      schreiben(vorhanden ? aktuell.map((x) => (x.id === t.id ? t : x)) : [...aktuell, t]);
    },
    [schluessel, schreiben],
  );

  const loeschen = useCallback(
    (id: string) => schreiben(lesen(schluessel).filter((x) => x.id !== id)),
    [schluessel, schreiben],
  );

  return { termine, speichern, loeschen };
}

/** Ganze Tage zwischen zwei Daten (lokal, ohne Zeitumstellungsfehler). */
function tageZwischen(a: string, b: string) {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Alle Termine an einem Tag, auch wiederkehrende. Ganztägige zuerst. */
export function termineAm(termine: Termin[], iso: string): Termin[] {
  return termine
    .filter((t) => {
      if (iso < t.datum) return false;
      switch (t.wiederholung) {
        case "taeglich":
          return true;
        case "woechentlich":
          return tageZwischen(t.datum, iso) % 7 === 0;
        case "monatlich":
          return fromISO(iso).getDate() === fromISO(t.datum).getDate();
        default:
          return iso === t.datum;
      }
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

function neueId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const feld =
  "flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-[16px]";
const eingabe =
  "min-w-0 flex-1 bg-transparent py-2 text-right text-[16px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md";

export function TerminBlatt({
  datum,
  termin,
  onSpeichern,
  onLoeschen,
  onClose,
}: {
  datum: string;
  termin: Termin | null;
  onSpeichern: (t: Termin) => void;
  onLoeschen: (id: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [titel, setTitel] = useState(termin?.titel ?? "");
  const [ganz, setGanz] = useState(termin?.ganztaegig ?? false);
  const [von, setVon] = useState(termin?.von ?? "12:00");
  const [bis, setBis] = useState(termin?.bis ?? "13:00");
  const [wdh, setWdh] = useState<Wiederholung>(termin?.wiederholung ?? "nie");
  const [notiz, setNotiz] = useState(termin?.notiz ?? "");
  const [ort, setOrt] = useState(termin?.ort ?? "");

  const tag = termin?.datum ?? datum;

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    onSpeichern({
      id: termin?.id ?? neueId(),
      datum: tag,
      titel: titel.trim(),
      ganztaegig: ganz,
      von,
      bis,
      wiederholung: wdh,
      notiz: notiz.trim(),
      ort: ort.trim(),
    });
  }

  // An den Body gehängt: der Kalender steht auf dem Handy fest (eigene
  // Ebene unter der Navigation) – im Kalender selbst läge das Blatt sonst
  // unter der Navigationsleiste, und „Speichern“ wäre nicht zu erreichen.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />
      <form
        onSubmit={speichern}
        role="dialog"
        aria-label={termin ? "Termin bearbeiten" : "Neuer Termin"}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl"
      >
        <div className="flex items-baseline justify-between bg-surface-sunken px-5 py-4">
          <span className="text-[17px] font-semibold">
            {termin?.wiederholung && termin.wiederholung !== "nie" ? "ab " : ""}
            {formatDE(tag)}
          </span>
          <span className="tnum text-[15px] text-ink-muted">{ganz ? "Ganztägig" : dauer(von, bis)}</span>
        </div>

        <div className="overflow-y-auto px-5">
          <label className={feld}>
            <span className="shrink-0">Titel</span>
            <input
              id={`${id}-titel`}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Ohne Titel"
              maxLength={80}
              autoComplete="off"
              className={eingabe}
            />
          </label>
          <div className={feld}>
            <span id={`${id}-ganz`}>Ganztägig</span>
            <button
              type="button"
              role="switch"
              aria-checked={ganz}
              aria-labelledby={`${id}-ganz`}
              onClick={() => setGanz((g) => !g)}
              className={cn(
                "relative h-8 w-[52px] shrink-0 rounded-full transition-colors",
                ganz ? "bg-brand-500" : "bg-surface-sunken ring-1 ring-inset ring-line",
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
              <label className={feld}>
                <span>Start</span>
                <input
                  id={`${id}-von`}
                  type="time"
                  value={von}
                  onChange={(e) => setVon(e.target.value)}
                  className={cn(eingabe, "flex-none")}
                  required
                />
              </label>
              <label className={feld}>
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
          ) : null}
          <label className={feld}>
            <span>Wiederholen</span>
            <select
              id={`${id}-wdh`}
              value={wdh}
              onChange={(e) => setWdh(e.target.value as Wiederholung)}
              className={cn(eingabe, "text-right")}
            >
              <option value="nie">Niemals</option>
              <option value="taeglich">Täglich</option>
              <option value="woechentlich">Wöchentlich</option>
              <option value="monatlich">Monatlich</option>
            </select>
          </label>

          <div className="my-4 overflow-hidden rounded-2xl border border-line">
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
              className="block w-full border-t border-line bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-ink-faint"
            />
          </div>
          <p className="pb-3 text-[12px] text-ink-faint">
            Termine werden nur auf diesem Gerät gespeichert. Niemand sonst sieht sie.
          </p>
        </div>

        <div className="flex items-center border-t border-line pb-[env(safe-area-inset-bottom)]">
          {termin ? (
            <button
              type="button"
              onClick={() => onLoeschen(termin.id)}
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
          <button type="submit" className="h-14 flex-1 text-[16px] font-semibold text-brand-600">
            Speichern
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
