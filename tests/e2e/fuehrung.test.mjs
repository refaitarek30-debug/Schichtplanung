// Führung: Mitteilungen in einer Liste („Neue Mitteilung“ → An wen?) und die aufgeräumte Mitarbeiterliste.
import { chromium } from "playwright";
import { APP, DB, SITZUNG_COOKIE, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

export default async function fuehrung() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    // Hinweis an zwei Personen (eine Anweisung) – soll als EINE Zeile erscheinen.
    await fetch(`${DB}/rest/v1/rpc/hinweis_senden`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ p_empfaenger: ["e1", "e2"], p_text: "Schichttausch Freitag klären", p_ziel: null, p_push: "aus" }),
    });

    await seite.goto(`${APP}/mitteilungen`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});

    const hinweis = seite.locator('[data-eintrag="personen"]').filter({ hasText: "Schichttausch Freitag klären" });
    pruefe((await hinweis.count()) === 1, "Mitteilungen: Hinweis an 2 Personen ist eine Zeile");
    pruefe(await hinweis.getByText("Hinweis an 2 Personen").isVisible(), "Mitteilungen: „Hinweis an 2 Personen“");
    pruefe(await hinweis.getByText("0 von 2 gelesen").isVisible(), "Mitteilungen: „0 von 2 gelesen“");
    await hinweis.getByRole("button", { name: /Wer\?/ }).click();
    await warte(300);
    pruefe(
      (await hinweis.getByText("Louis Becker").isVisible()) && (await hinweis.getByText("Mia Wagner").isVisible()),
      "Mitteilungen: „Wer?“ zeigt die Empfänger",
    );
    pruefe((await seite.locator('[data-eintrag="sperre"]').filter({ hasText: "Stillstand" }).count()) === 1, "Mitteilungen: Urlaubssperre steht in derselben Liste");

    // Neue Mitteilung → An wen? → Alle im Betrieb
    await seite.getByRole("button", { name: "Neue Mitteilung" }).click();
    await warte(500);
    const wahl = seite.locator("[data-an-wen]");
    pruefe(
      (await wahl.getByText("Einzelne Personen").isVisible()) &&
        (await wahl.getByText("Alle im Betrieb").isVisible()) &&
        (await wahl.getByText("Urlaubssperre").isVisible()),
      "Neue Mitteilung: Frage „An wen?“ mit drei Wegen (Administration)",
    );
    await wahl.getByText("Alle im Betrieb").click();
    await warte(500);
    const form = seite.locator("[data-an-alle]");
    await form.getByPlaceholder("z. B. Wartung Anlage 3").fill("Wartung Anlage 3");
    await form.getByRole("radio", { name: "Wichtig" }).click();
    pruefe(await form.getByText("So sieht es auf der Startseite aus").isVisible(), "An alle: Vorschau sichtbar");
    await form.getByRole("button", { name: "Veröffentlichen" }).click();
    await warte(2000);
    pruefe(await seite.getByText("Mitteilung veröffentlicht.").isVisible(), "An alle: veröffentlicht");
    const neu = seite.locator('[data-eintrag="an_alle"]').filter({ hasText: "Wartung Anlage 3" });
    pruefe((await neu.count()) === 1 && (await neu.getByText("An alle · Wichtig").isVisible()), "An alle: steht in der Liste als „Wichtig“");

    // Filter
    await seite.getByRole("button", { name: "An alle", exact: true }).click();
    await warte(300);
    pruefe(
      (await seite.locator("[data-eintrag]").count()) === (await seite.locator('[data-eintrag="an_alle"]').count()),
      "Filter „An alle“ zeigt nur Mitteilungen an alle",
    );

    // Mitarbeiter: ruhige Liste, Person antippen → Blatt mit Aktionen
    await seite.goto(`${APP}/verwaltung?bereich=mitarbeiter`, { waitUntil: "networkidle" });
    await warte(1500);
    const liste = seite.locator("[data-mitarbeiter-liste]");
    pruefe((await liste.getByRole("button", { name: /Bearbeiten|Deaktivieren|Passwort-Code/ }).count()) === 0, "Mitarbeiter: keine Knöpfe mehr in der Liste");
    pruefe(await liste.getByText("Louis Becker", { exact: true }).isVisible(), "Mitarbeiter: voller Name in der Liste");
    await liste.getByText("Louis Becker", { exact: true }).click();
    await warte(600);
    const blatt = seite.locator('[role="dialog"] [data-person="Louis Becker"]');
    pruefe(await blatt.isVisible(), "Handy: Person öffnet als Blatt");
    pruefe(
      (await blatt.getByRole("button", { name: "Bearbeiten" }).isVisible()) &&
        (await blatt.getByRole("button", { name: "Hinweis" }).isVisible()) &&
        (await blatt.getByRole("button", { name: "Deaktivieren" }).isVisible()),
      "Blatt: Bearbeiten, Hinweis, Deaktivieren (Administration)",
    );
    await blatt.getByRole("button", { name: "Bearbeiten" }).click();
    await warte(800);
    pruefe((await seite.locator('[role="dialog"] [data-person]').count()) === 0, "Bearbeiten: Blatt schließt");
    pruefe(await seite.evaluate(() => [...document.querySelectorAll("input")].some((i) => i.value === "Louis")), "Bearbeiten: Formular mit den Daten oben");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }

  // Computer: die Person rechts neben der Liste
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, locale: "de-DE", timezoneId: "Europe/Berlin", bypassCSP: true });
    await ctx.addCookies([SITZUNG_COOKIE]);
    const s = await ctx.newPage();
    await s.goto(`${APP}/verwaltung?bereich=mitarbeiter`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await s.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});
    await s.locator("[data-mitarbeiter-liste]").getByText("Mia Wagner", { exact: true }).click();
    await warte(500);
    pruefe(await s.locator('[data-person-spalte] [data-person="Mia Wagner"]').isVisible(), "Computer: Person rechts neben der Liste");
    pruefe((await s.locator('[role="dialog"]').count()) === 0, "Computer: kein Blatt");
  } finally {
    await b.close();
  }
}
