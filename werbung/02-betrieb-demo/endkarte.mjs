// Zeichnet die Endkarte im Querformat (1920x1080) mit einem Bild aus der Aufnahme.
// Aufruf: node endkarte.mjs <bild.png> <ausgabe.png>
import { readFileSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const [bild, ziel] = process.argv.slice(2);
const daten = readFileSync(bild).toString("base64");

const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;overflow:hidden;font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:#fff;
  background:radial-gradient(900px 700px at 90% 10%,#3d8fa8 0,transparent 60%),radial-gradient(900px 800px at 0% 100%,#2a4fa0 0,transparent 62%),linear-gradient(160deg,#184a5c 0%,#12384a 55%,#10263f 100%);
  display:grid;grid-template-columns:860px 1fr;align-items:center;padding:0 110px;gap:70px}
.logo{display:flex;align-items:center;gap:24px}
.sn{width:104px;height:104px;border-radius:28px;background:#fff;color:#1f5f73;font-weight:800;font-size:50px;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(0,0,0,.28)}
.name{font-size:76px;font-weight:800;letter-spacing:-1px}
h1{margin-top:48px;font-size:76px;line-height:1.06;font-weight:800;letter-spacing:-1.5px}
h1 span{color:#9fe0f0}
.punkte{margin-top:30px;font-size:34px;line-height:1.5;color:#d4ecf2;font-weight:600}
.cta{display:inline-block;margin-top:44px;background:#fff;color:#14506a;font-weight:800;font-size:44px;padding:24px 58px;border-radius:999px;box-shadow:0 20px 44px rgba(0,0,0,.3)}
.url{margin-top:26px;font-size:46px;font-weight:800;letter-spacing:.5px}
.bild{border-radius:26px;background:#0b1520;padding:12px;transform:rotate(-2deg);box-shadow:0 50px 90px rgba(0,0,0,.5)}
.bild img{display:block;width:100%;border-radius:16px}
</style>
<div>
  <div class="logo"><div class="sn">SN</div><div class="name">ShiftNexo</div></div>
  <h1>Der Schichtplan<br>für euren Betrieb.<br><span>Kostenlos testen.</span></h1>
  <div class="punkte">Pilotphase ohne Zahlungsdaten<br>und ohne Vertragslaufzeit.</div>
  <div class="cta">Pilot starten</div>
  <div class="url">shiftnexo.de/betriebe</div>
</div>
<div class="bild"><img src="data:image/png;base64,${daten}"></div>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.setContent(html);
await p.screenshot({ path: ziel });
await b.close();
