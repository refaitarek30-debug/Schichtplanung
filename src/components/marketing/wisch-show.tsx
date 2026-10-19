"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Folie = { titel: string; text: string; bild: ReactNode };

/** Feste Entwurfsgrößen; verkleinert wird per CSS (globals.css, .buehne-*). */
const PC: CSSProperties = { "--b": "800px", "--h": "500px" } as CSSProperties;
const HANDY: CSSProperties = { "--b": "300px", "--h": "640px" } as CSSProperties;

/**
 * Bühne der Startseite: hinten ein Bildschirm (PC), vorne ein Handy im
 * Hochformat, in dem man durch die Funktionen wischt. Darunter Titel und
 * Punkte. Wischen ist natives Scrollen mit Einrasten – kein Nachbau.
 */
export function WischShow({ pc, folien, name }: { pc: ReactNode; folien: Folie[]; name: string }) {
  const leiste = useRef<HTMLDivElement>(null);
  const [aktiv, setAktiv] = useState(0);

  function gehe(i: number) {
    const el = leiste.current;
    if (!el) return;
    const n = Math.max(0, Math.min(folien.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  }

  function gescrollt() {
    const el = leiste.current;
    if (!el || !el.clientWidth) return;
    setAktiv(Math.round(el.scrollLeft / el.clientWidth));
  }

  const f = folien[aktiv] ?? folien[0];

  return (
    <div>
      <div className="relative mx-auto h-[566px] w-full text-left max-w-[343px] sm:h-[540px] sm:max-w-[600px] lg:h-[640px] lg:max-w-[980px]">
        {/* PC im Hintergrund */}
        <div aria-hidden className="absolute left-1/2 top-0 -translate-x-1/2 sm:left-0 sm:translate-x-0">
          <div className="rounded-[12px] bg-[#1c1d21] p-[5px] shadow-[0_24px_60px_-24px_rgba(17,24,39,0.45)] ring-1 ring-white/15 sm:rounded-[16px] sm:p-[7px] lg:rounded-[20px] lg:p-[10px]">
            <div className="buehne-pc overflow-hidden rounded-[6px] bg-surface lg:rounded-[8px]" style={PC}>
              <div>{pc}</div>
            </div>
          </div>
          <div className="mx-auto h-[26px] w-[20%] bg-gradient-to-b from-[#c9ccd2] to-[#e3e5e9] [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)] sm:h-[38px] lg:h-[56px]" />
          <div className="mx-auto h-[4px] w-[32%] rounded-full bg-[#d4d7dc] sm:h-[6px]" />
        </div>

        {/* Handy im Vordergrund */}
        <div className="absolute left-1/2 top-[64px] -translate-x-1/2 sm:left-auto sm:right-0 sm:top-[52px] sm:translate-x-0 lg:right-6 lg:top-[112px]">
          <div className="relative rounded-[40px] bg-[#16181d] p-[7px] shadow-[0_30px_70px_-18px_rgba(17,24,39,0.5)] ring-1 ring-white/15">
            <div className="overflow-hidden rounded-[33px]">
              <div
                ref={leiste}
                onScroll={gescrollt}
                tabIndex={0}
                role="region"
                aria-roledescription="Wischbare Vorschau"
                aria-label={`${name}: ${folien.length} Bildschirme, zum Wechseln wischen`}
                className="buehne-handy wisch flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-none"
                style={HANDY}
              >
                {folien.map((x, i) => (
                  <div key={x.titel} className="folie shrink-0 snap-center snap-always" aria-hidden={i !== aktiv}>
                    <div>{x.bild}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Dynamic Island */}
            <span aria-hidden className="pointer-events-none absolute left-1/2 top-[15px] h-[18px] w-[64px] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>
      </div>

      {/* Beschriftung und Punkte */}
      <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 sm:mt-8">
        <button
          type="button"
          onClick={() => gehe(aktiv - 1)}
          disabled={aktiv === 0}
          aria-label="Vorheriger Bildschirm"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink transition-opacity hover:bg-ink/[0.1] disabled:opacity-30 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex justify-center gap-2" role="tablist" aria-label="Bildschirm wählen">
            {folien.map((x, i) => (
              <button
                key={x.titel}
                type="button"
                role="tab"
                aria-selected={i === aktiv}
                aria-label={x.titel}
                onClick={() => gehe(i)}
                className="flex h-6 items-center justify-center px-0.5"
              >
                <span className={cn("block h-[7px] rounded-full transition-all duration-300", i === aktiv ? "w-6 bg-ink" : "w-[7px] bg-ink/25")} />
              </button>
            ))}
          </div>
          <p aria-live="polite" className="mt-3 min-h-[3.25rem]">
            <span className="block text-[17px] font-semibold tracking-tight">{f.titel}</span>
            <span className="mt-0.5 block text-[15px] leading-snug text-ink-muted">{f.text}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => gehe(aktiv + 1)}
          disabled={aktiv === folien.length - 1}
          aria-label="Nächster Bildschirm"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink transition-opacity hover:bg-ink/[0.1] disabled:opacity-30 sm:flex"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
