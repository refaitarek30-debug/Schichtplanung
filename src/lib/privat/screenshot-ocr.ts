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
): { canvas: HTMLCanvasElement; faktor: number } {
  const faktor = Math.min(maxFaktor, Math.max(1, zielBreite / bereich.b));
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
      await w.setParameters({ tessedit_pageseg_mode: "6" as never });
      try {
        for (const [k, z] of zellen.entries()) {
          // Etwas nach innen (Ränder und Rundungen der Zelle stören) und
          // unter der Tageszahl beginnen.
          const rand = (z.x1 - z.x0) * 0.06;
          const x0 = Math.max(0, z.x0 + rand);
          const x1 = Math.min(bild.width, z.x1 - rand);
          const y0 = Math.max(0, z.y0 + gitter.h * 1.45);
          const y1 = Math.min(bild.height, z.y1 - rand);
          const aus = { x: Math.round(x0), y: Math.round(y0), b: Math.round(x1 - x0), h: Math.round(y1 - y0) };
          onFortschritt?.(0.6 + (0.4 * (k + 1)) / zellen.length);
          if (aus.b < 8 || aus.h < 8) continue;
          const { canvas, faktor } = vorbereiten(bild, "binaer", aus, 360, 4);
          const { data } = await w.recognize(canvas, {}, { blocks: true });
          const neu = woerterAus(data, faktor, aus.x, aus.y).filter(
            (x) => x.text.trim() && x.konfidenz >= (Array.from(x.text.trim()).length === 1 ? 70 : 50),
          );
          const drin = (x: Wort) => {
            const cx = (x.x0 + x.x1) / 2;
            const cy = (x.y0 + x.y1) / 2;
            return cx >= aus.x && cx < aus.x + aus.b && cy >= aus.y && cy < aus.y + aus.h;
          };
          const buchstaben = (liste: Wort[]) => liste.filter((x) => /\p{L}/u.test(x.text));
          const sicherheit = (liste: Wort[]) => (liste.length ? liste.reduce((a, x) => a + x.konfidenz, 0) / liste.length : 0);
          const vorher = buchstaben(woerter.filter(drin));
          const jetzt = buchstaben(neu);
          // Nur ersetzen, wenn die Zell-Lesung sicherer ist als die vom ganzen Bild.
          if (!jetzt.length || sicherheit(jetzt) < sicherheit(vorher)) continue;
          woerter = [...woerter.filter((x) => !drin(x) || !/\p{L}/u.test(x.text)), ...neu.filter((x) => /\p{L}/u.test(x.text) || /\d[:.]\d/.test(x.text))];
        }
      } finally {
        await w.setParameters({ tessedit_pageseg_mode: "11" as never });
      }
    }
    return { woerter, text, breite: bild.width, hoehe: bild.height, gitter };
  } finally {
    bild.close();
  }
}
