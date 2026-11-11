// Privatbereich: einmalige Umfrage (Zufriedenheit, Woher, Verbesserung).
import { APP, DB, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function umfrage() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    // Noch nicht fällig: kein Popup.
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(2200);
    pruefe((await seite.locator("[data-umfrage]").count()) === 0, "Umfrage: vor 3 Tagen kein Popup");

    await fetch(`${DB}/rest/v1/rpc/_umfrage_oeffnen`, { method: "POST", body: "{}" });
    await seite.reload({ waitUntil: "networkidle" });
    await warte(2200);
    const dialog = seite.locator("[data-umfrage]");
    pruefe((await dialog.count()) === 1, "Umfrage: Popup erscheint, wenn fällig");
    pruefe(await dialog.getByRole("button", { name: "Absenden" }).isDisabled(), "Umfrage: Absenden erst mit einer Antwort");
    await dialog.getByRole("radio", { name: "Gut" }).click();
    await dialog.getByRole("radio", { name: "TikTok" }).click();
    await dialog.locator("#umfrage-text").fill("Widget für den Startbildschirm");
    await dialog.getByRole("button", { name: "Absenden" }).click();
    await warte(400);
    pruefe((await seite.locator("[data-umfrage-danke]").count()) === 1, "Umfrage: Danke nach dem Absenden");
    const antwort = await (await fetch(`${DB}/rest/v1/rpc/_umfrage`, { method: "POST", body: "{}" })).json();
    pruefe(
      antwort?.p_zufriedenheit === 4 && antwort?.p_quelle === "tiktok" && antwort?.p_verbesserung === "Widget für den Startbildschirm",
      `Umfrage: Antwort gespeichert ${JSON.stringify(antwort)}`,
    );
    await warte(1800);
    pruefe((await seite.locator("[data-umfrage]").count()) === 0, "Umfrage: Popup schließt sich");

    await seite.reload({ waitUntil: "networkidle" });
    await warte(2200);
    pruefe((await seite.locator("[data-umfrage]").count()) === 0, "Umfrage: kommt nur einmal");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
