// „Meine Daten herunterladen“ (Migration 0220): Datei kommt im Browser an.
import { APP, neuerBrowser, pruefe, warte } from "./helfer.mjs";

export default async function meineDaten() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/privat/mehr`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(800);
    const knopf = seite.locator("[data-meine-daten] button");
    pruefe((await knopf.count()) === 1, "Mehr: Knopf „Meine Daten herunterladen“");
    const [datei] = await Promise.all([seite.waitForEvent("download", { timeout: 10_000 }), knopf.click()]);
    pruefe(/^shiftnexo-meine-daten-\d{4}-\d{2}-\d{2}\.json$/.test(datei.suggestedFilename()), `Datei heißt richtig (${datei.suggestedFilename()})`);
    const pfad = await datei.path();
    const inhalt = JSON.parse(await (await import("node:fs/promises")).readFile(pfad, "utf8"));
    pruefe(inhalt.privat_konto?.name === "Test", "Datei enthält die Daten");
    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
  } finally {
    await browser.close();
  }
}
