/**
 * Monatsansicht aus einem Screenshot lesen – Auswertung der Texterkennung.
 *
 * Die Texterkennung liefert Wörter mit Position. Daraus wird der Monatsraster
 * rekonstruiert: Die Tageszahlen 1, 2, 3 … liegen in Zeilen zu je sieben
 * Spalten; jedes andere Wort gehört zu dem Tag, in dessen Zelle es liegt. Alles
 * rein rechnerisch, nichts hier greift auf Netz oder Bild zu.
 */
import type { Gruppe } from "./ics-lesen";

export interface Wort {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 0–100 */
  konfidenz: number;
}

export interface Raster {
  gruppen: Gruppe[];
  /** Tage des Monats, die im Raster gefunden wurden (mit oder ohne Eintrag) */
  tageGefunden: number;
  /** Tage mit mindestens einem Eintrag */
  tageMitEintrag: number;
  /** Hinweis für die Person, wenn etwas nicht passt */
  warnung: string | null;
}

const MONATE: [RegExp, number][] = [
  [/^jan(uar|\.)?$/i, 1],
  [/^feb(ruar|\.)?$/i, 2],
  [/^m(ä|ae|a)r(z)?\.?$/i, 3],
  [/^apr(il|\.)?$/i, 4],
  [/^mai$/i, 5],
  [/^jun(i|\.)?$/i, 6],
  [/^jul(i|\.)?$/i, 7],
  [/^aug(ust|\.)?$/i, 8],
  [/^sep(t)?(ember|\.)?$/i, 9],
  [/^okt(ober|\.)?$/i, 10],
  [/^nov(ember|\.)?$/i, 11],
  [/^dez(ember|\.)?$/i, 12],
];

/** Monat und Jahr aus der Kopfzeile („Oktober 2026“), sonst null. */
export function findeMonat(woerter: Wort[]): { jahr: number; monat: number } | null {
  const sortiert = [...woerter].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  for (let i = 0; i < sortiert.length; i++) {
    const t = sortiert[i]!.text.replace(/[,.:;]+$/, "");
    const treffer = MONATE.find(([re]) => re.test(t));
    if (!treffer) continue;
    // Jahr: nächstes Wort (oder das davor) mit vier Ziffern 20xx, in der Nähe.
    for (const nachbar of [sortiert[i + 1], sortiert[i - 1], sortiert[i + 2]]) {
      const j = nachbar && /^(20\d\d)$/.exec(nachbar.text.replace(/[,.]+$/, ""));
      if (j) return { jahr: Number(j[1]), monat: treffer[1] };
    }
  }
  // „10/2026“ oder „10.2026“
  for (const w of sortiert) {
    const m = /^(0?[1-9]|1[0-2])[./](20\d\d)$/.exec(w.text);
    if (m) return { jahr: Number(m[2]), monat: Number(m[1]) };
  }
  return null;
}

