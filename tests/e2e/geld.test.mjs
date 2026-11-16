// Privatbereich: Geld je Job (Minijob netto, Nachtzuschlag 23–24 Uhr) und andere Uhrzeit an einem Tag.
import { APP, DB, heute, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

const euro = (n) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export default async function geld() {
  const jetzt = heute();
  const monat = jetzt.iso.slice(0, 8);
  // Eine Tankstellenschicht 18–24 Uhr (6 Std) an vier Tagen, dazu zwei Frühschichten (Ausbildung).
  await fetch(`${DB}/rest/v1/privat_schichtarten`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Tanke", kuerzel: "T", farbe: "#F76B15", art: "arbeit", beginn: "18:00:00", ende: "00:00:00", stunden: 6, reihenfolge: 7 }),
  });
  const arten = await (await fetch(`${DB}/rest/v1/privat_schichtarten`)).json();
  const tanke = arten.find((a) => a.name === "Tanke");
  const frueh = arten.find((a) => a.name === "Früh");
  const tage = [
    ...["02", "04", "06", "08"].map((t) => ({ tag: monat + t, ebene: 1, schichtart_id: tanke.id })),
    ...["10", "11"].map((t) => ({ tag: monat + t, ebene: 1, schichtart_id: frueh.id })),
  ];
  await fetch(`${DB}/rest/v1/privat_tage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(tage) });

  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/privat/schichten?reiter=geld`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1200);
    pruefe((await seite.locator('[data-assistent="art"]').count()) === 1, "Geld: beim ersten Mal startet der Assistent");

    await seite.getByLabel("Name des Jobs").fill("Tankstelle");
    await seite.getByRole("button", { name: "Weiter" }).click();
    await seite.locator("#assistent-lohn").fill("13,90");
    await seite.getByRole("button", { name: "Weiter" }).click();
    pruefe((await seite.locator('[data-assistent="schichten"]').count()) === 1, "Assistent: Schritt Schichten");
    await seite.locator("[data-schicht-wahl]").getByRole("checkbox", { name: /Tanke/ }).click();
    await seite.getByRole("button", { name: "Weiter" }).click();
    await seite.locator("#assistent-nacht").fill("25");
    await seite.locator("#assistent-nacht-von").fill("23");
    await seite.locator("#assistent-nacht-bis").fill("24");
    await warte(200);
    pruefe(/1 Std mit 25 % Nachtzuschlag/.test(await seite.locator("[data-uhr-band]").innerText()), "Assistent: Uhr-Band zeigt 1 Std Nachtzuschlag");
    await seite.getByRole("button", { name: "Fertig" }).click();
    await warte(500);

    // 4 × 6 Std × 13,90 € = 333,60 €, Nacht 4 × 1 Std × 3,475 € = 13,90 € -> 347,50 €. Frühschichten zählen nicht.
    const karte = seite.locator('[data-job-karte="Tankstelle"]');
    pruefe((await karte.count()) === 1, "Geld: Karte Tankstelle");
    const betrag = await karte.locator("[data-job-betrag]").innerText();
    pruefe(betrag.trim() === euro(347.5), `Tankstelle: ausgezahlt ${euro(347.5)} (ist ${betrag})`);
    pruefe(/Minijob · netto/.test(await karte.innerText()), "Tankstelle: als Minijob netto");
    pruefe((await karte.locator("[data-minijob-grenze]").count()) === 1, "Tankstelle: Minijob-Grenze sichtbar");
    pruefe(/333,60\s€ von/.test(await karte.locator("[data-minijob-grenze]").innerText()), "Grenze: zählt nur den Grundlohn");

    // Andere Uhrzeit an einem Tag: 17:00–23:30 statt 18–24.
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle" });
    await warte(1200);
    await seite.locator(`[data-iso="${monat}02"]`).first().click();
    await warte(800);
    const zeile = seite.locator("[data-andere-uhrzeit] li").first();
    await zeile.getByRole("button", { name: "Andere Zeit" }).click();
    await zeile.getByLabel("Beginn").fill("17:00");
    await zeile.getByLabel("Ende").fill("23:30");
    await zeile.getByRole("button", { name: "Speichern" }).click();
    await warte(800);
    pruefe(/17:00–23:30/.test(await zeile.innerText()) && /heute anders/.test(await zeile.innerText()), "Tag: andere Uhrzeit gespeichert");
    const gespeichert = await (await fetch(`${DB}/rest/v1/privat_tag_zeiten`)).json();
    pruefe(gespeichert.length === 1 && gespeichert[0].beginn.startsWith("17:00"), "Tag: Uhrzeit in der Datenbank");

    // 24,5 Std × 13,90 = 340,55 €; Nacht 3,5 Std × 3,475 = 12,16 € -> 352,71 €.
    await seite.goto(`${APP}/privat/schichten?reiter=geld`, { waitUntil: "networkidle" });
    await warte(1200);
    const neu = await seite.locator('[data-job-karte="Tankstelle"] [data-job-betrag]').innerText();
    pruefe(neu.trim() === euro(352.71), `Geld rechnet mit der Uhrzeit des Tages: ${euro(352.71)} (ist ${neu})`);

    // Einstellungen: Job-Blatt öffnet, Zuordnung sichtbar.
    await seite.getByRole("button", { name: /Lohn, Zuschläge, Schichten/ }).click();
    await warte(500);
    pruefe((await seite.locator("[data-job-blatt]").count()) === 1, "Job-Einstellungen öffnen");

    // Festes Monatsgehalt: Stundenlohn für Zuschläge von selbst (37,5 Std), Zuschläge auch in € je Stunde.
    await seite.getByRole("radiogroup", { name: "Art des Jobs" }).getByRole("radio", { name: "Normal" }).click();
    await seite.getByRole("radiogroup", { name: "Bezahlung" }).getByRole("radio", { name: "Monatsgehalt" }).click();
    await seite.locator("#job-gehalt").fill("3989");
    await seite.locator("#job-gehalt").press("Tab");
    await warte(300);
    pruefe((await seite.locator("#job-stundenwert").getAttribute("placeholder")) === "24,55", "Monatsgehalt: Stundenlohn für Zuschläge ohne Wochenstunden (3.989 € ÷ 162,5 Std)");
    await seite.getByRole("radiogroup", { name: "Zuschläge" }).getByRole("radio", { name: "€ je Stunde" }).click();
    await seite.locator("#job-nacht").fill("5,25");
    await seite.locator("#job-nacht").press("Tab");
    await warte(300);
    await seite.keyboard.press("Escape");
    await warte(500);
    // Normaler Job = Hauptjob: steht ganz in der Lohn-Rechnung, keine eigene Karte mehr.
    const rechnung = await seite.locator("[data-lohn-details]").innerText();
    pruefe(/Grundgehalt/.test(rechnung) && /\d+ Schichten/.test(rechnung) && !/^0 Schichten/m.test(rechnung), "Monatsgehalt: Rechnung zeigt Grundgehalt und die Schichten");
    pruefe(/Nacht 5,25\s€\/Std/.test(rechnung), "Lohn: Nachtzuschlag in € je Stunde wie auf der Abrechnung");
    pruefe((await seite.locator("[data-lohn-hinweis]").count()) === 0, "Lohn: kein Hinweis auf Wochenstunden mehr nötig");
    pruefe((await seite.locator('[data-job-karte="Tankstelle"]').count()) === 0, "Hauptjob: keine doppelte Karte");

    // Lohn: Auszahlung nach Steuer und Abgaben, Steuerklasse, Monat speichern, Jahresübersicht.
    const zahl = (t) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
    const netto1 = zahl(await seite.locator("[data-lohn-netto]").innerText());
    pruefe(netto1 > 2000 && netto1 < 3989, `Lohn: Auszahlung ca. unter Brutto (${netto1})`);
    await seite.getByRole("button", { name: /Steuerklasse 1/ }).click();
    await warte(400);
    await seite.locator("[data-steuer-blatt]").getByRole("radio", { name: "3" }).click();
    await warte(300);
    await seite.keyboard.press("Escape");
    await warte(500);
    const netto3 = zahl(await seite.locator("[data-lohn-netto]").innerText());
    pruefe(netto3 > netto1, `Lohn: Steuerklasse 3 bringt mehr netto (${netto3} > ${netto1})`);
    await seite.locator("[data-lohn-speichern]").click();
    await warte(300);
    pruefe(/gespeichert/.test(await seite.locator("[data-lohn-speichern]").innerText()), "Lohn: Monat gespeichert");
    await seite.locator("#lohn-echt").fill("2800");
    await seite.locator("#lohn-echt").press("Tab");
    await warte(300);
    await seite.getByRole("radiogroup", { name: "Ansicht" }).getByRole("radio", { name: "Jahr" }).click();
    await warte(400);
    const jahrText = await seite.locator("[data-lohn-jahr]").first().innerText();
    pruefe(/2\.800/.test(jahrText) && /1 von 12 Monaten/.test(jahrText), "Lohn: Jahresübersicht zeigt den Monat mit dem echten Betrag");
    const gemerkt = await seite.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sp_lohn:")).length);
    pruefe(gemerkt === 1, "Lohn: bleibt nur auf dem Gerät (lokaler Speicher)");

    // Kachel „Lohn“ und Lohn-Seite: derselbe Monat (vorheriger Monat über ?monat=).
    await seite.goto(`${APP}/privat/schichten`, { waitUntil: "networkidle" });
    await warte(1200);
    await seite.getByRole("button", { name: "Vorheriger Monat" }).first().click().catch(() => {});
    await warte(1200);
    const lohnLink = seite.locator('a[href*="reiter=geld"]').first();
    const href = (await lohnLink.getAttribute("href")) ?? "";
    pruefe(/monat=\d{4}-\d{2}/.test(href), `Kachel Lohn: Link mit Monat (${href})`);
    const kachelBetrag = (await lohnLink.innerText()).match(/[\d.]+\s€/)?.[0] ?? "";
    await lohnLink.click();
    await seite.waitForURL(/reiter=geld/);
    await warte(1500);
    const seiteBetrag = Math.round(zahl(await seite.locator("[data-lohn-netto]").innerText()));
    pruefe(kachelBetrag !== "" && zahl(kachelBetrag.replace(".", "")) === seiteBetrag, `Kachel und Lohn-Seite gleich (${kachelBetrag} / ${seiteBetrag})`);

    // „Mehr“ (Entwurf B): Kacheln oben, Einstellungen öffnen als Blatt.
    await seite.goto(`${APP}/privat/mehr`, { waitUntil: "networkidle" });
    await warte(800);
    pruefe((await seite.locator("[data-mehr-kacheln] > *").count()) === 4, "Mehr: vier Kacheln oben");
    await seite.getByRole("button", { name: /Feiertage/ }).click();
    await warte(500);
    pruefe(await seite.locator("#privat-bundesland").isVisible(), "Mehr: Feiertage öffnen Bundesland im Blatt");
    await seite.keyboard.press("Escape");
    await warte(400);

    // Woche in 7 Spalten.
    await seite.evaluate(() => localStorage.setItem("schichtplan.privat-ansicht", "woche"));
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle" });
    await warte(1200);
    pruefe((await seite.locator("[data-woche-spalten] [data-woche-tag]").count()) === 7, "Woche: 7 Spalten");
    pruefe((await seite.locator("[data-woche-summe]").count()) === 0, "Woche: ohne Summe unten, Raster füllt die Höhe");
    // Lange in ein freies Feld drücken: neuer Termin zu dieser Uhrzeit.
    const spalte = seite.locator("[data-woche-spalten] [data-iso]").nth(10);
    const box = await spalte.boundingBox();
    await seite.mouse.move(box.x + box.width / 2, box.y + box.height * 0.75);
    await seite.mouse.down();
    await warte(800);
    await seite.mouse.up();
    await warte(800);
    pruefe((await seite.locator('[aria-label="Neuer Termin"]').count()) >= 1, "Woche: lange drücken öffnet „Neuer Termin“");
    await seite.getByRole("button", { name: "Schließen", exact: true }).last().click();
    await warte(500);
    // Pinsel auch in der Woche.
    pruefe((await seite.locator("[data-pinsel-knopf], button[aria-label*='Pinsel']").count()) >= 1, "Woche: Pinsel-Knopf da");
    pruefe((await seite.locator("[data-woche-spalten] [data-woche-tag]").count()) === 7, "Woche: Zeitraster mit 7 Spalten");
    // Nächste Woche, dann unten noch mal „Kalender“: zurück zu heute.
    const vorher = await seite.locator("[data-woche-tag]").first().getAttribute("data-woche-tag");
    await seite.mouse.move(300, 500);
    await seite.mouse.down();
    await seite.mouse.move(80, 505, { steps: 6 });
    await seite.mouse.up();
    await warte(700);
    const danach = await seite.locator("[data-woche-tag]").first().getAttribute("data-woche-tag");
    await seite.getByRole("link", { name: "Kalender" }).click();
    await warte(700);
    const zurueck = await seite.locator("[data-woche-tag]").first().getAttribute("data-woche-tag");
    pruefe(danach !== vorher && zurueck === vorher, `Kalender erneut antippen: zurück zu heute (${vorher} → ${danach} → ${zurueck})`);
    await seite.evaluate(() => localStorage.setItem("schichtplan.privat-ansicht", "monat"));

    // Countdown: nächste Schicht und eigene Countdowns.
    await seite.goto(`${APP}/privat/countdown`, { waitUntil: "networkidle" });
    await warte(1200);
    pruefe((await seite.locator("[data-countdown-schicht]").count()) === 1, "Countdown: nächste Schicht");
    await seite.locator("[data-countdown-neu]").click();
    await warte(500);
    await seite.getByLabel("Titel").fill("Konzert");
    await seite.getByRole("button", { name: "Countdown starten" }).click();
    await warte(600);
    pruefe(/Konzert/.test(await seite.locator("[data-countdown]").innerText()), "Countdown: eigener Countdown erscheint");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
