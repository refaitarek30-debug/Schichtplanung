// Privatbereich: Gerätespeicher mit Änderungsstand (Migration 0249) – ist nichts geändert,
// kommen Schichten, Termine und To-dos vom Handy, ohne neue Abfragen. Bei einer Änderung wird geladen.
import { APP, DB, neuerBrowser, pruefe, warte } from "./helfer.mjs";

const stand = (wert) => fetch(`${DB}/__test/stand`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wert }) });

export default async function speicher() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  const abfragen = [];
  seite.on("request", (r) => {
    const u = r.url();
    if (r.method() !== "OPTIONS" && /\/rest\/v1\/(privat_tage|rpc\/(meine_termine|privat_feiertage))/.test(u)) abfragen.push(u.split("/rest/v1/")[1].split("?")[0]);
  });
  try {
    await stand(7);
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(4500); // Vorrat (nach 3 s) liegt jetzt mit Stand 7 auf dem Gerät
    pruefe(abfragen.length > 0, `Erstes Öffnen lädt vom Server (${abfragen.length})`);

    abfragen.length = 0;
    await seite.reload({ waitUntil: "networkidle" });
    await warte(4500);
    pruefe(abfragen.length === 0, `Nichts geändert: keine Abfragen für Schichten und Termine (${abfragen.join(", ")})`);
    pruefe((await seite.locator("[data-iso]").count()) > 20, "Kalender steht trotzdem da");

    await stand(8);
    abfragen.length = 0;
    await seite.reload({ waitUntil: "networkidle" });
    await warte(4500);
    pruefe(abfragen.some((a) => a === "privat_tage") && abfragen.includes("rpc/meine_termine"), `Geändert: wird neu geladen (${[...new Set(abfragen)].join(", ")})`);

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
  } finally {
    await stand(null);
    await browser.close();
  }
}
