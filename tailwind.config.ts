import type { Config } from "tailwindcss";

/** Kurzform: Farbe aus einer CSS-Variablen, mit Transparenz kombinierbar. */
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  // Beide Bäume: die Seiten liegen unter ./app, Komponenten und Bibliothek
  // unter ./src. Fehlt ./app hier, werden Klassen, die es NUR dort gibt,
  // aus dem CSS entfernt und die Seite sieht kaputt aus.
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Die Werte stehen in app/globals.css – einmal für hell, einmal für
      // dunkel. Hier nur die Namen.
      colors: {
        surface: {
          DEFAULT: c("surface"),
          muted: c("surface-muted"),
          sunken: c("surface-sunken"),
        },
        ink: {
          DEFAULT: c("ink"),
          muted: c("ink-muted"),
          faint: c("ink-faint"),
        },
        line: c("line"),
        brand: {
          50: c("brand-50"),
          100: c("brand-100"),
          500: c("brand-500"),
          600: c("brand-600"),
          700: c("brand-700"),
        },
        ok: { bg: c("ok-bg"), fg: c("ok-fg"), dot: c("ok-dot") },
        warn: { bg: c("warn-bg"), fg: c("warn-fg"), dot: c("warn-dot") },
        crit: { bg: c("crit-bg"), fg: c("crit-fg"), dot: c("crit-dot") },
        info: { bg: c("info-bg"), fg: c("info-fg"), dot: c("info-dot") },
        plan: { bg: c("plan-bg"), fg: c("plan-fg"), dot: c("plan-dot") },
        // Kürzel im Schichtplan
        shift: {
          frueh: c("frueh"),
          "frueh-ink": c("frueh-ink"),
          spaet: c("spaet"),
          "spaet-ink": c("spaet-ink"),
          nacht: c("nacht"),
          "nacht-ink": c("nacht-ink"),
          urlaub: c("urlaub"),
          "urlaub-ink": c("urlaub-ink"),
          vtag: c("vtag"),
          "vtag-ink": c("vtag-ink"),
          krank: c("krank"),
          "krank-ink": c("krank-ink"),
          schulung: c("schulung"),
          "schulung-ink": c("schulung-ink"),
          altersfrei: c("altersfrei"),
          "altersfrei-ink": c("altersfrei-ink"),
          sonderurlaub: c("sonderurlaub"),
          "sonderurlaub-ink": c("sonderurlaub-ink"),
          bildungsurlaub: c("bildungsurlaub"),
          "bildungsurlaub-ink": c("bildungsurlaub-ink"),
          gewerkschaft: c("gewerkschaft"),
          "gewerkschaft-ink": c("gewerkschaft-ink"),
        },
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,24,39,0.04), 0 8px 24px -12px rgba(17,24,39,0.10)",
        pop: "0 12px 40px -12px rgba(17,24,39,0.22)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
