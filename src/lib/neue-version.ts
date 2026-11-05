/**
 * Veraltete Seite nach einer neuen Version.
 *
 * Der eigene Kalender öffnet aus dem Gerätespeicher (public/sw.js) und frischt
 * sich nebenher auf. Wurde dazwischen eine neue Version der App veröffentlicht,
 * kann die gemerkte Seite Dateien nachladen wollen, die es nicht mehr gibt.
 * Dann hilft ein einmaliges Neuladen – die Auffrischung im Hintergrund hat die
 * Seite dann längst erneuert.
 */

/** Wortlaute der Browser, wenn eine nachzuladende Programmdatei fehlt. */
const FEHLENDE_DATEI =
  /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function istFehlendeDatei(nachricht: string): boolean {
  return FEHLENDE_DATEI.test(nachricht);
}

const ZEIT = "sn-neue-version-zeit";
const FRIST_MS = 60_000;

/** Höchstens einmal je Minute neu laden – sonst gäbe es bei einem echten Fehler eine Schleife. */
export function darfWegenNeuerVersionNeuLaden(): boolean {
  try {
    const zuletzt = Number(window.sessionStorage.getItem(ZEIT));
    if (Number.isFinite(zuletzt) && zuletzt > 0 && Date.now() - zuletzt < FRIST_MS) return false;
    window.sessionStorage.setItem(ZEIT, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
