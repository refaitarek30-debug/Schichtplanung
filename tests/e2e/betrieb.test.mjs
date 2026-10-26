// Betrieb: Mein Kalender (für alle der neue), Hinweise, Vorgabe in den Regeln, ohne Netz.
import { APP, DB, NUTZER, heute, neuerBrowser, pruefe, seitenText, warte, wartenderTermin } from "./helfer.mjs";

const WARTESCHLANGE = `sp_offline_termine:${NUTZER}`;

async function hinweisSenden(push, text) {
  await fetch(`${DB}/rest/v1/rpc/hinweis_senden`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_empfaenger: ["e0"], p_text: text, p_ziel: null, p_push: push }),
  });
}

export default async function betrieb({ app }) {
  const jetzt = heute();
  const { browser, ctx, seite, seitenFehler } = await neuerBrowser();
  try {
    // Mein Kalender
    await seite.goto(`${APP}/meine-schichten`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    pruefe(await seite.getByText(jetzt.name).first().isVisible(), `Mein Kalender zeigt ${jetzt.name}`);
    pruefe((await seite.getByText(/^(Früh|Spät|Nacht)$/).count()) > 10, "Schichten sind eingetragen");
    pruefe((await seite.locator("[data-glas-leiste]").count()) === 1, "neue Ansicht (schwebende Leiste)");
    // Einführung wegklicken, falls sie kommt
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1500 }).catch(() => {});

    // Hinweis „zur Arbeitszeit“: noch nicht sichtbar. Hinweis „sofort“: gleich sichtbar.
    await hinweisSenden("schicht", "Bitte morgen früher kommen.");
    await seite.goto(`${APP}/start`, { waitUntil: "networkidle" });
    await warte(1500);
    pruefe((await seite.getByText("Bitte morgen früher kommen.").count()) === 0, "Hinweis zur Arbeitszeit erscheint noch nicht");
    await hinweisSenden("sofort", "Bitte Urlaubsantrag neu stellen.");
    await seite.reload({ waitUntil: "networkidle" });
    await warte(1500);
    pruefe(await seite.getByText("Bitte Urlaubsantrag neu stellen.").isVisible(), "Hinweis „sofort“ erscheint als Fenster");
    await seite.getByRole("button", { name: "Verstanden" }).click();
    await warte(800);
    pruefe((await seite.getByText("Bitte Urlaubsantrag neu stellen.").count()) === 0, "„Verstanden“ schließt den Hinweis");

    // Vorgabe für Hinweise in den Regeln
    await seite.goto(`${APP}/verwaltung?bereich=regeln`, { waitUntil: "networkidle" });
    await warte(1500);
    const karte = seite.getByRole("radiogroup", { name: "Vorgabe für Hinweise" });
    pruefe(await karte.isVisible(), "Regeln: Vorgabe für Hinweise sichtbar");
    await karte.getByRole("radio", { name: /Sofort/ }).click();
    await warte(1500);
    const gespeichert = await (await fetch(`${DB}/rest/v1/rpc/hinweis_standard`, { method: "POST", body: "{}" })).json();
    pruefe(gespeichert === "sofort", `Regeln: Vorgabe gespeichert (${gespeichert})`);

    // Ohne Netz
    await seite.goto(`${APP}/meine-schichten`, { waitUntil: "networkidle" });
    await seite
      .waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 15_000 })
      .catch(() => {});
    await seite.reload({ waitUntil: "networkidle" });
    await warte(2000);
    const gemerkt = await seite.evaluate(async () => !!(await (await caches.open("schichtplan-kalender-v1")).match("/meine-schichten")));
    pruefe(gemerkt, "Kalender ist für offline gemerkt");

    app.stopp();
    await warte(1500);
    await ctx.setOffline(true);
    await seite.goto(`${APP}/schichtplan`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await warte(2500);
    pruefe(/\/meine-schichten$/.test(seite.url()), `offline: Schichtplan springt zum Kalender (${seite.url()})`);
    pruefe((await seite.getByText("Offline · letzter Stand").count()) === 1, "offline: kleine Anzeige");
    pruefe((await seite.getByText(/^(Früh|Spät|Nacht)$/).count()) > 10, "offline: Schichten sichtbar");
    pruefe((await seite.getByText("kann momentan nicht geladen werden").count()) === 0, "offline: keine Fehlermeldung");

    await seite.evaluate(([k, v]) => localStorage.setItem(k, v), [WARTESCHLANGE, wartenderTermin(jetzt.iso)]);
    await seite.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await warte(2500);
    pruefe((await seite.getByText(/1 Termin wartet/).count()) === 1, "offline: „1 Termin wartet“");

    await ctx.setOffline(false);
    for (let i = 0; i < 40 && (await seite.evaluate((k) => localStorage.getItem(k), WARTESCHLANGE)); i++) await warte(1000);
    pruefe((await seite.evaluate((k) => localStorage.getItem(k), WARTESCHLANGE)) === null, "wieder online: Termin hochgeladen");

    pruefe(seitenFehler.length === 0, `keine Skriptfehler ${seitenFehler.join(" | ")}`);
    if (seitenFehler.length) console.log("   Seite:", await seitenText(seite));
  } finally {
    await browser.close();
  }
}
