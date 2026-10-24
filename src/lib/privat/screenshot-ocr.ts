/**
 * Texterkennung für Screenshots – läuft im Browser (tesseract.js, WebAssembly).
 * Programm und deutsche Sprachdaten liegen unter /ocr auf der eigenen Adresse
 * (kopiert von `scripts/ocr-kopieren.mjs`); das Bild verlässt das Handy nicht.
 */
import { leseGitter, zellenVon, type Gitter, type Wort } from "./screenshot-raster";

export interface Erkannt {
  woerter: Wort[];
  text: string;
  breite: number;
  hoehe: number;
  /** Lage des Monatsrasters (null = keins erkannt) */
  gitter: Gitter | null;
}

const ZIEL_BREITE = 1800;

type Aufbereitung = "grau" | "lokal" | "binaer";

/**
 * Bild laden, auf lesbare Größe bringen und für die Texterkennung aufbereiten:
 * "grau" = Graustufen mit mehr Kontrast (dunkle Schrift auf hellem Grund),
 * "lokal" = jeder Punkt gegen seine Umgebung: Schrift wird schwarz auf Weiß,
 * egal ob hell auf Farbe (Schichtfelder) oder dunkel auf hell.
 * "binaer" = für kleine Ausschnitte (eine Zelle): eine Schwelle nach Otsu;
 * die seltenere Seite ist die Schrift und wird schwarz – so wird auch helle
 * Schrift auf farbigem Kästchen zu schwarzer Schrift auf Weiß.
 */
async function oeffne(datei: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(datei);
  } catch {
    throw new Error("Das Bild konnte nicht geöffnet werden.");
  }
}

/** Ausschnitt in Bildpunkten des Originals */
interface Ausschnitt {
  x: number;
  y: number;
  b: number;
  h: number;
}

function vorbereiten(
  bild: ImageBitmap,
  art: Aufbereitung,
  bereich: Ausschnitt = { x: 0, y: 0, b: bild.width, h: bild.height },
  zielBreite = ZIEL_BREITE,
  maxFaktor = 2.5,
  festerFaktor?: number,
): { canvas: HTMLCanvasElement; faktor: number } {
  const faktor = festerFaktor ?? Math.min(maxFaktor, Math.max(1, zielBreite / bereich.b));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bereich.b * faktor));
  canvas.height = Math.max(1, Math.round(bereich.h * faktor));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Das Bild konnte nicht verarbeitet werden.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bild, bereich.x, bereich.y, bereich.b, bereich.h, 0, 0, canvas.width, canvas.height);
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = px.data;
  const { width: w, height: h } = canvas;
  const grau = new Uint8ClampedArray(w * h);
  let min = 255;
  let max = 0;
  for (let i = 0, k = 0; i < d.length; i += 4, k++) {
    const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    grau[k] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const aus = new Uint8ClampedArray(w * h);
  if (art === "grau") {
    const spanne = Math.max(1, max - min);
    for (let k = 0; k < aus.length; k++) aus[k] = ((grau[k]! - min) * 255) / spanne;
  } else if (art === "binaer") {
    const hist = new Array<number>(256).fill(0);
    for (let k = 0; k < grau.length; k++) hist[Math.round(grau[k]!)]! += 1;
    let summe = 0;
    for (let i = 0; i < 256; i++) summe += i * hist[i]!;
    let sB = 0;
    let wB = 0;
    let best = 0;
    let schwelle = 128;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]!;
      if (!wB) continue;
      const wF = grau.length - wB;
      if (!wF) break;
      sB += i * hist[i]!;
      const mB = sB / wB;
      const mF = (summe - sB) / wF;
      const zwischen = wB * wF * (mB - mF) ** 2;
      if (zwischen > best) {
        best = zwischen;
        schwelle = i;
      }
    }
    let dunkel = 0;
    for (let k = 0; k < grau.length; k++) if (grau[k]! <= schwelle) dunkel++;
    const schriftDunkel = dunkel <= grau.length / 2;
    for (let k = 0; k < aus.length; k++) {
      const istDunkel = grau[k]! <= schwelle;
      aus[k] = istDunkel === schriftDunkel ? 0 : 255;
    }
  } else {
    // Summenbild: Mittelwert der Umgebung in konstanter Zeit je Punkt.
    const b = w + 1;
    const summe = new Uint32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let zeile = 0;
      for (let x = 0; x < w; x++) {
        zeile += grau[y * w + x]!;
        summe[(y + 1) * b + x + 1] = summe[y * b + x + 1]! + zeile;
      }
    }
    const r = Math.max(8, Math.round(Math.max(w, ZIEL_BREITE) / 90));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(w, x + r + 1);
        const flaeche = (x1 - x0) * (y1 - y0);
        const mittel = (summe[y1 * b + x1]! - summe[y0 * b + x1]! - summe[y1 * b + x0]! + summe[y0 * b + x0]!) / flaeche;
        aus[y * w + x] = Math.abs(grau[y * w + x]! - mittel) > 40 ? 0 : 255;
      }
    }
  }
  for (let i = 0, k = 0; i < d.length; i += 4, k++) d[i] = d[i + 1] = d[i + 2] = aus[k]!;
  ctx.putImageData(px, 0, 0);
  return { canvas, faktor };
}

