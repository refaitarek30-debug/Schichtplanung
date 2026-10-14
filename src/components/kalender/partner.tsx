"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { formatDE } from "@/lib/dates";
import type { PartnerCode } from "@/lib/data/partner";
import { cn } from "@/lib/utils";

/**
 * Arbeitstage des Partners im Kalender.
 *
 * Gespeichert in der Datenbank (0138_kalender_partner.sql), damit der
 * Partner sie über seinen Einladungslink selbst eintragen kann und der
 * Inhaber sie sieht. Lesen und schreiben können nur diese beiden – auch
 * die Firma nicht.
 */

export type PartnerSchicht = PartnerCode;

export const PARTNER_SCHICHTEN: { code: PartnerSchicht; text: string; lang: string }[] = [
  { code: "F", text: "Früh", lang: "Frühschicht" },
  { code: "S", text: "Spät", lang: "Spätschicht" },
  { code: "N", text: "Nacht", lang: "Nachtschicht" },
  { code: "T", text: "Arbeit", lang: "Arbeitstag" },
  { code: "U", text: "Urlaub", lang: "Urlaub" },
  { code: "X", text: "Frei", lang: "Frei" },
];

export function partnerText(code: PartnerSchicht, lang = false): string {
  const s = PARTNER_SCHICHTEN.find((x) => x.code === code);
  return (lang ? s?.lang : s?.text) ?? code;
}

/** Umriss in der Farbe der Schicht – gefüllt sind nur die eigenen. */
export const PARTNER_FARBE: Record<PartnerSchicht, string> = {
  F: "ring-shift-frueh-ink/70 text-shift-frueh-ink",
  S: "ring-shift-spaet-ink/70 text-shift-spaet-ink",
  N: "ring-shift-nacht-ink/70 text-shift-nacht-ink",
  T: "ring-brand-600/70 text-brand-700",
  U: "ring-shift-urlaub-ink/70 text-shift-urlaub-ink",
  X: "ring-line text-ink-faint",
};

/** Gefüllt – für die eigenen Schichten in der Partneransicht und die Auswahl. */
export const VOLL_FARBE: Record<PartnerSchicht, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  T: "bg-brand-100 text-brand-700",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  X: "bg-surface-sunken text-ink-muted",
};

/**
 * Früher lagen die Partnertage nur im Browser. Was dort noch steht, wird
 * einmal in die Datenbank übernommen und danach gelöscht.
 */
export function alteLokalePartnerTage(benutzer: string): Record<string, PartnerSchicht> | null {
  try {
    const roh = window.localStorage.getItem(`schichtplan.partner.${benutzer}`);
    if (!roh) return null;
    const daten = JSON.parse(roh) as Record<string, unknown>;
    const gueltig = new Set(PARTNER_SCHICHTEN.map((s) => s.code));
    const tage: Record<string, PartnerSchicht> = {};
    for (const [tag, code] of Object.entries(daten ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tag) && gueltig.has(code as PartnerSchicht)) {
        tage[tag] = code as PartnerSchicht;
      }
    }
    return tage;
  } catch {
    return null;
  }
}

export function vergissLokalePartnerTage(benutzer: string) {
  try {
    window.localStorage.removeItem(`schichtplan.partner.${benutzer}`);
  } catch {
    // egal – dann wird beim nächsten Mal noch einmal übernommen (idempotent)
  }
}

const ANZAHL = [1, 3, 5, 7, 14];

function Blatt({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">{children}</div>;
}

export function PartnerBlatt({
  datum,
  aktuell,
  hinweis,
  onWahl,
  onClose,
  onEinladen,
}: {
  datum: string;
  aktuell: PartnerSchicht | null;
  /** Zeile unter der Auswahl. */
  hinweis: string;
  onWahl: (code: PartnerSchicht | null, anzahl: number) => void;
  onClose: () => void;
  /** Nur beim Inhaber: Verweis auf die Einladung. */
  onEinladen?: () => void;
}) {
  const [anzahl, setAnzahl] = useState(1);

  return createPortal(
    <Blatt>
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Arbeitstag des Partners"
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl"
      >
        <div className="flex items-baseline justify-between bg-surface-sunken px-5 py-4">
          <span className="text-[17px] font-semibold">{formatDE(datum)}</span>
          <span className="text-[15px] text-ink-muted">Partner</span>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            {PARTNER_SCHICHTEN.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => onWahl(s.code, anzahl)}
                aria-pressed={aktuell === s.code}
                className={cn(
                  "rounded-xl py-3.5 text-[15px] font-semibold",
                  VOLL_FARBE[s.code],
                  aktuell === s.code && "ring-2 ring-brand-500 ring-offset-2 ring-offset-surface",
                )}
              >
                {s.text}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Für wie viele Tage">
            <span className="mr-1 text-[15px]">Für</span>
            {ANZAHL.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAnzahl(n)}
                aria-pressed={anzahl === n}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[14px] font-semibold",
                  anzahl === n ? "bg-brand-500 text-white" : "bg-surface-muted text-ink-muted",
                )}
              >
                {n === 1 ? "1 Tag" : `${n} Tage`}
              </button>
            ))}
          </div>

          <p className="text-[12px] text-ink-faint">{hinweis}</p>
          {onEinladen ? (
            <button
              type="button"
              onClick={onEinladen}
              className="text-[14px] font-semibold text-brand-600 underline"
            >
              Partner einladen, damit er selbst einträgt
            </button>
          ) : null}
        </div>

        <div className="flex items-center border-t border-line pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => onWahl(null, anzahl)}
            className="h-14 flex-1 text-[16px] font-semibold text-crit-fg"
          >
            Entfernen
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 text-[16px] font-semibold text-ink-muted"
          >
            Schließen
          </button>
        </div>
      </div>
    </Blatt>,
    document.body,
  );
}
