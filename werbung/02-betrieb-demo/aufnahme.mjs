// Nimmt die Live-Demo für Betriebe am PC auf (1280x720, später auf 1920x1080 hochgerechnet).
// Aufruf: STATE=./demo-state.json OUT=./roh node aufnahme.mjs
//   STATE: gespeicherte Anmeldung einer Live-Demo (sonst wird eine neue Demo gestartet).
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const BASE = process.env.BASE ?? "https://shiftnexo.de";
const OUT = process.env.OUT ?? "./roh";
const STATE = process.env.STATE;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  ignoreHTTPSErrors: true,
  locale: "de-DE",
  colorScheme: "light",
  storageState: STATE && existsSync(STATE) ? STATE : undefined,
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
});
// Mauszeiger sichtbar machen und den Demo-Hinweis oben ausblenden (im Video steht „Beispieldaten“).
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const z = document.createElement("div");
    z.id = "zeiger";
    z.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;left:-40px;top:-40px;width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,.35);border:2.5px solid #1d4ed8;box-shadow:0 2px 8px rgba(0,0,0,.25);transform:translate(-50%,-50%);transition:transform .12s";
    document.body.appendChild(z);
    addEventListener("mousemove", (e) => { z.style.left = e.clientX + "px"; z.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { z.style.transform = "translate(-50%,-50%) scale(.7)"; }, true);
    addEventListener("mouseup", () => { z.style.transform = "translate(-50%,-50%)"; }, true);
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(st);
    // Den Demo-Hinweis oben ausblenden, auch wenn er neu gezeichnet wird.
    const weg = () => {
      for (const el of document.querySelectorAll("main p, main div")) {
        if (el.children.length < 6 && /^Live-Demo – alle Personen/.test(el.textContent?.trim() ?? "")) {
          const box = el.closest("[role=status], [role=alert]") ?? el.parentElement ?? el;
          box.style.display = "none";
        }
      }
    };
    weg();
    new MutationObserver(weg).observe(document.body, { childList: true, subtree: true });
  });
});

const t0 = Date.now();
const zeit = {};
const marke = (n) => { zeit[n] = +((Date.now() - t0) / 1000).toFixed(2); };
const page = await ctx.newPage();
const warte = (ms) => page.waitForTimeout(ms);
let maus = { x: 640, y: 360 };
async function hin(locator, klicken = true) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(maus.x, maus.y);
  await page.mouse.move(x, y, { steps: 22 });
  maus = { x, y };
  await warte(250);
  if (klicken) await page.mouse.click(x, y);
}
async function demoHinweisWeg() {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("main *")) {
      if (el.children.length < 6 && /^Live-Demo – alle Personen/.test(el.textContent?.trim() ?? "")) {
        const box = el.closest("[role=status], [role=alert], div");
        (box ?? el).style.display = "none";
        break;
      }
    }
  });
}
async function oeffne(pfad) {
  await page.goto(BASE + pfad, { waitUntil: "networkidle", timeout: 90000 });
  await demoHinweisWeg();
  await warte(400);
}

if (!STATE || !existsSync(STATE)) {
  await page.goto(BASE + "/demo", { waitUntil: "networkidle", timeout: 90000 });
  await page.getByRole("button", { name: "Live-Demo starten" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/demo"), { timeout: 60000 });
  if (STATE) writeFileSync(STATE, JSON.stringify(await ctx.storageState()));
}

// 1) Übersicht
await oeffne("/dashboard");
marke("dashboard");
await page.mouse.move(640, 360);
await hin(page.getByText("Offene Anträge").first(), false);
await warte(1600);
await hin(page.getByText("Kritische Tage").first(), false);
await warte(1600);
marke("dashboard_ende");

// 2) Schichtplan
await oeffne("/schichtplan");
marke("plan");
await warte(1200);
await hin(page.getByRole("button", { name: /Schicht A/ }).first());
await warte(1800);
const zelle = page.locator("tr", { hasText: "Michael Bergmann" }).locator("td button").nth(8);
marke("zelle");
await hin(zelle);
await warte(3000);
marke("plan_ende");

// 3) Urlaubsanträge mit Besetzungsprüfung
await oeffne("/urlaubsantraege");
marke("antraege");
await warte(1200);
const warnung = page.getByText(/Mindestbesetzung gefährdet/).first();
if (await warnung.count()) await hin(warnung, false);
await warte(2600);
await page.mouse.wheel(0, 380);
await warte(2200);
marke("antraege_ende");

// 4) Besetzung
await oeffne("/besetzung");
marke("besetzung");
await warte(1400);
await hin(page.getByText("Frühschicht").first(), false);
await warte(1800);
await page.mouse.wheel(0, 420);
await warte(2200);
marke("ende");

await ctx.close();
await browser.close();
const datei = readdirSync(OUT).filter((f) => f.endsWith(".webm"))[0];
renameSync(`${OUT}/${datei}`, `${OUT}/roh.webm`);
writeFileSync(`${OUT}/zeiten.json`, JSON.stringify(zeit, null, 2));
console.log(zeit);
