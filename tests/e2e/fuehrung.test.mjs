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

    // Plan: drei Reiter über Schichtplan, Besetzung und Ausbildung
    await seite.goto(`${APP}/schichtplan`, { waitUntil: "networkidle" });
    await warte(1500);
    const reiter = seite.locator("[data-plan-reiter]");
    pruefe(
      (await reiter.getByRole("link").allInnerTexts()).join("|") === "Schichtplan|Besetzung|Ausbildung" &&
        (await reiter.getByRole("link", { name: "Schichtplan" }).getAttribute("aria-current")) === "page",
      "Plan: Reiter Schichtplan · Besetzung · Ausbildung, Schichtplan aktiv",
    );
    await reiter.getByRole("link", { name: "Besetzung" }).click();
    await seite.waitForURL(/\/besetzung$/);
    await warte(800);
    pruefe(
      (await seite.locator("[data-plan-reiter]").getByRole("link", { name: "Besetzung" }).getAttribute("aria-current")) === "page",
      "Plan: Reiter „Besetzung“ öffnet die Besetzung",
    );
    pruefe(
      (await seite.locator("[data-mobile-nav]").getByRole("link", { name: "Plan" }).getAttribute("aria-current")) === "page",
      "Plan: Leiste unten zeigt „Plan“ auch in der Besetzung",
    );
    // Besetzung: großes Band oben, Soll & Mindest hinter dem Zahnrad
    const band = seite.locator("[data-band-handy]");
    pruefe((await band.locator("tbody tr").count()) === 14, "Besetzung: Band zeigt 14 Tage untereinander (Handy)");
    pruefe(await band.getByText("5/5").first().isVisible(), "Besetzung: Zellen zeigen Anwesend/Soll");
    pruefe(
      (await seite.locator("[data-zu-knapp]").getByText(/Nacht .* 2 von 3/).count()) === 1,
      "Besetzung: zu knappe Schicht steht oben („Nacht … 2 von 3“)",
    );
    pruefe((await seite.getByText("Laufende Tage").count()) === 0, "Besetzung: Einstellungen nicht mehr auf der Seite");
    await seite.locator("[data-besetzung-einstellungen]").click();
    await warte(800);
    pruefe(
      (await seite.locator('[role="dialog"]').getByText("Frühschicht").first().isVisible()) &&
        (await seite.locator('[role="dialog"]').getByText("Mindest").first().isVisible()),
      "Besetzung: Zahnrad öffnet Soll & Mindest je Schicht",
    );
    await seite.keyboard.press("Escape");
    await warte(400);
    await seite.locator("[data-plan-reiter]").getByRole("link", { name: "Ausbildung" }).click();
    await seite.waitForURL(/\/ausbildung$/);
    await warte(800);
    pruefe((await seite.locator("[data-plan-reiter]").count()) === 1, "Plan: Reiter auch in der Ausbildung");

    // Urlaub: Reiter „Mein Urlaub | Entscheiden“ mit der Zahl offener Anträge
    await seite.goto(`${APP}/urlaub`, { waitUntil: "networkidle" });
    await warte(1500);
    const urlaub = seite.locator("[data-urlaub-reiter]");
    pruefe(
      (await urlaub.getByRole("link", { name: /Mein Urlaub/ }).getAttribute("aria-current")) === "page" &&
        (await urlaub.locator("[data-offen]").getAttribute("data-offen")) === "2",
      "Urlaub: Reiter Mein Urlaub · Entscheiden mit „2“ offenen Anträgen",
    );
    await urlaub.getByRole("link", { name: /Entscheiden/ }).click();
    await seite.waitForURL(/\/urlaubsantraege$/);
    await warte(800);
    pruefe(
      (await seite.locator("[data-urlaub-reiter]").getByRole("link", { name: /Entscheiden/ }).getAttribute("aria-current")) === "page" &&
        (await seite.locator("[data-mobile-nav]").getByRole("link", { name: "Urlaub" }).getAttribute("aria-current")) === "page",
      "Urlaub: „Entscheiden“ öffnet die Anträge, unten leuchtet „Urlaub“",
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

    // Seitenleiste: wenige Bereiche mit Untertext, „Team“ leuchtet auf der Verwaltung
    const leiste = await s.locator("aside [data-leiste]").evaluateAll((els) => els.map((e) => e.getAttribute("data-leiste")));
    pruefe(
      leiste.join("|") === "Start|Plan|Urlaub|Kalender|Team|Mitteilungen|Auswertung|Einstellungen",
      `Seitenleiste: Start, Plan, Urlaub, Kalender, Team, Mitteilungen, Auswertung, Einstellungen (${leiste.join(", ")})`,
    );
    pruefe(
      (await s.locator('aside [data-leiste="Team"]').getAttribute("aria-current")) === "page" &&
        (await s.locator('aside [data-leiste="Plan"]').innerText()).includes("Schichtplan · Besetzung · Ausbildung"),
      "Seitenleiste: Team aktiv, unter Plan steht, was drinsteckt",
    );
    pruefe((await s.locator('aside [data-leiste="Urlaub"]').getByText("2", { exact: true }).count()) === 1, "Seitenleiste: Urlaub zeigt 2 offene Anträge");
    await s.goto(`${APP}/besetzung`, { waitUntil: "networkidle" });
    await warte(800);
    pruefe((await s.locator('aside [data-leiste="Plan"]').getAttribute("aria-current")) === "page", "Seitenleiste: Plan leuchtet auch auf der Besetzung");
  } finally {
    await b.close();
  }
}
