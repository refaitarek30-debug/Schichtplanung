/**
 * Gleiche Abfragen, die zur selben Zeit starten, nur einmal stellen.
 *
 * Auf der Startseite holen sich mehrere Kacheln dieselben Daten (Mitteilungen,
 * Schichten, „wen darf ich entscheiden“, nächster Urlaub) – beim Öffnen alle
 * im selben Augenblick. Wer innerhalb von 250 ms nach dem Start derselben
 * Abfrage fragt, bekommt dieselbe Antwort. Wer später fragt (etwa nach einer
 * Änderung), fragt frisch – auch wenn die alte Abfrage noch läuft. Danach wird
 * nichts aufgehoben.
 */
const GLEICHZEITIG_MS = 250;
const laufend = new Map<string, { seit: number; antwort: Promise<unknown> }>();

export function gemeinsam<T>(schluessel: string, holen: () => Promise<T>): Promise<T> {
  const da = laufend.get(schluessel);
  if (da && Date.now() - da.seit < GLEICHZEITIG_MS) return da.antwort as Promise<T>;
  const eintrag = { seit: Date.now(), antwort: holen() as Promise<unknown> };
  laufend.set(schluessel, eintrag);
  void eintrag.antwort
    .catch(() => undefined)
    .finally(() => {
      if (laufend.get(schluessel) === eintrag) laufend.delete(schluessel);
    });
  return eintrag.antwort as Promise<T>;
}
