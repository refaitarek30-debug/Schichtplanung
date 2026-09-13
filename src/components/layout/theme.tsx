"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "system" | "light" | "dark";
export const THEME_KEY = "schichtplan.theme";

/**
 * Setzt die Wahl als data-theme an das <html>-Element. Ohne Wahl bleibt das
 * Attribut weg, dann entscheidet die Systemeinstellung (siehe globals.css).
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
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
  const code = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    THEME_KEY,
  )});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Auswahl zwischen hell, dunkel und der Systemeinstellung. */
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
      className="inline-flex rounded-xl border border-line bg-surface p-1"
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
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
