import type { Holiday } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Datum -> "YYYY-MM-DD" (lokal, ohne UTC-Verschiebung). */
export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" -> Date (lokale Mitternacht). */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, amount: number): string {
  const date = fromISO(iso);
  date.setDate(date.getDate() + amount);
  return toISO(date);
}

export function isWeekend(iso: string): boolean {
  const day = fromISO(iso).getDay();
  return day === 0 || day === 6;
}

export function isHoliday(iso: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === iso);
}

export function holidayName(iso: string, holidays: Holiday[]): string | undefined {
  return holidays.find((h) => h.date === iso)?.name;
}

/** Alle Tage eines Zeitraums inklusive Start und Ende. */
export function eachDay(startISO: string, endISO: string): string[] {
  const days: string[] = [];
  let cursor = startISO;
  let guard = 0;
  while (cursor <= endISO && guard < 800) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
}

/**
 * Urlaubstage eines Zeitraums: Wochenenden und Feiertage zählen nicht.
 * Ein halber Tag ist nur bei eintägigen Anträgen zulässig.
 */
export function countLeaveDays(
  startISO: string,
  endISO: string,
  holidays: Holiday[],
  halfDay = false,
): number {
  const workdays = eachDay(startISO, endISO).filter(
    (iso) => !isWeekend(iso) && !isHoliday(iso, holidays),
  ).length;
  if (halfDay && workdays === 1) return 0.5;
  return workdays;
}

const WEEKDAY_LONG = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function weekdayLong(iso: string): string {
  return WEEKDAY_LONG[fromISO(iso).getDay()];
}

export function monthName(month: number): string {
  return MONTHS[month];
}

/** "2026-08-31" -> "31.08.2026" */
export function formatDE(iso: string): string {
  const date = fromISO(iso);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** "2026-08-31" -> "31.08." */
export function formatDEShort(iso: string): string {
  const date = fromISO(iso);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.`;
}

/**
 * Zeitpunkt aus der Datenbank (timestamptz) für Menschen:
 * "2026-09-26T12:32:00Z" -> "26.09.2026 um 14:32 Uhr".
 *
 * Immer in deutscher Zeit – nicht in der Zeitzone des Geräts. Wer mit
 * einem auf UTC gestellten Rechner oder aus dem Urlaub schaut, sieht sonst
 * eine andere Uhrzeit als die Kollegen im Werk.
 */
const ZEITPUNKT_DATUM = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const ZEITPUNKT_UHRZEIT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Heutiges Datum in deutscher Zeit als "YYYY-MM-DD" – wie die Datenbank es für Fristen nimmt. */
const TAG_IN_BERLIN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function heuteInBerlin(): string {
  return TAG_IN_BERLIN.format(new Date());
}

export function formatZeitpunkt(isoZeitstempel: string): string {
  const zeitpunkt = new Date(isoZeitstempel);
  if (Number.isNaN(zeitpunkt.getTime())) return "";
  return `${ZEITPUNKT_DATUM.format(zeitpunkt)} um ${ZEITPUNKT_UHRZEIT.format(zeitpunkt)} Uhr`;
}

export function formatRange(startISO: string, endISO: string): string {
  return startISO === endISO
    ? formatDE(startISO)
    : `${formatDE(startISO)} – ${formatDE(endISO)}`;
}

/** Kalendermatrix einer Monatsansicht, Montag als erster Wochentag. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Mo = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return toISO(day);
  });
}

export function isSameMonth(iso: string, year: number, month: number): boolean {
  const date = fromISO(iso);
  return date.getFullYear() === year && date.getMonth() === month;
}

/** Formatiert Tageszahlen: 0.5 -> "0,5", 12 -> "12". */
export function formatDays(days: number): string {
  return Number.isInteger(days) ? String(days) : days.toFixed(1).replace(".", ",");
}
