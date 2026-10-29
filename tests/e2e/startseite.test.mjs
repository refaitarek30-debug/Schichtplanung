// Startseite Klassisch/Kompakt, Profil-Fenster, Glühbirne, Stammdaten, Geburtsdatum bestätigen.
import { chromium } from "playwright";
import { APP, SITZUNG_COOKIE, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function startseite() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1500 }).catch(() => {});

    // Klassisch (Stand aller bisherigen Konten): großer Knopf, große Kacheln.
    pruefe(await seite.getByText("Urlaubstage verfügbar").first().isVisible(), "Klassisch: große Kachel „Urlaubstage verfügbar“");
    pruefe((await seite.locator('main a[href="/schichtplan?antrag=1"]').count()) === 1, "Klassisch: großer Knopf „Urlaub beantragen“");

    // Geburtsdatum bestätigen (nur Administration, nur wenn etwas offen ist).
    pruefe(await seite.getByText("Geburtsdatum bestätigen").isVisible(), "Admin: Hinweis „Geburtsdatum bestätigen“");
    await seite.getByRole("button", { name: "Bestätigen" }).click();
    await warte(800);
    pruefe((await seite.getByText("Geburtsdatum bestätigen").count()) === 0, "Admin: nach dem Bestätigen verschwunden");

    // Glühbirne: Nachrichtenfeld ohne Leuchten – auch wenn es Neues gibt.
    const birne = seite.locator("[data-neuigkeiten]:visible").first();
    pruefe(
      (await birne.getAttribute("data-neuigkeiten")) === "" && !(await birne.getAttribute("class")).includes("leuchten"),
      "Glühbirne leuchtet nicht (auch bei Neuem)",
    );
    await birne.click();
    await warte(500);
    pruefe(await seite.getByText("Neu bei ShiftNexo").isVisible(), "Glühbirne öffnet „Neu bei ShiftNexo“");
    pruefe((await seite.getByText("NEU", { exact: true }).count()) > 0, "Neues ist in der Liste markiert");
    pruefe(
      (await seite.evaluate(() => document.documentElement.style.overflow)) === "hidden",
      "Glühbirne: Seite dahinter bewegt sich nicht mit",
    );
    await seite.keyboard.press("Escape");
    await warte(400);
    pruefe((await seite.evaluate(() => document.documentElement.style.overflow)) !== "hidden", "Nach dem Schließen: Seite scrollt wieder");
    // Nur auf der Startseite.
    await seite.goto(`${APP}/urlaub`, { waitUntil: "networkidle" });
    await warte(800);
    pruefe((await seite.locator("[data-neuigkeiten]").count()) === 0, "Glühbirne nicht auf anderen Seiten");
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle" });
    await warte(1000);

    // „Mehr“: oben die Kacheln Team, Urlaubssperre, Mitteilungen – darunter der Rest ohne Doppelte.
    await seite.locator("[data-mobile-nav]").getByRole("button", { name: "Mehr" }).click();
    await warte(500);
    const mehr = seite.locator("[data-mehr]");
    const kacheln = await mehr.locator("[data-mehr-kacheln] a").allInnerTexts();
    pruefe(
      kacheln.length === 3 && /^Team/.test(kacheln[0]) && /^Urlaubssperre/.test(kacheln[1]) && /^Mitteilungen/.test(kacheln[2]),
      `Mehr: Kacheln Team, Urlaubssperre, Mitteilungen (${kacheln.map((k) => k.split("\n")[0]).join(", ")})`,
    );
    pruefe(
      (await mehr.locator('ul a[href="/verwaltung"], ul a[href="/mitteilungen"], ul a[href="/altersfreizeit"]').count()) === 0,
      "Mehr: Verwaltung, Mitteilungen, AF nicht doppelt in der Liste",
    );
    pruefe(
      (await mehr.locator('ul a[href="/besetzung"], ul a[href="/ausbildung"]').count()) === 0,
      "Mehr: Besetzung und Ausbildung nicht mehr in der Liste (Reiter im Plan)",
    );
    pruefe((await mehr.locator('ul a[href="/urlaubsantraege"]').count()) === 1, "Mehr: übrige Bereiche (z. B. Urlaubsanträge) weiter da");
    await mehr.getByRole("link", { name: /Urlaubssperre/ }).click();
    await seite.waitForURL(/\/mitteilungen\?bereich=sperren/);
    await warte(1200);
    pruefe(
      (await seite.getByRole("button", { name: "Sperren", pressed: true }).count()) === 1 &&
        (await seite.locator("[data-eintrag]").count()) === (await seite.locator('[data-eintrag="sperre"]').count()),
      "Urlaubssperre: Mitteilungen zeigt gleich nur die Sperren",
    );
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle" });
    await warte(1000);

    // Profil-Fenster: Abmelden oben, Umschalter Startseite.
    await seite.locator("[data-glas-profil]").first().click();
    await warte(500);
    const abmelden = seite.getByRole("button", { name: "Abmelden" });
    const box = await abmelden.boundingBox();
    pruefe(!!box && box.y < 400, `Profil: „Abmelden“ gleich oben sichtbar (y=${box ? Math.round(box.y) : "?"})`);
    await seite.getByRole("radio", { name: "Kompakt" }).click();
    await warte(300);
    await seite.keyboard.press("Escape");
    await warte(800);

    // Kompakt: kleine Kacheln, kein großer Knopf, kleiner Knopf im Plan.
    pruefe((await seite.locator('main a[href="/schichtplan?antrag=1"]').count()) === 1, "Kompakt: nur noch der kleine Knopf (im Plan)");
    const kleinerKnopf = seite.locator('main a[href="/schichtplan?antrag=1"]');
    pruefe((await kleinerKnopf.innerText()).includes("Urlaub beantragen"), "Kompakt: „Urlaub beantragen“ in der Knopfleiste des Plans");
    const knopfY = (await kleinerKnopf.boundingBox())?.y ?? -1;
    const grossY = (await seite.getByRole("button", { name: "Groß" }).first().boundingBox())?.y ?? -2;
    pruefe(Math.abs(knopfY - grossY) < 4, `Kompakt: „Urlaub beantragen“, Legende und Groß in einer Zeile (${Math.round(knopfY)}/${Math.round(grossY)})`);
    pruefe(await seite.locator("[data-urlaub-kompakt]").isVisible(), "Kompakt: neue Urlaubskarte");
    pruefe((await seite.locator("main a[href='/urlaub'] [data-kachel-pfeil]").count()) > 0, "Kompakt: Kacheln mit Pfeil zum Antippen");
    const meinUrlaub = seite.locator("[data-mein-urlaub]");
    pruefe(await meinUrlaub.isVisible(), "Kompakt: „Mein Urlaub“ unten auf der Startseite");
    await meinUrlaub.getByRole("button", { name: /Urlaubskonto/ }).click();
    await warte(500);
    pruefe(await meinUrlaub.getByText(/Resturlaub|verfügbar|übrig/).first().isVisible(), "Mein Urlaub: Urlaubskonto klappt auf");
    const kachelHoehe = (await seite.locator('main a[href="/urlaub"]').first().boundingBox())?.height ?? 999;
    pruefe(kachelHoehe < 110, `Kompakt: Kacheln sind klein (${Math.round(kachelHoehe)} px hoch)`);
    pruefe(await seite.getByText("aus der Betriebsleitung").first().isVisible(), "Kompakt: Mitteilungen stehen weiter darunter");

    // Bleibt nach dem Neuladen (gespeichert).
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1200);
    pruefe((await seite.locator('main a[href="/urlaub"]').first().boundingBox())?.height < 110, "Kompakt: bleibt nach dem Neuladen");

    // Stammdaten selbst eintragen.
    await seite.goto(`${APP}/profil`, { waitUntil: "networkidle" });
    await warte(800);
    await seite.getByLabel("Personalnummer").fill("4711");
    await seite.getByLabel("Abteilung").fill("Logistik");
    await seite.getByRole("button", { name: "Speichern", exact: true }).click();
    await warte(1000);
    pruefe(await seite.getByText("Gespeichert.").first().isVisible(), "Profil: Personalnummer und Abteilung gespeichert");
    pruefe(!(await seite.locator("#birth-date").isDisabled()), "Profil: Geburtsdatum ist änderbar");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }

  // Computer: Kompakt im Raster – Plan links, Mitteilungen rechts.
  const pc = await chromium.launch();
  try {
    const kontext = await pc.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-DE", timezoneId: "Europe/Berlin", bypassCSP: true });
    await kontext.addCookies([SITZUNG_COOKIE]);
    const s = await kontext.newPage();
    await s.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 60_000 });
    await warte(1500);
    const plan = await s.locator('main a[href="/schichtplan?antrag=1"]').boundingBox();
    const mitteilungen = await s.getByText("aus der Betriebsleitung").first().boundingBox();
    await s.screenshot({ path: process.env.BILD_PC ?? "/dev/null" }).catch(() => {});
    pruefe(!!plan && !!mitteilungen && mitteilungen.x > plan.x + 300, "Computer: Plan links, Mitteilungen in der rechten Spalte");
  } finally {
    await pc.close();
  }
}
