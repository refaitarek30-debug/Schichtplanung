// Zeichnet die Endkarte (1080x1920) mit einem Handy-Bild aus der Aufnahme.
// Aufruf: node endkarte.mjs <handy-bild.png> <ausgabe.png>
import { readFileSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [bild, ziel] = process.argv.slice(2);
const daten = readFileSync(bild).toString("base64");

const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:#fff;
  background:radial-gradient(900px 700px at 85% 12%,#3d8fa8 0,transparent 60%),radial-gradient(900px 800px at 5% 95%,#2a4fa0 0,transparent 62%),linear-gradient(165deg,#184a5c 0%,#12384a 55%,#10263f 100%);
  display:flex;flex-direction:column;align-items:center;padding-top:100px}
.logo{display:flex;align-items:center;gap:28px}
.sn{width:128px;height:128px;border-radius:34px;background:#fff;color:#1f5f73;font-weight:800;font-size:62px;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(0,0,0,.28)}
.name{font-size:92px;font-weight:800;letter-spacing:-1px}
h1{margin-top:50px;font-size:80px;line-height:1.08;font-weight:800;text-align:center;letter-spacing:-1.5px}
h1 span{color:#9fe0f0}
.handy{margin-top:56px;width:470px;border-radius:70px;background:#0b1520;padding:14px;transform:rotate(-3.5deg);box-shadow:0 50px 90px rgba(0,0,0,.5),0 0 0 2px rgba(255,255,255,.15) inset}
.handy img{display:block;width:100%;height:640px;object-fit:cover;object-position:top;border-radius:58px}
.cta{margin-top:56px;background:#fff;color:#14506a;font-weight:800;font-size:60px;padding:30px 78px;border-radius:999px;box-shadow:0 20px 44px rgba(0,0,0,.3)}
.klein{margin-top:34px;font-size:40px;color:#c9e6ee;font-weight:600}
.url{margin-top:18px;font-size:58px;font-weight:800;letter-spacing:.5px}
</style>
<div class="logo"><div class="sn">SN</div><div class="name">ShiftNexo</div></div>
<h1>Dein Dienstplan.<br>Dein Kalender.<br><span>Deine Daten.</span></h1>
<div class="handy"><img src="data:image/png;base64,${daten}"></div>
<div class="cta">Kostenlos starten</div>
<div class="klein">ohne Werbung · ohne E-Mail</div>
<div class="url">shiftnexo.de</div>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.setContent(html);
await p.screenshot({ path: ziel });
await b.close();
