// Oberflächen-Tests: die gebaute App gegen eine nachgeahmte Datenbank im Browser prüfen.
//
// Vorher bauen – die Adresse der Datenbank wird beim Bauen fest eingesetzt:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5459 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon \
//   NEXT_PUBLIC_SITE_URL=http://localhost:3125 npm run build
// Dann: npm run test:e2e   (läuft auch automatisch bei GitHub, siehe .github/workflows/tests.yml)
import { ergebnis, starteApp, starteDatenbank } from "./helfer.mjs";
import privat from "./privat.test.mjs";
import betrieb from "./betrieb.test.mjs";
import startseite from "./startseite.test.mjs";
import bereiche from "./bereiche.test.mjs";
import beitritt from "./beitritt.test.mjs";
import fuehrung from "./fuehrung.test.mjs";

const ABLAEUFE = [
  ["Privatbereich", "privat", privat],
  ["Betrieb", "betrieb", betrieb],
  ["Startseite und Profil", "betrieb", startseite],
  ["Betrieb und Privat", "betrieb", bereiche],
  ["Beitritt", "privat", beitritt],
  ["Führung: Mitteilungen und Mitarbeiter", "betrieb", fuehrung],
];

const nur = process.argv[2];
for (const [name, datenbank, ablauf] of ABLAEUFE) {
  if (nur && nur !== datenbank) continue;
  console.log(`\n${name}`);
  const db = await starteDatenbank(datenbank);
  const app = await starteApp();
  try {
    await ablauf({ app });
  } catch (e) {
    ergebnis.fehler.push(`${name}: ${e.message}`);
    console.log(`  ✗ abgebrochen: ${e.message}`);
  } finally {
    app.stopp();
    db.stopp();
    await new Promise((r) => setTimeout(r, 1000));
  }
}

console.log(`\n${ergebnis.ok} in Ordnung, ${ergebnis.fehler.length} fehlgeschlagen`);
for (const f of ergebnis.fehler) console.log(`  ✗ ${f}`);
process.exit(ergebnis.fehler.length ? 1 : 0);