type Arbeiter = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;
let arbeiter: Promise<Arbeiter> | null = null;
let fortschritt: ((p: number) => void) | null = null;

async function holeArbeiter(): Promise<Arbeiter> {
  arbeiter ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const basis = window.location.origin;
    const w = await createWorker("deu", 1, {
      workerPath: `${basis}/ocr/worker.min.js`,
      corePath: `${basis}/ocr/core`,
      langPath: `${basis}/ocr/lang`,
      gzip: true,
      cacheMethod: "none",
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") fortschritt?.(m.progress);
      },
    });
    // Verstreute Texte (Kalenderzellen) statt Fließtext.
    await w.setParameters({ tessedit_pageseg_mode: "11" as never, preserve_interword_spaces: "1" });
    return w;
  })();
  try {
    return await arbeiter;
  } catch (e) {
    arbeiter = null;
    throw e;
  }
}

/** Gibt den Speicher der Texterkennung wieder frei (beim Verlassen der Seite). */
export async function beendeTexterkennung() {
  const a = arbeiter;
  arbeiter = null;
  if (a) await (await a.catch(() => null))?.terminate();
}

const ueberlappt = (a: Wort, b: Wort) => {
  const x = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const y = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (x <= 0 || y <= 0) return false;
  const kleiner = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return (x * y) / kleiner > 0.4;
};

/** Zwei Lesedurchgänge zusammenlegen: an gleicher Stelle gewinnt das sicherere Wort. */
export function vereineWoerter(a: Wort[], b: Wort[]): Wort[] {
  const aus = [...a];
  for (const w of b) {
    const i = aus.findIndex((x) => ueberlappt(x, w));
    if (i === -1) aus.push(w);
    else if (w.konfidenz > aus[i]!.konfidenz) aus[i] = w;
  }
  return aus;
}

/** Ein Streifen mit Inhalt in einer Zelle, in Bildpunkten des Zellausschnitts. */
interface Band {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Teilt eine Zelle in waagerechte Streifen mit Inhalt: farbige Balken (auch
 * mit heller Schrift darin), Textzeilen, blasse Kästchen. Hintergrund ist die
 * Farbe der obersten und untersten Pixelzeile – so geht es bei leerer Zelle,
 * ganz gefärbter Zelle und im dunklen Modus gleich. `minH` = kleinste Höhe
 * eines Streifens (kürzere sind meist Linien).
 */
export function findeBaender(px: Uint8ClampedArray, b: number, h: number, minH: number): Band[] {
  const kanal: number[][] = [[], [], []];
  for (const y of [0, 1, h - 2, h - 1]) {
    if (y < 0 || y >= h) continue;
    for (let x = 0; x < b; x++) for (let c = 0; c < 3; c++) kanal[c]!.push(px[(y * b + x) * 4 + c]!);
  }
  const bg = kanal.map((k) => k.sort((a, c) => a - c)[k.length >> 1] ?? 255);
  const SCHWELLE = 38 * 38;
  const zeile = new Uint16Array(h);
  const maske = new Uint8Array(b * h);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < b; x++) {
      const i = (y * b + x) * 4;
      const dr = px[i]! - bg[0]!;
      const dg = px[i + 1]! - bg[1]!;
      const db = px[i + 2]! - bg[2]!;
      if (dr * dr + dg * dg + db * db > SCHWELLE) {
        maske[y * b + x] = 1;
        n++;
      }
    }
    zeile[y] = n;
  }
  const an = Math.max(3, Math.round(b * 0.03));
  const luecke = Math.max(2, Math.round(minH * 0.35));
  const baender: Band[] = [];
  let start = -1;
  let leer = 0;
  for (let y = 0; y <= h; y++) {
    const voll = y < h && zeile[y]! >= an;
    if (voll) {
      if (start < 0) start = y;
      leer = 0;
    } else if (start >= 0) {
      leer++;
      if (leer > luecke || y === h) {
        const ende = y - leer;
        if (ende - start + 1 >= minH) {
          // Waagerechte Ausdehnung: Spalten mit genug Inhalt im Streifen.
          const hoehe = ende - start + 1;
          let x0 = -1;
          let x1 = -1;
          for (let x = 0; x < b; x++) {
            let n = 0;
            for (let yy = start; yy <= ende; yy++) n += maske[yy * b + x]!;
            if (n >= Math.max(1, hoehe * 0.1)) {
              if (x0 < 0) x0 = x;
              x1 = x;
            }
          }
          if (x0 >= 0 && x1 - x0 >= 3) {
            // Aufzählungspunkt vor einem Text („● Zahnarzt“): ein runder, niedriger
            // Fleck ganz links mit Abstand zum Rest – weglassen, er stört das Lesen.
            let spalteMit = (x: number) => {
              for (let yy = start; yy <= ende; yy++) if (maske[yy * b + x]) return true;
              return false;
            };
            let gx1 = x0;
            while (gx1 <= x1 && spalteMit(gx1)) gx1++;
            let naechster = gx1;
            while (naechster <= x1 && !spalteMit(naechster)) naechster++;
            if (gx1 < x1 && naechster - gx1 >= Math.max(3, hoehe * 0.2) && naechster <= x1) {
              let ya = h;
              let ye = -1;
              for (let yy = start; yy <= ende; yy++)
                for (let x = x0; x < gx1; x++)
                  if (maske[yy * b + x]) {
                    ya = Math.min(ya, yy);
                    ye = Math.max(ye, yy);
                  }
              const gh = ye - ya + 1;
              const gw = gx1 - x0;
              if (gh <= hoehe * 0.9 && gw >= gh * 0.6 && gw <= gh * 1.3) x0 = naechster;
            }
            spalteMit = () => false;
            baender.push({ x0, y0: start, x1: x1 + 1, y1: ende + 1 });
          }
        }
        start = -1;
        leer = 0;
      }
    }
  }
  return baender;
}

