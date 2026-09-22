"use client";

/**
 * Zuletzt angesehener Zeitraum, über einen Bereichswechsel hinweg.
 *
 * Wer im Schichtplan auf März 2027 steht, kurz in den Urlaubsbereich geht
 * und zurückkommt, soll wieder im März 2027 landen – nicht beim heutigen
 * Tag. Ohne das ist jedes Nachschlagen in einem anderen Bereich ein
 * Verlust der Position.
 *
 * `sessionStorage` und nicht `localStorage`: die Position gehört zur
 * laufenden Sitzung. Am nächsten Tag beim frischen Öffnen ist "heute"
 * wieder richtig, und ein Monat aus der letzten Woche wäre verwirrend.
 *
 * Fehlerfest: im privaten Modus oder bei gesperrtem Speicher wirft der
 * Zugriff. Dann gilt schlicht die Vorgabe – die Ansicht funktioniert, sie
 * merkt sich nur nichts.
 */
export function merkeAnsicht(schluessel: string, wert: string): void {
  try {
    window.sessionStorage.setItem(`schichtplan:${schluessel}`, wert);
  } catch {
    // Kein Speicher, kein Merken. Das ist kein Fehler, der jemanden stört.
  }
}

/**
 * Gemerkten Wert lesen. `pruefe` entscheidet, ob er noch brauchbar ist –
 * ein alter oder unsinniger Wert darf die Ansicht nicht kaputt machen.
 */
export function gemerkteAnsicht(
  schluessel: string,
  pruefe: (wert: string) => boolean,
): string | null {
  try {
    const wert = window.sessionStorage.getItem(`schichtplan:${schluessel}`);
    return wert && pruefe(wert) ? wert : null;
  } catch {
    return null;
  }
}

/** Sieht der Wert aus wie ein Datum "JJJJ-MM-TT" und ist er plausibel? */
export function istPlausiblesDatum(wert: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const jahr = Number(wert.slice(0, 4));
  return jahr >= 2000 && jahr <= 2100;
}
