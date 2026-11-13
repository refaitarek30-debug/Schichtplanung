// Zwei-Faktor-Anmeldung und Sperre nach 5 Fehlversuchen (Migration 0219).
import { APP, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function zweiFaktor() {
  // Passwort ja, Code noch nicht: keine App, sondern die Code-Eingabe.
  {
    const { browser, seite } = await neuerBrowser({ zweiFaktor: "offen" });
    try {
      await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 120_000 });
      pruefe(new URL(seite.url()).pathname === "/zwei-faktor", `Code offen: Weiterleitung zur Code-Eingabe (ist ${seite.url()})`);
      pruefe(await seite.getByRole("heading", { name: "Code eingeben" }).isVisible(), "Code-Eingabe sichtbar");
    } finally {
      await browser.close();
    }
  }

  // Administration ohne Zwei-Faktor: erst einrichten (Pflicht).
  {
    const { browser, seite } = await neuerBrowser({ zweiFaktor: "keiner" });
    try {
      await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 120_000 });
      const url = new URL(seite.url());
      pruefe(url.pathname === "/zwei-faktor/einrichten" && url.searchParams.get("pflicht") === "1", `Pflicht: Einrichten für die Administration (ist ${seite.url()})`);
      pruefe(/Pflicht/.test(await seitenText(seite, 600)), "Einrichten: Hinweis auf Pflicht");
    } finally {
      await browser.close();
    }
  }

  // Bestätigt: Mitarbeiterliste zeigt die Sperre, Administration schaltet frei.
  {
    const { browser, seite, seitenFehler } = await neuerBrowser();
    try {
      await seite.goto(`${APP}/verwaltung?bereich=mitarbeiter`, { waitUntil: "networkidle", timeout: 120_000 });
      await warte(800);
      const liste = seite.locator("[data-mitarbeiter-liste]");
      await liste.getByText("Louis Becker", { exact: true }).click();
      await warte(500);
      const person = seite.locator('[role="dialog"] [data-person="Louis Becker"]');
      pruefe(await person.getByText("Gesperrt", { exact: true }).isVisible(), "Sperre: Abzeichen „Gesperrt“");
      pruefe(await person.getByRole("button", { name: "2FA zurücksetzen" }).isVisible(), "Zwei-Faktor zurücksetzen angeboten");
      await person.getByRole("button", { name: "Freischalten" }).click();
      await warte(1000);
      pruefe(/wieder freigeschaltet/.test(await seite.locator("[data-zugang-meldung]").innerText()), "Freischalten: Meldung");
      pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    } finally {
      await browser.close();
    }
  }
}
