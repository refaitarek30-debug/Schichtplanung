// Privatbereich: Lohnabrechnungen, Monat per Hochwischen, „Wen sehe ich?“ vom rechten Rand.
import { APP, DB, heute, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

/** Wischen mit Pointer-Ereignissen (das Handy-Profil schickt bei Maus-Gesten keine). */
async function wische(seite, von, bis) {
  await seite.evaluate(
    ([a, b]) => {
      const el = document.elementFromPoint(a.x, a.y);
      const ev = (typ, x, y) =>
        el.dispatchEvent(new PointerEvent(typ, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true }));
      ev("pointerdown", a.x, a.y);
      for (let i = 1; i <= 10; i++) ev("pointermove", a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10);
      ev("pointerup", b.x, b.y);
    },
    [von, bis],
  );
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export default async function privatNeu() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    // Lohnabrechnungen: erst einwilligen, dann hochladen, ansehen, löschen.
    await seite.goto(`${APP}/privat/schichten?reiter=lohn`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(800);
    const einwilligung = seite.locator("[data-lohnzettel-einwilligung]");
    pruefe((await einwilligung.count()) === 1, "Lohnabrechnungen: erst die Einwilligung");
    pruefe(await einwilligung.getByRole("button", { name: "Einverstanden" }).isDisabled(), "Einwilligung: ohne Haken kein Weiter");
    await einwilligung.getByRole("checkbox").check();
    await einwilligung.getByRole("button", { name: "Einverstanden" }).click();
    await warte(500);
    await seite.locator("[data-lohnzettel-datei]").setInputFiles({ name: "lohn.png", mimeType: "image/png", buffer: PNG });
    await warte(1500);
    pruefe((await seite.locator("[data-lohnzettel-eintrag]").count()) === 1, "Lohnabrechnung hochgeladen und in der Liste");
    const dateien = await (await fetch(`${DB}/rest/v1/privat_lohnzettel`)).json();
    pruefe(dateien.length === 1 && dateien[0].typ === "image/jpeg" && dateien[0].pfad.endsWith(".jpg"), "Foto wird als verkleinertes JPEG gespeichert");
    await seite.locator("[data-lohnzettel-eintrag]").click();
    await warte(800);
    pruefe((await seite.getByRole("img", { name: /Lohnabrechnung/ }).count()) === 1, "Lohnabrechnung lässt sich ansehen");
    await seite.getByRole("button", { name: "Löschen" }).click();
    await seite.getByRole("button", { name: "Löschen" }).last().click();
    await warte(800);
    pruefe((await seite.locator("[data-lohnzettel-eintrag]").count()) === 0, "Lohnabrechnung gelöscht");

    // Kalender: seitlich wischen tut nichts, hochwischen = nächster Monat.
    const jetzt = heute();
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle" });
    await warte(1200);
    const titel = async () => (await seite.locator("header h1").first().innerText()).trim();
    const vorher = await titel();
    const v = seite.viewportSize();
    const mitte = { x: v.width / 2, y: v.height / 2 };
    await wische(seite, { x: mitte.x + 100, y: mitte.y }, { x: mitte.x - 100, y: mitte.y });
    await warte(700);
    pruefe((await titel()) === vorher, `Seitlich wischen blättert nicht (${await titel()})`);
    await wische(seite, { x: mitte.x, y: mitte.y + 120 }, { x: mitte.x, y: mitte.y - 120 });
    await warte(900);
    const naechster = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(jetzt.jahr, jetzt.monat, 1));
    pruefe((await titel()).startsWith(naechster), `Hochwischen: nächster Monat (${await titel()})`);

    // Vom rechten Rand nach links ziehen: „Wen sehe ich?“ als Seitenblatt.
    await wische(seite, { x: v.width - 6, y: mitte.y }, { x: v.width - 130, y: mitte.y });
    await warte(600);
    pruefe((await seite.locator("[data-wen-sehe-ich]").count()) === 1, "Rand rechts: „Wen sehe ich?“ öffnet sich");
    await seite.keyboard.press("Escape");
    await warte(300);
    pruefe((await seite.locator("[data-wen-sehe-ich]").count()) === 0, "Escape schließt „Wen sehe ich?“");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
