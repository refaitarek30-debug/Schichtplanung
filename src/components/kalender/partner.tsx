"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { addDays, formatDE } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Arbeitstage des Partners im eigenen Kalender – nur auf diesem Gerät.
 *
 * Wie die Termine (siehe termine.tsx) bewusst nicht in der Datenbank: Das
 * sind Angaben über eine Person, die mit dem Betrieb nichts zu tun hat. Sie
 * bleiben auf dem Handy, je Benutzer-Id getrennt.
 */

export type PartnerSchicht = "F" | "S" | "N" | "T" | "X";

export const PARTNER_SCHICHTEN: { code: PartnerSchicht; text: string; lang: string }[] = [
  { code: "F", text: "Früh", lang: "Frühschicht" },
  { code: "S", text: "Spät", lang: "Spätschicht" },
  { code: "N", text: "Nacht", lang: "Nachtschicht" },
  { code: "T", text: "Arbeit", lang: "Arbeitstag" },
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
  X: "ring-line text-ink-faint",
};

const WAHL_FARBE: Record<PartnerSchicht, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  T: "bg-brand-100 text-brand-700",
  X: "bg-surface-sunken text-ink-muted",
};

type Tage = Record<string, PartnerSchicht>;
const LEER: Tage = {};
const zuhoerer = new Set<() => void>();
const cache = new Map<string, { roh: string | null; tage: Tage }>();
const GUELTIG = new Set(PARTNER_SCHICHTEN.map((s) => s.code));

function lesen(schluessel: string): Tage {
  let roh: string | null = null;
  try {
    roh = window.localStorage.getItem(schluessel);
  } catch {
    return LEER;
  }
  const alt = cache.get(schluessel);
  if (alt && alt.roh === roh) return alt.tage;
  let tage: Tage = LEER;
  if (roh) {
    try {
      const daten: unknown = JSON.parse(roh);
      if (daten && typeof daten === "object" && !Array.isArray(daten)) {
        tage = {};
        for (const [tag, code] of Object.entries(daten as Record<string, unknown>)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(tag) && GUELTIG.has(code as PartnerSchicht)) {
            tage[tag] = code as PartnerSchicht;
          }
        }
      }
    } catch {
      tage = LEER;
    }
  }
  cache.set(schluessel, { roh, tage });
  return tage;
}

function abonnieren(rueckruf: () => void) {
  zuhoerer.add(rueckruf);
  window.addEventListener("storage", rueckruf);
  return () => {
    zuhoerer.delete(rueckruf);
    window.removeEventListener("storage", rueckruf);
  };
}

export function usePartnerTage(benutzer: string) {
  const schluessel = `schichtplan.partner.${benutzer}`;
  const tage = useSyncExternalStore(
    abonnieren,
    () => lesen(schluessel),
    () => LEER,
  );

  /** Ab `start` für `anzahl` Tage setzen – `null` entfernt. */
  const setzen = useCallback(
    (start: string, anzahl: number, code: PartnerSchicht | null) => {
      const neu = { ...lesen(schluessel) };
      for (let i = 0; i < anzahl; i++) {
        const tag = addDays(start, i);
        if (code) neu[tag] = code;
        else delete neu[tag];
      }
      try {
        window.localStorage.setItem(schluessel, JSON.stringify(neu));
      } catch {
        // Speicher voll oder gesperrt – dann bleibt es beim alten Stand.
      }
      for (const z of zuhoerer) z();
    },
    [schluessel],
  );

  return { tage, setzen };
}

const ANZAHL = [1, 3, 5, 7, 14];

export function PartnerBlatt({
  datum,
  aktuell,
  onWahl,
  onClose,
}: {
  datum: string;
  aktuell: PartnerSchicht | null;
  onWahl: (code: PartnerSchicht | null, anzahl: number) => void;
  onClose: () => void;
}) {
  const [anzahl, setAnzahl] = useState(1);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
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
          <div className="grid grid-cols-5 gap-2">
            {PARTNER_SCHICHTEN.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => onWahl(s.code, anzahl)}
                aria-pressed={aktuell === s.code}
                className={cn(
                  "rounded-xl py-4 text-[14px] font-semibold",
                  WAHL_FARBE[s.code],
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

          <p className="text-[12px] text-ink-faint">
            Nur auf diesem Gerät gespeichert. Niemand sonst sieht es.
          </p>
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
    </div>,
    document.body,
  );
}
