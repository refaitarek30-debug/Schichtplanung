// Schneidet eine aufgenommene Folge (1080x1920, 30 fps): Stimme, große Untertitel,
// Aufhänger oben in den ersten Sekunden, am Ende nur „ShiftNexo“.
// Aufruf: node bauen.mjs ../02-name ./roh ./video.mp4
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [ordner, roh = "./roh", ziel = "./video.mp4"] = process.argv.slice(2);
const folge = (await import(pathToFileURL(resolve(ordner, "folge.mjs")).href)).default;
const z = JSON.parse(readFileSync(join(roh, "zeiten.json"), "utf8"));
const FETT = process.env.SCHRIFT ?? "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf";
const SCHLUSS = 1.6;

const start = Math.max(0, z.saetze[0].ab - 0.35);
const dauer = +(z.ende - start + 0.3).toFixed(2);
const text = (name, inhalt) => {
  const p = join(roh, name);
  writeFileSync(p, inhalt);
  return p;
};
const dt = (datei, groesse, extra) =>
  `drawtext=fontfile=${FETT}:textfile=${datei}:fontsize=${groesse}:line_spacing=12:text_align=center:${extra}`;

// Zeilen umbrechen, damit nichts über den Rand läuft (eigene Umbrüche bleiben).
const umbrechen = (t, max = 24) =>
  t.split("\n").flatMap((zeile) => {
    const aus = [];
    let akt = "";
    for (const wort of zeile.split(" ")) {
      if (akt && (akt + " " + wort).length > max) {
        aus.push(akt);
        akt = wort;
      } else akt = akt ? akt + " " + wort : wort;
    }
    return akt ? [...aus, akt] : aus;
  }).join("\n");
const haken = text("t-haken.txt", umbrechen(folge.haken, 26));
const hakenBis = Math.min(3.2, z.saetze[0].dauer + 0.6);
const untertitel = z.saetze.map((s, i) => {
  const ab = +(s.ab - start).toFixed(2);
  const bis = +(i + 1 < z.saetze.length ? z.saetze[i + 1].ab - start : dauer).toFixed(2);
  return dt(text(`t-u${i}.txt`, umbrechen(s.untertitel)), 64, `fontcolor=white:borderw=8:bordercolor=0x101a28:x=(w-text_w)/2:y=1300:enable='between(t,${ab},${bis - 0.05})'`);
});

const bild = [
  `[0:v]trim=start=${start}:duration=${dauer},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:flags=lanczos`,
  dt(haken, 74, `box=1:boxcolor=0xE5484DF2:boxborderw=30:fontcolor=white:x=(w-text_w)/2:y=230:enable='between(t,0,${hakenBis})'`),
  ...untertitel,
  `format=yuv420p[a]`,
].join(",");
const schluss = `color=c=0x10263f:s=1080x1920:d=${SCHLUSS}:r=30,drawtext=fontfile=${FETT}:text=ShiftNexo:fontsize=150:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2,fade=t=in:st=0:d=0.3,format=yuv420p[b]`;

// Stimme: jeder Satz an seiner Stelle, dann lauter und gleichmäßig
const eingaenge = z.saetze.flatMap((s) => ["-i", s.datei]);
const ton = z.saetze.map((s, i) => `[${i + 1}:a]adelay=${Math.round((s.ab - start) * 1000)}:all=1[s${i}]`);
const mix = `${z.saetze.map((_, i) => `[s${i}]`).join("")}amix=inputs=${z.saetze.length}:normalize=0,apad=whole_dur=${dauer + SCHLUSS},loudnorm=I=-14:TP=-1.5[ton]`;

const filter = [bild, schluss, "[a][b]concat=n=2:v=1:a=0[v]", ...ton, mix].join(";");
const f = spawnSync(
  "ffmpeg",
  ["-loglevel", "error", "-y", "-i", join(roh, "roh.webm"), ...eingaenge, "-filter_complex", filter, "-map", "[v]", "-map", "[ton]",
   "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", ziel],
  { stdio: "inherit" },
);
console.log(`Länge etwa ${(dauer + SCHLUSS).toFixed(1)} s`);
process.exit(f.status ?? 1);
