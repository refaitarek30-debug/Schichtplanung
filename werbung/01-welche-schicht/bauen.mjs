// Schneidet aus der Aufnahme das fertige Hochformat-Video (1080x1920, 30 fps, ohne Ton).
// Aufruf: node bauen.mjs <ordner-mit-roh.webm> <ausgabe.mp4>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const [ordner = "./roh", ziel = "./video.mp4"] = process.argv.slice(2);
const z = JSON.parse(readFileSync(join(ordner, "zeiten.json"), "utf8"));
const SCHRIFT = process.env.SCHRIFT ?? "/usr/share/fonts/opentype/inter/Inter-Bold.otf";

const start = Math.max(0, z.bereit - 0.2);
const dauer = z.ende - start;
const tipp = z.tippen - start;
const ENDKARTE = 2.8;

const text = (name, inhalt) => {
  const p = join(ordner, name);
  writeFileSync(p, inhalt);
  return p;
};
const frage = text("t-frage.txt", "Welche Schicht hab ich\nnächsten Samstag?");
const antwort = text("t-antwort.txt", "Nachtschicht.\nEin Tipp. Fertig.");
const marke = text("t-marke.txt", "ShiftNexo");
const spruch = text("t-spruch.txt", "Dein Dienstplan.\nDein Kalender.\nDeine Daten.");
const klein = text("t-klein.txt", "Kostenlos · ohne Werbung · ohne E-Mail");
const url = text("t-url.txt", "shiftnexo.de");

const box = "box=1:boxcolor=0x14233cE6:boxborderw=34:fontcolor=white";
const dt = (datei, groesse, extra) =>
  `drawtext=fontfile=${SCHRIFT}:textfile=${datei}:fontsize=${groesse}:line_spacing=16:text_align=center:${extra}`;

const filter = [
  `[0:v]trim=start=${start}:duration=${dauer},setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,fps=30,` +
    dt(frage, 72, `${box}:x=(w-text_w)/2:y=330:enable='between(t,0,${tipp + 0.2})'`) + "," +
    dt(antwort, 84, `${box}:x=(w-text_w)/2:y=330:enable='gte(t,${tipp + 0.9})'`) +
    `,format=yuv420p[a]`,
  `color=c=0x1f5f73:s=1080x1920:d=${ENDKARTE}:r=30,` +
    dt(marke, 96, "fontcolor=white:x=(w-text_w)/2:y=520") + "," +
    dt(spruch, 76, "fontcolor=white:x=(w-text_w)/2:y=720") + "," +
    dt(klein, 40, "fontcolor=0xd5e7ed:x=(w-text_w)/2:y=1120") + "," +
    dt(url, 70, "fontcolor=white:x=(w-text_w)/2:y=1360") +
    `,fade=t=in:st=0:d=0.3,format=yuv420p[b]`,
  `[a][b]concat=n=2:v=1:a=0[v]`,
].join(";");

mkdirSync(join(ziel, ".."), { recursive: true });
const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(ordner, "roh.webm"), "-filter_complex", filter, "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", ziel], { stdio: "inherit" });
process.exit(r.status ?? 1);
