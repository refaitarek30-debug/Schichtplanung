// Beitritt mit bestehendem Konto (Migration 0194): Code eingeben, Übernahme-Frage, beitreten.
import { APP, DB, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function beitritt() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/privat/mehr`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1000);
    await seite.getByRole("link", { name: /Einem Betrieb beitreten/ }).click();
    await seite.waitForURL(/\/beitreten$/);
    await seite.getByLabel("Code").fill("abcd-2345");
    await seite.getByRole("button", { name: "Weiter" }).click();
    await seite.waitForURL(/\/beitreten\/ABCD2345/);
    await warte(500);
    pruefe(await seite.getByText("Deinen privaten Kalender übernehmen?").isVisible(), "Beitritt: Übernahme-Frage");
    pruefe(await seite.getByText("Testbetrieb").first().isVisible(), "Beitritt: Name des Betriebs");
    pruefe(await seite.getByText("3 Termine").isVisible(), "Beitritt: Zahl der Termine");
    // To-dos nicht übernehmen, eigene Schichten doch.
    await seite.getByText("2 To-dos").click();
    await seite.getByText("Eigene Schichten").click();
    await seite.getByRole("button", { name: "Übernehmen und beitreten" }).click();
    await warte(2000);
    const r = await (await fetch(`${DB}/rest/v1/rpc/_beitritt`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).json();
    pruefe(
      r && r.p_code === "ABCD2345" && r.p_termine === true && r.p_todos === false && r.p_schichten === true,
      `Beitritt: Auswahl kommt an (${JSON.stringify(r)})`,
    );

    await seite.goto(`${APP}/beitreten/FALSCH22`, { waitUntil: "networkidle" });
    pruefe(await seite.getByText("ungültig oder abgelaufen").isVisible(), "Beitritt: falscher Code wird erklärt");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
