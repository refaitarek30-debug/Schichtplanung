/**
 * Kürzel aus dem Namen – für eigene Einträge (Firma) und Schichtarten
 * (privat). Zwei Wörter → Anfangsbuchstaben („Halber Tag“ → HT), ein Wort →
 * die ersten zwei Buchstaben („Nebenjob“ → NE), nur ein Emoji → das Emoji.
 * Ist das Kürzel schon vergeben, wird es eindeutig gemacht („Netflix“ neben
 * „Nebenjob“ → NT, sonst NE2 …).
 */
export function kuerzelAus(name: string, vergeben: string[] = []): string {
  const woerter = name
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  const erstes = (w: string) => Array.from(w)[0] ?? "";
  let grund: string;
  if (woerter.length >= 2) grund = (erstes(woerter[0]!) + erstes(woerter[1]!)).toUpperCase();
  else if (woerter.length === 1) grund = Array.from(woerter[0]!).slice(0, 2).join("").toUpperCase();
  else return Array.from(name.trim()).slice(0, 1).join("");

  const belegt = new Set(vergeben.map((k) => k.trim().toUpperCase()));
  if (!belegt.has(grund)) return grund;
  // Erster Buchstabe mit einem späteren Buchstaben des Namens.
  const buchstaben = Array.from(woerter.join("").toUpperCase());
  for (const b of buchstaben.slice(1)) {
    const k = buchstaben[0]! + b;
    if (!belegt.has(k)) return k;
  }
  for (let n = 2; n <= 9; n++) if (!belegt.has(`${grund}${n}`)) return `${grund}${n}`;
  return grund;
}
