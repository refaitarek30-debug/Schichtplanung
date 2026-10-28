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