const median = (zahlen: number[]) => {
  const s = [...zahlen].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

const tageImMonat = (jahr: number, monat: number) => new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
/** Wochentag des Ersten, Montag = 0. */
const ersterWochentag = (jahr: number, monat: number) => (new Date(Date.UTC(jahr, monat - 1, 1)).getUTCDay() + 6) % 7;
const iso = (jahr: number, monat: number, tag: number) =>
  `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;

interface Zahl {
  wert: number;
  cx: number;
  cy: number;
  x0: number;
  y0: number;
  h: number;
}

/** Längste Folge in Lese-Reihenfolge, deren Zahlen immer größer werden. */
function laengsteFolge(zahlen: Zahl[]): Zahl[] {
  const laenge = zahlen.map(() => 1);
  const davor = zahlen.map(() => -1);
  for (let i = 0; i < zahlen.length; i++) {
    for (let j = 0; j < i; j++) {
      if (zahlen[j]!.wert < zahlen[i]!.wert && laenge[j]! + 1 > laenge[i]!) {
        laenge[i] = laenge[j]! + 1;
        davor[i] = j;
      }
    }
  }
  let best = 0;
  for (let i = 1; i < zahlen.length; i++) if (laenge[i]! > laenge[best]!) best = i;
  const folge: Zahl[] = [];
  for (let i = zahlen.length ? best : -1; i !== -1; i = davor[i]!) folge.unshift(zahlen[i]!);
  return folge;
}

/**
 * Raster lesen. `jahr`/`monat` kommen aus der Kopfzeile oder von der Person –
 * sie bestimmen, wie viele Tage der Monat hat und worauf der Erste fällt.
 */
export function leseMonatsraster(woerter: Wort[], jahr: number, monat: number): Raster {
  const leer = (warnung: string): Raster => ({ gruppen: [], tageGefunden: 0, tageMitEintrag: 0, warnung });
  const anzahl = tageImMonat(jahr, monat);

  const sauber = woerter.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0);
  const kandidaten: Zahl[] = sauber
    .filter((w) => /^\d{1,2}$/.test(w.text.trim()) && Number(w.text) >= 1 && Number(w.text) <= anzahl)
    .map((w) => ({
      wert: Number(w.text),
      cx: (w.x0 + w.x1) / 2,
      cy: (w.y0 + w.y1) / 2,
      x0: w.x0,
      y0: w.y0,
      h: w.y1 - w.y0,
    }));
  if (kandidaten.length < 10) return leer("Auf dem Screenshot sind keine Tageszahlen eines Monatsplans zu erkennen.");

  // Zeilen: gleiche Höhe der Zahlen = gleiche Wochenzeile.
  const h = median(kandidaten.map((k) => k.h));
  const nachY = [...kandidaten].sort((a, b) => a.cy - b.cy);
  const zeilen: Zahl[][] = [];
  for (const k of nachY) {
    const letzte = zeilen[zeilen.length - 1];
    if (letzte && Math.abs(k.cy - median(letzte.map((z) => z.cy))) <= h * 0.9) letzte.push(k);
    else zeilen.push([k]);
  }
  const reihenfolge = zeilen.flatMap((z) => z.sort((a, b) => a.cx - b.cx));
  const folge = laengsteFolge(reihenfolge);
  if (folge.length < 10) return leer("Der Monatsraster ist auf dem Screenshot nicht sicher zu erkennen.");

  // Spaltenbreite aus den äußeren Zahlen, dann Spalte und Zeile je Zahl.
  const xs = folge.map((k) => k.cx);
  const spaltenBreite = (Math.max(...xs) - Math.min(...xs)) / 6;
  if (!(spaltenBreite > h)) return leer("Der Monatsraster ist auf dem Screenshot nicht sicher zu erkennen.");
  const links = Math.min(...xs);
  const spalte = (k: Zahl) => Math.max(0, Math.min(6, Math.round((k.cx - links) / spaltenBreite)));
  const zeilenMitte = zeilen.map((z) => median(z.map((k) => k.cy)));
  const zeileVon = (k: Zahl) => {
    let best = 0;
    for (let i = 1; i < zeilenMitte.length; i++) if (Math.abs(zeilenMitte[i]! - k.cy) < Math.abs(zeilenMitte[best]! - k.cy)) best = i;
    return best;
  };

  // Wo steht der Erste? Abstimmung über alle Zahlen: Spalte − (Tag−1) mod 7.
  // Zeilenindex relativ zur obersten Zeile der Folge.
  const ersteZeile = Math.min(...folge.map(zeileVon));
  const stimmen = new Map<number, number>();
  for (const k of folge) {
    const versatz = ((((spalte(k) + 7 * (zeileVon(k) - ersteZeile)) - (k.wert - 1)) % 7) + 7) % 7;
    stimmen.set(versatz, (stimmen.get(versatz) ?? 0) + 1);
  }
  const [versatz] = [...stimmen.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const passend = folge.filter((k) => {
    const z = zeileVon(k) - ersteZeile;
    return spalte(k) + 7 * z === versatz + (k.wert - 1) && versatz + (k.wert - 1) >= 0;
  });
  if (passend.length < 10) return leer("Der Monatsraster ist auf dem Screenshot nicht sicher zu erkennen.");

  let warnung: string | null = null;
  const erwartet = ersterWochentag(jahr, monat);
  if (versatz !== erwartet && versatz !== (erwartet + 1) % 7) {
    warnung = "Die Wochentage passen nicht zum gewählten Monat – bitte Monat und Jahr prüfen.";
  }

  // Zellen: Spaltenmitte und Zeilenhöhe aus den erkannten Zahlen.
  // Steht die Zahl mittig in der Zelle oder links? Die stabilere Kante verrät es.
  const abweichung = (wert: (k: Zahl) => number) =>
    median(passend.map((k) => Math.abs(wert(k) - median(passend.filter((q) => spalte(q) === spalte(k)).map(wert)))));
  const ausgerichtet = abweichung((k) => k.x0) < abweichung((k) => k.cx) / 2 ? "links" : "mitte";
  const spaltenAnker = Array.from({ length: 7 }, (_, c) => {
    const von = passend.filter((k) => spalte(k) === c);
    return von.length ? median(von.map((k) => (ausgerichtet === "links" ? k.x0 : k.cx))) : null;
  });
  const anker = (c: number) => spaltenAnker[c] ?? links + c * spaltenBreite + (ausgerichtet === "links" ? -h : 0);
  const zeilenAbstand = zeilenMitte.length > 1 ? median(zeilenMitte.slice(1).map((y, i) => y - zeilenMitte[i]!)) : h * 6;
  const zellenOben = (zeile: number) => (zeilenMitte[zeile] ?? zeilenMitte[0]! + zeile * zeilenAbstand) - h * 0.7;

  const zelleVon = (cx: number, cy: number): number | null => {
    // Spalte: nächster Anker (bei „links“ gehört alles bis zur nächsten Spalte dazu).
    const von = (c: number) => (ausgerichtet === "links" ? anker(c) - spaltenBreite * 0.1 : anker(c) - spaltenBreite / 2);
    let c = -1;
    for (let i = 0; i < 7; i++) if (cx >= von(i)) c = i;
    if (c < 0 || cx > von(6) + spaltenBreite) return null;
    let z = -1;
    const zeilenZahl = Math.ceil((versatz + anzahl) / 7);
    for (let i = 0; i < zeilenZahl; i++) if (cy >= zellenOben(i + ersteZeile)) z = i;
    if (z < 0) return null;
    if (cy > zellenOben(z + ersteZeile) + zeilenAbstand) return null;
    const tag = z * 7 + c - versatz + 1;
    return tag >= 1 && tag <= anzahl ? tag : null;
  };

  // Wörter den Tagen zuordnen. Die Tageszahlen selbst und reine Zahlen/Zeiten zählen nicht.
  const zahlWort = new Set(passend.map((k) => `${Math.round(k.cx)}|${Math.round(k.cy)}`));
  const proTag = new Map<number, Wort[]>();
  for (const w of sauber) {
    const t = w.text.trim();
    const cx = (w.x0 + w.x1) / 2;
    const cy = (w.y0 + w.y1) / 2;
    if (zahlWort.has(`${Math.round(cx)}|${Math.round(cy)}`)) continue;
    if (!/\p{L}/u.test(t)) continue; // nur Wörter mit Buchstaben (Kürzel, Namen)
    if (w.konfidenz < 35) continue;
    // Eine Tageszahl liegt oben in der Zelle; Text darunter gehört zu ihr.
    const tag = zelleVon(cx, cy);
    if (tag === null) continue;
    proTag.set(tag, [...(proTag.get(tag) ?? []), w]);
  }

  const gruppen = new Map<string, Set<string>>();
  let mitEintrag = 0;
  for (const [tag, ws] of proTag) {
    // Zeilen innerhalb der Zelle: Wörter auf gleicher Höhe ergeben einen Namen.
    const sortiert = [...ws].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const namen: Wort[][] = [];
    for (const w of sortiert) {
      const letzte = namen[namen.length - 1];
      if (letzte && Math.abs((w.y0 + w.y1) / 2 - (letzte[0]!.y0 + letzte[0]!.y1) / 2) <= h * 0.8) letzte.push(w);
      else namen.push([w]);
    }
    let hat = false;
    for (const n of namen) {
      const name = n
        .sort((a, b) => a.x0 - b.x0)
        .map((w) => w.text.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
        .filter(Boolean)
        .join(" ")
        .slice(0, 30);
      // Einzelne kleine Buchstaben sind fast immer Erkennungsrauschen (echte Kürzel stehen groß).
      if (!name || (Array.from(name).length === 1 && name === name.toLowerCase())) continue;
      hat = true;
      const s = gruppen.get(name) ?? new Set<string>();
      s.add(iso(jahr, monat, tag));
      gruppen.set(name, s);
    }
    if (hat) mitEintrag += 1;
  }

  const liste: Gruppe[] = [...gruppen.entries()]
    .map(([name, tage]) => ({ name, tage: [...tage].sort(), beginn: "", ende: "", ganztaegig: true }))
    .sort((a, b) => b.tage.length - a.tage.length || a.name.localeCompare(b.name, "de"));
  if (!liste.length && !warnung) warnung = "Im Raster ist kein Text zu erkennen – nur Tageszahlen.";
  return { gruppen: liste, tageGefunden: passend.length, tageMitEintrag: mitEintrag, warnung };
}

/** Gruppen mehrerer Quellen zusammenführen (gleicher Name = gleiche Schicht). */
export function vereineGruppen(...quellen: Gruppe[][]): Gruppe[] {
  const alle = new Map<string, Gruppe>();
  for (const q of quellen) {
    for (const g of q) {
      const da = alle.get(g.name);
      if (!da) alle.set(g.name, { ...g, tage: [...g.tage] });
      else {
        da.tage = [...new Set([...da.tage, ...g.tage])].sort();
        if (!da.beginn && g.beginn) {
          da.beginn = g.beginn;
          da.ende = g.ende;
          da.ganztaegig = g.ganztaegig;
        }
      }
    }
  }
  return [...alle.values()].sort((a, b) => b.tage.length - a.tage.length || a.name.localeCompare(b.name, "de"));
}
