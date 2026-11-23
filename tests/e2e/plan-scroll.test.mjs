// Schichtplan scrollt durchgehend: das Fenster wächst nach rechts und links, ohne Blättern.
import { chromium } from "playwright";
import { APP, HINWEIS_GESEHEN, SITZUNG_COOKIE, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

const spalten = (seite) => seite.locator("thead th[data-tag]").count();
const ersterTag = (seite) => seite.locator("thead th[data-tag]").first().getAttribute("data-tag");
const box = (seite) => seite.locator("[data-plan-tabelle]").locator("xpath=..");

export default async function planScroll() {
  // Handy
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/schichtplan`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    const anfang = await spalten(seite);
    pruefe(anfang >= 30 && anfang <= 70, `Beim Öffnen kein riesiges Fenster (${anfang} Tage)`);
    // Anfassen: Jetzt bekommt der Plan auch links Luft.
    await box(seite).evaluate((e) => e.dispatchEvent(new Event("pointerdown")));
    await warte(1500);
    const von = await ersterTag(seite);
    const imBildNachLinksWachsen = await box(seite).evaluate((e) => {
      const name = e.querySelector("thead th");
      const rand = e.scrollLeft + name.offsetWidth + 1;
      for (const th of e.querySelectorAll("thead th[data-tag]")) if (th.offsetLeft + th.offsetWidth > rand) return th.dataset.tag;
      return null;
    });
    const heuteIso = new Date().toISOString().slice(0, 10);
    pruefe(von < heuteIso && imBildNachLinksWachsen === heuteIso, `Wachsen nach links lässt das Bild stehen (links ${von}, im Bild ${imBildNachLinksWachsen})`);
    const label = async () => (await seite.getByRole("button", { name: "Nächster Zeitraum" }).locator("xpath=preceding-sibling::span[1]").textContent()) ?? "";
    const label1 = await label();

    // Nach rechts scrollen: Fenster wächst weiter, das Bild springt nicht
    const bx = box(seite);
    const spalteBreite = await seite.locator("thead th[data-tag]").first().evaluate((e) => e.offsetWidth);
    await bx.evaluate((e, b) => (e.scrollLeft = b * 70), spalteBreite);
    await warte(1500);
    const nachRechts = await spalten(seite);
    pruefe(nachRechts > anfang || (await ersterTag(seite)) !== von, `Rechts scrollen: Plan wächst oder wandert mit (${anfang} → ${nachRechts})`);
    const label2 = await label();
    pruefe(label2 !== label1, `Rechts scrollen: Zeitraum oben folgt dem Bild („${label1.trim()}“ → „${label2.trim()}“)`);

    // Sichtbarer Tag ändert sich beim Wachsen nicht von allein
    const tagImBild = () =>
      bx.evaluate((e) => {
        const name = e.querySelector("thead th");
        const rand = e.scrollLeft + name.offsetWidth + 1;
        for (const th of e.querySelectorAll("thead th[data-tag]")) if (th.offsetLeft + th.offsetWidth > rand) return th.dataset.tag;
        return null;
      });
    const t1 = await tagImBild();
    await bx.evaluate((e) => (e.scrollLeft += 600));
    await warte(1200);
    const t2 = await tagImBild();
    pruefe(t1 !== t2, `Weiter rechts: ein anderer Tag steht links (${t1} → ${t2})`);

    // Nach links zurück: auch dort wächst der Plan, ohne dass das Bild springt
    await bx.evaluate((e) => (e.scrollLeft = 0));
    await warte(1500);
    const links = await ersterTag(seite);
    pruefe(links < von, `Links scrollen: Plan reicht weiter in die Vergangenheit (${von} → ${links})`);
    const tNachLinks = await tagImBild();
    pruefe(tNachLinks !== null && tNachLinks < t2, `Links: Bild bleibt an einem früheren Tag stehen (${tNachLinks})`);

    // Pfeil scrollt sanft weiter
    const vorherPfeil = await bx.evaluate((e) => e.scrollLeft);
    await seite.getByRole("button", { name: "Nächster Zeitraum" }).click();
    await warte(900);
    const nachherPfeil = await bx.evaluate((e) => e.scrollLeft);
    pruefe(nachherPfeil > vorherPfeil + 50, `Pfeil rechts scrollt weiter (${Math.round(vorherPfeil)} → ${Math.round(nachherPfeil)})`);

    // Heute: sanft zurück, Fenster bleibt
    await seite.locator("main").getByRole("button", { name: "Heute", exact: true }).first().click();
    await warte(1200);
    const heute = await tagImBild();
    pruefe(Math.abs(new Date(heute).getTime() - Date.now()) < 3 * 864e5, `„Heute“ scrollt zum heutigen Tag (${heute})`);

    // Monat wählen, weit weg: Fenster springt, Plan lädt
    await seite.getByLabel("Monat auswählen").selectOption({ index: 20 });
    await warte(1800);
    const gesprungen = await tagImBild();
    pruefe(gesprungen !== null && gesprungen !== heute, `Monatswahl springt (${gesprungen})`);
    pruefe((await spalten(seite)) >= 30, "Nach dem Sprung steht der Plan");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }

  // Computer: breiter Bildschirm – der Plan scrollt auch dort durch
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, locale: "de-DE", timezoneId: "Europe/Berlin", bypassCSP: true });
    await ctx.addCookies([SITZUNG_COOKIE]);
    await ctx.addInitScript(HINWEIS_GESEHEN);
    const s = await ctx.newPage();
    await s.goto(`${APP}/schichtplan`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    const n = await spalten(s);
    const kasten = box(s);
    const scrollt = await kasten.evaluate((e) => e.scrollWidth > e.clientWidth + 5);
    pruefe(n > 30 && scrollt, `PC: Plan reicht über den Bildschirm hinaus und scrollt (${n} Tage)`);
    const vorher = await kasten.evaluate((e) => e.scrollLeft);
    await s.mouse.move(700, 450);
    await s.mouse.wheel(0, 1500);
    await warte(1200);
    const nachher = await kasten.evaluate((e) => e.scrollLeft);
    pruefe(nachher > vorher, `PC: Mausrad scrollt den Plan zur Seite (${Math.round(vorher)} → ${Math.round(nachher)})`);
    await s.mouse.wheel(0, 3000);
    await warte(1500);
    const n2 = await spalten(s);
    pruefe(n2 >= n, `PC: Plan wächst beim Weiterscrollen mit (${n} → ${n2})`);
  } finally {
    await b.close();
  }
}
