// Privatbereich: Urlaubsplaner je Feiertag (Brückentage, Hebel, Jahreskalender, Plan kopieren).
import { APP, heute, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function urlaub() {
  const naechstes = heute().jahr + 1;
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/privat/schichten?reiter=urlaub`, { waitUntil: "networkidle", timeout: 120_000 });
    await seite.getByRole("radio", { name: String(naechstes) }).click();
    await warte(1200);
    pruefe((await seite.locator("[data-mein-plan]").count()) === 1, "Urlaubsplaner: „Mein Plan“ steht oben");
    pruefe((await seite.locator("[data-anlass]").count()) >= 1, "Urlaubsplaner: Karten je Feiertag");
    pruefe((await seite.locator("[data-jahreskalender] > div").count()) === 12, "Urlaubsplaner: Jahreskalender mit 12 Monaten");
    const kopf = await seite.locator("[data-plan-kopf]").innerText();
    pruefe(/\d+ freie Tage mit \d+ von 30 Urlaubstagen/.test(kopf), `Kopfzeile: ${kopf}`);

    // Eine Karte abwählen: der Plan wird kürzer.
    const karte = seite.locator("[data-anlass]").first();
    const vorher = Number(kopf.match(/mit (\d+) von/)[1]);
    await karte.getByRole("radio", { name: "aus" }).click();
    await warte(300);
    const nachher = Number((await seite.locator("[data-plan-kopf]").innerText()).match(/mit (\d+) von/)[1]);
    pruefe(nachher < vorher, `Abwählen: weniger Urlaubstage im Plan (${vorher} → ${nachher})`);
    pruefe((await seite.getByRole("button", { name: "Zurück zum Vorschlag" }).count()) === 1, "Abwählen: „Zurück zum Vorschlag“ erscheint");

    // Strategie „Alle Tage nutzen“ verplant mehr Urlaubstage.
    await seite.getByRole("radio", { name: "Alle Tage nutzen" }).click();
    await warte(300);
    const alle = Number((await seite.locator("[data-plan-kopf]").innerText()).match(/mit (\d+) von/)[1]);
    pruefe(alle > vorher, `„Alle Tage nutzen“: mehr Urlaubstage verplant (${alle})`);

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
