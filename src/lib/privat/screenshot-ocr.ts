/**
 * Texterkennung für Screenshots – läuft im Browser (tesseract.js, WebAssembly).
 * Programm und deutsche Sprachdaten liegen unter /ocr auf der eigenen Adresse
 * (kopiert von `scripts/ocr-kopieren.mjs`); das Bild verlässt das Handy nicht.
 */
import type { Wort } from "./screenshot-raster";

export interface Erkannt {
  woerter: Wort[];
  text: string;
  breite: number;
  hoehe: number;
}

const ZIEL_BREITE = 1800;

type Aufbereitung = "grau" | "lokal";

/**
 * Bild laden, auf lesbare Größe bringen und für die Texterkennung aufbereiten:
 * "grau" = Graustufen mit mehr Kontrast (dunkle Schrift auf hellem Grund),
 * "lokal" = jeder Punkt gegen seine Umgebung: Schrift wird schwarz auf Weiß,
 * egal ob hell auf Farbe (Schichtfelder) oder dunkel auf hell.
 */
async function vorbereiten(datei: File, art: Aufbereitung): Promise<{ canvas: HTMLCanvasElement; faktor: number }> {
  let bild: ImageBitmap;
  try {
    bild = await createImageBitmap(datei);
  } catch {
    throw new Error("Das Bild konnte nicht geöffnet werden.");
  }
  const faktor = Math.min(2.5, Math.max(1, ZIEL_BREITE / bild.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bild.width * faktor);
  canvas.height = Math.round(bild.height * faktor);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Das Bild konnte nicht verarbeitet werden.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
  bild.close();
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
    const r = Math.max(8, Math.round(w / 90));
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

/**
 * Screenshot lesen: Wörter mit Position in Pixeln des Originalbilds. Das Bild
 * wird zweimal unterschiedlich aufbereitet (normal und „lokal“ für helle Schrift
 * auf bunten Feldern) und beides zusammengelegt – so fehlt weniger.
 */
export async function erkenneScreenshot(datei: File, onFortschritt?: (anteil: number) => void): Promise<Erkannt> {
  let w: Arbeiter;
  try {
    w = await holeArbeiter();
  } catch {
    throw new Error("Die Texterkennung konnte nicht gestartet werden. Bitte versuch es noch einmal oder nimm eine Kalender-Datei.");
  }
  const arten: Aufbereitung[] = ["grau", "lokal"];
  let woerter: Wort[] = [];
  let text = "";
  let breite = 0;
  let hoehe = 0;
  for (const [i, art] of arten.entries()) {
    const { canvas, faktor } = await vorbereiten(datei, art);
    fortschritt = (p) => onFortschritt?.((i + p) / arten.length);
    try {
      const { data } = await w.recognize(canvas, {}, { text: true, blocks: true });
      const neu: Wort[] = [];
      for (const block of data.blocks ?? [])
        for (const absatz of block.paragraphs ?? [])
          for (const zeile of absatz.lines ?? [])
            for (const wort of zeile.words ?? []) {
              neu.push({
                text: wort.text,
                x0: wort.bbox.x0 / faktor,
                y0: wort.bbox.y0 / faktor,
                x1: wort.bbox.x1 / faktor,
                y1: wort.bbox.y1 / faktor,
                konfidenz: wort.confidence,
              });
            }
      woerter = i === 0 ? neu : vereineWoerter(woerter, neu);
      text += `${data.text ?? ""}\n`;
      breite = canvas.width / faktor;
      hoehe = canvas.height / faktor;
    } finally {
      fortschritt = null;
    }
  }
  return { woerter, text, breite, hoehe };
}
