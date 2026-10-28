/**
 * Ein Konto, zwei Bereiche (Migration 0194): Betrieb und Privat.
 *
 * Wechsel ohne Ruckeln: Der Bildschirm bleibt stehen, während der andere
 * Bereich im Hintergrund vollständig lädt (samt Kalender). Erst wenn er
 * fertig ist, dreht sich die Seite einmal und der neue Bereich ist da.
 * Technik: View Transitions des Browsers – wo es sie nicht gibt, wird ohne
 * Drehung gewechselt.
 */

export type Bereich = "betrieb" | "privat";

export const BEREICH_ZIEL: Record<Bereich, string> = {
  betrieb: "/meine-schichten",
  privat: "/privat",
};

const BEREIT = "bereich-bereit";
/** Länger wartet niemand – dann wird auch ohne „fertig“ gewechselt. */
const HOECHSTENS_MS = 3500;

/** Läuft die Seite gerade im Betrieb (alles außerhalb von /privat)? */
export function imBetrieb(): boolean {
  return typeof window !== "undefined" && !window.location.pathname.startsWith("/privat");
}

function ruhig(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type MitUebergang = Document & {
  startViewTransition?: (aenderung: () => Promise<void>) => { finished: Promise<void> };
};

/** In den anderen Bereich wechseln – erst laden, dann drehen. */
export function wechsleBereich(ziel: Bereich, router: { push: (pfad: string) => void }) {
  const pfad = BEREICH_ZIEL[ziel];
  const doc = document as MitUebergang;
  if (ruhig() || typeof doc.startViewTransition !== "function") {
    router.push(pfad);
    return;
  }
  const html = document.documentElement;
  html.classList.add("bereich-wechsel");
  const uebergang = doc.startViewTransition(
    () =>
      new Promise<void>((fertig) => {
        let erledigt = false;
        const los = () => {
          if (erledigt) return;
          erledigt = true;
          window.removeEventListener(BEREIT, los);
          // Einen Moment für das Zeichnen der neuen Seite.
          window.setTimeout(fertig, 60);
        };
        window.addEventListener(BEREIT, los);
        window.setTimeout(los, HOECHSTENS_MS);
        router.push(pfad);
      }),
  );
  void uebergang.finished.finally(() => html.classList.remove("bereich-wechsel"));
}

/** Vom Kalender des Zielbereichs: „ich bin fertig geladen“. */
export function meldeBereichBereit() {
  window.dispatchEvent(new Event(BEREIT));
}
