// Untere Leiste: sitzt sie zu hoch (iPhone-Eigenheit), setzt der Wächter sie neu; steht sie richtig, bleibt er ruhig.
import { APP, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function leiste() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/einstellungen`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    // Einstellungen sind aufklappbar – für die Scroll-Prüfung alles offen.
    await seite.evaluate(() => document.querySelectorAll("details[data-gruppe]").forEach((d) => (d.open = true)));
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});

    // Zähler für die Anstöße (window.scrollBy mit ±1).
    await seite.evaluate(() => {
      window.__anstoesse = 0;
      const orig = window.scrollBy.bind(window);
      window.scrollBy = (...a) => {
        if (Math.abs(a[1]) === 1) window.__anstoesse += 1;
        return orig(...a);
      };
    });
    const anstoesse = () => seite.evaluate(() => window.__anstoesse);
    const leiste = seite.locator("[data-mobile-nav]");
    pruefe(await leiste.isVisible(), "Handy: untere Leiste ist da");

    // 1) Leiste sitzt richtig: der Wächter bleibt ruhig.
    await warte(3500);
    pruefe((await anstoesse()) === 0, `Leiste unten: kein Anstoß (${await anstoesse()})`);

    // 2) Leiste steht mitten im Bild (wie auf dem Bild von iPhone): der Wächter setzt sie neu.
    await leiste.evaluate((el) => {
      el.style.bottom = "450px";
    });
    await warte(3500);
    pruefe((await anstoesse()) >= 2, `Leiste zu hoch: Wächter stößt an (${await anstoesse()} Anstöße = hin und zurück)`);

    // 3) Hilft es nicht, hört er nach wenigen Versuchen auf – kein Dauerzucken.
    await warte(9000);
    pruefe((await anstoesse()) <= 8, `… und macht nicht endlos weiter (${await anstoesse()})`);

    // 4) Steht ein Feld im Fokus (Tastatur offen), lässt er die Seite in Ruhe.
    await leiste.evaluate((el) => {
      el.style.bottom = "";
    });
    await warte(1500);
    const vorher = await anstoesse();
    await leiste.evaluate((el) => {
      el.style.bottom = "450px";
    });
    await seite.evaluate(() => {
      const f = document.createElement("input");
      f.id = "testfeld";
      document.body.appendChild(f);
      f.focus();
    });
    await warte(4500);
    pruefe((await anstoesse()) === vorher, "Feld im Fokus: kein Anstoß");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
