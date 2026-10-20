// Schneidet aus der Aufnahme das fertige Querformat-Video (1920x1080, 30 fps, ohne Ton):
// vier Szenen mit kurzen Übergängen, Untertitel unten, „Beispieldaten“ in der Ecke, danach die Endkarte.
// Aufruf: node bauen.mjs <ordner-mit-roh.webm> <ausgabe.mp4>
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const [ordner = "./roh", ziel = "./video.mp4"] = process.argv.slice(2);
const hier = fileURLToPath(new URL(".", import.meta.url));
const z = JSON.parse(readFileSync(join(ordner, "zeiten.json"), "utf8"));
const FETT = process.env.SCHRIFT ?? "/usr/share/fonts/opentype/inter/Inter-Bold.otf";
const UEBERGANG = 0.4;
const ENDKARTE = 4;

// Szenen aus der Aufnahme, Ladepausen dazwischen fallen weg. Texte relativ zum Szenenbeginn.
const szenen = [
  { von: z.dashboard - 0.2, bis: z.dashboard_ende, texte: [[0, "Alles auf einen Blick: Anträge, kritische Tage, Krankenstand."]] },
  {
    von: z.plan - 0.1,
    bis: z.plan_ende,
    texte: [
      [0, "Der Schichtplan für alle Gruppen."],
      [z.zelle - z.plan - 0.6, "Schicht ändern mit einem Klick."],
    ],
  },
  { von: z.antraege - 0.1, bis: z.antraege_ende, texte: [[0, "Jeder Antrag wird gegen die Mindestbesetzung geprüft."]] },
  { von: z.besetzung - 0.1, bis: z.ende, texte: [[0, "Besetzung je Schicht: zugeordnet, Soll, Mindest."]] },
].map((s) => ({ ...s, dauer: +(s.bis - s.von).toFixed(2) }));

// Endkarte: Bild aus der Plan-Szene
const bild = join(ordner, "plan.png");
spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(z.plan + 0.6), "-i", join(ordner, "roh.webm"), "-frames:v", "1", bild], { stdio: "inherit" });
const karte = join(ordner, "endkarte.png");
const k = spawnSync("node", [join(hier, "endkarte.mjs"), bild, karte], { stdio: "inherit" });
if (k.status !== 0) process.exit(k.status ?? 1);

const textDatei = (name, inhalt) => {
  const p = join(ordner, name);
  writeFileSync(p, inhalt);
  return p;
};
const dt = (datei, groesse, extra) => `drawtext=fontfile=${FETT}:textfile=${datei}:fontsize=${groesse}:${extra}`;
const marke = textDatei("t-marke.txt", "Beispieldaten");

const filter = [];
szenen.forEach((s, i) => {
  // Szene nach Szene: Text bis kurz vor den Übergang.
  const texte = s.texte.map(([ab, inhalt], j) => {
    const bis = j + 1 < s.texte.length ? s.texte[j + 1][0] : s.dauer - UEBERGANG / 2;
    const datei = textDatei(`t-${i}-${j}.txt`, inhalt);
    return dt(
      datei,
      46,
      `fontcolor=white:box=1:boxcolor=0x14233cE6:boxborderw=26:x=(w-text_w)/2:y=h-150:alpha='min(1,(t-${ab})/0.25)':enable='between(t,${ab},${bis})'`,
    );
  });
  filter.push(
    `[0:v]trim=start=${s.von}:duration=${s.dauer},setpts=PTS-STARTPTS,fps=30,scale=1920:1080:flags=lanczos,` +
      [...texte, dt(marke, 26, "fontcolor=0x55646c:box=1:boxcolor=0xffffffD9:boxborderw=12:x=w-text_w-40:y=h-text_h-36")].join(",") +
      `,format=yuv420p[s${i}]`,
  );
});
filter.push(`[1:v]loop=loop=${ENDKARTE * 30}:size=1:start=0,setpts=N/30/TB,fps=30,format=yuv420p[e]`);

// Übergänge: xfade braucht die Startzeit jedes Übergangs im bisherigen Video.
const teile = [...szenen.map((_, i) => `s${i}`), "e"];
let laenge = szenen[0].dauer;
let vorher = teile[0];
for (let i = 1; i < teile.length; i++) {
  const aus = i === teile.length - 1 ? "v" : `x${i}`;
  filter.push(`[${vorher}][${teile[i]}]xfade=transition=fade:duration=${UEBERGANG}:offset=${(laenge - UEBERGANG).toFixed(2)}[${aus}]`);
  laenge += (i < szenen.length ? szenen[i].dauer : ENDKARTE) - UEBERGANG;
  vorher = aus;
}

const f = spawnSync(
  "ffmpeg",
  ["-loglevel", "error", "-y", "-i", join(ordner, "roh.webm"), "-i", karte, "-filter_complex", filter.join(";"), "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", ziel],
  { stdio: "inherit" },
);
console.log(`Länge etwa ${laenge.toFixed(1)} s`);
process.exit(f.status ?? 1);
