"use client";

import { useRef } from "react";
import type React from "react";
import { Eraser, Paintbrush, Plus, X } from "lucide-react";
import { farbStil } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

/**
 * Gemeinsam für „Mein Kalender“ (Firma) und den Privatkalender: der
 * Pinsel-Knopf unten rechts, die Pinsel-Leiste und das Blättern der Monate
 * durch Wischen nach oben oder unten – mit Bewegung.
 */

/** Runder Pinsel-Knopf unten rechts auf dem Kalender. */
export function PinselKnopf({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Mit dem Pinsel eintragen"
      onClick={onClick}
      className="glas-dicht absolute bottom-4 right-4 z-[5] flex h-12 w-12 items-center justify-center rounded-full text-ink shadow-[0_10px_26px_rgba(31,41,77,0.22)] transition-transform active:scale-95"
    >
      <Paintbrush className="h-[22px] w-[22px]" />
    </button>
  );
}

export interface PinselEintrag {
  id: string;
  name: string;
  kuerzel: string;
  farbe: string;
}

/** Leiste unten: Kreis mit Kürzel und Name je Eintrag, Leeren, Neu; X schließt. */
export function PinselLeiste({
  eintraege,
  aktiv,
  onWahl,
  onNeu,
  onClose,
}: {
  eintraege: PinselEintrag[];
  /** Id des gewählten Eintrags oder "leer" */
  aktiv: string | null;
  onWahl: (id: string) => void;
  /** Neuen Eintrag anlegen (ohne: kein „Neu“). */
  onNeu?: () => void;
  onClose: () => void;
}) {
  const fach = (an: boolean) =>
    cn(
      "relative flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-[22px] px-2.5",
      an && "bg-ink/[0.07]",
    );
  const kreis = (an: boolean) =>
    cn(
      "flex h-9 w-9 items-center justify-center rounded-full text-[12.5px] font-bold [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7",
      an && "ring-2 ring-ink ring-offset-2 ring-offset-white",
    );
  const strich = <span aria-hidden className="absolute left-0 top-1/2 h-8 w-px -translate-y-1/2 bg-ink/10" />;

  return (
    <div className="relative mt-3 shrink-0 [animation:pinsel-hoch_.24s_cubic-bezier(.2,.8,.2,1)] motion-reduce:[animation:none]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Pinsel beenden"
        className="absolute -top-6 right-2 z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-[0_6px_18px_rgba(31,41,77,0.25)]"
      >
        <X className="h-5 w-5" strokeWidth={2.6} />
      </button>
      <div
        role="toolbar"
        aria-label="Pinsel: Eintrag wählen, dann Tage antippen"
        className="glas-dicht flex h-[5.4rem] touch-pan-x select-none items-stretch overflow-x-auto overflow-y-hidden overscroll-contain rounded-[28px] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [@media(max-height:700px)]:h-[4.4rem]"
      >
        {eintraege.map((a, i) => (
          <button key={a.id} type="button" onClick={() => onWahl(a.id)} aria-pressed={aktiv === a.id} className={fach(aktiv === a.id)}>
            {i > 0 ? strich : null}
            <span className={kreis(aktiv === a.id)} style={farbStil(a.farbe)}>
              {a.kuerzel}
            </span>
            <span className="max-w-[6.5rem] truncate text-[13px] font-semibold">{a.name}</span>
          </button>
        ))}
        {eintraege.length ? (
          <button type="button" onClick={() => onWahl("leer")} aria-pressed={aktiv === "leer"} className={fach(aktiv === "leer")}>
            {strich}
            <span className={cn(kreis(aktiv === "leer"), "bg-ink/[0.08] text-ink-muted")}>
              <Eraser className="h-4 w-4" />
            </span>
            <span className="text-[13px] font-semibold">Leeren</span>
          </button>
        ) : null}
        {onNeu ? (
          <button type="button" onClick={onNeu} className={fach(false)}>
            {eintraege.length ? strich : null}
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink/30 text-ink-muted [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7">
              <Plus className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-ink-muted">
              {eintraege.length ? "Neu" : "Eigenen Eintrag anlegen"}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Monate blättern durch Wischen nach oben (weiter) oder unten (zurück). Die
 * Fläche folgt dem Finger, gleitet beim Blättern hinaus und der neue Monat
 * von der anderen Seite herein. Bei „Bewegung reduzieren“ ohne Animation.
 */
export function useMonatWischen(springe: (schritt: number) => void) {
  const flaeche = useRef<HTMLDivElement>(null);
  const wisch = useRef<{ x: number; y: number; senkrecht: boolean } | null>(null);
  const gewischt = useRef(false);
  const blaettert = useRef(false);

  function versatz(y: number, dauer = 0) {
    const el = flaeche.current;
    if (!el) return;
    el.style.transition = dauer ? `transform ${dauer}ms cubic-bezier(.2,.8,.2,1), opacity ${dauer}ms ease-out` : "none";
    el.style.transform = y ? `translateY(${y}px)` : "";
    el.style.opacity = y ? String(Math.max(0, 1 - Math.abs(y) / (el.offsetHeight * 0.26))) : "";
  }

  function blaettern(schritt: number) {
    const el = flaeche.current;
    const ruhig = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || ruhig || blaettert.current) {
      versatz(0);
      springe(schritt);
      return;
    }
    blaettert.current = true;
    const weg = el.offsetHeight * 0.22;
    versatz(schritt > 0 ? -weg : weg, 160);
    window.setTimeout(() => {
      springe(schritt);
      versatz(schritt > 0 ? weg : -weg);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          versatz(0, 240);
          window.setTimeout(() => (blaettert.current = false), 240);
        }),
      );
    }, 160);
  }

  const griffe = {
    onPointerDown: (e: React.PointerEvent) => {
      gewischt.current = false;
      if (blaettert.current) return;
      wisch.current = { x: e.clientX, y: e.clientY, senkrecht: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = wisch.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.senkrecht && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.2) s.senkrecht = true;
      // Die Fläche folgt dem Finger – etwas gebremst.
      if (s.senkrecht) versatz(dy * 0.55);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = wisch.current;
      wisch.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        gewischt.current = true;
        // Nur den Klick direkt danach schlucken.
        window.setTimeout(() => (gewischt.current = false), 120);
        blaettern(dy < 0 ? 1 : -1);
      } else if (s.senkrecht) {
        versatz(0, 200);
      }
    },
    onPointerCancel: () => {
      wisch.current = null;
      versatz(0, 200);
    },
  };

  return { flaeche, griffe, blaettern, gewischt };
}
