"use client";

import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, THEME_KEY, type Theme } from "@/components/layout/theme";
import { cn } from "@/lib/utils";

/**
 * Erster Start (Entwurf 2): einmal pro Gerät – erst „Wie soll ShiftNexo
 * aussehen?“ (Hell, Dunkel, wie das Handy), dann ein kurzer Rundgang mit vier
 * Stationen. Überspringen geht jederzeit. Danach kommt wie bisher „Wie
 * arbeitest du?“, falls der Kalender noch leer ist.
 */

const SCHLUESSEL = "sp_willkommen";
const EREIGNIS = "sp-willkommen";

function gesehen(): boolean {
  try {
    return window.localStorage.getItem(SCHLUESSEL) === "1";
  } catch {
    return true;
  }
}

/** Ob der erste Start schon durch ist (bis der Browser gelesen hat: ja – nichts blitzt auf). */
export function useWillkommenFertig(): boolean {
  return useSyncExternalStore(
    (rueckruf) => {
      window.addEventListener(EREIGNIS, rueckruf);
      return () => window.removeEventListener(EREIGNIS, rueckruf);
    },
    gesehen,
    () => true,
  );
}

function fertigMerken() {
  try {
    window.localStorage.setItem(SCHLUESSEL, "1");
  } catch {
    // ohne Speicher: kommt beim nächsten Öffnen noch einmal
  }
  window.dispatchEvent(new Event(EREIGNIS));
}

const THEMEN: { wert: Theme; name: string; icon: typeof Sun; vorschau: string }[] = [
  { wert: "light", name: "Hell", icon: Sun, vorschau: "linear-gradient(#ffffff, #f1ece4)" },
  { wert: "dark", name: "Dunkel", icon: Moon, vorschau: "linear-gradient(#26282e, #111214)" },
  { wert: "system", name: "Wie Handy", icon: Monitor, vorschau: "linear-gradient(90deg, #ffffff 50%, #1b1d22 50%)" },
];

const STATIONEN: { ziel: string; titel: string; text: string }[] = [
  { ziel: "[data-rundgang='kalender']", titel: "Dein Kalender", text: "Tag antippen = eintragen. Hoch und runter wischen = anderer Monat." },
  { ziel: "nav a[href='/privat/schichten']", titel: "Mein Monat", text: "Stunden, Lohn, Urlaub und Countdown – alles zu deinem Monat." },
  { ziel: "nav a[href='/privat/teilen']", titel: "Teilen", text: "Plan mit Partner, Familie oder Kollegen teilen – und sehen, wann ihr gemeinsam frei habt." },
  { ziel: "[data-privat-profil]", titel: "Profil und Neuigkeiten", text: "Oben rechts: Einstellungen, zum Betrieb wechseln – und die Glühbirne zeigt, was neu ist." },
];

export function Willkommen() {
  const fertig = useWillkommenFertig();
  const [schritt, setSchritt] = useState(0);
  const [thema, setThema] = useState<Theme>("system");
  const [rahmen, setRahmen] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (fertig) return;
    try {
      const t = window.localStorage.getItem(THEME_KEY) as Theme | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (t) setThema(t);
    } catch {
      // egal
    }
  }, [fertig]);

  const station = schritt > 0 ? STATIONEN[schritt - 1] : null;
  const messen = useCallback(() => {
    const el = station ? document.querySelector(station.ziel) : null;
    setRahmen(el ? el.getBoundingClientRect() : null);
  }, [station]);
  useLayoutEffect(() => {
    if (!station) return;
    // Ziel vor dem Zeichnen ausmessen, damit die Markierung nicht springt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, [station, messen]);

  if (fertig) return null;

  function waehle(t: Theme) {
    setThema(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // gilt dann nur für diese Sitzung
    }
  }

  const weiter = () => (schritt >= STATIONEN.length ? fertigMerken() : setSchritt((s) => s + 1));

  if (!station) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface/80 px-5 backdrop-blur-md" role="dialog" aria-label="Willkommen" data-willkommen>
        <div className="w-full max-w-sm text-center">
          <p className="text-[28px] font-bold leading-tight">Willkommen!</p>
          <p className="mt-1 text-[15px] text-ink-muted">Wie soll ShiftNexo aussehen?</p>
          <div className="mt-6 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Darstellung">
            {THEMEN.map((t) => (
              <button
                key={t.wert}
                type="button"
                role="radio"
                aria-checked={thema === t.wert}
                onClick={() => waehle(t.wert)}
                className={cn(
                  "glas rounded-[18px] p-2 text-[13.5px] font-semibold outline-offset-2 transition-[outline-color]",
                  thema === t.wert ? "outline outline-[2.5px] outline-brand-500" : "outline outline-1 outline-transparent",
                )}
              >
                <span className="mb-2 block h-24 rounded-[12px] ring-1 ring-ink/10" style={{ background: t.vorschau }} />
                <span className="inline-flex items-center gap-1">
                  <t.icon className="h-3.5 w-3.5" /> {t.name}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] text-ink-muted">Ändern geht später unter Mehr → Darstellung.</p>
          <button type="button" onClick={weiter} className="mt-8 h-12 w-full rounded-[16px] bg-brand-500 text-[15px] font-semibold text-white" data-willkommen-weiter>
            Weiter
          </button>
          <button type="button" onClick={fertigMerken} className="mt-2 h-10 w-full text-[14px] font-semibold text-ink-muted">
            Überspringen
          </button>
        </div>
      </div>
    );
  }

  // Rundgang: das Ziel bleibt frei, der Rest wird abgedunkelt; die Karte steht darüber oder darunter.
  const rand = 6;
  const unten = rahmen ? rahmen.top + rahmen.height / 2 > window.innerHeight / 2 : false;
  const kartenStil: React.CSSProperties = !rahmen
    ? { top: "50%", transform: "translateY(-50%)" }
    : unten
      ? { bottom: window.innerHeight - rahmen.top + 14 }
      : { top: Math.min(rahmen.bottom + 14, window.innerHeight - 200) };
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label={station.titel} data-rundgang-schritt={schritt}>
      {rahmen ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[18px] transition-all duration-300 ease-out"
          style={{
            left: rahmen.left - rand,
            top: rahmen.top - rand,
            width: rahmen.width + 2 * rand,
            height: rahmen.height + 2 * rand,
            boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 9999px rgba(15, 12, 8, 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(15,12,8,0.55)]" />
      )}
      <div className="absolute inset-x-4 mx-auto max-w-sm rounded-[18px] bg-surface p-4 shadow-[0_16px_40px_rgba(0,0,0,0.3)] transition-all duration-300" style={kartenStil}>
        <p className="text-[16px] font-bold">{station.titel}</p>
        <p className="mt-0.5 text-[14px] leading-snug text-ink-muted">{station.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex gap-1.5" aria-label={`Schritt ${schritt} von ${STATIONEN.length}`}>
            {STATIONEN.map((_, i) => (
              <span key={i} className={cn("h-2 w-2 rounded-full", i + 1 === schritt ? "bg-brand-500" : "bg-ink/15")} />
            ))}
          </span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={fertigMerken} className="text-[13.5px] font-semibold text-ink-muted">
              Überspringen
            </button>
            <button type="button" onClick={weiter} className="rounded-full bg-brand-500 px-4 py-1.5 text-[14px] font-semibold text-white" data-willkommen-weiter>
              {schritt >= STATIONEN.length ? "Los geht’s" : "Weiter"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
