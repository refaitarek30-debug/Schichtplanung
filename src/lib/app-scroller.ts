/**
 * Wer scrollt? Auf dem Handy nicht mehr die ganze Seite, sondern nur der
 * Inhaltsbereich (`data-app-scroller`). Grund: Seit iOS 26 verschiebt Safari
 * feste Leisten, sobald sich beim Scrollen der SEITE die Richtung ändert
 * (WebKit-Fehler 297779) – die untere Leiste stand dann mitten im Bild.
 * Scrollt die Seite selbst nie, gibt es nichts, was Safari verschieben kann.
 *
 * Am Computer scrollt weiter die Seite. Diese Helfer nehmen jeweils das, was
 * gerade wirklich scrollt.
 */

/** Der Inhaltsbereich, wenn er gerade der Scroller ist – sonst null (dann scrollt die Seite). */
export function appScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>("[data-app-scroller]");
  if (!el) return null;
  const y = getComputedStyle(el).overflowY;
  return y === "auto" || y === "scroll" || y === "hidden" ? el : null;
}

/** Um `top` Pixel weiter scrollen (negativ = nach oben). */
export function scrolleUm(top: number, behavior: ScrollBehavior = "auto") {
  const el = appScroller();
  if (el) el.scrollBy({ top, behavior });
  else window.scrollBy({ top, behavior });
}

/** Ganz nach oben. */
export function nachOben(behavior: ScrollBehavior = "smooth") {
  const el = appScroller();
  if (el) el.scrollTo({ top: 0, behavior });
  else window.scrollTo({ top: 0, behavior });
}
