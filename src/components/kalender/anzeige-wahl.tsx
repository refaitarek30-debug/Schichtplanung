"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { setzeAnzeige, useAnzeige, type PlanAnsicht, type Wochenende } from "@/lib/anzeige";

const WOCHENENDE: { wert: Wochenende; name: string }[] = [
  { wert: "aus", name: "Aus" },
  { wert: "leicht", name: "Leicht" },
  { wert: "kraeftig", name: "Kräftig" },
];

const ANSICHT: { wert: PlanAnsicht; name: string }[] = [
  { wert: "kompakt", name: "Kompakt" },
  { wert: "gross", name: "Groß" },
];

function Segmente<T extends string>({
  label,
  werte,
  aktiv,
  onWahl,
}: {
  label: string;
  werte: { wert: T; name: string }[];
  aktiv: T;
  onWahl: (w: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-flow-col gap-1 rounded-[14px] bg-ink/[0.06] p-1">
      {werte.map((w) => (
        <button
          key={w.wert}
          type="button"
          role="radio"
          aria-checked={aktiv === w.wert}
          onClick={() => onWahl(w.wert)}
          className={cn(
            "rounded-[10px] py-2 text-[13.5px] font-semibold transition-colors",
            aktiv === w.wert ? "bg-surface text-ink shadow-[0_1px_6px_rgba(0,0,0,0.1)]" : "text-ink-muted",
          )}
        >
          {w.name}
        </button>
      ))}
    </div>
  );
}

/** Kleine Vorschau einer Woche – zeigt sofort, wie die Wahl aussieht. */
function WochenVorschau() {
  return (
    <div aria-hidden className="mt-2 grid grid-cols-7 overflow-hidden rounded-xl border border-line text-center">
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((t, i) => (
        <span key={t} className={cn("py-1 text-[11px] font-semibold text-ink-faint", i >= 5 && "we-kopf")}>
          {t}
        </span>
      ))}
      {[14, 15, 16, 17, 18, 19, 20].map((z, i) => (
        <span key={z} className={cn("border-t border-line py-2 text-[13px]", i > 0 && "border-l", i >= 5 && "we-zelle")}>
          {z}
        </span>
      ))}
    </div>
  );
}

/**
 * Samstag und Sonntag hervorheben – gilt für den eigenen Kalender und den
 * Schichtplan, nur für die Person selbst.
 */
export function WochenendeWahl({ vorschau = true }: { vorschau?: boolean }) {
  const anzeige = useAnzeige();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <div>
      <Segmente
        label="Wochenende hervorheben"
        werte={WOCHENENDE}
        aktiv={anzeige.wochenende}
        onWahl={(w) => {
          setFehler(null);
          setzeAnzeige({ wochenende: w }).catch((e: unknown) =>
            setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden."),
          );
        }}
      />
      {vorschau ? <WochenVorschau /> : null}
      {fehler ? <p className="mt-1.5 text-[12px] text-crit-fg">{fehler}</p> : null}
    </div>
  );
}

/** Schichtplan kompakt (mehr Tage im Bild) oder groß (leichter zu treffen). */
export function PlanAnsichtWahl() {
  const anzeige = useAnzeige();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <div>
      <Segmente
        label="Ansicht des Schichtplans"
        werte={ANSICHT}
        aktiv={anzeige.planAnsicht}
        onWahl={(w) => {
          setFehler(null);
          setzeAnzeige({ planAnsicht: w }).catch((e: unknown) =>
            setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden."),
          );
        }}
      />
      {fehler ? <p className="mt-1.5 text-[12px] text-crit-fg">{fehler}</p> : null}
    </div>
  );
}

/** Eigene Kalenderfarben auch im Schichtplan verwenden. */
export function PlanFarbenSchalter() {
  const anzeige = useAnzeige();
  const [fehler, setFehler] = useState<string | null>(null);
  const an = anzeige.planEigeneFarben;
  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={an}
        onClick={() => {
          setFehler(null);
          setzeAnzeige({ planEigeneFarben: !an }).catch((e: unknown) =>
            setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden."),
          );
        }}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Meine Farben im Schichtplan</span>
          <span className="block text-[12.5px] text-ink-muted">
            {an ? "Der Schichtplan zeigt deine Kalenderfarben." : "Aus: die gewohnten Farben des Betriebs."}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors",
            an ? "bg-ok-dot" : "bg-ink/[0.15]",
          )}
        >
          <span
            className={cn(
              "absolute top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow transition-[left]",
              an ? "left-[22px]" : "left-[2px]",
            )}
          />
        </span>
      </button>
      {fehler ? <p className="mt-1.5 text-[12px] text-crit-fg">{fehler}</p> : null}
    </div>
  );
}
