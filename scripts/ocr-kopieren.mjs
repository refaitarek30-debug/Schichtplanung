// Texterkennung für „Schichten übernehmen“ (Screenshots): Die Dateien kommen aus
// node_modules und werden unter /ocr von der eigenen Adresse ausgeliefert –
// nichts wird von einem fremden Server nachgeladen.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const ziel = join(wurzel, "public", "ocr");
const kopiere = (von, nach) => {
  const quelle = join(wurzel, "node_modules", von);
  if (!existsSync(quelle)) {
    console.warn(`ocr-kopieren: ${von} fehlt – Screenshots lesen ist dann nicht verfügbar.`);
    return;
  }
  mkdirSync(dirname(join(ziel, nach)), { recursive: true });
  cpSync(quelle, join(ziel, nach));
};

kopiere("tesseract.js/dist/worker.min.js", "worker.min.js");
for (const v of ["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"]) {
  kopiere(`tesseract.js-core/${v}.wasm.js`, `core/${v}.wasm.js`);
}
kopiere("@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz", "lang/deu.traineddata.gz");
