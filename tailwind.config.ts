import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F5F6F8",
          sunken: "#EEF0F4",
        },
        ink: {
          DEFAULT: "#111827",
          muted: "#5B6472",
          faint: "#8A93A2",
        },
        line: "#E5E8EE",
        brand: {
          50: "#EEF3FF",
          100: "#DCE6FF",
          500: "#2F5BEA",
          600: "#2148CC",
          700: "#1A39A3",
        },
        ok: { bg: "#E8F7EF", fg: "#0F7B4F", dot: "#16A34A" },
        warn: { bg: "#FEF5E1", fg: "#9A6206", dot: "#F59E0B" },
        crit: { bg: "#FDEBEC", fg: "#B01B22", dot: "#DC2626" },
        info: { bg: "#EAF1FE", fg: "#1F49B6", dot: "#2F5BEA" },
        plan: { bg: "#F1EDFD", fg: "#5B34C7", dot: "#7C4DE0" },
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
