// Urlaubssperren: auch die Schichtleitung legt sie an und entfernt sie (Mitteilungen → Neue Mitteilung → Urlaubssperre).
import { APP, DB, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

const rolle = (r) =>
  fetch(`${DB}/__test/rolle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rolle: r }) });

export default async function sperren() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await rolle("shift_leader");
    await seite.goto(`${APP}/mitteilungen`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});

    // Anlegen
    await seite.getByRole("button", { name: "Neue Mitteilung" }).click();
    await warte(500);
    const wahl = seite.locator("[data-an-wen]");
    pruefe(await wahl.getByText("Urlaubssperre").isVisible(), "Schichtleitung: „An wen?“ bietet „Urlaubssperre“");
    await wahl.getByText("Urlaubssperre").click();
    await warte(500);
    const form = seite.locator("[data-sperre-form]");
    await form.locator('input[name="start_date"]').fill("2027-03-01");
    await form.locator('input[name="end_date"]').fill("2027-03-05");
    await form.locator('input[name="reason"]').fill("Inventur");
    await form.getByRole("button", { name: "Sperre anlegen" }).click();
    await warte(2000);
    pruefe(await seite.getByText("Urlaubssperre angelegt.").isVisible(), "Schichtleitung: Sperre angelegt");
    const neu = seite.locator('[data-eintrag="sperre"]').filter({ hasText: "Inventur" });
    pruefe((await neu.count()) === 1 && (await neu.getByText("01.03.2027 – 05.03.2027").isVisible()), "Sperre steht in der Liste (01.03.–05.03.2027)");

    // Entfernen
    pruefe(await neu.getByRole("button", { name: "Entfernen" }).isVisible(), "Schichtleitung: „Entfernen“ bei der Sperre");
    await neu.getByRole("button", { name: "Entfernen" }).click();
    await warte(1500);
    pruefe((await seite.locator('[data-eintrag="sperre"]').filter({ hasText: "Inventur" }).count()) === 0, "Schichtleitung: Sperre entfernt");
    pruefe((await seite.locator('[data-eintrag="sperre"]').filter({ hasText: "Stillstand" }).count()) === 1, "andere Sperre bleibt stehen");
    pruefe((await seite.getByRole("alert").filter({ hasText: /konnte nicht/ }).count()) === 0, "keine Fehlermeldung");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await rolle("admin");
    await browser.close();
  }
}
