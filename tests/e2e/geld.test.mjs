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
    await seite.keyboard.press("Escape");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
