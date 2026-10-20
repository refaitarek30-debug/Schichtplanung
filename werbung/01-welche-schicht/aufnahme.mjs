// Nimmt die App im Handy-Format auf (Beispieldaten, siehe ../beispieldaten-server.mjs).
// Aufruf: BASE=http://localhost:3122 OUT=./roh node aufnahme.mjs
// Playwright wird über PLAYWRIGHT_PATH gefunden, falls es nicht im Projekt installiert ist.
import { mkdirSync, writeFileSync, renameSync, readdirSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
const BASE = process.env.BASE ?? "http://localhost:3122";
const OUT = process.env.OUT ?? "./roh";
mkdirSync(OUT, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const U = "11111111-2222-4333-8444-555555555555";
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: U, role: "authenticated", exp: 4102444800, aud: "authenticated" })}.sig`;
const sitzung = "base64-" + b64({ access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: { id: U, aud: "authenticated" } });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 540, height: 960 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  colorScheme: "light",
  locale: "de-DE",
  bypassCSP: true, // der Beispieldaten-Server läuft auf http://127.0.0.1, die App erlaubt nur https
  recordVideo: { dir: OUT, size: { width: 540, height: 960 } },
});
await ctx.addCookies([{ name: "sb-127-auth-token", value: sitzung, domain: "localhost", path: "/" }]);
// Der Entwicklungs-Knopf von Next.js soll nicht im Video stehen.
await ctx.addInitScript(() => {
  const st = document.createElement("style");
  st.textContent = "nextjs-portal{display:none!important}";
  document.documentElement.appendChild(st);
});
// Fingerabdruck: ein heller Ring dort, wo getippt wird.
await ctx.addInitScript(() => {
  addEventListener("pointerdown", (e) => {
    const r = document.createElement("div");
    r.style.cssText = `position:fixed;z-index:99999;pointer-events:none;left:${e.clientX - 34}px;top:${e.clientY - 34}px;width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid rgba(20,30,60,.35);transform:scale(.5);opacity:1;transition:transform .45s ease-out,opacity .45s ease-out`;
    document.body.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = "scale(1.25)"; r.style.opacity = "0"; });
    setTimeout(() => r.remove(), 600);
  }, true);
});

const t0 = Date.now();
const zeit = {};
const marke = (n) => { zeit[n] = (Date.now() - t0) / 1000; };
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

// Wischen mit dem Finger (echte Touch-Ereignisse)
async function wischen(x, y, dx, dy, schritte = 16) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= schritte; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / schritte, y: y + (dy * i) / schritte }] });
    await page.waitForTimeout(14);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function tippen(locator) {
  const b = await locator.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

await page.goto(`${BASE}/privat`, { waitUntil: "networkidle", timeout: 180000 });
const weiter = page.getByRole("button", { name: "Überspringen" });
if (await weiter.count()) await weiter.click();
await page.waitForTimeout(600);
marke("bereit");

await page.waitForTimeout(1800); // Frage steht im Bild, der Kalender ist schon zu sehen

// Durch die Monate blättern (im Monat wischt man nach oben/unten): vor, zurück
marke("blaettern");
await wischen(270, 760, 0, -420);
await page.waitForTimeout(1100);
await wischen(270, 300, 0, 420);
await page.waitForTimeout(1100);

// Nächster Samstag: 24.10.2026
marke("tippen");
await tippen(page.locator('button[aria-label*="24.10.2026"]').first());
await page.waitForTimeout(2200);

// Tag ansehen
marke("tagansicht");
await tippen(page.getByRole("button", { name: "Tag ansehen" }));
await page.waitForTimeout(2600);
marke("ende");

await ctx.close();
await browser.close();

const datei = readdirSync(OUT).find((f) => f.endsWith(".webm"));
renameSync(`${OUT}/${datei}`, `${OUT}/roh.webm`);
writeFileSync(`${OUT}/zeiten.json`, JSON.stringify(zeit, null, 2));
console.log(zeit);
