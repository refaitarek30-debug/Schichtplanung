// Mein Kalender öffnet sofort aus dem Gerätespeicher (auch mit Netz) und frischt sich im Hintergrund auf (public/sw.js).
import { APP, NUTZER, neuerBrowser, pruefe, seitenText, warte } from "./helfer.mjs";

const CACHE = "schichtplan-kalender-v1";

/** Namen aus „Server-Timing“ der geladenen Seite – der Worker setzt „sn-kalender“, wenn sie vom Gerät kam. */
const serverTiming = (seite) =>
  seite.evaluate(() => performance.getEntriesByType("navigation")[0].serverTiming.map((t) => t.name));
const gemerktAm = (seite, pfad) =>
  seite.evaluate(
    async ([cache, p]) => Number((await (await caches.open(cache)).match(p))?.headers.get("x-gemerkt-am") ?? 0),
    [CACHE, pfad],
  );
const imCache = (seite, pfad) =>
  seite.evaluate(async ([cache, p]) => !!(await (await caches.open(cache)).match(p)), [CACHE, pfad]);

export default async function schnell() {
  const { browser, ctx, seite, seitenFehler } = await neuerBrowser();
  try {
    // Vorbereitung: Kalender einmal online öffnen, Worker anmelden, noch einmal laden (dabei wird die Seite gemerkt).
    await seite.goto(`${APP}/meine-schichten`, { waitUntil: "networkidle", timeout: 120_000 });
    await seite.waitForFunction(() => navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller), null, { timeout: 20_000 }).catch(() => {});
    await seite.reload({ waitUntil: "networkidle" });
    await warte(2500);
    pruefe(await imCache(seite, "/meine-schichten"), "Kalender ist auf dem Gerät gemerkt");
    pruefe(!(await serverTiming(seite)).includes("sn-kalender"), "erster Aufruf kommt noch vom Server");

    // 1) Mit Netz: die gemerkte Seite erscheint sofort …
    const vorher = await gemerktAm(seite, "/meine-schichten");
    await seite.reload({ waitUntil: "networkidle" });
    pruefe((await serverTiming(seite)).includes("sn-kalender"), "Mein Kalender kommt sofort aus dem Gerätespeicher – auch mit Netz");
    await warte(1500);
    pruefe((await seite.getByText(/^(Früh|Spät|Nacht)$/).count()) > 10, "Schichten stehen da");

    // Monate untereinander wie im Privatbereich: hochwischen = nächster Monat, schon vorgeladen.
    {
      // Die einmalige Einführung liegt sonst über dem Kalender.
      const ueberspringen = seite.getByRole("button", { name: "Überspringen" });
      if (await ueberspringen.isVisible().catch(() => false)) {
        await ueberspringen.click();
        await warte(400);
      }
      const titel = async () => (await seite.locator("[data-monat-titel]").first().innerText()).trim();
      const vorherTitel = await titel();
      const box = await seite.locator("[data-monats-scroller]").boundingBox();
      const cdp = await seite.context().newCDPSession(seite);
      const x = box.x + box.width / 2;
      const y = box.y + box.height * 0.7;
      const schritt = (box.height * 0.6) / 12;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 12; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * schritt }] });
        await warte(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await warte(1100);
      pruefe((await titel()) !== vorherTitel, `Mein Kalender: hochwischen = nächster Monat (${vorherTitel} → ${await titel()})`);
      const sichtbar = await seite.evaluate(() => {
        const s = document.querySelector("[data-monats-scroller]");
        const seite = [...s.children].find((c) => c.getAttribute("aria-hidden") === "false");
        return seite ? [...seite.querySelectorAll("[data-iso]")].filter((b) => /Früh|Spät|Nacht/.test(b.textContent)).length : 0;
      });
      pruefe(sichtbar > 5, `Mein Kalender: nächster Monat steht gleich mit Schichten da (${sichtbar})`);
      await seite.reload({ waitUntil: "networkidle" });
      await warte(1000);
    }
    // … und wird nebenher aufgefrischt.
    await warte(2500);
    pruefe((await gemerktAm(seite, "/meine-schichten")) > vorher, "im Hintergrund aufgefrischt (neuer Stand gemerkt)");

    // 2) Startadresse: landet die Person im Kalender, geht es nach dem Lernen sofort dorthin.
    await ctx.addCookies([{ name: "sp_start", value: encodeURIComponent(`${NUTZER}|kalender`), url: APP }]);
    await seite.goto(`${APP}/start`, { waitUntil: "networkidle" });
    await warte(3000);
    pruefe(await imCache(seite, "/__start-ziel"), "Startadresse führt in den Kalender – gemerkt");
    await seite.goto(`${APP}/start`, { waitUntil: "networkidle" });
    pruefe(/\/meine-schichten$/.test(seite.url()), `Startadresse landet im Kalender (${seite.url()})`);
    pruefe((await serverTiming(seite)).includes("sn-kalender"), "… und der Kalender kommt sofort vom Gerät");

    // 3) Startseite geändert: der gemerkte Weg wird vergessen.
    await seite.evaluate(() => navigator.serviceWorker.controller?.postMessage("vergiss-start"));
    await warte(700);
    pruefe(!(await imCache(seite, "/__start-ziel")), "Startseite geändert: gemerkter Weg ist weg");
    pruefe(await imCache(seite, "/meine-schichten"), "… die gemerkte Kalender-Seite bleibt");

    // 3b) Startseite ist NICHT der Kalender: einmal nachsehen, dann nicht bei jedem Öffnen erneut
    //     (sonst lädt der Server die Startseite jedes Mal doppelt).
    await ctx.addCookies([{ name: "sp_start", value: encodeURIComponent(`${NUTZER}|dashboard`), url: APP }]);
    await seite.goto(`${APP}/start`, { waitUntil: "networkidle" });
    await warte(3000);
    const marke = await seite.evaluate(
      async ([c, p]) => (await (await caches.open(c)).match(p))?.text() ?? null,
      [CACHE, "/__start-ziel"],
    );
    pruefe(marke === "-", `Startadresse führt nicht in den Kalender – so gemerkt (${marke})`);
    const ersteMarke = await gemerktAm(seite, "/__start-ziel");
    await seite.goto(`${APP}/start`, { waitUntil: "networkidle" });
    pruefe(/\/dashboard$/.test(seite.url()), `Startadresse landet auf der Startseite (${seite.url()})`);
    await warte(2000);
    pruefe((await gemerktAm(seite, "/__start-ziel")) === ersteMarke, "beim zweiten Öffnen kein zweites Laden im Hintergrund");
    await seite.evaluate(() => navigator.serviceWorker.controller?.postMessage("vergiss-start"));
    await warte(500);

    // 4) Sitzung weg: die Auffrischung merkt es, alles Gemerkte verschwindet, das Fenster geht zur Anmeldung.
    await ctx.clearCookies();
    await seite.goto(`${APP}/meine-schichten`, { waitUntil: "commit" }).catch(() => {});
    await seite.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => {});
    pruefe(/\/login/.test(seite.url()), `ohne Sitzung führt der Kalender zur Anmeldung (${seite.url()})`);
    await warte(500);
    pruefe(!(await seite.evaluate(async (c) => (await caches.keys()).includes(c), CACHE)), "ohne Sitzung: nichts Persönliches bleibt auf dem Gerät");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