/** Wörter aus einem Lesedurchgang, umgerechnet in Bildpunkte des Originals. */
function woerterAus(
  data: { blocks?: { paragraphs?: { lines?: { words?: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] | null },
  faktor: number,
  dx = 0,
  dy = 0,
): Wort[] {
  const neu: Wort[] = [];
  for (const block of data.blocks ?? [])
    for (const absatz of block.paragraphs ?? [])
      for (const zeile of absatz.lines ?? [])
        for (const wort of zeile.words ?? []) {
          neu.push({
            text: wort.text,
            x0: dx + wort.bbox.x0 / faktor,
            y0: dy + wort.bbox.y0 / faktor,
            x1: dx + wort.bbox.x1 / faktor,
            y1: dy + wort.bbox.y1 / faktor,
            konfidenz: wort.confidence,
          });
        }
  return neu;
}

/**
 * Screenshot lesen: Wörter mit Position in Pixeln des Originalbilds.
 *   1. Das ganze Bild zweimal unterschiedlich aufbereitet (normal und
 *      „lokal“ für helle Schrift auf bunten Feldern) – daraus Überschrift
 *      und Tageszahlen, also das Raster.
 *   2. Jede Tageszelle noch einmal einzeln und vergrößert als Textblock: So
 *      werden kurze Kürzel (F, S, N) in farbigen Kästchen viel sicherer
 *      gelesen. Wo das gelingt, ersetzt es die Wörter aus Schritt 1.
 */
export async function erkenneScreenshot(datei: File, onFortschritt?: (anteil: number) => void): Promise<Erkannt> {
  let w: Arbeiter;
  try {
    w = await holeArbeiter();
  } catch {
    throw new Error("Die Texterkennung konnte nicht gestartet werden. Bitte versuch es noch einmal oder nimm eine Kalender-Datei.");
  }
  const bild = await oeffne(datei);
  try {
    const arten: Aufbereitung[] = ["grau", "lokal"];
    // Anteile am Fortschritt: ganzes Bild 2 × 30 %, Zellen 40 %.
    let woerter: Wort[] = [];
    let text = "";
    for (const [i, art] of arten.entries()) {
      const { canvas, faktor } = vorbereiten(bild, art);
      fortschritt = (p) => onFortschritt?.((i + p) * 0.3);
      try {
        const { data } = await w.recognize(canvas, {}, { text: true, blocks: true });
        const neu = woerterAus(data, faktor);
        woerter = i === 0 ? neu : vereineWoerter(woerter, neu);
        text += `${data.text ?? ""}\n`;
      } finally {
        fortschritt = null;
      }
    }

    const gitter = leseGitter(woerter);
    if (gitter) {
      const zellen = zellenVon(gitter).filter((z) => z.x1 > 0 && z.y1 > 0 && z.x0 < bild.width && z.y0 < bild.height);
      let modus = "11";
      const setzeModus = async (m: string) => {
        if (m === modus) return;
        modus = m;
        await w.setParameters({ tessedit_pageseg_mode: m as never });
      };
      const buchstaben = (liste: Wort[]) => liste.filter((x) => /\p{L}/u.test(x.text));
      const sicherheit = (liste: Wort[]) => (liste.length ? liste.reduce((a, x) => a + x.konfidenz, 0) / liste.length : 0);
      try {
        for (const [k, z] of zellen.entries()) {
          onFortschritt?.(0.6 + (0.4 * (k + 1)) / zellen.length);
          // Etwas nach innen (Ränder und Rundungen der Zelle stören) und
          // unter der Tageszahl beginnen.
          const rand = (z.x1 - z.x0) * 0.04;
          const zx0 = Math.max(0, Math.round(z.x0 + rand));
          const zx1 = Math.min(bild.width, Math.round(z.x1 - rand));
          const zy0 = Math.max(0, Math.round(z.y0 + gitter.h * 1.3));
          const zy1 = Math.min(bild.height, Math.round(z.y1 - rand));
          const zb = zx1 - zx0;
          const zh = zy1 - zy0;
          if (zb < 12 || zh < 8) continue;
          // Zelle in Originalgröße holen und in Streifen teilen.
          const roh = document.createElement("canvas");
          roh.width = zb;
          roh.height = zh;
          const rctx = roh.getContext("2d", { willReadFrequently: true });
          if (!rctx) continue;
          rctx.drawImage(bild, zx0, zy0, zb, zh, 0, 0, zb, zh);
          const baender = findeBaender(rctx.getImageData(0, 0, zb, zh).data, zb, zh, Math.max(6, gitter.h * 0.5));
          if (!baender.length) continue;

          const neu: Wort[] = [];
          for (const bd of baender) {
            const bh = bd.y1 - bd.y0;
            // Schrift soll etwa 45–60 Bildpunkte hoch sein: so liest Tesseract am sichersten.
            const faktor = Math.min(4, Math.max(2, 60 / gitter.h));
            // Eng um den Streifen: nur Balken und Schrift, damit die Schrift
            // (immer die kleinere Farbfläche) schwarz auf Weiß wird.
            const aus = { x: zx0 + bd.x0, y: zy0 + bd.y0, b: bd.x1 - bd.x0, h: bh };
            const { canvas } = vorbereiten(bild, "binaer", aus, 0, 5, faktor);
            const m = 12;
            const mitRand = document.createElement("canvas");
            mitRand.width = canvas.width + 2 * m;
            mitRand.height = canvas.height + 2 * m;
            const mctx = mitRand.getContext("2d");
            if (!mctx) continue;
            mctx.fillStyle = "#fff";
            mctx.fillRect(0, 0, mitRand.width, mitRand.height);
            mctx.drawImage(canvas, m, m);
            await setzeModus(bh > gitter.h * 1.9 ? "6" : "7");
            const { data } = await w.recognize(mitRand, {}, { blocks: true });
            neu.push(
              ...woerterAus(data, faktor, aus.x - m / faktor, aus.y - m / faktor).filter(
                (x) => x.text.trim() && x.konfidenz >= (Array.from(x.text.trim()).length === 1 ? 60 : 38),
              ),
            );
          }
          // Ersetzt werden alle Buchstaben-Wörter der ganzen Zelle (auch Rauschen neben der Tageszahl).
          const drin = (x: Wort) => {
            const cx = (x.x0 + x.x1) / 2;
            const cy = (x.y0 + x.y1) / 2;
            return cx >= z.x0 && cx < z.x1 && cy >= z.y0 && cy < zy1;
          };
          const vorher = buchstaben(woerter.filter(drin));
          const jetzt = buchstaben(neu);
          // Nur ersetzen, wenn die Zell-Lesung mindestens so sicher ist wie die vom ganzen Bild.
          if (!jetzt.length || (vorher.length && sicherheit(jetzt) < sicherheit(vorher) - 5)) continue;
          woerter = [...woerter.filter((x) => !drin(x) || !/\p{L}/u.test(x.text)), ...neu.filter((x) => /\p{L}/u.test(x.text) || /\d[:.]\d/.test(x.text))];
        }
      } finally {
        await setzeModus("11");
      }
    }
    return { woerter, text, breite: bild.width, hoehe: bild.height, gitter };
  } finally {
    bild.close();
  }
}
