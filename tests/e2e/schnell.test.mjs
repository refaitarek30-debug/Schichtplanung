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
