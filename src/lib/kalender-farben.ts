import type { CSSProperties } from "react";
import { farbStil } from "@/lib/privat/daten";

/**
 * Persönliche Farben für Schichten und Abwesenheiten (Tabelle
 * kalender_farben). Gelten im eigenen Kalender – und im Schichtplan, wenn
 * die Person „Meine Farben im Schichtplan“ einschaltet.
 */

/**
 * Standardfarben – kräftig, im Farbton wie im Schichtplan. Jede Person kann
 * sie für sich ändern (Kalender anpassen).
 */
export const STANDARD_FARBE: Record<string, string> = {
  "schicht:F": "#F5A524",
  "schicht:S": "#46A758",
  "schicht:N": "#2F6FDE",
  "abw:U": "#F2C200",
  "abw:V": "#8E4EC6",
  "abw:K": "#E5484D",
  "abw:AF": "#18794E",
  "abw:SU": "#D6409F",
  "abw:BU": "#8D8D86",
  "abw:G": "#A18072",
  "abw:FB": "#6E56CF",
  "abw:A": "#5B6472",
};
/** Andere Schichten (z. B. Tagschicht) ohne eigene Standardfarbe. */
export const SONSTIGE_SCHICHT_FARBE = "#12A594";

/** Abwesenheiten, deren Farbe sich ändern lässt (Reihenfolge der Liste). */
export const ABW_IN_EINSTELLUNGEN = ["U", "V", "K", "AF", "SU", "BU", "G", "FB"];

export const schichtSchluessel = (code: string | null, name: string | null) =>
  `schicht:${(code || name || "?").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30) || "X"}`;

export function farbeFuer(schluessel: string, farben: Record<string, string>): string | null {
  if (farben[schluessel]) return farben[schluessel]!;
  if (STANDARD_FARBE[schluessel]) return STANDARD_FARBE[schluessel]!;
  if (schluessel.startsWith("schicht:")) return SONSTIGE_SCHICHT_FARBE;
  return null; // Frei: neutral
}

/** Abwesenheiten im Schichtplan; alles andere außer „FREI“ ist eine Schicht. */
const PLAN_ABWESENHEIT = new Set(["U", "V", "AF", "SU", "BU", "G", "K", "FB", "A"]);

/**
 * Zellfarbe im Schichtplan nach den eigenen Kalenderfarben. Beantragt
 * (kleines Kürzel) hell mit Rahmen, wie im Kalender. null = Standard des
 * Plans behalten (z. B. Frei ohne eigene Farbe).
 */
export function planZellStil(code: string, farben: Record<string, string>): CSSProperties | null {
  if (code === "FREI") return farben.frei ? farbStil(farben.frei) : null;
  const gross = code.toUpperCase();
  if (PLAN_ABWESENHEIT.has(gross)) {
    const f = farbeFuer(`abw:${gross}`, farben) ?? STANDARD_FARBE["abw:A"]!;
    if (code !== gross) return { backgroundColor: `${f}33`, boxShadow: `inset 0 0 0 1.5px ${f}`, color: "rgb(var(--c-ink))" };
    return farbStil(f);
  }
  const f = farbeFuer(schichtSchluessel(code, null), farben);
  return f ? farbStil(f) : null;
}
