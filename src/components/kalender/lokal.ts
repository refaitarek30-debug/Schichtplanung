"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Kleine Ja/Nein-Einstellung im Browser (z. B. „Partner anzeigen“,
 * „Einführung gesehen“). Ohne Speicher (privater Modus) gilt der
 * Standardwert. Mehrere Komponenten mit demselben Schlüssel bleiben
 * gleich, auch über Tabs hinweg.
 */

const zuhoerer = new Set<() => void>();

function abonnieren(rueckruf: () => void) {
  zuhoerer.add(rueckruf);
  window.addEventListener("storage", rueckruf);
  return () => {
    zuhoerer.delete(rueckruf);
    window.removeEventListener("storage", rueckruf);
  };
}

function lesen(schluessel: string): string | null {
  try {
    return window.localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}

export function setzeLokal(schluessel: string, wert: boolean) {
  try {
    window.localStorage.setItem(schluessel, wert ? "1" : "0");
  } catch {
    // kein Speicher – dann gilt es nur bis zum Neuladen nicht
  }
  for (const z of zuhoerer) z();
}

export function useLokaleEinstellung(schluessel: string, standard: boolean) {
  const roh = useSyncExternalStore(
    abonnieren,
    () => lesen(schluessel),
    () => null,
  );
  const wert = roh === null ? standard : roh === "1";
  const setzen = useCallback((neu: boolean) => setzeLokal(schluessel, neu), [schluessel]);
  return [wert, setzen] as const;
}

/**
 * Wie oben, aber für Dinge, die erst nach dem Laden im Browser feststehen
 * (z. B. „Neu“-Markierung): auf dem Server immer `serverWert`, damit nichts
 * aufblitzt, das dann wieder verschwindet.
 */
export function useLokalNachLaden(schluessel: string, standard: boolean, serverWert: boolean) {
  const roh = useSyncExternalStore(
    abonnieren,
    () => lesen(schluessel) ?? "",
    () => (serverWert ? "1" : "0"),
  );
  return roh === "" ? standard : roh === "1";
}
