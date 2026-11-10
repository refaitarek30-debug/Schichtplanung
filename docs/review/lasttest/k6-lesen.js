// Lasttest: gleichzeitige Leser.
//
// ENTWURF aus dem Review vom 10.11.2026. NICHT ausgeführt.
// NUR gegen ein eigenes Testprojekt (siehe README.md) – NIEMALS gegen die Live-Datenbank.
//
// Start (Beispiel):
//   k6 run -e SUPABASE_URL=https://<testprojekt>.supabase.co \
//          -e SUPABASE_ANON_KEY=<öffentlicher Schlüssel des TESTPROJEKTS> \
//          -e TEST_EMAIL=<Testkonto> -e TEST_PASSWORT=<Passwort des Testkontos> \
//          -e FIRMA=<ID des Unternehmens LASTTEST 2000> \
//          k6-lesen.js
//
// Das Skript meldet sich einmal an und spielt dann nach, was ein offenes Gerät tut:
// alle 60 s den Takt, dazu Schichtplan, Besetzung und Urlaubskonto.

import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Trend } from "k6/metrics";

const URL = __ENV.SUPABASE_URL;
const KEY = __ENV.SUPABASE_ANON_KEY;
const FIRMA = __ENV.FIRMA;

// Sicherung: Abbruch, wenn die Adresse nach Produktion aussieht.
const VERBOTEN = ["ehmphogahhqytscdwtla"]; // Kennung der Live-Datenbank
if (!URL || VERBOTEN.some((v) => URL.includes(v))) {
  fail("Abbruch: SUPABASE_URL fehlt oder zeigt auf die Live-Datenbank.");
}

export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "5m", target: 50 },
    { duration: "2m", target: 300 },
    { duration: "5m", target: 300 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    takt: ["p(95)<200"],
    schichtplan: ["p(95)<800"],
    besetzung: ["p(95)<1500"],
    konto: ["p(95)<800"],
  },
};

const takt = new Trend("takt", true);
const schichtplan = new Trend("schichtplan", true);
const besetzung = new Trend("besetzung", true);
const konto = new Trend("konto", true);

export function setup() {
  const antwort = http.post(
    `${URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: __ENV.TEST_EMAIL, password: __ENV.TEST_PASSWORT }),
    { headers: { apikey: KEY, "Content-Type": "application/json" } },
  );
  if (antwort.status !== 200) fail(`Anmeldung fehlgeschlagen: ${antwort.status}`);
  return { token: antwort.json("access_token") };
}

function rpc(name, body, token) {
  return http.post(`${URL}/rest/v1/rpc/${name}`, JSON.stringify(body), {
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

function tag(versatz) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + versatz);
  return d.toISOString().slice(0, 10);
}

export default function (daten) {
  // Parameter bitte mit den aktuellen Funktions-Signaturen abgleichen.
  let a = rpc("aenderungsstand", {}, daten.token);
  takt.add(a.timings.duration);
  check(a, { "Takt 200": (r) => r.status === 200 });

  a = rpc("shift_plan_grid", { p_company_id: FIRMA, p_from: tag(-7), p_days: 35 }, daten.token);
  schichtplan.add(a.timings.duration);
  check(a, { "Schichtplan 200": (r) => r.status === 200 });

  if (Math.random() < 0.2) {
    a = rpc("staffing_range", { p_company_id: FIRMA, p_from: tag(0), p_days: 31 }, daten.token);
    besetzung.add(a.timings.duration);
    check(a, { "Besetzung 200": (r) => r.status === 200 });
  }

  if (Math.random() < 0.3) {
    a = http.get(`${URL}/rest/v1/leave_balances_view?select=*&year=eq.${new Date().getUTCFullYear()}&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${daten.token}` },
    });
    konto.add(a.timings.duration);
    check(a, { "Konto 200": (r) => r.status === 200 });
  }

  sleep(55 + Math.random() * 10); // Takt alle ~60 s, mit Versatz
}
