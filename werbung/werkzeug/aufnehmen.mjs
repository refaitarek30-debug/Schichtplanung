// Nimmt eine Folge mit Stimme auf: erst die Sätze sprechen lassen (Piper, offline),
// dann die App so bedienen, dass jede Aktion genau zu ihrem Satz passt.
// Aufruf: PIPER=…/piper STIMME=…/de_DE-thorsten-high.onnx node aufnehmen.mjs ../02-name ./roh
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { starte } from "./sitzung.mjs";

const [ordner, out = "./roh"] = process.argv.slice(2);
const folge = (await import(pathToFileURL(resolve(ordner, "folge.mjs")).href)).default;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. Stimme: ein WAV je Satz, Länge merken
const PIPER = process.env.PIPER ?? "piper";
const STIMME = process.env.STIMME;
const saetze = folge.saetze.map((s, i) => {
  const datei = join(out, `satz-${i}.wav`);
  execFileSync(PIPER, ["-m", STIMME, "-f", datei, "--length-scale", String(folge.tempo ?? 0.9), "--sentence-silence", "0.1"], {
    input: s.sprechen ?? s.text,
    stdio: ["pipe", "ignore", "ignore"],
  });
  const dauer = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", datei]).toString());
  return { ...s, datei, dauer };
});

// 2. Aufnahme im Takt der Sätze
const s = await starte({ OUT: out });
await s.page.goto(s.base + folge.start, { waitUntil: "networkidle", timeout: 180000 });
const ueberspringen = s.page.getByRole("button", { name: "Überspringen" });
if (await ueberspringen.count()) await ueberspringen.first().click();
if (folge.vorbereiten) await folge.vorbereiten(s);
await s.page.waitForTimeout(800);

const zeiten = [];
for (const [i, satz] of saetze.entries()) {
  const ab = Date.now();
  s.marke(`satz${i}`);
  zeiten.push(s.zeit[`satz${i}`]);
  if (satz.aktion) await satz.aktion(s);
  const rest = satz.dauer * 1000 + (satz.pause ?? 250) - (Date.now() - ab);
  if (rest > 0) await s.page.waitForTimeout(rest);
}
s.marke("ende");
await s.page.waitForTimeout(600);
await s.ctx.close();
await s.browser.close();

const datei = readdirSync(out).find((f) => f.endsWith(".webm"));
renameSync(join(out, datei), join(out, "roh.webm"));
writeFileSync(
  join(out, "zeiten.json"),
  JSON.stringify({ saetze: saetze.map((x, i) => ({ text: x.text, untertitel: x.untertitel ?? x.text, datei: x.datei, dauer: x.dauer, ab: zeiten[i] })), ende: s.zeit.ende }, null, 2),
);
console.log(saetze.map((x, i) => `${zeiten[i].toFixed(1)}s ${x.dauer.toFixed(1)}s ${x.text}`).join("\n"));
