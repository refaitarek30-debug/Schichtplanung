/**
 * Farben und Reihenfolge der Schichten außerhalb der Plantabelle – in den
 * Auswahlknöpfen dieselben Farben wie die Kürzel im Plan. Tagschicht und
 * Frei bleiben ohne Farbe.
 */
const FARBE: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
};

const REIHENFOLGE = ["F", "S", "N", "T"];

export function schichtFarbe(kuerzel: string | null | undefined): string | null {
  return kuerzel ? (FARBE[kuerzel] ?? null) : null;
}

/** Früh, Spät, Nacht, Tag – danach alles Weitere in der gelieferten Reihenfolge. */
export function nachSchichtfolge<T extends { shortName: string }>(liste: T[]): T[] {
  const rang = (s: T) => {
    const i = REIHENFOLGE.indexOf(s.shortName);
    return i === -1 ? REIHENFOLGE.length : i;
  };
  return [...liste].sort((a, b) => rang(a) - rang(b));
}
