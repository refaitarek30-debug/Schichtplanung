"use client";

import { useSession } from "@/context/session";
import type { StartAnsicht } from "@/lib/types";
import { cn } from "@/lib/utils";

const WAHL: { wert: StartAnsicht; label: string }[] = [
  { wert: "klassisch", label: "Klassisch" },
  { wert: "kompakt", label: "Kompakt" },
];

/**
 * Umschalter für den Aufbau der Startseite – im Profil-Fenster (Handy) und im
 * Profilmenü (Computer). Gilt sofort und wird im Profil gespeichert.
 */
export function StartAnsichtSchalter({ klein = false }: { klein?: boolean }) {
  const { startAnsicht, setStartAnsicht } = useSession();
  return (
    <div
      role="radiogroup"
      aria-label="Startseite"
      className={cn("flex rounded-full bg-ink/[0.06] p-1", klein && "p-0.5")}
    >
      {WAHL.map(({ wert, label }) => {
        const an = startAnsicht === wert;
        return (
          <button
            key={wert}
            type="button"
            role="radio"
            aria-checked={an}
            onClick={() => setStartAnsicht(wert)}
            className={cn(
              "flex-1 rounded-full font-semibold transition-colors",
              klein ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-[15px]",
              an ? "bg-brand-600 text-white shadow-card" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
