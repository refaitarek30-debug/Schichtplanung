// Kompakte Startseite: einmaliger Hinweis mit Bildern, kleiner Umschalter auf der Seite, einheitliche Abstände.
import { chromium, devices } from "playwright";
import { APP, SITZUNG_COOKIE, pruefe, seitenText, warte } from "./helfer.mjs";

async function neuerKontext(browser) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "de-DE", timezoneId: "Europe/Berlin", bypassCSP: true });
  await ctx.addCookies([SITZUNG_COOKIE]);
  return ctx;
}

const istKompakt = (seite) => seite.locator("main a[href='/urlaub'] [data-kachel-pfeil]").count().then((n) => n > 0);

export default async function kompakt() {
  const browser = await chromium.launch();
  try {
    // 1) Nicht jetzt: nichts ändert sich, der Hinweis kommt nicht wieder.
    let ctx = await neuerKontext(browser);
    let seite = await ctx.newPage();
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(e.message));
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 120_000 });
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1500 }).catch(() => {});
    await seite.locator("[data-kompakt-hinweis]").waitFor({ timeout: 8000 }).catch(() => {});
    pruefe(await seite.locator("[data-kompakt-hinweis]").isVisible().catch(() => false), "Hinweis: Fenster „Neu: Kompakte Startseite“ erscheint einmal");
    pruefe(
      (await seite.locator("[data-kompakt-hinweis] button[aria-pressed]").count()) === 2 &&
        (await seite.locator('[data-kompakt-hinweis] [role="radiogroup"]').count()) === 1,
      "Hinweis: zwei Bilder zum Vergleichen und ein kleiner Umschalter",
    );
    await seite.getByRole("button", { name: "Nicht jetzt" }).click();
    await warte(500);
    pruefe((await seite.locator("[data-kompakt-hinweis]").count()) === 0, "Hinweis: „Nicht jetzt“ schließt");
    pruefe(!(await istKompakt(seite)), "Hinweis: „Nicht jetzt“ lässt die Startseite klassisch");
    await seite.reload({ waitUntil: "networkidle" });
    await warte(4000);
    pruefe((await seite.locator("[data-kompakt-hinweis]").count()) === 0, "Hinweis: kommt nach dem Schließen nicht wieder");

    // 2) Kleiner Umschalter direkt auf der Startseite.
    const schalter = seite.locator('main [role="radiogroup"][aria-label="Startseite"]').first();
    pruefe(await schalter.isVisible(), "Startseite: kleiner Umschalter „Klassisch | Kompakt“ steht unter der Begrüßung");
    const hoehe = (await schalter.boundingBox())?.height ?? 999;
    pruefe(hoehe <= 34, `Umschalter ist klein (${Math.round(hoehe)} px hoch)`);
    await schalter.getByRole("radio", { name: "Kompakt" }).click();
    await warte(800);
    pruefe(await istKompakt(seite), "Umschalter: „Kompakt“ stellt sofort um");

    // 3) Einheitliche Abstände in der kompakten Ansicht.
    const luecken = await seite.evaluate(() => {
      const kopf = document.querySelector("header.dash-kopf");
      const kacheln = kopf?.nextElementSibling;
      const raster = kacheln?.nextElementSibling;
      if (!kopf || !kacheln || !raster) return null;
      const r = (el) => el.getBoundingClientRect();
      const faecher = [...raster.children].filter((c) => r(c).height > 0);
      const l = [r(kacheln).top - r(kopf).bottom, r(raster).top - r(kacheln).bottom];
      for (let i = 1; i < faecher.length; i++) l.push(r(faecher[i]).top - r(faecher[i - 1]).bottom);
      return l.map((x) => Math.round(x));
    });
    pruefe(
      !!luecken && luecken.length >= 3 && luecken.every((x) => Math.abs(x - 16) <= 1),
      `Kompakt: alle Abstände zwischen den Blöcken 16 px (${luecken?.join(", ")})`,
    );

    await schalter.getByRole("radio", { name: "Klassisch" }).click();
    await warte(800);
    pruefe(!(await istKompakt(seite)), "Umschalter: „Klassisch“ stellt zurück");
    await ctx.close();

    // 4) Übernehmen: neues Gerät (kein „gesehen“ gemerkt), Hinweis → Kompakt übernehmen.
    ctx = await neuerKontext(browser);
    seite = await ctx.newPage();
    seite.on("pageerror", (e) => fehler.push(e.message));
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 120_000 });
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1500 }).catch(() => {});
    await seite.locator("[data-kompakt-hinweis]").waitFor({ timeout: 8000 }).catch(() => {});
    pruefe(await seite.locator("[data-kompakt-hinweis]").isVisible().catch(() => false), "Neues Gerät: Hinweis erscheint wieder");
    await seite.locator('[data-kompakt-hinweis] [role="radiogroup"]').getByRole("radio", { name: "Klassisch" }).click();
    await seite.locator('[data-kompakt-hinweis] [role="radiogroup"]').getByRole("radio", { name: "Kompakt" }).click();
    await seite.getByRole("button", { name: "Übernehmen" }).click();
    await warte(900);
    pruefe((await seite.locator("[data-kompakt-hinweis]").count()) === 0 && (await istKompakt(seite)), "Hinweis: „Übernehmen“ stellt auf Kompakt um");
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1200);
    pruefe(await istKompakt(seite), "Hinweis: Kompakt bleibt nach dem Neuladen");

    pruefe(fehler.length === 0, `keine Skriptfehler ${fehler.join(" | ")}`);
    if (fehler.length) console.log("   Seite:", await seitenText(seite));
    await ctx.close();
  } finally {
    await browser.close();
  }
}
