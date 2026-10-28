// Ein Konto, zwei Bereiche (Migration 0194): Wechsel Betrieb ↔ Privat, Betriebsschichten
// im Privatbereich, Glühbirne im Privatbereich, Austritt mit „Privat weitermachen?“.
import { APP, DB, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function bereiche() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/meine-schichten`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1500 }).catch(() => {});

    // Betrieb: kein Umschalter im Kalender – der Wechsel steht im Profil-Fenster.
    pruefe((await seite.locator("[data-bereich-schalter]").count()) === 0, "Betrieb: kein Umschalter direkt im Kalender");
    await seite.getByRole("button", { name: /^Profil/ }).first().click();
    await warte(600);
    await seite.locator("[data-zum-privat]").click();
    await warte(600);
    pruefe(await seite.getByText("Dein Privatbereich").isVisible(), "Profil → „Zum Privatbereich wechseln“: Fenster „Dein Privatbereich“");
    pruefe(await seite.getByText("Dein Betrieb sieht davon nichts").isVisible(), "Hinweis zum Datenschutz im Fenster");
    await seite.getByRole("button", { name: "Privatbereich einrichten" }).click();
    await seite.waitForURL(/\/privat$/, { timeout: 15_000 });
    await warte(2000);

    // Privat: gleicher Login, Betriebsschichten nur zum Ansehen.
    pruefe(seite.url().endsWith("/privat"), "Nach dem Einrichten im Privatbereich");
    const frueh = await seite.locator("[data-iso]:visible").filter({ hasText: /^\d+Früh/ }).count();
    pruefe(frueh > 5, `Privat: Betriebsschichten stehen im Kalender (${frueh} Tage „Früh“)`);
    pruefe((await seite.locator("[data-neuigkeiten]:visible").count()) === 1, "Privat: Glühbirne auf der Startseite (Kalender)");
    pruefe((await seite.locator('[data-neuigkeiten="neu"]').count()) === 0, "Privat: Glühbirne leuchtet nicht");
    const frei = await seite.locator("[data-iso]:visible").filter({ hasText: /^\d+Frei/ }).count();
    pruefe(frei > 5, `Privat: freie Tage aus dem Betrieb stehen da (${frei} Tage „Frei“)`);
    await seite.locator("[data-neuigkeiten]:visible").click();
    await warte(500);
    pruefe(await seite.getByText("Einem Betrieb beitreten").first().isVisible(), "Privat: eigene Neuigkeiten in der Liste");
    await seite.keyboard.press("Escape");
    await warte(400);

    // Tag antippen: die Betriebsschicht steht da, nur zum Ansehen.
    await seite.locator("[data-iso]:visible").filter({ hasText: /^\d+Früh/ }).first().click();
    await warte(700);
    pruefe(await seite.getByText("Betrieb · nur ansehen").first().isVisible(), "Privat: Tag zeigt die Betriebsschicht als „nur ansehen“");
    await seite.keyboard.press("Escape");
    await warte(400);

    // Nach dem Wechsel lässt sich jede Seite wieder scrollen (nichts hält sie fest).
    await seite.getByRole("link", { name: "Schichten" }).click();
    await seite.waitForURL(/\/privat\/schichten/);
    await warte(800);
    pruefe(
      (await seite.evaluate(() => document.documentElement.style.overflow + document.body.style.overflow)) === "",
      "Nach dem Wechsel: Seite lässt sich scrollen",
    );

    // Zurück in den Betrieb – über „Mehr“.
    await seite.goto(`${APP}/privat/mehr`, { waitUntil: "networkidle" });
    await warte(600);
    await seite.locator("[data-zum-betrieb]").click();
    await seite.waitForURL(/\/meine-schichten/, { timeout: 15_000 });
    pruefe(true, "Zurück in den Betrieb");

    // Austritt: Zugang deaktiviert → beim nächsten Öffnen die Frage.
    await fetch(`${DB}/rest/v1/rpc/_austritt`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle" });
    await warte(800);
    pruefe(seite.url().includes("/privat-weiter"), `Austritt: Frage „Privat weitermachen?“ (${seite.url()})`);
    pruefe(await seite.getByText("Kommt mit").isVisible(), "Austritt: zeigt, was mitkommt");
    pruefe(await seite.getByText("Krank- und Urlaubsanträge").isVisible(), "Austritt: Krank- und Urlaubsanträge bleiben im Betrieb");
    await seite.getByRole("button", { name: "Privat weitermachen" }).click();
    await seite.waitForURL(/\/privat$/, { timeout: 15_000 });
    await warte(1500);
    await seite.goto(`${APP}/privat/mehr`, { waitUntil: "networkidle" });
    await warte(600);
    pruefe((await seite.locator("[data-zum-betrieb]").count()) === 0, "Nach dem Austritt: kein Wechsel zum Betrieb mehr");
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle" });
    await warte(1500);
    pruefe((await seite.locator("[data-iso]:visible").filter({ hasText: /^\d+Früh/ }).count()) === 0, "Nach dem Austritt: keine Betriebsschichten mehr");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
