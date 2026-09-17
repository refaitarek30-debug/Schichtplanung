"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface DeviationPoint {
  label: string;
  /** Null, wenn es im Monat keinen Arbeitstag gab. */
  rate: number | null;
  sollTage: number;
  ausfallTage: number;
}

/**
 * Abweichung der Gesundheitsrate vom Zielwert, Monat für Monat.
 *
 * Bewusst die Abweichung und nicht die Rate selbst: bei Werten zwischen
 * 93 % und 98 % sähen Balken von 0 bis 100 alle gleich lang aus, und eine
 * gestauchte Achse ab 90 % würde jeden Unterschied künstlich aufblasen.
 * Der Zielwert ist der natürliche Nullpunkt – über ihm ist gut, unter ihm
 * nicht, und die Länge zeigt, wie weit.
 *
 * Farbe trägt hier Zustand, nicht Identität: über Ziel, knapp darunter,
 * deutlich darunter. Deshalb die Statusfarben der Anwendung und keine
 * Reihenfarben. Jeder Balken ist zusätzlich beschriftet, Farbe ist also
 * nie das einzige Merkmal.
 */
export function TargetDeviation({
  punkte,
  ziel,
}: {
  punkte: DeviationPoint[];
  ziel: number;
}) {
  const [aktiv, setAktiv] = useState<number | null>(null);

  const mitWerten = punkte.filter((p) => p.rate !== null);
  if (mitWerten.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Für diesen Zeitraum gibt es keine Arbeitstage, aus denen sich eine Rate ergeben könnte.
      </p>
    );
  }

  // Maßstab aus dem größten tatsächlichen Ausschlag, mindestens aber 2
  // Prozentpunkte – sonst wird aus einer Abweichung von 0,3 ein
  // bildschirmfüllender Balken.
  const groessteAbweichung = Math.max(
    2,
    ...mitWerten.map((p) => Math.abs((p.rate as number) - ziel)),
  );

  return (
    <div>
      <div className="flex items-end gap-1 sm:gap-2" role="list">
        {punkte.map((p, i) => {
          const rate = p.rate;
          const abw = rate === null ? 0 : rate - ziel;
          // Halbe Höhe je Richtung, damit die Mittellinie mittig sitzt.
          const anteil = Math.min(Math.abs(abw) / groessteAbweichung, 1);
          const hoehe = rate === null ? 0 : Math.max(anteil * 46, 2);
          const ueber = abw >= 0;
          const knapp = !ueber && Math.abs(abw) <= 1;

          return (
            <div
              key={p.label}
              role="listitem"
              className="group relative flex min-w-0 flex-1 flex-col items-center"
              onMouseEnter={() => setAktiv(i)}
              onMouseLeave={() => setAktiv(null)}
              onFocus={() => setAktiv(i)}
              onBlur={() => setAktiv(null)}
              tabIndex={0}
            >
              {/* Oberhalb der Linie: über dem Ziel */}
              <div className="flex h-[48px] w-full items-end justify-center">
                {rate !== null && ueber ? (
                  <span
                    style={{ height: `${hoehe}px` }}
                    className="w-full max-w-[24px] rounded-t bg-ok-fg/80"
                  />
                ) : null}
              </div>

              <span className="h-px w-full bg-line" aria-hidden="true" />

              {/* Unterhalb: unter dem Ziel */}
              <div className="flex h-[48px] w-full items-start justify-center">
                {rate !== null && !ueber ? (
                  <span
                    style={{ height: `${hoehe}px` }}
                    className={cn(
                      "w-full max-w-[24px] rounded-b",
                      knapp ? "bg-warn-fg/80" : "bg-crit-fg/80",
                    )}
                  />
                ) : null}
              </div>

              <span className="mt-1 block truncate text-[10px] text-ink-faint">
                {p.label.slice(0, 3)}
              </span>

              {aktiv === i ? (
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-md">
                  <p className="font-medium">{p.label}</p>
                  {rate === null ? (
                    <p className="text-ink-muted">keine Arbeitstage</p>
                  ) : (
                    <>
                      <p className="tnum text-ink-muted">
                        {rate.toFixed(1)} % · {abw >= 0 ? "+" : ""}
                        {abw.toFixed(1)} zum Ziel
                      </p>
                      <p className="tnum text-ink-faint">
                        {p.sollTage} Soll-Tage · {p.ausfallTage} Ausfall
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[12px] text-ink-faint">
        Mittellinie = Zielwert {ziel} %. Nach oben über dem Ziel, nach unten darunter.
      </p>
    </div>
  );
}
