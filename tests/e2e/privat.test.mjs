// Privatbereich: Kalender online, ohne Netz, Termin ohne Netz.
import { APP, DB, NUTZER, heute, neuerBrowser, pruefe, seitenText, warte, wartenderTermin } from "./helfer.mjs";

const WARTESCHLANGE = `sp_offline_termine:${NUTZER}`;

export default async function privat({ app }) {
  const jetzt = heute();
  // Den laufenden Monat mit Schichten füllen.
  const arten = await (await fetch(`${DB}/rest/v1/privat_schichtarten`)).json();
  const tage = Array.from({ length: jetzt.tage }, (_, i) => ({
    tag: `${jetzt.iso.slice(0, 8)}${String(i + 1).padStart(2, "0")}`,
    ebene: 1,
    schichtart_id: arten[(i + 1) % 3].id,
  }));
  await fetch(`${DB}/rest/v1/privat_tage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(tage),
  });

  const { browser, ctx, seite, seitenFehler } = await neuerBrowser();
  try {
    // Online
    await seite.goto(`${APP}/privat`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    pruefe(await seite.getByText(jetzt.name).first().isVisible(), `Kalender zeigt ${jetzt.name}`);
    pruefe((await seite.getByText(/^(Früh|Spät|Nacht)$/).count()) > 10, "Schichten sind eingetragen");

    await seite
      .waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 15_000 })
      .catch(() => {});
    await seite.reload({ waitUntil: "networkidle" });
    await warte(2000);
    const gemerkt = await seite.evaluate(async () => !!(await (await caches.open("schichtplan-kalender-v1")).match("/privat")));
    pruefe(gemerkt, "Kalender ist für offline gemerkt");

    // Ohne Netz: Server wirklich aus (der Offline-Schalter des Browsers gilt nicht für den Service Worker).
    app.stopp();
    await warte(1500);
    await ctx.setOffline(true);
    await seite.goto(`${APP}/privat`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await warte(2500);
    pruefe((await seite.getByText("Offline · letzter Stand").count()) === 1, "offline: kleine Anzeige");
    pruefe((await seite.getByText(/^(Früh|Spät|Nacht)$/).count()) > 10, "offline: Schichten sichtbar");
    pruefe((await seite.getByText("konnte nicht geladen werden").count()) === 0, "offline: keine Fehlermeldung");

    // Ein ohne Netz angelegter Termin wartet auf dem Gerät …
    let hochgeladen = 0;
    seite.on("request", (r) => {
      if (r.url().includes("rpc/termin_sichern")) hochgeladen++;
    });
    await seite.evaluate(([k, v]) => localStorage.setItem(k, v), [WARTESCHLANGE, wartenderTermin(jetzt.iso)]);
    await seite.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await warte(2500);
    pruefe((await seite.getByText(/1 Termin wartet/).count()) === 1, "offline: „1 Termin wartet“");

    // Andere Seiten springen offline zum Kalender.
    await seite.goto(`${APP}/start`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await warte(2500);
    pruefe(/\/privat$/.test(seite.url()), `offline: /start springt zum Kalender (${seite.url()})`);

    // … und geht mit Netz hoch.
    await ctx.setOffline(false);
    for (let i = 0; i < 40 && (await seite.evaluate((k) => localStorage.getItem(k), WARTESCHLANGE)); i++) await warte(1000);
    pruefe(hochgeladen >= 1, "wieder online: Termin hochgeladen");
    pruefe((await seite.evaluate((k) => localStorage.getItem(k), WARTESCHLANGE)) === null, "wieder online: nichts wartet mehr");

    // Abmelden leert den gemerkten Kalender.
    await seite.evaluate(() => navigator.serviceWorker.controller?.postMessage("leere-kalender"));
    await warte(800);
    const nochDa = await seite.evaluate(async () => !!(await (await caches.open("schichtplan-kalender-v1")).match("/privat")));
    pruefe(!nochDa, "nach dem Abmelden: gemerkter Kalender gelöscht");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
