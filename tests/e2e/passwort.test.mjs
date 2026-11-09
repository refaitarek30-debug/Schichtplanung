// Profil: das eigene Passwort ändern (altes Passwort wird geprüft, neues gesetzt).
import { APP, DB, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

const gesetzt = () => fetch(`${DB}/__test/passwort`).then((r) => r.json());

export default async function passwort() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/profil`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1000);
    const form = seite.locator("[data-passwort-aendern]");
    pruefe(await form.isVisible(), "Profil: Karte „Passwort ändern“ ist da");

    const fuelle = async (aktuell, neu, wiederholt) => {
      await form.locator('input[name="current_password"]').fill(aktuell);
      await form.locator('input[name="password"]').fill(neu);
      await form.locator('input[name="password_repeat"]').fill(wiederholt);
      await form.getByRole("button", { name: "Passwort ändern" }).click();
      await warte(1500);
    };

    // 1) Die beiden neuen Passwörter sind verschieden.
    await fuelle("altes-passwort", "neues-passwort-1", "neues-passwort-2");
    pruefe(await seite.getByText("stimmen nicht überein").isVisible(), "verschiedene neue Passwörter: Hinweis");
    pruefe((await gesetzt()).passwort === null, "… nichts wurde gesetzt");

    // 2) Aktuelles Passwort falsch.
    await fuelle("falsches-passwort", "neues-passwort-1", "neues-passwort-1");
    pruefe(await seite.getByText("Das aktuelle Passwort ist falsch.").isVisible(), "falsches aktuelles Passwort: Fehlermeldung");
    pruefe((await gesetzt()).passwort === null, "… nichts wurde gesetzt");

    // 3) Neues gleich dem alten.
    await fuelle("altes-passwort", "altes-passwort", "altes-passwort");
    pruefe(await seite.getByText("muss sich vom aktuellen unterscheiden").isVisible(), "neues = altes: Hinweis");
    pruefe((await gesetzt()).passwort === null, "… nichts wurde gesetzt");

    // 4) Alles richtig.
    await fuelle("altes-passwort", "neues-passwort-1", "neues-passwort-1");
    pruefe(await seite.getByText("Passwort geändert.").isVisible(), "richtige Eingaben: „Passwort geändert.“");
    const stand = await gesetzt();
    pruefe(stand.passwort === "neues-passwort-1" && stand.mitAltem === "altes-passwort", "… das neue Passwort wurde gesetzt");
    pruefe(
      (await form.locator('input[name="current_password"]').inputValue()) === "",
      "… die Felder sind danach leer",
    );
    pruefe(/\/profil$/.test(seite.url()), "… man bleibt angemeldet auf dem Profil");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
