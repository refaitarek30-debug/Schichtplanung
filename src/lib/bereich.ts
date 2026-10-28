/**
 * Ein Konto, zwei Bereiche (Migration 0194): Betrieb und Privat.
 *
 * Gewechselt wird mit einer kurzen Drehung – die Seite dreht sich weg, der
 * andere Bereich dreht sich herein. Die zweite Hälfte spielt die Zielseite
 * ab (`BereichDrehung`), der Merker dafür liegt im sessionStorage.
 */

export type Bereich = "betrieb" | "privat";

export const BEREICH_ZIEL: Record<Bereich, string> = {
  betrieb: "/meine-schichten",
  privat: "/privat",
};

const MERKER = "sp_bereich_drehung";
const DAUER_RAUS_MS = 300;

/** Läuft die Seite gerade im Betrieb (alles außerhalb von /privat)? */
export function imBetrieb(): boolean {
  return typeof window !== "undefined" && !window.location.pathname.startsWith("/privat");
}

function ruhig(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** In den anderen Bereich wechseln – mit Drehung, ohne bei „weniger Bewegung“. */
export function wechsleBereich(ziel: Bereich) {
  const pfad = BEREICH_ZIEL[ziel];
  if (ruhig()) {
    window.location.assign(pfad);
    return;
  }
  try {
    window.sessionStorage.setItem(MERKER, "1");
  } catch {
    // ohne Speicher: nur die erste Hälfte der Drehung
  }
  document.documentElement.classList.add("bereich-raus");
  window.setTimeout(() => window.location.assign(pfad), DAUER_RAUS_MS);
  // Zurück-Taste (bfcache): die Seite nicht verdreht stehen lassen.
  window.addEventListener("pageshow", () => document.documentElement.classList.remove("bereich-raus"), { once: true });
}

/** Zweite Hälfte der Drehung auf der Zielseite; true, wenn sie läuft. */
export function dreheHerein(): boolean {
  let gemerkt = false;
  try {
    gemerkt = window.sessionStorage.getItem(MERKER) === "1";
    window.sessionStorage.removeItem(MERKER);
  } catch {
    return false;
  }
  if (!gemerkt || ruhig()) return false;
  const html = document.documentElement;
  html.classList.add("bereich-rein");
  window.setTimeout(() => html.classList.remove("bereich-rein"), 450);
  return true;
}
