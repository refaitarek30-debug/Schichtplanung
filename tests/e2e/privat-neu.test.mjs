// Privatbereich: Lohnabrechnungen abgeschaltet, Monat per Hochwischen, „Wen sehe ich?“ vom rechten Rand.
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
    // Lohnabrechnungen sind abgeschaltet: keine Kachel, kein eigener Bereich.
    await seite.goto(`${APP}/privat/schichten`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(800);
    pruefe((await seite.getByText("Lohnabrechnungen").count()) === 0, "Lohnabrechnungen: keine Kachel mehr");
    await seite.goto(`${APP}/privat/schichten?reiter=lohn`, { waitUntil: "networkidle" });
    await warte(500);
    pruefe((await seite.locator("[data-lohnzettel-einwilligung], [data-lohnzettel-datei]").count()) === 0, "Lohnabrechnungen: kein Upload erreichbar");

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

    // Eigene Schichten ausblenden: „Ich · Schichten“ im Seitenblatt.
    const mitSchicht = () => seite.locator('[data-iso][aria-label*=": "]').count();
    // Eigene Schichten im angezeigten Monat anlegen (im Mock), dann neu laden.
    await seite.evaluate(async ([j, mo]) => {
      const basis = "http://127.0.0.1:5459/rest/v1";
      const h = { apikey: "anon", "content-type": "application/json" };
      const arten = await (await fetch(`${basis}/privat_schichtarten`, { headers: h })).json();
      // Aktueller und nächster Monat – je nachdem, welcher nach dem Neuladen zu sehen ist.
      const rows = [-1, 0].flatMap((v) => {
        const m = new Date(j, mo + v, 1);
        return [3, 4, 5].map((d) => ({ tag: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, ebene: 1, schichtart_id: arten[0].id }));
      });
      await fetch(`${basis}/privat_tage`, { method: "POST", headers: h, body: JSON.stringify(rows) });
    }, [new Date(jetzt.jahr, jetzt.monat, 1).getFullYear(), new Date(jetzt.jahr, jetzt.monat, 1).getMonth()]);
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1200);
    const vorherSchichten = await mitSchicht();
    await wische(seite, { x: v.width - 6, y: mitte.y }, { x: v.width - 160, y: mitte.y });
    await warte(600);
    const blattBox = await seite.locator("[data-wen-sehe-ich]").boundingBox();
    pruefe(!!blattBox && blattBox.height > v.height * 0.7, `Seitenblatt fast über die ganze Höhe (${blattBox?.height}/${v.height})`);
    pruefe(!!blattBox && v.width - (blattBox.x + blattBox.width) < 16, "Seitenblatt am rechten Rand");
    await seite.locator("[data-wen-ich]").getByRole("button", { name: "Ich: Schichten" }).click();
    await warte(300);
    const nachher = await mitSchicht();
    pruefe(vorherSchichten > 0 && nachher === 0, `Eigene Schichten ausgeblendet (${vorherSchichten} → ${nachher})`);
    await seite.locator("[data-wen-ich]").getByRole("button", { name: "Ich: Schichten" }).click();
    await warte(300);
    pruefe((await mitSchicht()) === vorherSchichten, "Eigene Schichten wieder da");
    // Häkchen bei „Ich“: abwählen nimmt Schichten und Termine weg, anwählen zeigt beides.
    await seite.getByRole("button", { name: "Ich: ausblenden" }).click();
    await warte(300);
    const ichS = seite.getByRole("button", { name: "Ich: Schichten" });
    const ichT = seite.getByRole("button", { name: "Ich: Termine" });
    pruefe((await mitSchicht()) === 0 && (await ichS.getAttribute("aria-pressed")) === "false" && (await ichT.getAttribute("aria-pressed")) === "false", "Häkchen ab: Schichten und Termine aus");
    await seite.getByRole("button", { name: "Ich: einblenden" }).click();
    await warte(300);
    pruefe((await mitSchicht()) === vorherSchichten && (await ichT.getAttribute("aria-pressed")) === "true", "Häkchen an: beides wieder da");
    // Farben nur in den Einstellungen (Regler oben).
    pruefe((await seite.locator('[data-wen-sehe-ich] button[aria-label^="Farbe der Schichten"]').count()) === 0, "Farbpunkte erst in den Einstellungen");
    await seite.getByRole("button", { name: "Einstellungen: Farben und Darstellung" }).click();
    await warte(200);
    pruefe((await seite.locator('[data-wen-sehe-ich] button[aria-label^="Farbe der Schichten"]').count()) > 0, "Einstellungen: Farbpunkte je Person");
    await seite.keyboard.press("Escape");
    await warte(300);

    // Geburtstag ohne Torte: Schalter im Termin-Fenster, Geburtsjahr freiwillig.
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle" });
    await warte(1000);
    await seite.locator(`[data-iso="${jetzt.iso.slice(0, 8)}15"]`).first().click();
    await warte(600);
    await seite.getByRole("button", { name: /Neuer Termin/ }).first().click();
    await warte(600);
    await seite.locator("[data-geburtstag-schalter]").click();
    await warte(200);
    pruefe((await seite.getByText("Geburtsjahr").count()) >= 1 && (await seite.getByText("jedes Jahr").count()) >= 1, "Geburtstag-Schalter: jährlich, Geburtsjahr freiwillig");
    pruefe((await seite.getByPlaceholder("Wessen Geburtstag?").inputValue()) === "", "Geburtstag: Name ohne Torte im Feld");
    await seite.keyboard.press("Escape");
    await warte(300);

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
