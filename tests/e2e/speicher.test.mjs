// Privatbereich: Start-Paket und Gerätespeicher mit Änderungsstand (Migration 0249) – ist nichts
// geändert, kommt beim Öffnen nur eine Zahl; Schichten, Termine und To-dos bleiben vom Handy.
// Bei einer Änderung kommt alles Nötige in einem Paket statt in vielen Einzelabfragen.
import { APP, DB, neuerBrowser, pruefe, warte } from "./helfer.mjs";

const stand = (wert) => fetch(`${DB}/__test/stand`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wert }) });

export default async function speicher() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  const einzeln = [];
  const pakete = [];
  seite.on("request", (r) => {
    const u = r.url();
    if (r.method() !== "OPTIONS" && /\/rest\/v1\/(privat_tage|rpc\/(meine_termine|privat_feiertage))/.test(u)) einzeln.push(u.split("/rest/v1/")[1].split("?")[0]);
  });
  seite.on("response", async (r) => {
    if (!r.url().includes("/rpc/privat_paket")) return;
    try {
      pakete.push(await r.json());
    } catch {
      pakete.push(null);
    }
  });
  try {
    await stand(7);
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(4500); // Vorrat (nach 3 s) liegt jetzt mit Stand 7 auf dem Gerät
    pruefe(pakete.length === 1 && !!pakete[0]?.jahre && !!pakete[0]?.termine, `Erstes Öffnen: ein Paket mit allem (${pakete.length})`);
    const kalenderText = await seite.locator("[data-rundgang='kalender']").innerText().catch(() => "");

    einzeln.length = 0;
    pakete.length = 0;
    await seite.reload({ waitUntil: "networkidle" });
    await warte(4500);
    pruefe(pakete.length === 1 && pakete[0]?.stand === 7 && !pakete[0]?.jahre, "Nichts geändert: das Paket bringt nur den Stand");
    pruefe(einzeln.length === 0, `Nichts geändert: keine Einzelabfragen für Schichten und Termine (${einzeln.join(", ")})`);
    pruefe((await seite.locator("[data-iso]").count()) > 20, "Kalender steht trotzdem da");
    const jahreGemerkt = await seite.evaluate(() => Object.keys(localStorage).filter((k) => k.includes(":privat:jahr:")).length);
    pruefe(jahreGemerkt >= 3, `Jahre bleiben auf dem Gerät gemerkt (${jahreGemerkt})`);
    pruefe((await seite.locator("[data-rundgang='kalender']").getAttribute("aria-busy")) === "false", "Kalender meldet sich als fertig (nicht „lädt“)");
    pruefe((await seite.locator("[data-rundgang='kalender']").innerText().catch(() => "")) === kalenderText, "Gleicher Inhalt wie mit frischen Daten");

    await stand(8);
    einzeln.length = 0;
    pakete.length = 0;
    await seite.reload({ waitUntil: "networkidle" });
    await warte(4500);
    pruefe(pakete.length === 1 && pakete[0]?.stand === 8 && !!pakete[0]?.jahre && !!pakete[0]?.todos, "Geändert: alles kommt in einem Paket");
    pruefe(einzeln.length <= 2, `Geändert: kaum Einzelabfragen (${einzeln.join(", ")})`);

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
  } finally {
    await stand(null);
    await browser.close();
  }
}
