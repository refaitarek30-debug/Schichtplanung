// Privatbereich: neue Tagesansicht – Tag öffnen, Schicht setzen, wischen, lang drücken = neuer Termin
// (Titel gleich im Fokus), Termin anheben und verschieben, Ende ziehen, Löschen nur mit Rückfrage.
import { APP, addTage, heute, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

/** Pointer-Ereignisse an einer Stelle (das Handy-Profil schickt bei Maus-Gesten keine). */
async function zeiger(seite, typ, x, y) {
  await seite.evaluate(
    ([t, px, py]) => {
      const el = window.__ziel ?? document.elementFromPoint(px, py);
      if (t === "pointerdown") window.__ziel = el;
      el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: px, clientY: py, pointerId: 9, pointerType: "touch", isPrimary: true, button: 0 }));
      if (t === "pointerup") window.__ziel = null;
    },
    [typ, x, y],
  );
}

async function ziehe(seite, von, bis, { halten = 0, schritte = 8 } = {}) {
  await zeiger(seite, "pointerdown", von.x, von.y);
  if (halten) await warte(halten);
  for (let i = 1; i <= schritte; i++) {
    await zeiger(seite, "pointermove", von.x + ((bis.x - von.x) * i) / schritte, von.y + ((bis.y - von.y) * i) / schritte);
    await warte(16);
  }
  await zeiger(seite, "pointerup", bis.x, bis.y);
}

export default async function tagesansicht() {
  const jetzt = heute();
  const tag = `${jetzt.iso.slice(0, 8)}15`;
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1200);
    await seite.locator(`[data-iso="${tag}"]`).first().click();
    await warte(700);
    const ansicht = seite.locator("[data-tagesansicht]");
    pruefe((await ansicht.getAttribute("data-tagesansicht")) === tag, `Tag antippen öffnet die Tagesansicht (${await seitenText(seite)})`);
    pruefe((await seite.getByRole("button", { name: /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d+\.$/ }).count()) === 7, "Oben die Woche (7 Tage)");

    // Schicht setzen über den Pinsel oben.
    pruefe((await seite.locator("[data-tag-leiste]").count()) === 0, "Schicht-Leiste ist erst zu");
    await seite.locator("[data-tag-pinsel]").click();
    await warte(300);
    const chip = seite.locator("[data-tag-leiste] button[aria-pressed]").first();
    const vorher = await chip.getAttribute("aria-pressed");
    await chip.click();
    await warte(500);
    pruefe((await chip.getAttribute("aria-pressed")) !== vorher, "Pinsel: Tippen setzt bzw. entfernt die Schicht");
    await chip.click();
    await warte(500);

    // Wischen: nächster und wieder voriger Tag.
    const raster = await seite.locator("[data-tag-raster]").boundingBox();
    const mitte = { x: raster.x + raster.width / 2, y: raster.y + raster.height / 2 };
    await ziehe(seite, { x: mitte.x + 120, y: mitte.y }, { x: mitte.x - 120, y: mitte.y + 4 });
    await warte(700);
    pruefe((await ansicht.getAttribute("data-tagesansicht")) === addTage(tag, 1), "Nach links wischen: nächster Tag");
    await ziehe(seite, { x: mitte.x - 120, y: mitte.y }, { x: mitte.x + 120, y: mitte.y });
    await warte(700);
    pruefe((await ansicht.getAttribute("data-tagesansicht")) === tag, "Nach rechts wischen: zurück");
    // Kurzer Wisch reicht.
    await ziehe(seite, { x: mitte.x + 35, y: mitte.y }, { x: mitte.x - 35, y: mitte.y + 10 }, { schritte: 5 });
    await warte(700);
    pruefe((await ansicht.getAttribute("data-tagesansicht")) === addTage(tag, 1), "Kurzer Wisch blättert auch");
    await ziehe(seite, { x: mitte.x - 35, y: mitte.y }, { x: mitte.x + 35, y: mitte.y }, { schritte: 5 });
    await warte(700);

    // Lang in eine freie Uhrzeit drücken: „Neuer Termin“, das Blatt geht auf, Titel im Fokus.
    const flaeche = await seite.locator("[data-tag-flaeche]").boundingBox();
    await seite.locator("[data-tag-raster]").evaluate((el) => (el.scrollTop = 9 * 56));
    await warte(200);
    const punkt = { x: flaeche.x + flaeche.width / 2, y: (await seite.locator("[data-tag-flaeche]").boundingBox()).y + 10 * 56 + 4 };
    await zeiger(seite, "pointerdown", punkt.x, punkt.y);
    await warte(650);
    pruefe((await seite.locator("[data-neuer-termin]").count()) === 1, "Lang drücken: „Neuer Termin“ an der Uhrzeit");
    await zeiger(seite, "pointerup", punkt.x, punkt.y);
    await warte(700);
    const titel = seite.getByPlaceholder("Ohne Titel");
    pruefe(await titel.isVisible(), "Loslassen öffnet das Termin-Blatt");
    pruefe(await titel.evaluate((el) => el === document.activeElement), "Titel ist gleich ausgewählt (Tastatur)");
    await titel.fill("Zahnarzt");
    await seite.getByRole("button", { name: "Speichern" }).click();
    await warte(900);
    const block = seite.locator("[data-termin-block]").filter({ hasText: "Zahnarzt" });
    pruefe((await block.count()) === 1, "Neuer Termin steht im Tag");
    pruefe(/10:00–11:00/.test(await block.innerText()), `Termin an der gedrückten Uhrzeit (${await block.innerText()})`);

    // Halten und ziehen: eine Stunde später.
    const b = await block.boundingBox();
    await ziehe(seite, { x: b.x + 30, y: b.y + 12 }, { x: b.x + 30, y: b.y + 12 + 56 }, { halten: 500 });
    await warte(900);
    pruefe(/11:00–12:00/.test(await block.innerText()), `Halten + ziehen verschiebt (${await block.innerText()})`);
    pruefe((await seite.locator("[data-auswahl-leiste]").count()) === 1, "Nach dem Ziehen: ausgewählt mit Bearbeiten/Löschen");

    // Ende am Punkt unten ziehen: 30 Minuten länger.
    const g = await seite.locator('[data-griff="ende"]').boundingBox();
    await ziehe(seite, { x: g.x + g.width / 2, y: g.y + g.height / 2 }, { x: g.x + g.width / 2, y: g.y + g.height / 2 + 28 });
    await warte(900);
    pruefe(/11:00–12:30/.test(await block.innerText()), `Ende ziehen verlängert (${await block.innerText()})`);

    // Löschen nur mit Rückfrage.
    await seite.locator("[data-auswahl-leiste]").getByRole("button", { name: "Löschen" }).click();
    await warte(300);
    pruefe(await seite.getByText("Termin löschen?").isVisible(), "Löschen fragt vorher");
    await seite.getByRole("alertdialog").getByRole("button", { name: "Löschen" }).click();
    await warte(900);
    pruefe((await seite.locator("[data-termin-block]").filter({ hasText: "Zahnarzt" }).count()) === 0, "Nach dem Bestätigen gelöscht");

    // Zurück zum Monat.
    await seite.getByRole("button", { name: "Monat", exact: true }).click();
    await warte(400);
    pruefe((await seite.locator("[data-tagesansicht]").count()) === 0, "„Monat“ schließt die Tagesansicht");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
