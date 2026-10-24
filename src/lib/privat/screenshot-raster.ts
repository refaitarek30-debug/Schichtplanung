/**
 * Monatsansicht aus einem Screenshot lesen – Auswertung der Texterkennung.
 *
 * Reihenfolge wie beim Hinschauen:
 *   1. Raster: Die Tageszahlen 1, 2, 3 … liegen in Zeilen zu je sieben
 *      Spalten. Daraus folgen Spalten, Zeilen und wo der Erste steht – auch
 *      wenn die Texterkennung einzelne (gern einstellige) Zahlen verpasst.
 *   2. Monat und Jahr: aus der Überschrift („Oktober 2026“, „Okt. 26“,
 *      „October“, „10/2026“). Fehlt etwas, verrät der Wochentag des Ersten,
 *      welcher Monat in der Nähe von heute passt.
 *   3. Einträge: Jedes andere Wort gehört zu dem Tag, in dessen Zelle es
 *      liegt. Schichten (Kürzel, bekannte Namen, was sich oft wiederholt)
 *      werden von Terminen (mit Uhrzeit, einmalige längere Texte) getrennt.
 *
 * Alles rein rechnerisch, nichts hier greift auf Netz oder Bild zu.
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

/** Ein erkannter Termin aus einer Tageszelle. */
export interface ErkannterTermin {
  tag: string;
  titel: string;
  /** "HH:MM" oder leer (ganztägig) */
  beginn: string;
  ende: string;
}

export interface Raster {
  gruppen: Gruppe[];
  termine: ErkannterTermin[];
  /** Tage des Monats, die im Raster gefunden wurden (mit oder ohne Eintrag) */
  tageGefunden: number;
  /** Tage mit mindestens einem Eintrag */
  tageMitEintrag: number;
  /** Hinweis für die Person, wenn etwas nicht passt */
  warnung: string | null;
}

/** Lage des Monatsrasters auf dem Bild – unabhängig davon, welcher Monat es ist. */
export interface Gitter {
  /** Spalte (0–6), in der der Erste steht */
  versatz: number;
  /** Mitte der ersten Spalte (x) */
  links: number;
  spaltenBreite: number;
  /** Mitte der Tageszahlen je Monatszeile (0 = Zeile mit dem Ersten) */
  zeilenMitte: number[];
  zeilenAbstand: number;
  /** Höhe einer Tageszahl */
  h: number;
  ausgerichtet: "links" | "mitte";
  /** Höchste erkannte Tageszahl */
  letzterTag: number;
  /** Erkannte Tageszahlen, die ins Raster passen */
  gefunden: number;
  /** Position der Tageszahlen (gerundet), damit sie nicht als Eintrag zählen */
  zahlen: Set<string>;
  /** Kopfzeile mit Wochentagen beginnt mit Sonntag (null = keine erkannt) */
  sonntagZuerst: boolean | null;
  /** Oberkante des Rasters */
  oben: number;
}

