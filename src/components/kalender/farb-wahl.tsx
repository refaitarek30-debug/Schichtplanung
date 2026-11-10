"use client";

import { useState } from "react";
import { Check, Pipette } from "lucide-react";
import { FARBEN, PASTELL, PASTELL_REIHEN, textFarbe } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

type Reiter = "pastell" | "kraeftig" | "eigene";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Farbauswahl für Schichten im eigenen Kalender: Pastell in Reihen je
 * Farbton, kräftige Farben und eine frei gemischte eigene Farbe. Jede
 * Farbe im Format #RRGGBB ist gültig (Datenbank prüft genau das).
 */
export function FarbWahl({
  wert,
  onWahl,
  name = "Farbe",
  className,
}: {
  wert: string | null;
  onWahl: (farbe: string) => void;
  /** Für die Vorlesehilfe, z. B. der Name der Schicht. */
  name?: string;
  className?: string;
}) {
  const start: Reiter = !wert || PASTELL.includes(wert) ? "pastell" : FARBEN.includes(wert) ? "kraeftig" : "eigene";
  const [reiter, setReiter] = useState<Reiter>(start);
  const [hex, setHex] = useState(wert ?? "#93BFA3");

  const feld = (f: string) => {
    const an = wert?.toLowerCase() === f.toLowerCase();
    return (
      <button
        key={f}
        type="button"
        onClick={() => onWahl(f)}
        aria-label={`${name}: Farbe ${f}`}
        aria-pressed={an}
        className={cn(
          "flex h-9 w-full items-center justify-center rounded-[9px] transition-transform active:scale-90",
          an && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
        )}
        style={{ backgroundColor: f, color: textFarbe(f) }}
      >
        {an ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
      </button>
    );
  };

  return (
    <div className={cn("space-y-2.5", className)} data-farb-wahl>
      <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-ink/[0.06] p-[3px]">
        {(
          [
            ["pastell", "Pastell"],
            ["kraeftig", "Kräftig"],
            ["eigene", "Eigene"],
          ] as [Reiter, string][]
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={reiter === id}
            onClick={() => {
              setReiter(id);
              // „Eigene“ startet mit der gerade gewählten Farbe.
              if (id === "eigene" && wert && HEX.test(wert)) setHex(wert);
            }}
            className={cn("h-8 rounded-[10px] text-[13px] font-semibold", reiter === id ? "bg-surface text-ink shadow-sm" : "text-ink-muted")}
          >
            {text}
          </button>
        ))}
      </div>

      {reiter === "pastell" ? (
        <div className="space-y-1.5">
          {PASTELL_REIHEN.map((r) => (
            <div key={r.name} className="grid grid-cols-6 gap-1.5" aria-label={r.name} role="group">
              {r.farben.map(feld)}
            </div>
          ))}
        </div>
      ) : reiter === "kraeftig" ? (
        <div className="grid grid-cols-6 gap-1.5">{FARBEN.map(feld)}</div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <label
              className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[14px] ring-1 ring-inset ring-ink/10"
              style={{ backgroundColor: HEX.test(hex) ? hex : "#ccc", color: textFarbe(HEX.test(hex) ? hex : "#cccccc") }}
            >
              <Pipette className="h-5 w-5" />
              <input
                type="color"
                value={HEX.test(hex) ? hex : "#cccccc"}
                onChange={(e) => {
                  setHex(e.target.value);
                  onWahl(e.target.value.toUpperCase());
                }}
                aria-label={`${name}: eigene Farbe mischen`}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Eigene Farbe</p>
              <p className="text-[12.5px] leading-snug text-ink-muted">Auf das Feld tippen und jede beliebige Farbe mischen – oder den Farbcode eingeben.</p>
            </div>
          </div>
          <input
            value={hex}
            onChange={(e) => {
              const v = e.target.value.trim();
              const mit = v.startsWith("#") ? v : `#${v}`;
              setHex(mit);
              if (HEX.test(mit)) onWahl(mit.toUpperCase());
            }}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="characters"
            aria-label={`${name}: Farbcode`}
            className="h-10 w-full rounded-[10px] bg-ink/[0.06] px-3 font-mono text-[15px] uppercase outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}
    </div>
  );
}
