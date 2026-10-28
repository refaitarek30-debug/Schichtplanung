// Gemeinsame Helfer für die Oberflächen-Tests (siehe run.mjs).
import { spawn } from "node:child_process";
import { chromium, devices } from "playwright";

export const APP = "http://localhost:3125";
export const DB = "http://127.0.0.1:5459";
export const NUTZER = "11111111-2222-4333-8444-555555555555";

const ROOT = new URL("../../", import.meta.url).pathname;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: NUTZER, role: "authenticated", exp: 4102444800, aud: "authenticated" })}.sig`;
/** Angemeldete Sitzung für das nachgeahmte Supabase (Cookie wie @supabase/ssr). */
const SITZUNG =
  "base64-" +
  b64({
    access_token: jwt,
    refresh_token: "r",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4102444800,
    user: { id: NUTZER, aud: "authenticated" },
  });

/** Heute in deutscher Zeit, z. B. { iso: "2026-10-26", jahr: 2026, monat: 10, tage: 31, name: "Oktober" }. */
export function heute() {
  const iso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const [jahr, monat] = iso.split("-").map(Number);
  const name = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "Europe/Berlin" }).format(new Date());
  return { iso, jahr, monat, tage: new Date(jahr, monat, 0).getDate(), name };
}

/** Ein Termin, der ohne Netz angelegt wurde und auf dem Gerät wartet. */
export function wartenderTermin(datum) {
  return JSON.stringify({
    t: Date.now(),
    w: [
      {
        id: "offline:test1",
        t: Date.now(),
        eingabe: {
          id: null, datum, bisDatum: null, titel: "Zahnarzt", ganztaegig: false,
          von: "10:00", bis: "11:00", wiederholung: "nie", notiz: "", ort: "", erinnerung: null,
        },
      },
    ],
  });
}

/** Das Anmelde-Cookie, z. B. für einen zweiten Browser in anderer Größe. */
export const SITZUNG_COOKIE = { name: "sb-127-auth-token", value: SITZUNG, url: APP };

export const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/** Zählt Fehlschläge; run.mjs beendet mit Code 1, wenn einer dabei war. */
export const ergebnis = { ok: 0, fehler: [] };
export function pruefe(bedingung, text) {
  if (bedingung) {
    ergebnis.ok++;
    console.log(`  ✓ ${text}`);
  } else {
    ergebnis.fehler.push(text);
    console.log(`  ✗ ${text}`);
  }
}

async function bereit(url, versuche = 60) {
  for (let i = 0; i < versuche; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      // noch nicht da
    }
    await warte(500);
  }
  throw new Error(`${url} antwortet nicht`);
}

function starte(befehl, args, env) {
  // Eigene Prozessgruppe, damit beim Beenden auch Unterprozesse (npx → next) mitgehen.
  const kind = spawn(befehl, args, { cwd: ROOT, detached: true, stdio: "ignore", env: { ...process.env, ...env } });
  return {
    stopp() {
      try {
        process.kill(-kind.pid);
      } catch {
        // schon weg
      }
    },
  };
}

/** Nachgeahmte Datenbank starten ("privat" oder "betrieb"). */
export async function starteDatenbank(art) {
  const p = starte("node", [`tests/e2e/mock-${art}.mjs`], { PORT: "5459" });
  await bereit(`${DB}/rest/v1/`);
  return p;
}

/** Die gebaute App starten (npm run build muss vorher gelaufen sein). */
export async function starteApp() {
  const p = starte("npx", ["next", "start", "-p", "3125"], {
    NEXT_PUBLIC_SUPABASE_URL: DB,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    NEXT_PUBLIC_SITE_URL: APP,
  });
  await bereit(`${APP}/login`);
  return p;
}

/** Browser wie ein iPhone, angemeldet. */
export async function neuerBrowser() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    // Die echte CSP erlaubt nur Supabase-Adressen, nicht die nachgeahmte Datenbank.
    bypassCSP: true,
    serviceWorkers: "allow",
  });
  await ctx.addCookies([SITZUNG_COOKIE]);
  const seite = await ctx.newPage();
  const seitenFehler = [];
  seite.on("pageerror", (e) => seitenFehler.push(e.message));
  return { browser, ctx, seite, seitenFehler };
}

/** Text der Seite (kurz), für Fehlermeldungen. */
export async function seitenText(seite, laenge = 160) {
  const t = await seite.locator("body").innerText().catch(() => "?");
  return t.slice(0, laenge).replace(/\s+/g, " ");
}
