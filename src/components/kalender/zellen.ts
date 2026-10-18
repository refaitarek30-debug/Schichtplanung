"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wie viele Terminzeilen in eine Monatszelle passen. Die Zelle hat eine feste
 * Höhe (sie wird nie gestreckt, Überstehendes wird abgeschnitten), deshalb
 * messen wir sie und ziehen ab, was schon drinsteht: Tageszahl, Schicht-
 * Kästchen, Eingeladene, Feiertag. Der Rest ist Platz für Termine – je
 * eine Zeile untereinander.
 */
const RAND = 31; // Rand oben/unten, Tageszahl und Abstand
const KAESTCHEN = 24;
const KAESTCHEN_KLEIN = 20;
const ZEILE = 14.5;

/** Misst die Höhe einer Zelle (alle Zellen sind gleich hoch) und merkt sich Änderungen. */
export function useZellenHoehe() {
  const [hoehe, setHoehe] = useState(0);
  const beobachter = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    beobachter.current?.disconnect();
    beobachter.current = null;
    if (!el) return;
    const messen = () => setHoehe(el.clientHeight);
    messen();
    beobachter.current = new ResizeObserver(messen);
    beobachter.current.observe(el);
  }, []);
  return { ref, hoehe };
}

/** Höchstens so viele Terminzeilen passen (0 bis 4). Ohne Messung: die vorsichtige Zahl 1–2. */
export function terminZeilen(hoehe: number, opt: { kaestchen: number; klein: boolean; eingeladene: boolean; extraZeilen?: number }): number {
  if (!hoehe) return Math.max(0, 2 - (opt.eingeladene ? 1 : 0) - Math.max(0, opt.kaestchen - 1));
  const belegt = opt.kaestchen * (opt.klein ? KAESTCHEN_KLEIN : KAESTCHEN) + (opt.eingeladene ? 17 : 0) + (opt.extraZeilen ?? 0) * 12;
  return Math.max(0, Math.min(4, Math.floor((hoehe - RAND - belegt) / ZEILE)));
}
