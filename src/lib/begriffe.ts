"use client";

import { useCallback } from "react";
import { useSession } from "@/context/session";

/**
 * Jeder Betrieb darf bei der Registrierung festlegen, wie er „V-Tag“ nennt
 * (zum Beispiel „Zeitausgleichstag“). Geändert wird nur die Beschriftung; die
 * Berechnung und die Werte in der Datenbank bleiben gleich.
 */
export function ersetzeVTag(text: string, einzahl: string, mehrzahl: string): string {
  if (einzahl === "V-Tag" && mehrzahl === "V-Tage") return text;
  const mitN = mehrzahl.endsWith("e") ? `${mehrzahl}n` : mehrzahl;
  return text
    .replace(/V-Tagen/g, mitN)
    .replace(/V-Tage/g, mehrzahl)
    .replace(/V-Tag/g, einzahl);
}

/** Text so zurückgeben, wie der eigene Betrieb ihn nennt: `const t = useBegriffe(); t("V-Tage")`. */
export function useBegriffe(): (text: string) => string {
  const { company } = useSession();
  const einzahl = company.vTagName ?? "V-Tag";
  const mehrzahl = company.vTageName ?? "V-Tage";
  return useCallback((text: string) => ersetzeVTag(text, einzahl, mehrzahl), [einzahl, mehrzahl]);
}
