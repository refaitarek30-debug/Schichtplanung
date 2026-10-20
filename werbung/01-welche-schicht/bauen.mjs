// Schneidet aus der Aufnahme das fertige Hochformat-Video (1080x1920, 30 fps, ohne Ton):
// Aufnahme mit Frage oben und Sprechertext als Untertitel, danach die Endkarte.
// Aufruf: node bauen.mjs <ordner-mit-roh.webm> <ausgabe.mp4>
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const [ordner = "./roh", ziel = "./video.mp4"] = process.argv.slice(2);
const hier = fileURLToPath(new URL(".", import.meta.url));
const z = JSON.parse(readFileSync(join(ordner, "zeiten.json"), "utf8"));
const SCHRIFT = process.env.SCHRIFT ?? "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf";

const start = Math.max(0, z.bereit - 0.2);
const r = (name) => +(z[name] - start).toFixed(2); // Zeit im geschnittenen Video
const dauer = +(z.ende - start + 0.4).toFixed(2);
const ENDKARTE = 3.2;

// Endkarte: Handy-Bild aus der Aufnahme
const handy = join(ordner, "handy.png");
spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(z.bereit + 0.4), "-i", join(ordner, "roh.webm"), "-frames:v", "1", handy], { stdio: "inherit" });
const karte = join(ordner, "endkarte.png");
const k = spawnSync("node", [join(hier, "endkarte.mjs"), handy, karte], { stdio: "inherit" });
if (k.status !== 0) process.exit(k.status ?? 1);

const text = (name, inhalt) => {
  const p = join(ordner, name);
  writeFileSync(p, inhalt);
  return p;
};

// Frage oben, Sprechertext unten (wie bei TikTok: große Schrift mit Kontur)
const frage = text("t-frage.txt", "Welche Schicht hab ich\nnächsten Samstag?");
const sprecher = [
  { t: [0.3, r("blaettern") + 0.4], s: "Zettel suchen?\nIm Chat scrollen?" },
  { t: [r("blaettern") + 0.6, r("tippen") - 0.1], s: "Oder einfach durch\ndeinen Kalender wischen." },
  { t: [r("tippen") + 0.1, r("tagansicht") - 0.1], s: "Samstag antippen.\nNachtschicht. Fertig." },
  { t: [r("tagansicht") + 0.1, dauer], s: "Mit Uhrzeit:\n22 bis 6 Uhr." },
].map((e, i) => ({ ...e, datei: text(`t-s${i}.txt`, e.s) }));

const dt = (datei, groesse, extra) =>
  `drawtext=fontfile=${SCHRIFT}:textfile=${datei}:fontsize=${groesse}:line_spacing=14:text_align=center:${extra}`;
const kontur = "fontcolor=white:borderw=9:bordercolor=0x101a28";

const teile = [
  `trim=start=${start}:duration=${dauer}`,
  "setpts=PTS-STARTPTS",
  "scale=1080:1920:flags=lanczos",
  "fps=30",
  dt(frage, 70, `box=1:boxcolor=0x14233cE6:boxborderw=34:fontcolor=white:x=(w-text_w)/2:y=330:enable='between(t,0,${r("blaettern") + 1.4})'`),
  ...sprecher.map((e) => dt(e.datei, 68, `${kontur}:x=(w-text_w)/2:y=1330:enable='between(t,${e.t[0]},${e.t[1]})'`)),
  "format=yuv420p",
];

const filter = [
  `[0:v]${teile.join(",")}[a]`,
  `[1:v]scale=1188:2112,zoompan=z='1.1-0.1*on/${ENDKARTE * 30}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${ENDKARTE * 30}:s=1080x1920:fps=30,fade=t=in:st=0:d=0.35,format=yuv420p[b]`,
  "[a][b]concat=n=2:v=1:a=0[v]",
].join(";");

const f = spawnSync(
  "ffmpeg",
  ["-loglevel", "error", "-y", "-i", join(ordner, "roh.webm"), "-i", karte, "-filter_complex", filter, "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", ziel],
  { stdio: "inherit" },
);
process.exit(f.status ?? 1);
