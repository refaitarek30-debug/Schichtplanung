// Fenster im Schichtplan lassen sich nach unten wischen (wie die Blätter im Kalender).
import { APP, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

/** Wischt mit einem Finger von der Mitte des Fensters nach unten (echte Touch-Ereignisse). */
async function wischeNachUnten(seite, selektor, { startImText = false } = {}) {
  await seite.evaluate(
    async ({ selektor, startImText }) => {
      const el = document.querySelector(selektor);
      const ziel = startImText ? el.querySelector("textarea") : el;
      const r = ziel.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + Math.min(20, r.height / 2);
      const beruehrung = (yy) => new Touch({ identifier: 1, target: ziel, clientX: x, clientY: yy });
      const ereignis = (art, yy) =>
        new TouchEvent(art, {
          bubbles: true,
          cancelable: true,
          touches: art === "touchend" ? [] : [beruehrung(yy)],
          changedTouches: [beruehrung(yy)],
        });
      ziel.dispatchEvent(ereignis("touchstart", y));
      for (let i = 1; i <= 8; i++) {
        ziel.dispatchEvent(ereignis("touchmove", y + i * 20));
        await new Promise((f) => setTimeout(f, 16));
      }
      ziel.dispatchEvent(ereignis("touchend", y + 160));
    },
    { selektor, startImText },
  );
  await new Promise((f) => setTimeout(f, 600));
}

export default async function wischen() {
  const { browser, seite, seitenFehler } = await neuerBrowser();
  try {
    await seite.goto(`${APP}/schichtplan`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1800);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});

    const tag = '[role="dialog"][aria-label="Tag bearbeiten"]';
    const kommentar = '[role="dialog"][aria-label="Kommentare"]';

    // Eine bearbeitbare Zelle antippen, bis sich „Tag bearbeiten“ öffnet.
    const zellen = seite.locator('td button[title*=" · "]');
    const n = Math.min(await zellen.count(), 60);
    let offen = false;
    for (let i = 0; i < n && !offen; i++) {
      await zellen.nth(i).scrollIntoViewIfNeeded().catch(() => {});
      await zellen.nth(i).click({ timeout: 1500 }).catch(() => {});
      await warte(150);
      offen = (await seite.locator(tag).count()) > 0;
    }
    pruefe(offen, "Schichtplan: Zelle antippen öffnet „Tag bearbeiten“");

    if (offen) {
      await wischeNachUnten(seite, tag);
      pruefe((await seite.locator(tag).count()) === 0, "Schichtplan: „Tag bearbeiten“ schließt durch Runterwischen");

      // Kommentare: erst öffnen (über die Zelle), dann Wisch im Textfeld ignorieren, dann am Rand wischen.
      for (let i = 0; i < n; i++) {
        await zellen.nth(i).click({ timeout: 1500 }).catch(() => {});
        await warte(150);
        if ((await seite.locator(tag).count()) > 0) break;
      }
      await seite.locator(tag).getByRole("button", { name: /Kommentar/ }).click();
      await warte(300);
      pruefe((await seite.locator(kommentar).count()) === 1, "Schichtplan: Kommentarfenster geöffnet");
      await wischeNachUnten(seite, kommentar, { startImText: true });
      pruefe((await seite.locator(kommentar).count()) === 1, "Kommentare: Wischen im Textfeld schließt nicht (dort wird getippt)");
      await wischeNachUnten(seite, kommentar);
      pruefe((await seite.locator(kommentar).count()) === 0, "Kommentare: Wischen am Rand schließt");
    }

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
