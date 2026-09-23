"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Aktualisieren, ohne ständig alles neu zu laden.
 *
 * Statt den Schichtplan alle 15 Sekunden komplett neu zu holen, fragt die
 * App einen kleinen Stempel ab (`aenderungsstand()`, wenige Millisekunden).
 * Nur wenn sich ein Stempel geändert hat, laden die Bereiche neu, die sich
 * für dieses Thema angemeldet haben.
 *
 * Wann gefragt wird:
 *   * alle 60 Sekunden – aber nur, solange die App sichtbar ist. Liegt das
 *     Handy in der Tasche, passiert nichts.
 *   * sofort, wenn die App aus dem Hintergrund zurückkommt oder das Netz
 *     wieder da ist. Wer das Handy herausholt, sieht damit aktuelle Daten.
 */

export type Thema = "antraege" | "abwesenheiten" | "plan" | "benachrichtigungen" | "mitteilungen";

const THEMEN: Thema[] = ["antraege", "abwesenheiten", "plan", "benachrichtigungen", "mitteilungen"];

export const PRUEF_ABSTAND_MS = 60_000;

type Abonnent = { themen: Set<Thema>; rueckruf: () => void };

const abonnenten = new Set<Abonnent>();
let letzterStand: Record<Thema, string> | null = null;
let laeuftGerade = false;
let letzteAbfrage = 0;
/**
 * Beim Zurückholen aus dem Hintergrund feuern Fokus, Sichtbarkeit und
 * pageshow oft fast gleichzeitig. Eine Frage genügt.
 */
const MINDESTABSTAND_MS = 5_000;

/** Nach dem Abmelden: der nächste Benutzer fängt ohne alten Stand an. */
export function vergissAenderungsstand() {
  letzterStand = null;
  letzteAbfrage = 0;
}

/**
 * Einmal nachfragen. Wird vom Taktgeber aufgerufen; kann auch direkt
 * angestoßen werden. Mehrfache gleichzeitige Aufrufe werden
 * zusammengefasst.
 */
export async function pruefeAenderungen(): Promise<void> {
  if (!isSupabaseConfigured || laeuftGerade) return;
  if (Date.now() - letzteAbfrage < MINDESTABSTAND_MS) return;
  letzteAbfrage = Date.now();
  laeuftGerade = true;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("aenderungsstand");
    // Fehler still übergehen: dann bleibt die Anzeige, wie sie ist, und der
    // nächste Takt versucht es wieder. Eine Störung soll hier nichts
    // auslösen – schon gar nicht ein Neuladen aller Bereiche.
    if (error) return;
    const zeile = ((data ?? []) as Record<Thema, string>[])[0];
    if (!zeile) return;

    const vorher = letzterStand;
    letzterStand = zeile;
    // Beim allerersten Mal gibt es nichts zu vergleichen – die Seiten haben
    // gerade eben selbst geladen.
    if (!vorher) return;

    const geaendert = new Set(THEMEN.filter((t) => vorher[t] !== zeile[t]));
    if (geaendert.size === 0) return;

    for (const abonnent of abonnenten) {
      for (const thema of abonnent.themen) {
        if (geaendert.has(thema)) {
          abonnent.rueckruf();
          break;
        }
      }
    }
  } catch {
    // wie oben: beim nächsten Takt wieder
  } finally {
    laeuftGerade = false;
  }
}

/**
 * Einen Bereich für Themen anmelden: `rueckruf` läuft, sobald sich eines
 * davon geändert hat. Der Rückruf darf wechseln (neue Abhängigkeiten), ohne
 * dass neu angemeldet wird.
 */
export function useAktualisierung(themen: Thema[], rueckruf: () => void) {
  const aktuell = useRef(rueckruf);
  useEffect(() => {
    aktuell.current = rueckruf;
  });
  const schluessel = themen.join(",");
  useEffect(() => {
    const abonnent: Abonnent = {
      themen: new Set(schluessel.split(",") as Thema[]),
      rueckruf: () => aktuell.current(),
    };
    abonnenten.add(abonnent);
    return () => {
      abonnenten.delete(abonnent);
    };
  }, [schluessel]);
}
