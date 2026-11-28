// Betrieb: Wochenansicht wie der Monat (Frei, Namen, andere Personen, Termine lesbar)
// und „Kalender teilen“ leicht zu finden (Mehr → Kalender teilen).
import { APP, NUTZER, neuerBrowser, pruefe, warte } from "./helfer.mjs";

export default async function wocheBetrieb() {
  const { browser, ctx, seite, seitenFehler } = await neuerBrowser();
  try {
    await ctx.addInitScript((u) => {
      try {
        localStorage.setItem("sp_geraet:" + u + ":betrieb-woche", JSON.stringify({ t: Date.now(), w: true }));
      } catch {}
    }, NUTZER);
    await seite.goto(`${APP}/meine-schichten`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    const weg = seite.getByRole("button", { name: "Überspringen" });
    if (await weg.count()) {
      await weg.first().click();
      await warte(500);
    }
    const woche = seite.locator("[data-woche-spalten]");
    pruefe((await woche.locator("[data-woche-tag]").count()) === 7, "Betrieb: Woche mit 7 Tagen");
    const text = await woche.innerText();
    pruefe(/Frei/.test(text), "Woche zeigt freie Tage wie der Monat");
    pruefe(/Früh|Spät|Nacht/.test(text), `Schichten mit Namen wie im Monat (${text.replace(/\s+/g, " ").slice(0, 120)})`);
    pruefe(/Training/.test(text), "Termin ganz lesbar (nicht „Tr…“)");
    const kopfMitAnderen = await woche.locator("[data-woche-tag]").evaluateAll((els) => els.filter((e) => e.children.length > 1).length);
    pruefe(kopfMitAnderen >= 5, `Schichten der anderen unter dem Datum (${kopfMitAnderen} Tage)`);

    // Teilen: über Mehr erreichbar
    await seite.locator("[data-mobile-nav]").getByRole("button", { name: "Mehr" }).click();
    await warte(500);
    await seite.getByRole("link", { name: /Kalender teilen/ }).click();
    await warte(1500);
    pruefe(await seite.getByRole("dialog", { name: "Kalender teilen" }).isVisible(), "Mehr → „Kalender teilen“ öffnet das Teilen-Blatt");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
  } finally {
    await browser.close();
  }
}
