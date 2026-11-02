// Aussetzer direkt nach der Anmeldung: eine unlesbare Antwort des Servers soll
// einmal still behoben werden und im Protokoll stehen (siehe docs/stoerungen.md).
import { chromium } from "playwright";
import { APP, neuerBrowser, pruefe, warte } from "./helfer.mjs";

const KEINE_ANTWORT = "An unexpected response was received from the server.";

export default async function aussetzer() {
  // 1) Angemeldet, kurz nach der Anmeldung: der Fehler lädt die Seite einmal neu.
  const { browser, seite } = await neuerBrowser();
  try {
    const meldungen = [];
    seite.on("request", (r) => {
      if (r.url().includes("/rpc/protokoll_melden")) meldungen.push(r.postData() ?? "");
    });
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 120_000 });
    await warte(1500);
    await seite.getByRole("button", { name: "Überspringen" }).click({ timeout: 1000 }).catch(() => {});

    await seite.evaluate(() => {
      sessionStorage.setItem("sn-anmeldung-zeit", String(Date.now()));
      window.__vorher = 1;
      setTimeout(() => Promise.reject(new Error("An unexpected response was received from the server.")), 0);
    });
    let neuGeladen = true;
    await seite.waitForFunction(() => window.__vorher === undefined, null, { timeout: 10_000 }).catch(() => (neuGeladen = false));
    pruefe(neuGeladen, "Aussetzer kurz nach der Anmeldung: Seite lädt einmal von selbst neu");
    pruefe(
      meldungen.some((m) => m.includes("einmal automatisch neu geladen") && m.includes("fehler.absturz")),
      "Aussetzer: steht vorher im Protokoll („automatisch neu geladen“)",
    );

    // Ein zweiter Aussetzer in derselben Anmeldung lädt NICHT noch einmal neu (keine Schleife), steht aber im Protokoll.
    await seite.waitForLoadState("networkidle");
    await warte(1000);
    meldungen.length = 0;
    await seite.evaluate(() => {
      window.__vorher = 1;
      setTimeout(() => Promise.reject(new Error("An unexpected response was received from the server.")), 0);
    });
    await warte(3500);
    pruefe((await seite.evaluate(() => window.__vorher)) === 1, "Zweiter Aussetzer: keine Schleife, Seite bleibt");
    pruefe(
      meldungen.some((m) => m.includes(KEINE_ANTWORT) && !m.includes("automatisch neu geladen")),
      "Zweiter Aussetzer: trotzdem im Protokoll",
    );

    // Lange nach der Anmeldung: kein Neuladen, nur Protokoll.
    await seite.evaluate(() => {
      sessionStorage.setItem("sn-anmeldung-zeit", String(Date.now() - 10 * 60_000));
      sessionStorage.removeItem("sn-anmeldung-neu-geladen");
      window.__vorher = 1;
      setTimeout(() => Promise.reject(new Error("An unexpected response was received from the server.")), 0);
    });
    await warte(3500);
    pruefe((await seite.evaluate(() => window.__vorher)) === 1, "Aussetzer lange nach der Anmeldung: nicht neu geladen");

    // Anderer Fehler direkt nach der Anmeldung: nie automatisch neu laden.
    await seite.evaluate(() => {
      sessionStorage.setItem("sn-anmeldung-zeit", String(Date.now()));
      sessionStorage.removeItem("sn-anmeldung-neu-geladen");
      window.__vorher = 1;
      setTimeout(() => Promise.reject(new Error("Etwas ganz anderes")), 0);
    });
    await warte(3500);
    pruefe((await seite.evaluate(() => window.__vorher)) === 1, "Anderer Fehler direkt nach der Anmeldung: nicht neu geladen");

    // 2) Die Anmeldung kam unlesbar zurück, die Zielseite wurde geladen: das Protokoll hält es fest.
    meldungen.length = 0;
    await seite.evaluate(() => sessionStorage.setItem("sn-anmeldung-hinweis", "1"));
    await seite.goto(`${APP}/dashboard`, { waitUntil: "networkidle" });
    await warte(1500);
    pruefe(
      meldungen.some((m) => m.includes("Anmeldung: Der Server antwortete nicht lesbar")),
      "Anmeldung ohne lesbare Antwort, Sitzung steht: im Protokoll vermerkt",
    );
  } finally {
    await browser.close();
  }

  // 3) Nicht angemeldet: die Anmeldung antwortet unlesbar → Zielseite wird geladen, dann Hinweis statt Absturz.
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: "de-DE", timezoneId: "Europe/Berlin", bypassCSP: true });
    const s = await ctx.newPage();
    const fehler = [];
    s.on("pageerror", (e) => fehler.push(e.message));
    let abgeschickt = 0;
    await s.route("**/login**", (route) => {
      const r = route.request();
      if (r.method() === "POST" && r.headers()["next-action"]) {
        abgeschickt++;
        return route.fulfill({ status: 502, contentType: "text/html", body: "<html><body>Bad Gateway</body></html>" });
      }
      return route.continue();
    });
    await s.goto(`${APP}/login`, { waitUntil: "networkidle", timeout: 120_000 });
    await s.locator('input[name="email"]').fill("test@x.invalid");
    await s.locator('input[name="password"]').fill("passwort123");
    await s.getByRole("button", { name: "Einloggen" }).click();
    await s.getByText("Der Server hat gerade nicht richtig geantwortet").waitFor({ timeout: 15_000 }).catch(() => {});
    pruefe(
      await s.getByText("Der Server hat gerade nicht richtig geantwortet").isVisible().catch(() => false),
      "Anmeldung ohne lesbare Antwort, keine Sitzung: freundlicher Hinweis auf der Anmeldeseite",
    );
    pruefe(abgeschickt === 1, `Anmeldung wurde nur einmal abgeschickt (${abgeschickt}×)`);
    pruefe(fehler.length === 0, `keine Skriptfehler ${fehler.join(" | ")}`);
  } finally {
    await b.close();
  }
}
