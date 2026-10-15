"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { formatDE, fromISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { Termin, TerminEingabe, Wiederholung } from "@/lib/data/partner";

/**
 * Termine im Kalender – Formular und Hilfen.
 *
 * Gespeichert in der Datenbank (0139_kalender_partner_termine.sql): eigene
 * Termine sieht nur die Person selbst – und ihr Partner, wenn sie das bei
 * der Einladung freigegeben hat. Termine des Partners sehen beide. Die
 * Firma sieht keine Termine.
 */


export type { Termin, TerminEingabe, Wiederholung };

/**
 * Termine lagen anfangs nur im Browser. Was dort noch steht, wird einmal in
 * die Datenbank übernommen und danach gelöscht (siehe MeinKalender).
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
        wiederholung: (["nie", "taeglich", "woechentlich", "monatlich"].includes(t.wiederholung)
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

const feld =
  "flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-[16px]";
const eingabe =
  "min-w-0 flex-1 bg-transparent py-2 text-right text-[16px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md";

export function TerminBlatt({
  datum,
  termin,
  onSpeichern,
  onLoeschen,
  hinweis,
  nurLesen = false,
  glas = false,
  onClose,
}: {
  datum: string;
  termin: Termin | null;
  onSpeichern: (t: TerminEingabe) => void;
  onLoeschen: (id: string) => void;
  /** Zeile unter den Feldern – wer den Termin sieht. */
  hinweis: string;
  /** Nur ansehen (Termin der anderen Person). */
  nurLesen?: boolean;
  /** Glas-Stil des Privatbereichs (schwebende Karte). */
  glas?: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const [titel, setTitel] = useState(termin?.titel ?? "");
  const zeile = glas ? feld.replace("border-line", "glas-linie") : feld;
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
      id: termin?.id ?? null,
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
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center lg:items-center",
        glas && "privat-schrift px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      <button
        type="button"
        aria-label="Schließen"
        className={cn("absolute inset-0 cursor-default", glas ? "bg-black/25 backdrop-blur-[3px]" : "bg-black/40")}
        onClick={onClose}
      />
      <form
        onSubmit={speichern}
        role="dialog"
        aria-label={termin ? "Termin bearbeiten" : "Neuer Termin"}
        className={cn(
          "relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden",
          glas ? "glas-dicht max-h-[88dvh] rounded-[30px]" : "rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl",
        )}
      >
        <div className={cn("flex items-baseline justify-between px-5 py-4", glas ? "bg-ink/[0.05]" : "bg-surface-sunken")}>
          <span className="text-[17px] font-semibold">
            {termin?.wiederholung && termin.wiederholung !== "nie" ? "ab " : ""}
            {formatDE(tag)}
          </span>
          <span className="tnum text-[15px] text-ink-muted">{ganz ? "Ganztägig" : dauer(von, bis)}</span>
        </div>

        <div className="overflow-y-auto px-5">
          <fieldset disabled={nurLesen} className="m-0 min-w-0 border-0 p-0">
          <label className={zeile}>
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
                  onChange={(e) => setVon(e.target.value)}
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
          ) : null}
          <label className={zeile}>
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
          {!nurLesen ? (
            <button type="submit" className="h-14 flex-1 text-[16px] font-semibold text-brand-600">
              Speichern
            </button>
          ) : null}
        </div>
      </form>
    </div>,
    document.body,
  );
}
