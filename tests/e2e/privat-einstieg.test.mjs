// Privatbereich: vom leeren Kalender zum ersten Plan – „Wie arbeitest du?“, Folge in zwei Tipps,
// „Fertig!“, Teilen-Karte und die Erinnerung an die Schicht in den Mitteilungen.
import { APP, DB, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function privatEinstieg() {
  // Neue Konten starten nur mit Arbeit, Urlaub, Arzt, Krank (Migration 0245): Früh/Spät/Nacht/Frei fehlen.
  await fetch(`${DB}/rest/v1/privat_schichtarten?kuerzel=in.(F,S,N,X)`, { method: "DELETE" });
  const { browser, seite, seitenFehler } = await neuerBrowser({ einstieg: true, willkommen: true });
  try {
    // Noch nichts geteilt: so tun, als gäbe es keine Personen und Verbindungen.
    await seite.route("**/rest/v1/rpc/meine_personen", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await seite.route("**/rest/v1/rpc/meine_verbindungen", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1000);

    // Erster Start: Darstellung wählen, dann vier Stationen Rundgang, erst danach „Wie arbeitest du?“.
    pruefe(await seite.locator("[data-willkommen]").isVisible(), "Erster Start: „Wie soll ShiftNexo aussehen?“");
    pruefe((await seite.locator("[data-einstieg]").count()) === 0, "Erster Start: Einstieg wartet");
    await seite.getByRole("radio", { name: /Dunkel/ }).click();
    pruefe((await seite.evaluate(() => document.documentElement.getAttribute("data-theme"))) === "dark", "Erster Start: Dunkel sofort sichtbar");
    await seite.getByRole("radio", { name: /Wie Handy/ }).click();
    await seite.locator("[data-willkommen-weiter]").click();
    for (const n of [1, 2, 3, 4]) {
      pruefe((await seite.locator(`[data-rundgang-schritt="${n}"]`).count()) === 1, `Rundgang: Station ${n}`);
      await seite.locator("[data-willkommen-weiter]").click();
      await warte(150);
    }
    pruefe(await seite.evaluate(() => localStorage.getItem("sp_willkommen") === "1"), "Rundgang: einmal pro Gerät gemerkt");
    await warte(300);
    const karte = seite.locator("[data-einstieg]");
    pruefe(await karte.isVisible(), `Leerer Kalender: „Wie arbeitest du?“ (${await seitenText(seite)})`);
    pruefe((await seite.locator("[data-hinweis-streifen]").count()) === 0, "Einstieg: kein schmaler Streifen daneben");
    pruefe((await seite.locator("[data-teilen-karte]").count()) === 0, "Ohne Plan: keine Teilen-Karte");

    // „Später“: weg, dafür der Streifen. Beim nächsten Öffnen noch einmal.
    await karte.getByRole("button", { name: "Später" }).click();
    await warte(300);
    pruefe((await karte.count()) === 0, "Später: Karte zu");
    pruefe(await seite.locator("[data-hinweis-streifen]").isVisible(), "Später: schmaler Streifen bleibt");
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1000);
    pruefe(await seite.locator("[data-einstieg]").isVisible(), "Nächstes Öffnen: Karte kommt noch einmal");

    // Folge in zwei Tipps.
    await seite.locator("[data-einstieg]").getByRole("button", { name: /Immer gleiche Folge/ }).click();
    await warte(500);
    const vorlage = seite.locator("[data-vorlagen] button").first();
    pruefe(await vorlage.isVisible(), "Folge: Vorlagen als Farbstreifen");
    await vorlage.click();
    await warte(1500);
    pruefe((await vorlage.getAttribute("aria-pressed")) === "true", "Folge: Vorlage gewählt");
    const angelegt = (await (await fetch(`${DB}/rest/v1/privat_schichtarten`)).json()).map((a) => a.kuerzel);
    pruefe(["F", "S", "N", "X"].every((k) => angelegt.includes(k)), `Folge: fehlende Schichten von selbst angelegt (${angelegt.join(",")})`);
    const heuteKnopf = seite.locator("[data-start-tage] button", { hasText: "Heute" });
    pruefe((await heuteKnopf.getAttribute("aria-pressed")) === "true", "Startdatum: Heute ist vorgewählt");
    pruefe((await seite.locator("[data-start-tage] button").count()) === 8, "Startdatum: 7 Tage + anderer Tag");
    await seite.getByRole("button", { name: /^Eintragen bis/ }).click();
    await warte(1000);

    const fertig = seite.locator("[data-fertig]");
    pruefe(await fertig.isVisible(), `Nach dem Eintragen: „Fertig!“ (${await seitenText(seite)})`);
    pruefe(/Fertig! \d+ Tage eingetragen/.test(await fertig.innerText()), "Fertig: Zahl der Tage");
    // Testbrowser = iPhone im Safari-Tab: Frage kommt, danach der Hinweis zum Home-Bildschirm.
    pruefe(await seite.getByText("Soll ich dich an deine Schichten erinnern?").isVisible(), "Fertig: Frage nach der Erinnerung");
    pruefe(await seite.locator('input[name="schicht-erinnerung"]').first().isChecked(), "Fertig: Abend vorher ist vorgewählt");
    await seite.getByRole("button", { name: "Erinnerung einschalten" }).click();
    await warte(600);
    pruefe(await seite.getByText("Erinnerung ist eingestellt.").isVisible(), "Erinnerung: eingestellt, mit Hinweis");
    pruefe(await seite.getByText(/Zum Home-Bildschirm/).isVisible(), "Erinnerung: Hinweis Home-Bildschirm");
    await seite.getByRole("button", { name: "Zum Kalender" }).click();
    await warte(600);
    pruefe((await seite.locator("[data-einstieg]").count()) === 0, "Mit Plan: keine Einstiegskarte mehr");

    // Teilen-Karte direkt nach dem ersten Plan.
    const teilen = seite.locator("[data-teilen-karte]");
    pruefe(await teilen.isVisible(), "Plan steht: Teilen-Karte");
    await teilen.getByRole("button", { name: "Familie" }).click();
    await warte(500);
    pruefe(await seite.getByText("Person einladen").isVisible(), "Teilen-Karte: Einladen öffnet sich");
    await seite.keyboard.press("Escape");
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1000);
    await seite.locator("[data-teilen-karte]").getByRole("button", { name: "Hinweis schließen" }).click();
    await warte(300);
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1000);
    pruefe((await seite.locator("[data-teilen-karte]").count()) === 0, "Teilen-Karte: ✕ schließt für immer");

    // Einstellung in Mehr → Mitteilungen.
    await seite.goto(`${APP}/privat/mehr`, { waitUntil: "networkidle" });
    await warte(600);
    await seite.getByRole("button", { name: /Mitteilungen/ }).first().click();
    await warte(500);
    const wahl = seite.locator("select", { has: seite.locator('option[value="vortag18"]') });
    pruefe(await wahl.isVisible(), "Mitteilungen: Erinnerung an meine Schicht");
    await wahl.selectOption("vortag18");
    await warte(400);
    await seite.reload({ waitUntil: "networkidle" });
    await warte(600);
    await seite.getByRole("button", { name: /Mitteilungen/ }).first().click();
    await warte(500);
    pruefe((await seite.locator("select", { has: seite.locator('option[value="vortag18"]') }).inputValue()) === "vortag18", "Erinnerung: gespeichert");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
  } finally {
    await browser.close();
  }
}
