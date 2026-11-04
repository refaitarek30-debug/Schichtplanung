"use client";

import { useSession } from "@/context/session";
import type { StartAnsicht } from "@/lib/types";
import { cn } from "@/lib/utils";

const WAHL: { wert: StartAnsicht; label: string }[] = [
  { wert: "klassisch", label: "Klassisch" },
  { wert: "kompakt", label: "Kompakt" },
];

/**
 * Umschalter für den Aufbau der Startseite – im Profil-Fenster (Handy), im
 * Profilmenü (Computer) und klein direkt auf der Startseite. Gilt sofort und
 * wird im Profil gespeichert. Mit `wert` und `onWahl` stellt er stattdessen
 * eine Auswahl dar, die erst später übernommen wird (Hinweisfenster).
 */
export function StartAnsichtSchalter({
  klein = false,
  winzig = false,
  wert: gewaehlt,
  onWahl,
}: {
  klein?: boolean;
  winzig?: boolean;
  wert?: StartAnsicht;
  onWahl?: (wert: StartAnsicht) => void;
}) {
  const { startAnsicht, setStartAnsicht } = useSession();
  const aktuell = gewaehlt ?? startAnsicht;
  const waehle = onWahl ?? setStartAnsicht;
  return (
    <div
      role="radiogroup"
      aria-label="Startseite"
      className={cn("flex rounded-full bg-ink/[0.06] p-1", (klein || winzig) && "p-0.5", winzig && "w-fit")}
    >
      {WAHL.map(({ wert, label }) => {
        const an = aktuell === wert;
        return (
          <button
            key={wert}
            type="button"
            role="radio"
            aria-checked={an}
            onClick={() => waehle(wert)}
            className={cn(
              "rounded-full font-semibold transition-colors",
              !winzig && "flex-1",
              winzig ? "px-2.5 py-1 text-[12px]" : klein ? "px-3 py-1.5 text-[13px]" : "px-4 py-2.5 text-[15px]",
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
