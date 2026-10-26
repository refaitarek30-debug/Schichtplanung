/**
 * Zuletzt Geladenes sofort zeigen, im Hintergrund auffrischen.
 *
 * Wer vom Schichtplan zur Startseite und zurück wechselt, sah bisher jedes
 * Mal erst einen leeren Rahmen, bis die Daten wieder da waren. Jetzt steht
 * sofort der letzte Stand da, und im Hintergrund wird nachgeladen. Ändert
 * sich etwas, springt die Anzeige auf den neuen Stand.
 *
 * Bewusst nur im Arbeitsspeicher dieses Tabs:
 *   * nichts landet dauerhaft auf dem Gerät – Kranktage, Anträge und der
 *     Plan anderer Leute sollen nicht auf einem Handy liegen bleiben,
 *   * der Schlüssel enthält immer die Benutzer-Id, und beim Abmelden wird
 *     alles verworfen,
 *   * auf dem Server wird nie etwas gespeichert (dort gäbe es nur einen
 *     Speicher für alle Anfragen – genau das darf nicht passieren).
 *
 * Einzige Ausnahme: die eigenen Schichten des Kalenders werden zusätzlich auf
 * dem Gerät gemerkt (geraete-speicher.ts), damit er sofort aufgeht.
 */

import { leereGeraet } from "@/lib/geraete-speicher";

const GRENZE = 40;
const speicher = new Map<string, unknown>();

const imBrowser = () => typeof window !== "undefined";

export function ausZwischenspeicher<T>(schluessel: string): T | undefined {
  if (!imBrowser()) return undefined;
  return speicher.get(schluessel) as T | undefined;
}

export function inZwischenspeicher<T>(schluessel: string, wert: T): void {
  if (!imBrowser()) return;
  // Zuletzt benutzt ans Ende, damit bei voller Liste das Älteste geht.
  speicher.delete(schluessel);
  speicher.set(schluessel, wert);
  while (speicher.size > GRENZE) {
    const aeltester = speicher.keys().next().value;
    if (aeltester === undefined) break;
    speicher.delete(aeltester);
  }
}

/** Beim Abmelden und auf der Anmeldeseite: auch der gemerkte Stand auf dem Gerät (geraete-speicher.ts) geht. */
export function leereZwischenspeicher(): void {
  speicher.clear();
  leereGeraet();
  // Offline angelegte, noch nicht hochgeladene Termine (offline-termine.ts).
  try {
    const weg: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("sp_offline_termine:")) weg.push(k);
    }
    for (const k of weg) window.localStorage.removeItem(k);
  } catch {
    // ohne Speicher nichts zu löschen
  }
  // Auch die gemerkte Offline-Seite des eigenen Kalenders (public/sw.js).
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage("leere-kalender");
      if (typeof caches !== "undefined") void caches.delete("schichtplan-kalender-v1");
    }
  } catch {
    // ohne Service Worker gibt es auch nichts zu löschen
  }
}
