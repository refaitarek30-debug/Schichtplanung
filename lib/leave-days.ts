import { eachDay, isHoliday, isWeekend } from "./dates";
import type { Holiday } from "./types";

export type HalfDayPeriod = "vormittag" | "nachmittag" | null;

/**
 * Client-seitige Vorschau für die Live-Prüfung im Formular. Spiegelt die
 * Logik von `calculate_leave_days()` in supabase/migrations/0006 – die
 * Datenbank berechnet den endgültigen Wert aber unabhängig noch einmal
 * neu und verwirft, was der Client mitschickt.
 */
export function previewLeaveDays(
  startISO: string,
  endISO: string,
  holidays: Holiday[],
  halfDayPeriod: HalfDayPeriod,
): number {
  if (endISO < startISO) return 0;
  const workdays = eachDay(startISO, endISO).filter(
    (iso) => !isWeekend(iso) && !isHoliday(iso, holidays),
  ).length;
  if (halfDayPeriod && workdays === 1) return 0.5;
  return workdays;
}
