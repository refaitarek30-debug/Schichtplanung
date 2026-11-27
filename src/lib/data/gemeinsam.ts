/**
 * Gleiche Abfragen, die zur selben Zeit laufen, nur einmal stellen.
 *
 * Auf der Startseite holen sich mehrere Kacheln dieselben Daten (Mitteilungen,
 * Schichten, „wen darf ich entscheiden“, nächster Urlaub) – beim Öffnen alle
 * auf einmal. Solange eine Abfrage noch läuft, bekommt jeder weitere Aufruf
 * dieselbe Antwort. Danach wird nichts aufgehoben: der nächste Aufruf fragt
 * wieder frisch – so kann nach einer Änderung nie etwas Veraltetes kommen.
 */
const laufend = new Map<string, Promise<unknown>>();

export function gemeinsam<T>(schluessel: string, holen: () => Promise<T>): Promise<T> {
  const da = laufend.get(schluessel);
  if (da) return da as Promise<T>;
  const neu = holen().finally(() => laufend.delete(schluessel));
  laufend.set(schluessel, neu);
  return neu;
}
