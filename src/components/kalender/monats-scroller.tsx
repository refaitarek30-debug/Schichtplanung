"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Monate untereinander in einer echten, nativen Scroll-Liste: Schwung wie bei
 * jeder iPhone-Liste, und am Ende rastet genau ein Monat ein (scroll-snap).
 * Kein Nachzeichnen per JavaScript während der Bewegung – das Scrollen läuft
 * im Browser selbst und hakt deshalb nicht.
 *
 * Es gibt 2 × SPANNE + 1 Seiten rund um einen Bezugsmonat; gezeichnet werden
 * nur die Seiten nahe am sichtbaren Monat, die anderen sind leere Platzhalter
 * mit derselben Höhe. Kommt man an den Rand, wird der Bezugsmonat neu gesetzt.
 */

const SPANNE = 60;
const ZEICHNEN = 2;

export interface Monat {
  jahr: number;
  monat: number;
}

const index = (basis: Monat, m: Monat) => (m.jahr - basis.jahr) * 12 + (m.monat - basis.monat) + SPANNE;
const monatBei = (basis: Monat, i: number): Monat => {
  const d = new Date(basis.jahr, basis.monat + (i - SPANNE), 1);
  return { jahr: d.getFullYear(), monat: d.getMonth() };
};

export interface MonatsScrollerGriff {
  /** Einen Monat weiter/zurück – mit derselben weichen Bewegung. */
  blaettern: (schritt: number) => void;
  /** Gerade in Bewegung (Scroll noch nicht zur Ruhe gekommen)? */
  bewegt: () => boolean;
}

export const MonatsScroller = forwardRef<
  MonatsScrollerGriff,
  {
    monat: Monat;
    onMonat: (m: Monat) => void;
    /** Scrollen aus (z. B. Pinsel: Finger malt statt zu scrollen). */
    gesperrt?: boolean;
    seite: (m: Monat, sichtbar: boolean) => ReactNode;
    className?: string;
    griffe?: React.HTMLAttributes<HTMLDivElement>;
  }
>(function MonatsScroller({ monat, onMonat, gesperrt = false, seite, className, griffe }, ref) {
  const flaeche = useRef<HTMLDivElement>(null);
  const [basis, setBasis] = useState<Monat>(monat);
  const [aktuell, setAktuell] = useState(SPANNE);
  const aktuellRef = useRef(SPANNE);
  const zuletzt = useRef(0);
  const meldung = useRef(onMonat);
  useEffect(() => {
    meldung.current = onMonat;
  });

  const hoehe = () => flaeche.current?.clientHeight || 1;

  // Am Anfang (und nach neuem Bezugsmonat): ohne Bewegung auf den Monat stellen.
  useLayoutEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const i = index(basis, monat);
    el.scrollTop = i * hoehe();
    aktuellRef.current = i;
    setAktuell(i);
    // Nur beim Wechsel des Bezugsmonats – sonst übernimmt das Scrollen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basis]);

  // Monat von außen geändert (Heute, Jahresansicht, Pfeile): dorthin scrollen.
  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const ziel = index(basis, monat);
    if (ziel === aktuellRef.current) return;
    if (ziel < ZEICHNEN || ziel > 2 * SPANNE - ZEICHNEN) {
      setBasis(monat);
      return;
    }
    const nah = Math.abs(ziel - aktuellRef.current) <= 2;
    aktuellRef.current = ziel;
    setAktuell(ziel);
    el.scrollTo({ top: ziel * hoehe(), behavior: nah ? "smooth" : "auto" });
  }, [monat, basis]);

  // Größe ändert sich (Drehen, Tastatur, Leiste): auf dem Monat bleiben.
  useEffect(() => {
    const el = flaeche.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      el.scrollTop = aktuellRef.current * hoehe();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const beimScrollen = useCallback(() => {
    const el = flaeche.current;
    if (!el) return;
    zuletzt.current = Date.now();
    const i = Math.max(0, Math.min(2 * SPANNE, Math.round(el.scrollTop / hoehe())));
    if (i === aktuellRef.current) return;
    aktuellRef.current = i;
    setAktuell(i);
    const m = monatBei(basis, i);
    meldung.current(m);
    // Nah am Rand der Liste: neu um diesen Monat herum aufbauen (merkt man nicht).
    if (i < ZEICHNEN + 1 || i > 2 * SPANNE - ZEICHNEN - 1) window.setTimeout(() => setBasis(m), 400);
  }, [basis]);

  useImperativeHandle(
    ref,
    () => ({
      blaettern: (schritt: number) => {
        const el = flaeche.current;
        if (!el) return;
        const ziel = Math.max(0, Math.min(2 * SPANNE, aktuellRef.current + schritt));
        el.scrollTo({ top: ziel * hoehe(), behavior: "smooth" });
      },
      bewegt: () => Date.now() - zuletzt.current < 140,
    }),
    [],
  );

  return (
    <div
      ref={flaeche}
      onScroll={beimScrollen}
      data-monats-scroller
      {...griffe}
      className={cn(
        "h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        gesperrt ? "touch-none overflow-hidden" : "touch-pan-y",
        className,
      )}
    >
      {Array.from({ length: 2 * SPANNE + 1 }, (_, i) => {
        const nah = Math.abs(i - aktuell) <= ZEICHNEN;
        const m = monatBei(basis, i);
        return (
          <div key={`${m.jahr}-${m.monat}`} className="h-full snap-start snap-always" aria-hidden={i !== aktuell}>
            {nah ? seite(m, i === aktuell) : null}
          </div>
        );
      })}
    </div>
  );
});
