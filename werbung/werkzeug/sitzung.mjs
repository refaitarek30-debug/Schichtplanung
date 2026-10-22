// Gemeinsame Hilfen für die Aufnahmen: Browser mit Beispiel-Sitzung (Handyformat), Tipp-Ring, Wischen.
export async function starte({ OUT, aufnahme = true, BASE = "http://localhost:3123", ohneSitzung = false }) {
  const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const U = "11111111-2222-4333-8444-555555555555";
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: U, role: "authenticated", exp: 4102444800, aud: "authenticated" })}.sig`;
  const sitzung = "base64-" + b64({ access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user: { id: U, aud: "authenticated" } });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: "light", locale: "de-DE",
    timezoneId: "Europe/Berlin", bypassCSP: true,
    ...(aufnahme ? { recordVideo: { dir: OUT, size: { width: 540, height: 960 } } } : {}),
  });
  if (!ohneSitzung) await ctx.addCookies([{ name: "sb-127-auth-token", value: sitzung, domain: "localhost", path: "/" }]);
  await ctx.addInitScript(() => {
    try { localStorage.setItem("schichtplan.einfuehrung", "1"); } catch {}
    addEventListener("pointerdown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;z-index:99999;pointer-events:none;left:${e.clientX - 30}px;top:${e.clientY - 30}px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.6);border:3px solid rgba(20,30,60,.4);transform:scale(.5);opacity:1;transition:transform .45s ease-out,opacity .45s ease-out`;
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(1.3)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const t0 = Date.now();
  const zeit = {};
  return {
    browser, ctx, page, base: BASE,
    marke: (n) => { zeit[n] = (Date.now() - t0) / 1000; },
    zeit,
    async wischen(x, y, dx, dy, schritte = 16) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= schritte; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / schritte, y: y + (dy * i) / schritte }] });
        await page.waitForTimeout(14);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    },
    async tippen(locator) {
      const bx = await locator.boundingBox();
      await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
    },
  };
}
