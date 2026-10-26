"use client";

import { useSyncExternalStore } from "react";

/**
 * Netz-Zustand. navigator.onLine allein reicht nicht: Mit WLAN ohne Internet
 * (oder wenn unser Server nicht erreichbar ist) meldet der Browser „online“,
 * obwohl nichts durchkommt. Deshalb zählt zusätzlich: Ist die letzte Anfrage an
 * uns oder an die Datenbank am Netz gescheitert? Die nächste geglückte Anfrage
 * (oder das „online“-Ereignis) hebt das wieder auf.
 */

let keinNetz = false;
const zuhoerer = new Set<() => void>();

function setzeKeinNetz(wert: boolean) {
  if (keinNetz === wert) return;
  keinNetz = wert;
  zuhoerer.forEach((z) => z());
}

function unsereAdresse(eingabe: RequestInfo | URL): boolean {
  try {
    const roh = typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url;
    const ziel = new URL(roh, window.location.href).origin;
    if (ziel === window.location.origin) return true;
    const db = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!db && ziel === new URL(db).origin;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined" && !(window as { __spNetz?: boolean }).__spNetz) {
  (window as { __spNetz?: boolean }).__spNetz = true;
  const original = window.fetch.bind(window);
  window.fetch = async (eingabe, init) => {
    const unsere = unsereAdresse(eingabe);
    try {
      const antwort = await original(eingabe, init);
      if (unsere) setzeKeinNetz(false);
      return antwort;
    } catch (e) {
      // Netzfehler sind TypeError; ein Abbruch (AbortError) zählt nicht.
      if (unsere && e instanceof TypeError) setzeKeinNetz(true);
      throw e;
    }
  };
  window.addEventListener("online", () => setzeKeinNetz(false));
}

function abonnieren(aufruf: () => void) {
  window.addEventListener("online", aufruf);
  window.addEventListener("offline", aufruf);
  zuhoerer.add(aufruf);
  return () => {
    window.removeEventListener("online", aufruf);
    window.removeEventListener("offline", aufruf);
    zuhoerer.delete(aufruf);
  };
}

/** Hat das Gerät gerade Netz? Auf dem Server und beim ersten Zeichnen: ja. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    abonnieren,
    () => navigator.onLine && !keinNetz,
    () => true,
  );
}

/** Ohne Hook, z. B. in einem Fehler-Zweig. */
export function istOffline(): boolean {
  return typeof navigator !== "undefined" && (navigator.onLine === false || keinNetz);
}
