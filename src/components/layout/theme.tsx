"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, Sunset, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANZEIGE_SKRIPT } from "@/lib/anzeige-skript";

export type Theme = "system" | "light" | "dark" | "graphit" | "sand";
export const THEME_KEY = "schichtplan.theme";

/**
 * Zwei Attribute am <html>-Element:
 *   - data-theme: hell oder dunkel – daran hängen alle Dunkel-Regeln.
 *   - data-palette: Feinabstimmung darauf (Graphit = tiefschwarz,
 *     Sand = warmes Hell). So bleiben die Dunkel-Regeln für Graphit gültig.
 * Ohne Wahl bleiben beide weg, dann entscheidet die Systemeinstellung.
 */
const GRUND: Record<Theme, { theme: "light" | "dark" | null; palette: string | null }> = {
  system: { theme: null, palette: null },
  light: { theme: "light", palette: null },
  dark: { theme: "dark", palette: null },
  graphit: { theme: "dark", palette: "graphit" },
  sand: { theme: "light", palette: "sand" },
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const { theme: t, palette } = GRUND[theme];
  if (t) root.setAttribute("data-theme", t);
  else root.removeAttribute("data-theme");
  if (palette) root.setAttribute("data-palette", palette);
  else root.removeAttribute("data-palette");
}

function istTheme(wert: string | null): wert is Theme {
  return wert !== null && wert in GRUND;
}

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (istTheme(stored)) return stored;
  } catch {
    // Privater Modus – dann gilt eben die Systemeinstellung.
  }
  return "system";
}

/**
 * Läuft vor dem ersten Zeichnen, damit die Seite nicht kurz hell aufblitzt,
 * bevor die dunkle Einstellung greift. Bewusst als kleines Inline-Skript –
 * React rendert dafür zu spät.
 */
export function ThemeScript() {
  const code = `(function(){try{var g=${JSON.stringify(GRUND)}[localStorage.getItem(${JSON.stringify(
    THEME_KEY,
  )})];if(g){var r=document.documentElement;if(g.theme)r.setAttribute("data-theme",g.theme);if(g.palette)r.setAttribute("data-palette",g.palette);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code + ANZEIGE_SKRIPT }} />;
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "graphit", label: "Graphit", icon: Circle },
  { value: "sand", label: "Sand", icon: Sunset },
  { value: "system", label: "System", icon: Monitor },
];

/** Auswahl zwischen hell, dunkel, Graphit, Sand und der Systemeinstellung. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Nicht speicherbar – die Wahl gilt dann nur für diese Sitzung.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className="inline-flex max-w-full flex-wrap gap-0.5 rounded-xl border border-line bg-surface p-1"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-ink-muted hover:bg-surface-muted",
            )}
          >
            <Icon
              className={cn("h-4 w-4", option.value === "graphit" && "fill-current")}
              strokeWidth={1.8}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
