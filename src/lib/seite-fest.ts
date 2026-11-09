/**
 * Die Seite festhalten (nicht scrollen) – für Blätter und Vollbild-Kalender.
 *
 * Gezählt statt „vorherigen Wert merken“: Beim Wechsel Betrieb ↔ Privat gehen
 * Kalender und offenes Blatt gleichzeitig zu, in beliebiger Reihenfolge. Mit
 * gemerkten Werten konnte dabei „fest“ zurückbleiben und die nächste Seite
 * ließ sich nicht mehr scrollen. Mit dem Zähler gilt: niemand hält mehr fest →
 * die Seite scrollt wieder.
 */
let halter = 0;

function anwenden() {
  const wert = halter > 0 ? "hidden" : "";
  document.documentElement.style.overflow = wert;
  document.body.style.overflow = wert;
  // Auf dem Handy scrollt nur der Inhaltsbereich (app-scroller.ts) – ihn mit
  // festhalten. `hidden` behält die Scrollposition. Am Computer scrollt er
  // nicht (overflow: visible) und bleibt unberührt.
  document.querySelectorAll<HTMLElement>("[data-app-scroller]").forEach((el) => {
    if (halter > 0) {
      const y = getComputedStyle(el).overflowY;
      if (y === "auto" || y === "scroll") {
        el.style.overflowY = "hidden";
        el.dataset.festgehalten = "1";
      }
    } else if (el.dataset.festgehalten) {
      el.style.overflowY = "";
      delete el.dataset.festgehalten;
    }
  });
}

/** Festhalten; die Rückgabe lässt wieder los (genau einmal). */
export function halteSeiteFest(): () => void {
  halter += 1;
  anwenden();
  let los = false;
  return () => {
    if (los) return;
    los = true;
    halter = Math.max(0, halter - 1);
    anwenden();
  };
}