/** Eine Tageszelle auf dem Bild. */
export interface Zelle {
  tag: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Monat {
  jahr: number;
  monat: number;
  /** woher: Überschrift ganz, Überschrift ohne Jahr, nur aus den Wochentagen */
  quelle: "kopf" | "kopf-ohne-jahr" | "raster";
}

// ---- Hilfen ---------------------------------------------------------------------------

const median = (zahlen: number[]) => {
  const s = [...zahlen].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

const tageImMonat = (jahr: number, monat: number) => new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
/** Wochentag des Ersten, Montag = 0. */
const ersterWochentag = (jahr: number, monat: number) => (new Date(Date.UTC(jahr, monat - 1, 1)).getUTCDay() + 6) % 7;
const iso = (jahr: number, monat: number, tag: number) =>
  `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
const mitteX = (w: Wort) => (w.x0 + w.x1) / 2;
const mitteY = (w: Wort) => (w.y0 + w.y1) / 2;

function abstand(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let vorher = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, vorher + (a[i - 1] === b[j - 1] ? 0 : 1));
      vorher = tmp;
    }
  }
  return d[b.length]!;
}

/** Typische Verwechslungen der Texterkennung in Wörtern aus Buchstaben. */
const buchstaben = (t: string) =>
  t
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/5/g, "s")
    .replace(/ae/g, "ä")
    .replace(/[^a-zäöüß]/g, "");

// ---- 2. Monat und Jahr aus der Überschrift ---------------------------------------------

const MONATSNAMEN: [string, number][] = [
  ["januar", 1], ["january", 1], ["jänner", 1],
  ["februar", 2], ["february", 2],
  ["märz", 3], ["march", 3], ["marz", 3],
  ["april", 4],
  ["mai", 5], ["may", 5],
  ["juni", 6], ["june", 6],
  ["juli", 7], ["july", 7],
  ["august", 8],
  ["september", 9],
  ["oktober", 10], ["october", 10],
  ["november", 11],
  ["dezember", 12], ["december", 12],
];
const KURZ: [string, number][] = [
  ["jan", 1], ["feb", 2], ["mär", 3], ["mar", 3], ["mrz", 3], ["apr", 4], ["jun", 6], ["jul", 7],
  ["aug", 8], ["sep", 9], ["sept", 9], ["okt", 10], ["oct", 10], ["nov", 11], ["dez", 12], ["dec", 12],
];

/** Monatsname (auch abgekürzt, englisch, leicht verlesen) -> 1–12, sonst null. */
export function monatAusWort(text: string): number | null {
  const roh = text.trim();
  const t = buchstaben(roh);
  if (t.length < 3) return null;
  for (const [name, m] of MONATSNAMEN) if (t === name) return m;
  // Abkürzung nur exakt (mit oder ohne Punkt): „Okt.“, „Dez“
  for (const [name, m] of KURZ) if (t === name) return m;
  // Verlesen: ein Zeichen daneben bei langen Namen („0ktober“, „Novernber“ zählt nicht)
  if (t.length >= 5) {
    for (const [name, m] of MONATSNAMEN) if (name.length >= 5 && abstand(t, name) <= 1) return m;
  }
  return null;
}

/**
 * Monat und Jahr aus der Überschrift. Gesucht wird oberhalb des Rasters
 * (`bis` = Oberkante), sonst im oberen Drittel. Jahr = null, wenn keins dabei steht.
 */
export function findeMonat(woerter: Wort[], bis?: number): { jahr: number | null; monat: number } | null {
  const grenze = bis ?? Math.max(...woerter.map((w) => w.y1), 0) / 3;
  const oben = woerter.filter((w) => w.y1 <= grenze + 2).sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const jahrAus = (t: string): number | null => {
    const v = t.replace(/^['’]/, "").replace(/[,.:;]+$/, "");
    if (/^20\d\d$/.test(v)) return Number(v);
    if (/^['’]\d\d$/.test(t.trim())) return 2000 + Number(v);
    return null;
  };
  // „10/2026“, „10.2026“, „2026-10“
  for (const w of oben) {
    const t = w.text.trim();
    const a = /^(0?[1-9]|1[0-2])[./-](20\d\d)$/.exec(t);
    if (a) return { jahr: Number(a[2]), monat: Number(a[1]) };
    const b = /^(20\d\d)-(0[1-9]|1[0-2])$/.exec(t);
    if (b) return { jahr: Number(b[1]), monat: Number(b[2]) };
  }
  for (let i = 0; i < oben.length; i++) {
    const w = oben[i]!;
    // „Oktober2026“ (ohne Leerzeichen gelesen)
    const klebt = /^([^\d\s]+?)\.?(20\d\d)$/.exec(w.text.trim());
    if (klebt) {
      const m = monatAusWort(klebt[1]!);
      if (m) return { jahr: Number(klebt[2]), monat: m };
    }
    const m = monatAusWort(w.text);
    if (!m) continue;
    // Jahr: auf gleicher Höhe rechts daneben, sonst irgendwo in der Überschrift
    const hoehe = w.y1 - w.y0;
    const nachbarn = oben
      .filter((x) => x !== w && Math.abs(mitteY(x) - mitteY(w)) < hoehe && x.x0 >= w.x0)
      .sort((a, b) => a.x0 - b.x0);
    for (const n of [...nachbarn, ...oben]) {
      const j = jahrAus(n.text);
      if (j) return { jahr: j, monat: m };
    }
    return { jahr: null, monat: m };
  }
  return null;
}

/**
 * Endgültiger Monat: Überschrift, wenn sie zum Raster passt; fehlt das Jahr,
 * das nächstgelegene Jahr, in dem der Erste auf den Wochentag im Raster
 * fällt; fehlt alles, der nächstgelegene passende Monat (bis 1 Jahr zurück,
 * 1½ Jahre voraus). `heute` = "YYYY-MM-DD".
 */
export function bestimmeMonat(woerter: Wort[], heute: string, gitter = leseGitter(woerter)): Monat | null {
  const kopf = findeMonat(woerter, gitter?.oben);
  const hj = Number(heute.slice(0, 4));
  const hm = Number(heute.slice(5, 7));
  const passt = (jahr: number, monat: number) => {
    if (!gitter) return true;
    const erster = ersterWochentag(jahr, monat);
    const ok = (v: number) =>
      gitter.sonntagZuerst === true ? v === (erster + 1) % 7 : gitter.sonntagZuerst === false ? v === erster : v === erster || v === (erster + 1) % 7;
    return ok(gitter.versatz) && tageImMonat(jahr, monat) >= gitter.letzterTag;
  };
  if (kopf?.jahr) return { jahr: kopf.jahr, monat: kopf.monat, quelle: "kopf" };
  if (kopf) {
    const jahre = [hj, hj + 1, hj - 1, hj + 2];
    const j = jahre.filter((x) => passt(x, kopf.monat)).sort((a, b) => Math.abs(a * 12 + kopf.monat - (hj * 12 + hm)) - Math.abs(b * 12 + kopf.monat - (hj * 12 + hm)))[0];
    return { jahr: j ?? hj, monat: kopf.monat, quelle: "kopf-ohne-jahr" };
  }
  if (!gitter) return null;
  const kandidaten: { jahr: number; monat: number; weg: number }[] = [];
  for (let d = -12; d <= 18; d++) {
    const n = hj * 12 + (hm - 1) + d;
    const jahr = Math.floor(n / 12);
    const monat = (n % 12) + 1;
    // Sichtbar sind meist alle Tage: Endet das Raster bei 30, ist es kein 31er-Monat.
    if (passt(jahr, monat) && (gitter.letzterTag < 28 || tageImMonat(jahr, monat) === gitter.letzterTag)) {
      kandidaten.push({ jahr, monat, weg: Math.abs(d) + (d < 0 ? 0.5 : 0) });
    }
  }
  const best = kandidaten.sort((a, b) => a.weg - b.weg)[0];
  return best ? { jahr: best.jahr, monat: best.monat, quelle: "raster" } : null;
}

// ---- 1. Raster ----------------------------------------------------------------------------

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
 * Wochennummern am Rand (KW 1–31 sehen aus wie Tageszahlen) aussortieren.
 * Zwei Merkmale: Sie passen nicht in die Spalten der Tage (anderer
 * waagerechter Abstand zum Raster), und ganz links in einer Zeile stimmt
 * ihr Wert nicht zum Abstand zur nächsten Zahl (Tage zählen je Spalte um 1).
 */
function ohneWochennummern(kandidaten: Zahl[]): Zahl[] {
  if (kandidaten.length < 12) return kandidaten;
  const h = median(kandidaten.map((k) => k.h));
  const nachY = [...kandidaten].sort((a, b) => a.cy - b.cy);
  const zeilen: Zahl[][] = [];
  for (const k of nachY) {
    const letzte = zeilen[zeilen.length - 1];
    if (letzte && Math.abs(k.cy - median(letzte.map((z) => z.cy))) <= h * 0.9) letzte.push(k);
    else zeilen.push([k]);
  }
  for (const z of zeilen) z.sort((a, b) => a.cx - b.cx);
  // Spaltenbreite: Nachbarn in einer Zeile, Wert-Unterschied 1–6.
  const schritte: number[] = [];
  for (const z of zeilen)
    for (let i = 1; i < z.length; i++) {
      const dv = z[i]!.wert - z[i - 1]!.wert;
      if (dv >= 1 && dv <= 6) schritte.push((z[i]!.cx - z[i - 1]!.cx) / dv);
    }
  if (schritte.length < 6) return kandidaten;
  const breite = median(schritte);
  if (!(breite > h)) return kandidaten;
  // Lage der Spalten: häufigster Rest von cx modulo Breite.
  const rest = (x: number) => ((x % breite) + breite) % breite;
  const kreis = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, breite - d);
  };
  let phase = 0;
  let beste = -1;
  for (const k of kandidaten) {
    const r = rest(k.cx);
    const n = kandidaten.filter((q) => kreis(rest(q.cx), r) <= breite * 0.08).length;
    if (n > beste) {
      beste = n;
      phase = r;
    }
  }
  const dazu = kandidaten.filter((q) => kreis(rest(q.cx), phase) <= breite * 0.12);
  phase = rest(median(dazu.map((q) => ((rest(q.cx) - phase + breite * 1.5) % breite) - breite / 2)) + phase);
  const passt = new Set(kandidaten.filter((k) => kreis(rest(k.cx), phase) <= breite * 0.14));
  // Ganz links in der Zeile: Wert muss zum Abstand zur nächsten Zahl passen.
  for (const z of zeilen) {
    const mit = z.filter((k) => passt.has(k));
    const a = mit[0];
    const b = mit[1];
    if (!a || !b) continue;
    const spalten = Math.round((b.cx - a.cx) / breite);
    if (spalten >= 1 && b.wert - a.wert !== spalten) passt.delete(a);
  }
  return passt.size >= 10 ? kandidaten.filter((k) => passt.has(k)) : kandidaten;
}

const WOCHENTAGE = /^(mo|di|mi|do|fr|sa|so|mon|tue|wed|thu|fri|sat|sun|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\.?$/i;

/** Lage des Monatsrasters, oder null, wenn keins sicher zu erkennen ist. */
export function leseGitter(woerter: Wort[]): Gitter | null {
  const sauber = woerter.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0);
  let kandidaten: Zahl[] = sauber
    .map((w) => ({ w, t: w.text.trim().replace(/\.$/, "") }))
    .filter(({ t }) => /^\d{1,2}$/.test(t) && Number(t) >= 1 && Number(t) <= 31)
    .map(({ w, t }) => ({ wert: Number(t), cx: mitteX(w), cy: mitteY(w), x0: w.x0, y0: w.y0, h: w.y1 - w.y0 }));
  if (kandidaten.length < 8) return null;
  kandidaten = ohneWochennummern(kandidaten);
  if (kandidaten.length < 8) return null;

  // Zeilen: gleiche Höhe = gleiche Wochenzeile.
  const h = median(kandidaten.map((k) => k.h));
  const nachY = [...kandidaten].sort((a, b) => a.cy - b.cy);
  const zeilen: Zahl[][] = [];
  for (const k of nachY) {
    const letzte = zeilen[zeilen.length - 1];
    if (letzte && Math.abs(k.cy - median(letzte.map((z) => z.cy))) <= h * 0.9) letzte.push(k);
    else zeilen.push([k]);
  }
  const folge = laengsteFolge(zeilen.flatMap((z) => [...z].sort((a, b) => a.cx - b.cx)));
  if (folge.length < 8) return null;

  // Spaltenbreite: Nachbarn in derselben Zeile (x-Abstand je Tag), sonst die äußeren Zahlen.
  const zeileIdx = (k: Zahl) => zeilen.findIndex((z) => z.includes(k));
  const schritte: number[] = [];
  for (let i = 1; i < folge.length; i++) {
    const a = folge[i - 1]!;
    const b = folge[i]!;
    if (zeileIdx(a) === zeileIdx(b) && b.wert > a.wert) schritte.push((b.cx - a.cx) / (b.wert - a.wert));
  }
  const xs = folge.map((k) => k.cx);
  const ausSpanne = (Math.max(...xs) - Math.min(...xs)) / 6;
  const ausSchritten = schritte.length >= 3 ? median(schritte) : ausSpanne;
  const spaltenBreite = Math.abs(ausSchritten - ausSpanne) / ausSpanne < 0.2 ? ausSpanne : ausSchritten;
  if (!(spaltenBreite > h)) return null;

  // Spalten 0–6: von der linkesten Zahl aus gezählt. Fehlt die erste Spalte
  // ganz, rücken die Spalten nach, wenn sonst die siebte über den Rand ginge.
  let links = Math.min(...xs);
  const spalteRoh = (k: Zahl) => Math.round((k.cx - links) / spaltenBreite);
  const maxSpalte = Math.max(...folge.map(spalteRoh));
  if (maxSpalte > 6) return null;
  const rechtsFrei = 6 - maxSpalte;
  if (rechtsFrei > 0) {
    // Stimmen: Werte in einer Zeile sind fortlaufend – passt der Versatz nur
    // mit verschobenen Spalten, liegt die erste Spalte links außerhalb.
    const stimmenFuer = (verschiebung: number) => {
      const zaehl = new Map<number, number>();
      for (const k of folge) {
        const v = ((((spalteRoh(k) + verschiebung) - (k.wert - 1)) % 7) + 7) % 7;
        zaehl.set(v, (zaehl.get(v) ?? 0) + 1);
      }
      return Math.max(...zaehl.values());
    };
    let best = 0;
    for (let v = 1; v <= rechtsFrei; v++) if (stimmenFuer(v) > stimmenFuer(best)) best = v;
    links -= best * spaltenBreite;
  }
  const spalte = (k: Zahl) => Math.max(0, Math.min(6, Math.round((k.cx - links) / spaltenBreite)));

  // Versatz (Spalte des Ersten): Abstimmung über alle Zahlen.
  const stimmen = new Map<number, number>();
  for (const k of folge) {
    const v = (((spalte(k) - (k.wert - 1)) % 7) + 7) % 7;
    stimmen.set(v, (stimmen.get(v) ?? 0) + 1);
  }
  const versatz = [...stimmen.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  // Welche Bildzeile ist welche Monatszeile? Auch abstimmen – fehlt die
  // erste Woche (einstellige Zahlen werden gern übersehen), verschiebt sich alles.
  const monatsZeile = (k: Zahl) => Math.floor((versatz + k.wert - 1) / 7);
  const zeilenVersatz = new Map<number, number>();
  for (const k of folge) {
    if (spalte(k) !== (versatz + k.wert - 1) % 7) continue;
    const d = monatsZeile(k) - zeileIdx(k);
    zeilenVersatz.set(d, (zeilenVersatz.get(d) ?? 0) + 1);
  }
  const zv = [...zeilenVersatz.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!zv) return null;
  const passend = folge.filter((k) => spalte(k) === (versatz + k.wert - 1) % 7 && monatsZeile(k) - zeileIdx(k) === zv[0]);
  if (passend.length < 8) return null;

  // Zeilenmitten je Monatszeile; fehlende aus dem Abstand ergänzen.
  const mitte = new Map<number, number[]>();
  for (const k of passend) mitte.set(monatsZeile(k), [...(mitte.get(monatsZeile(k)) ?? []), k.cy]);
  const bekannt = [...mitte.entries()].map(([z, ys]) => [z, median(ys)] as const).sort((a, b) => a[0] - b[0]);
  const abstaende: number[] = [];
  for (let i = 1; i < bekannt.length; i++) abstaende.push((bekannt[i]![1] - bekannt[i - 1]![1]) / (bekannt[i]![0] - bekannt[i - 1]![0]));
  const zeilenAbstand = abstaende.length ? median(abstaende) : h * 6;
  const zeilenMitte = Array.from({ length: 6 }, (_, z) => {
    const da = bekannt.find(([zz]) => zz === z);
    if (da) return da[1];
    const nah = [...bekannt].sort((a, b) => Math.abs(a[0] - z) - Math.abs(b[0] - z))[0]!;
    return nah[1] + (z - nah[0]) * zeilenAbstand;
  });

  // Zahl links in der Zelle oder mittig? Die stabilere Kante verrät es.
  const abweichung = (wert: (k: Zahl) => number) =>
    median(passend.map((k) => Math.abs(wert(k) - median(passend.filter((q) => spalte(q) === spalte(k)).map(wert)))));
  const ausgerichtet = abweichung((k) => k.x0) < abweichung((k) => k.cx) / 2 ? "links" : "mitte";
  // `links` = Mitte der ersten Spalte. Bei linksbündigen Zahlen liegt die
  // Zellkante knapp links der Zahl.
  links =
    ausgerichtet === "links"
      ? median(passend.map((k) => k.x0 - spalte(k) * spaltenBreite)) - spaltenBreite * 0.08 + spaltenBreite / 2
      : median(passend.map((k) => k.cx - spalte(k) * spaltenBreite));

  // Wochentage über dem Raster: beginnt die Woche am Sonntag?
  const kopfzeile = sauber
    .filter((w) => WOCHENTAGE.test(w.text.trim()) && w.y1 < zeilenMitte[0]! - h * 0.5)
    .sort((a, b) => a.x0 - b.x0);
  const erstesWT = kopfzeile[0]?.text.trim().toLowerCase().replace(/\.$/, "");
  const sonntagZuerst = kopfzeile.length >= 3 ? /^(so|sun|sonntag)/.test(erstesWT ?? "") : null;
  const oben = Math.min(zeilenMitte[0]! - h * 0.7, ...kopfzeile.map((w) => w.y0));

  return {
    versatz,
    links,
    spaltenBreite,
    zeilenMitte,
    zeilenAbstand,
    h,
    ausgerichtet,
    letzterTag: Math.max(...passend.map((k) => k.wert)),
    gefunden: passend.length,
    zahlen: new Set(passend.map((k) => `${Math.round(k.cx)}|${Math.round(k.cy)}`)),
    sonntagZuerst,
    oben,
  };
}

/** Rechtecke der Tageszellen (Tag 1 … anzahl) – für die Erkennung je Zelle. */
export function zellenVon(g: Gitter, anzahl = 31): Zelle[] {
  const liste: Zelle[] = [];
  for (let tag = 1; tag <= anzahl; tag++) {
    const pos = g.versatz + tag - 1;
    const zeile = Math.floor(pos / 7);
    if (zeile > 5) break;
    const spalte = pos % 7;
    const x0 = g.links + spalte * g.spaltenBreite - g.spaltenBreite / 2;
    const y0 = g.zeilenMitte[zeile]! - g.h * 0.75;
    liste.push({ tag, x0, y0, x1: x0 + g.spaltenBreite, y1: y0 + g.zeilenAbstand });
  }
  return liste;
}

// ---- 3. Einträge: Schicht oder Termin? -----------------------------------------------

/** Wörter, die fast immer eine Schicht (oder Abwesenheit) meinen. */
const SCHICHT_WOERTER = [
  "früh", "frueh", "spät", "spaet", "nacht", "frei", "urlaub", "krank", "tag", "mittel", "mittag", "zwischen",
  "frühdienst", "spätdienst", "nachtdienst", "tagdienst", "frühschicht", "spätschicht", "nachtschicht", "tagschicht",
  "dienst", "schicht", "bereitschaft", "rufbereitschaft", "ruhe", "ruhetag", "schule", "berufsschule", "seminar",
  "homeoffice", "ho", "gleitzeit", "überstunden", "ausgleich", "zeitausgleich", "az", "za", "kur", "elternzeit",
  "early", "late", "night", "off", "day", "vacation", "sick",
];

const ZEIT = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g;

interface Zeile {
  tag: number;
  text: string;
  zeiten: string[];
  /** mittlere Sicherheit der Texterkennung, 0–100 */
  konfidenz: number;
}

/** Kürzel, die fast immer Schichten meinen (Früh, Spät, Nacht, Tag, Urlaub, Krank, Frei). */
const KUERZEL = ["F", "S", "N", "T", "U", "K", "X", "FS", "SS", "NS", "TS", "UR", "KR"];

/** Text einer Zeile in einer Zelle aufräumen. */
const putzen = (t: string) =>
  t
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Raster lesen. `jahr`/`monat` kommen aus bestimmeMonat oder von der Person.
 * `bekannte` = Namen und Kürzel der eigenen Schichten: Was so heißt, ist eine
 * Schicht, auch wenn es nur einmal vorkommt.
 */
export function leseMonatsraster(
  woerter: Wort[],
  jahr: number,
  monat: number,
  opt: { bekannte?: string[]; gitter?: Gitter | null } = {},
): Raster {
  const leer = (warnung: string): Raster => ({ gruppen: [], termine: [], tageGefunden: 0, tageMitEintrag: 0, warnung });
  const anzahl = tageImMonat(jahr, monat);
  const g = opt.gitter === undefined ? leseGitter(woerter) : opt.gitter;
  if (!g) return leer("Auf dem Screenshot ist kein Monatsplan mit Tageszahlen sicher zu erkennen.");

  let warnung: string | null = null;
  const erwartet = ersterWochentag(jahr, monat);
  const passt = g.sonntagZuerst === true ? g.versatz === (erwartet + 1) % 7 : g.sonntagZuerst === false ? g.versatz === erwartet : g.versatz === erwartet || g.versatz === (erwartet + 1) % 7;
  if (!passt) warnung = "Die Wochentage passen nicht zum gewählten Monat – bitte Monat und Jahr prüfen.";

  const zellen = zellenVon(g, anzahl);
  const zelleVon = (cx: number, cy: number) => zellen.find((z) => cx >= z.x0 && cx < z.x1 && cy >= z.y0 && cy < z.y1)?.tag ?? null;

  // Wörter den Tagen zuordnen (ohne die Tageszahlen selbst), dann je Zelle zu Zeilen fügen.
  const proTag = new Map<number, Wort[]>();
  for (const w of woerter) {
    const t = w.text.trim();
    // Einzelne Buchstaben nur, wenn die Erkennung sicher war (sonst meist Kanten und Rauschen).
    if (!t || w.konfidenz < (Array.from(t).length === 1 ? 50 : 35)) continue;
    const cx = mitteX(w);
    const cy = mitteY(w);
    if (g.zahlen.has(`${Math.round(cx)}|${Math.round(cy)}`)) continue;
    const tag = zelleVon(cx, cy);
    if (tag === null) continue;
    // Die Tageszahl selbst (auch aus der zweiten Lesung) überspringen.
    if (t.replace(/\.$/, "") === String(tag) && cy < zellen[tag - 1]!.y0 + g.h * 1.6) continue;
    proTag.set(tag, [...(proTag.get(tag) ?? []), w]);
  }

  const zeilen: Zeile[] = [];
  for (const [tag, ws] of proTag) {
    const sortiert = [...ws].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
    const gruppiert: Wort[][] = [];
    for (const w of sortiert) {
      const letzte = gruppiert[gruppiert.length - 1];
      if (letzte && Math.abs(mitteY(w) - mitteY(letzte[0]!)) <= g.h * 0.6) letzte.push(w);
      else gruppiert.push([w]);
    }
    for (const n of gruppiert) {
      const roh = n
        .sort((a, b) => a.x0 - b.x0)
        .map((w) => w.text.trim())
        .join(" ");
      const zeiten = [...new Set([...roh.matchAll(ZEIT)].map((m) => `${m[1]!.padStart(2, "0")}:${m[2]}`))];
      let text = putzen(roh.replace(ZEIT, " ").replace(/\s[-–]\s?|\s?[-–]\s/g, " ")).slice(0, 40);
      // „Ss“, „Nn“: ein Kürzel, dessen Buchstabe doppelt gelesen wurde.
      const doppelt = /^(\p{Lu})(\p{Ll})$/u.exec(text);
      if (doppelt && doppelt[2] === doppelt[1]!.toLowerCase()) text = doppelt[1]!;
      // Reine Zahlen/Zeichen ohne Uhrzeit sind Rauschen; einzelne kleine Buchstaben auch.
      if (!/\p{L}/u.test(text) && !zeiten.length) continue;
      if (!zeiten.length && Array.from(text).length === 1 && text === text.toLowerCase()) continue;
      zeilen.push({ tag, text, zeiten, konfidenz: n.reduce((a, w) => a + w.konfidenz, 0) / n.length });
    }
  }
  // Eine Uhrzeit allein in einer Zeile gehört zum Text darunter („09:30“ / „Zahnarzt“).
  const sortiertZ = [...zeilen];
  for (let i = 0; i < sortiertZ.length - 1; i++) {
    const a = sortiertZ[i]!;
    const b = sortiertZ[i + 1]!;
    if (a.tag === b.tag && !a.text && a.zeiten.length && !b.zeiten.length) {
      b.zeiten = a.zeiten;
      a.zeiten = [];
    }
  }

  const bekannte = new Set((opt.bekannte ?? []).map((b) => b.toLowerCase()));
  const istSchichtWort = (t: string) => {
    const k = t.toLowerCase();
    return (
      bekannte.has(k) ||
      KUERZEL.includes(t) ||
      SCHICHT_WOERTER.includes(k) ||
      SCHICHT_WOERTER.some((s) => s.length >= 4 && k.startsWith(s))
    );
  };
  const haeufigkeit = new Map<string, number>();
  for (const z of zeilen) if (z.text) haeufigkeit.set(z.text, (haeufigkeit.get(z.text) ?? 0) + 1);

  const gruppen = new Map<string, { tage: Set<string>; zeiten: Map<string, number> }>();
  const termine: ErkannterTermin[] = [];
  const mitEintrag = new Set<number>();
  let letzterTermin = null as { tag: number; t: ErkannterTermin } | null;
  for (const z of zeilen) {
    if (!z.text) continue;
    const wortZahl = z.text.split(" ").length;
    const anzahl = haeufigkeit.get(z.text) ?? 0;
    const kuerzel = /^[\p{Lu}\d]{1,3}$/u.test(z.text);
    const oft = anzahl >= 3;
    const zeitspanne = z.zeiten.length >= 2;
    const datum = iso(jahr, monat, z.tag);
    // Fortsetzung eines Termins in der nächsten Zeile („Geburtstag“ / „Lea“).
    if (letzterTermin?.tag === z.tag && !z.zeiten.length && !istSchichtWort(z.text) && !kuerzel && anzahl < 2 && z.text.length >= 3) {
      letzterTermin.t.titel = `${letzterTermin.t.titel} ${z.text}`.slice(0, 60);
      continue;
    }
    let schicht: boolean;
    if (istSchichtWort(z.text)) schicht = true;
    else if (kuerzel) {
      // Unbekannte Kürzel nur, wenn sie mehrfach vorkommen oder sehr sicher gelesen sind –
      // einzelne Großbuchstaben sind sonst oft Kanten von Kästchen.
      if (anzahl < 2 && z.konfidenz < 90) continue;
      schicht = true;
    } else if (z.text.length <= 2) continue; // „ea“, „ll“: Rauschen
    else if (z.zeiten.length === 1) schicht = false; // „09:30 Zahnarzt“
    else if (zeitspanne) schicht = oft || wortZahl === 1; // „Frühdienst 06:00–14:00“
    else schicht = oft && wortZahl <= 2;
    mitEintrag.add(z.tag);
    letzterTermin = null;
    if (schicht) {
      const e = gruppen.get(z.text) ?? { tage: new Set<string>(), zeiten: new Map<string, number>() };
      e.tage.add(datum);
      if (zeitspanne) {
        const k = `${z.zeiten[0]}|${z.zeiten[1]}`;
        e.zeiten.set(k, (e.zeiten.get(k) ?? 0) + 1);
      }
      gruppen.set(z.text, e);
    } else {
      const t = { tag: datum, titel: z.text, beginn: z.zeiten[0] ?? "", ende: z.zeiten[1] ?? "" };
      termine.push(t);
      letzterTermin = { tag: z.tag, t };
    }
  }

  // Unbekannte Kürzel, die nur neben einer anderen Schicht stehen und selten
  // sind, stammen meist von Kanten farbiger Kästchen – weglassen.
  const mitSchicht = new Map<string, number>();
  for (const [name, e] of gruppen) {
    if (!/^[\p{Lu}\d]{1,3}$/u.test(name) || istSchichtWort(name)) for (const t of e.tage) mitSchicht.set(t, (mitSchicht.get(t) ?? 0) + 1);
  }
  const groesste = Math.max(0, ...[...gruppen.values()].map((e) => e.tage.size));
  for (const [name, e] of [...gruppen]) {
    if (!/^[\p{Lu}\d]{1,3}$/u.test(name) || istSchichtWort(name)) continue;
    if (e.tage.size <= Math.max(3, groesste / 4) && [...e.tage].every((t) => mitSchicht.has(t))) gruppen.delete(name);
  }

  // Verlesene Namen zur häufigen Schreibweise: „Ss“ → „S“, „Nackt“ → „Nacht“.
  const nachHaeufigkeit = [...gruppen.entries()].sort((a, b) => b[1].tage.size - a[1].tage.size);
  for (const [name, e] of [...nachHaeufigkeit].reverse()) {
    const ziel = nachHaeufigkeit.find(([anderer, f]) => {
      if (anderer === name || f.tage.size < e.tage.size * 2) return false;
      if (name.length >= 4 && anderer.length >= 4) return abstand(name.toLowerCase(), anderer.toLowerCase()) <= 1;
      // kurze Kürzel: gleicher Anfangsbuchstabe, Rest nur kleingeschriebenes Rauschen
      return anderer.length <= 2 && name.startsWith(anderer) && name.slice(anderer.length) === name.slice(anderer.length).toLowerCase();
    });
    if (!ziel || !gruppen.has(name)) continue;
    for (const t of e.tage) ziel[1].tage.add(t);
    gruppen.delete(name);
  }

  const liste: Gruppe[] = [...gruppen.entries()]
    .map(([name, e]) => {
      const zeit = [...e.zeiten.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const [beginn, ende] = zeit ? zeit.split("|") : ["", ""];
      return { name, tage: [...e.tage].sort(), beginn: beginn ?? "", ende: ende ?? "", ganztaegig: !zeit, ausBild: true };
    })
    .sort((a, b) => b.tage.length - a.tage.length || a.name.localeCompare(b.name, "de"));
  termine.sort((a, b) => a.tag.localeCompare(b.tag) || a.beginn.localeCompare(b.beginn));
  if (!liste.length && !termine.length && !warnung) warnung = "Im Raster ist kein Text zu erkennen – nur Tageszahlen.";
  return {
    gruppen: liste,
    termine,
    tageGefunden: Math.min(anzahl, g.gefunden),
    tageMitEintrag: mitEintrag.size,
    warnung,
  };
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
