/** Bereiche der Seite „Schichten“ (Kacheln) – auch für die Server-Seite, die `?reiter=` liest. */
export type Reiter = "uebersicht" | "liste" | "geld" | "urlaub" | "gemeinsam";
export const REITER: readonly Reiter[] = ["uebersicht", "liste", "geld", "urlaub", "gemeinsam"];

export function reiterAus(wert: string | undefined): Reiter {
  return REITER.find((r) => r === wert) ?? "uebersicht";
}
