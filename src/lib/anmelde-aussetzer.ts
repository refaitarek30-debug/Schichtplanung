/**
 * Kurzer Aussetzer direkt nach der Anmeldung.
 *
 * Antwortet der Server auf eine Aktion mit etwas Unlesbarem (Fehlerseite der
 * Plattform, Zeitüberschreitung, Netzaussetzer), wirft Next.js genau diese
 * Meldung. Nach der Anmeldung heilt ein einmaliges Neuladen das fast immer.
 *
 * Wiederholt wird nie eine Aktion, sondern nur das Laden der Seite: eine
 * zweite Anmeldung oder eine doppelt ausgeführte Änderung wäre schlimmer als
 * der Fehler. Alles hier läuft im Browser und merkt sich nur im
 * Sitzungsspeicher dieses Tabs, wann die Anmeldung war.
 */

/** Wortlaut von Next.js, wenn die Antwort des Servers nicht lesbar ist. */
export const KEINE_ANTWORT = "An unexpected response was received from the server.";

/** So lange nach der Anmeldung zählt ein solcher Fehler als Anlaufschwierigkeit. */
const FRIST_MS = 60_000;

const ZEIT = "sn-anmeldung-zeit";
const NEU_GELADEN = "sn-anmeldung-neu-geladen";
const HINWEIS = "sn-anmeldung-hinweis";

function lies(schluessel: string): string | null {
  try {
    return window.sessionStorage.getItem(schluessel);
  } catch {
    return null;
  }
}

function schreibe(schluessel: string, wert: string | null) {
  try {
    if (wert === null) window.sessionStorage.removeItem(schluessel);
    else window.sessionStorage.setItem(schluessel, wert);
  } catch {
    // ohne Speicher gibt es keine Wiederholung – der Fehler bleibt sichtbar
  }
}

export function istKeineAntwort(fehler: unknown): boolean {
  const text = fehler instanceof Error ? fehler.message : String(fehler ?? "");
  return text.includes(KEINE_ANTWORT);
}

/** Beim Abschicken der Anmeldung aufrufen. */
export function merkeAnmeldung() {
  schreibe(ZEIT, String(Date.now()));
  schreibe(NEU_GELADEN, null);
}

/**
 * Darf die Seite jetzt automatisch neu geladen werden? Nur kurz nach der
 * Anmeldung und nur einmal je Anmeldung – sonst käme eine Schleife.
 */
export function darfNachAnmeldungNeuLaden(): boolean {
  const zeit = Number(lies(ZEIT));
  if (!Number.isFinite(zeit) || zeit <= 0 || Date.now() - zeit > FRIST_MS) return false;
  if (lies(NEU_GELADEN) === String(zeit)) return false;
  schreibe(NEU_GELADEN, String(zeit));
  return true;
}

/** Die Anmeldung selbst bekam keine lesbare Antwort; die Zielseite wird direkt geladen. */
export function merkeUnlesbareAnmeldung() {
  schreibe(HINWEIS, "1");
}

/** Auf der nächsten Seite einmal abholen: gab es zuvor so einen Aussetzer? */
export function holeUnlesbareAnmeldung(): boolean {
  const da = lies(HINWEIS) === "1";
  if (da) schreibe(HINWEIS, null);
  return da;
}
