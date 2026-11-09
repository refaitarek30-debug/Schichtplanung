// Handy: Der Rahmen steht fest, nur der Inhalt scrollt – die Seite selbst nie (iOS 26 verschiebt sonst die Leiste).
// Computer: die Seite scrollt wie bisher.
import { chromium } from "playwright";
import { APP, HINWEIS_GESEHEN, SITZUNG_COOKIE, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

const lage = (seite) =>
  seite.evaluate(() => {
    const s = document.querySelector("[data-app-scroller]");
    const nav = document.querySelector("[data-mobile-nav]")?.getBoundingClientRect();
    return {
      fensterY: window.scrollY,
      seitenHoehe: document.documentElement.scrollHeight,
      fensterHoehe: window.innerHeight,
      inhaltY: s ? s.scrollTop : null,
      inhaltLang: s ? s.scrollHeight > s.clientHeight : null,
      navUnten: nav ? nav.bottom : null,
    };
  });

export default async function rahmen() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/einstellungen`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});

    let l = await lage(seite);
    const navStart = l.navUnten;
    pruefe(l.inhaltLang === true, "Handy: Einstellungen sind länger als der Bildschirm");
    pruefe(l.seitenHoehe <= l.fensterHoehe + 1, `Handy: die Seite selbst ist nicht länger als das Fenster (${l.seitenHoehe} / ${l.fensterHoehe})`);

    // Nach unten scrollen, dann die Richtung wechseln (genau das löst den iOS-Fehler aus).
    await seite.mouse.move(200, 400);
    await seite.mouse.wheel(0, 900);
    await warte(600);
    l = await lage(seite);
    pruefe(l.fensterY === 0 && l.inhaltY > 300, `nach unten: nur der Inhalt scrollt (Seite ${l.fensterY}, Inhalt ${l.inhaltY})`);
    pruefe(Math.abs(l.navUnten - navStart) < 1 && l.fensterHoehe - l.navUnten < 40, `nach unten: Leiste bleibt, wo sie war (${l.navUnten} / vorher ${navStart})`);
    await seite.mouse.wheel(0, -400);
    await warte(600);
    l = await lage(seite);
    pruefe(l.fensterY === 0 && Math.abs(l.navUnten - navStart) < 1, `Richtung gewechselt: Leiste bleibt unten, Seite steht (${l.navUnten})`);

    // Seitenwechsel aus der Mitte heraus: die neue Seite beginnt oben.
    await seite.mouse.wheel(0, 900);
    await warte(500);
    await seite.locator("[data-mobile-nav]").getByRole("link", { name: "Urlaub" }).click();
    await seite.waitForURL(/\/urlaub$/);
    await warte(1500);
    l = await lage(seite);
    pruefe(l.inhaltY === 0, `neue Seite beginnt ganz oben (Inhalt ${l.inhaltY})`);

    // Ganz unten: der Fuß (Impressum) ist nicht von der Leiste verdeckt.
    await seite.goto(`${APP}/einstellungen`, { waitUntil: "networkidle" });
    await warte(1000);
    await seite.evaluate(() => {
      const s = document.querySelector("[data-app-scroller]");
      s.scrollTop = s.scrollHeight;
    });
    await warte(500);
    const fuss = await seite.getByRole("link", { name: "Impressum" }).last().boundingBox();
    l = await lage(seite);
    const navOben = await seite.locator("[data-mobile-nav]").evaluate((n) => n.getBoundingClientRect().top);
    pruefe(fuss && fuss.y + fuss.height <= navOben, `ganz unten: Impressum steht über der Leiste (${fuss?.y} / ${navOben})`);

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }

  // Computer: die Seite scrollt wie bisher.
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 800 }, locale: "de-DE", timezoneId: "Europe/Berlin", bypassCSP: true });
    await ctx.addCookies([SITZUNG_COOKIE]);
    await ctx.addInitScript(HINWEIS_GESEHEN);
    const s = await ctx.newPage();
    await s.goto(`${APP}/einstellungen`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1000);
    await s.mouse.move(700, 400);
    await s.mouse.wheel(0, 800);
    await warte(600);
    const l = await lage(s);
    pruefe(l.fensterY > 300, `Computer: die Seite scrollt wie bisher (${l.fensterY})`);
  } finally {
    await b.close();
  }
}
