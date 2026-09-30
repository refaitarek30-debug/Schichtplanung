// Prüft, dass die Fassungen der Rechtstexte in der Anwendung
// (src/lib/legal/version.ts) und in der Datenbank (legal_versions) gleich sind.
//
// Aufruf:  NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/tests/legal_versions.mjs
// Exit-Code 1 bei Abweichung. Nach Änderung einer Fassung: Migration nachziehen.
import { readFileSync } from "node:fs";

const quelle = readFileSync(new URL("../../src/lib/legal/version.ts", import.meta.url), "utf8");
const block = quelle.match(/LEGAL_VERSIONS\s*=\s*\{([^}]*)\}/)?.[1] ?? "";
const app = Object.fromEntries([...block.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen.");
  process.exit(2);
}

const res = await fetch(`${url}/rest/v1/legal_versions?select=doc,version`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error("Abfrage fehlgeschlagen:", res.status);
  process.exit(2);
}
const db = Object.fromEntries((await res.json()).map((r) => [r.doc, r.version]));

let fehler = 0;
for (const doc of Object.keys(app)) {
  const gleich = app[doc] === db[doc];
  console.log(`${gleich ? "OK    " : "FEHLER"} ${doc}: App ${app[doc]} / Datenbank ${db[doc] ?? "fehlt"}`);
  if (!gleich) fehler++;
}
process.exit(fehler ? 1 : 0);
