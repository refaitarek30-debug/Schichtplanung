// Nachgeahmtes Supabase (Auth + PostgREST) für den Privatbereich – nur im Speicher.
import http from "node:http";
import { randomUUID } from "node:crypto";

const U = "11111111-2222-4333-8444-555555555555";
const db = {
  konto: { user_id: U, name: "Max Muster", bundesland: "NW", feiertage_zeigen: true, wochenstunden: null },
  arten: [
    ["Früh", "F", "#F5A524", "arbeit", "06:00:00", "14:00:00", 8, 1],
    ["Spät", "S", "#22A06B", "arbeit", "14:00:00", "22:00:00", 8, 2],
    ["Nacht", "N", "#2F6FDE", "arbeit", "22:00:00", "06:00:00", 8, 3],
    ["Frei", "X", "#E5484D", "frei", null, null, 0, 4],
    ["Urlaub", "U", "#9B59D0", "urlaub", null, null, 8, 5],
    ["Krank", "K", "#F76B15", "krank", null, null, 8, 6],
  ].map(([name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge], i) => ({
    id: `a000000${i}-0000-4000-8000-000000000000`, user_id: U, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge, erstellt_am: `2026-01-0${i + 1}`,
  })),
  tage: new Map(),
  termine: [],
  personen: [],
  gruppen: [{ id: "g1", name: "Familie", mitglieder: 3, von_mir: true }],
  todos: (() => {
    const tag = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    return [
      { id: "d0", titel: "Müll rausstellen", datum: tag(-1), uhrzeit: null, erledigt: false },
      { id: "d1", titel: "💊 Rezept abholen", datum: "2026-10-20", uhrzeit: "09:00", erledigt: false },
      { id: "d4", titel: "Sonnencreme kaufen", datum: tag(0), uhrzeit: null, erledigt: false },
      { id: "d2", titel: "Koffer packen", datum: tag(2), uhrzeit: null, erledigt: false },
      { id: "d3", titel: "Fotos sortieren", datum: null, uhrzeit: null, erledigt: false },
    ];
  })(),
  vorlieben: { rollen: [], vorlagen: [], gefragt: false },
};
const LEA = "5ea00000-0000-4000-8000-000000000001";
db.personen = [
  { id: LEA, name: "Lea", art: "partner", darf_eintragen: true, termine_sehen: true, link_aktiv: true, link_erstellt_am: "2026-10-01T10:00:00Z", zuletzt_genutzt: "2026-10-15T18:00:00Z", erstellt_am: "2026-10-01T10:00:00Z" },
  { id: "6ea00000-0000-4000-8000-000000000002", name: "Mama", art: "familie", darf_eintragen: false, termine_sehen: false, link_aktiv: true, link_erstellt_am: "2026-10-02T10:00:00Z", zuletzt_genutzt: null, erstellt_am: "2026-10-02T10:00:00Z" },
];
db.termine.push({ id: "7ea00000-0000-4000-8000-000000000003", von_partner: true, person_id: LEA, datum: "2026-10-20", titel: "Kino mit Lea", ganztaegig: false, beginn: "19:30", ende: "22:00", wiederholung: "nie", notiz: "", ort: "" });
db.termine.push({ id: "9ea00000-0000-4000-8000-000000000005", von_partner: false, person_id: null, datum: "2026-10-06", bis_datum: null, titel: "🏋️ Training", ganztaegig: false, beginn: "19:00", ende: "20:00", wiederholung: "woechentlich", notiz: "", ort: "", erinnerung: null, ausfaelle: [], serie_ab: null });
db.termine.push({ id: "8ea00000-0000-4000-8000-000000000004", von_partner: false, person_id: null, datum: "2026-10-21", bis_datum: null, titel: "🦷 Zahnarzt", ganztaegig: false, beginn: "14:00", ende: "15:00", wiederholung: "nie", notiz: "", ort: "", erinnerung: "h1" });
const add = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const feiertage = (j) => [[`${j}-01-01`, "Neujahr"], [`${j}-05-01`, "Tag der Arbeit"], [`${j}-10-03`, "Tag der Deutschen Einheit"], [`${j}-11-01`, "Allerheiligen"], [`${j}-12-25`, "1. Weihnachtstag"], [`${j}-12-26`, "2. Weihnachtstag"]].map(([tag, name]) => ({ tag, name }));

function filter(q, zeilen) {
  for (const [k, v] of q) {
    if (["select", "order", "limit", "on_conflict", "columns"].includes(k)) continue;
    const [op, ...r] = v.split("."); const w = r.join(".");
    zeilen = zeilen.filter((z) => {
      const x = String(z[k]);
      if (op === "eq") return x === w;
      if (op === "gte") return x >= w;
      if (op === "lte") return x <= w;
      if (op === "in") return w.replace(/[()"]/g, "").split(",").includes(x);
      return true;
    });
  }
  return zeilen;
}

db.personen = []; db.termine = []; db.todos = []; db.gruppen = []; db.verbindungen = []; db.fremd = [];
{ // Beispiel-Schichtfolge: 2 Früh, 2 Spät, 2 Nacht, 2 frei – so, dass der 24.10.2026 eine Nachtschicht ist
  const ids = [0, 0, 1, 1, 2, 2, 3, 3].map((i) => `a000000${i}-0000-4000-8000-000000000000`);
  for (let t = "2026-09-01", n = 0; t <= "2027-02-28"; t = add(t, 1), n++) {
    const tage = Math.round((Date.parse(t) - Date.parse("2026-10-01")) / 864e5);
    db.tage.set(`${t}|1`, ids[(((tage + 5) % 8) + 8) % 8]);
  }
}

http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const url = new URL(req.url, "http://x"); const q = [...url.searchParams.entries()];
    const body = b ? JSON.parse(b) : null; const m = req.method;
    const objekt = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    const kors = { "access-control-allow-origin": req.headers.origin ?? "*", "access-control-allow-credentials": "true", "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    if (req.method === "OPTIONS") { res.writeHead(204, kors); return res.end(); }
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json", ...kors }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
    const liste = (zeilen) => objekt ? (zeilen.length === 1 ? send(200, zeilen[0]) : send(406, { code: "PGRST116", message: "0 rows" })) : send(200, zeilen);
    const p = url.pathname;
    if (p.startsWith("/auth/v1/user")) return send(200, { id: U, aud: "authenticated", email: "t@example.invalid" });
    if (p.startsWith("/auth/v1/logout")) return send(204);
    if (p === "/rest/v1/profiles") return liste([]);
    if (p === "/rest/v1/privat_konten") {
      if (m === "PATCH") { Object.assign(db.konto, body); return send(204); }
      return liste(filter(q, [db.konto]));
    }
    if (p === "/rest/v1/privat_schichtarten") {
      if (m === "GET") return liste([...db.arten].sort((a, b) => a.reihenfolge - b.reihenfolge));
      if (m === "POST") { const z = Array.isArray(body) ? body : [body]; for (const r of z) db.arten.push({ id: randomUUID(), erstellt_am: new Date().toISOString(), ...r }); return send(201); }
      if (m === "PATCH") { for (const a of filter(q, db.arten)) Object.assign(a, body); return send(204); }
      if (m === "DELETE") { const weg = filter(q, db.arten).map((a) => a.id); db.arten = db.arten.filter((a) => !weg.includes(a.id)); for (const [t, id] of db.tage) if (weg.includes(id)) db.tage.delete(t); return send(204); }
    }
    if (p === "/rest/v1/privat_tage") {
      const zeilen = () => [...db.tage].map(([k, schichtart_id]) => ({ user_id: U, tag: k.split("|")[0], ebene: Number(k.split("|")[1]), schichtart_id }));
      if (m === "GET") return liste(filter(q, zeilen()));
      if (m === "POST") { for (const r of body) db.tage.set(`${r.tag}|${r.ebene}`, r.schichtart_id); return send(201); }
      if (m === "DELETE") { for (const z of filter(q, zeilen())) db.tage.delete(`${z.tag}|${z.ebene}`); return send(204); }
    }
    if (p.startsWith("/rest/v1/rpc/")) {
      const f = p.slice(13);
      if (f === "privat_rotation_anwenden") {
        let n = 0; const L = body.p_muster.length;
        for (let t = body.p_start, i = 0; t <= body.p_bis; t = add(t, 1), i++) {
          const id = body.p_muster[i % L];
          if (id === null) { if (body.p_ueberschreiben) db.tage.delete(`${t}|1`); continue; }
          if (!db.tage.has(`${t}|1`) || body.p_ueberschreiben) { db.tage.set(`${t}|1`, id); n++; }
        }
        return send(200, n);
      }
      if (f === "privat_feiertage") return send(200, feiertage(body.p_jahr));
      if (f === "meine_termine") return send(200, db.termine);
      if (f === "termin_ausnahme") { const t = db.termine.find((x) => x.id === body.p_id); if (!t) return send(400, { message: "weg" }); if (body.p_ab) { if (body.p_datum <= t.datum) { db.termine = db.termine.filter((x) => x.id !== t.id); return send(200, true); } t.serie_ab = body.p_datum; } else { (t.ausfaelle ??= []).push(body.p_datum); } return send(200, false); }
      if (f === "termin_loeschen") { db.termine = db.termine.filter((t) => t.id !== body.p_id); return send(204); }
      if (f === "verbindung_termin_loeschen") { db.fremd = (db.fremd ?? []).filter((t) => t.id !== body.p_id); return send(204); }
      if (f === "termin_speichern") { const id = body.p_id ?? randomUUID(); db.termine = db.termine.filter((t) => t.id !== id); db.termine.push({ id, von_partner: false, datum: body.p_datum, titel: body.p_titel, ganztaegig: body.p_ganztaegig, beginn: body.p_beginn, ende: body.p_ende, wiederholung: body.p_wiederholung, notiz: body.p_notiz, ort: body.p_ort }); return send(200, id); }
      if (f === "termin_sichern") { const id = body.p_id ?? randomUUID(); const alt = db.termine.find((t) => t.id === id); db.termine = db.termine.filter((t) => t.id !== id); db.termine.push({ ...(alt ?? {}), id, von_partner: alt?.von_partner ?? false, datum: body.p_datum, bis_datum: body.p_bis_datum, titel: body.p_titel, ganztaegig: body.p_ganztaegig, beginn: body.p_beginn, ende: body.p_ende, wiederholung: body.p_wiederholung, notiz: body.p_notiz, ort: body.p_ort, erinnerung: body.p_erinnerung }); return send(200, id); }
      if (f === "meine_todos") return send(200, db.todos);
      if (f === "todo_speichern") { const id = randomUUID(); db.todos.push({ id, titel: body.p_titel, datum: body.p_datum, uhrzeit: body.p_uhrzeit, erledigt: false }); return send(200, id); }
      if (f === "todo_erledigt") { const t = db.todos.find((x) => x.id === body.p_id); if (t) t.erledigt = body.p_an; return send(204); }
      if (f === "todo_loeschen") { db.todos = db.todos.filter((x) => x.id !== body.p_id); return send(204); }
      if (f === "meine_vorlieben") return send(200, db.vorlieben);
      if (f === "vorlieben_setzen") { if (body.p_rollen) db.vorlieben.rollen = body.p_rollen; if (body.p_vorlagen) db.vorlieben.vorlagen = body.p_vorlagen; db.vorlieben.gefragt = true; return send(204); }
      if (f === "meine_verbindungen") return send(200, db.verbindungen ?? (db.verbindungen = [{ id: "v1", partner: "p2", name: "Sam", art: "partner", ichTermine: false, ichDarf: false, erTermine: true, erDarf: true, seit: "2026-10-10T10:00:00Z" }]));
      if (f === "verbundene_tage") return send(200, []);
      if (false) { const t = {}; for (let i = 0; i < body.p_tage; i++) t[add(body.p_von, i)] = ["S", "S", "N", "X"][i % 4]; return send(200, [{ id: "p2", tage: t, farben: { S: "#FF8800" } }]); }
      if (f === "verbundene_termine") return send(200, db.fremd ?? (db.fremd = [{ id: "ft1", inhaber: "p2", von_user: null, datum: "2026-10-22", bis_datum: null, titel: "⚽ Sam Fußball", ganztaegig: false, beginn: "18:00", ende: "19:30", wiederholung: "nie", notiz: "", ort: "" }]));
      if (f === "verbindung_code_erstellen") return send(200, { code: "K7P4QX", gueltig_bis: "2026-10-17T12:00:00Z" });
      if (f === "verbindung_code_info") return send(200, body.p_code === "ABC234" ? { gueltig: true, name: "Mia", eigener: false, schon: false, uebernahme: false } : { gueltig: false });
      if (f === "verbindung_annehmen") { if (body.p_code !== "ABC234") return send(200, null); db.verbindungen.push({ id: "v2", partner: "p3", name: "Mia", art: "partner", ichTermine: false, ichDarf: false, erTermine: false, erDarf: false, seit: new Date().toISOString() }); return send(200, "v2"); }
      if (f === "verbindung_aendern") { const v = db.verbindungen.find((x) => x.id === body.p_id); Object.assign(v, { art: body.p_art, ichTermine: body.p_termine, ichDarf: body.p_darf }); return send(204); }
      if (f === "verbindung_termin_speichern") { db.fremd.push({ id: randomUUID(), inhaber: body.p_partner, von_user: U, datum: body.p_datum, bis_datum: null, titel: body.p_titel, ganztaegig: body.p_ganztaegig, beginn: body.p_beginn, ende: body.p_ende, wiederholung: "nie", notiz: "", ort: "" }); return send(200, "x"); }
      if (f === "meine_partner_tage") return send(200, []);
      if (false) return send(200, [{ tag: add(body.p_von, 10), schicht: "N" }]);
      // ---- Personen und Gruppen (0151/0152) ----
      if (f === "meine_personen") return send(200, db.personen);
      if (f === "einladung_erstellen") { const id = randomUUID(); db.personen.push({ id, name: body.p_name, art: body.p_art, darf_eintragen: body.p_darf_eintragen, termine_sehen: body.p_termine_sehen, link_aktiv: false, link_erstellt_am: null, zuletzt_genutzt: null, erstellt_am: new Date().toISOString() }); (db.einladungen ??= {})[id] = "2026-10-24T12:00:00Z"; return send(200, { code: "M3XQ7P", gueltig_bis: "2026-10-24T12:00:00Z", person: id }); }
      if (f === "meine_einladungen") return send(200, Object.entries(db.einladungen ?? {}).map(([person, bis]) => ({ person, bis })));
      if (f === "verbindung_annehmen") return send(200, body.p_code === "ABC234" ? "v-neu" : null);
      if (f === "person_anlegen") { const id = randomUUID(); db.personen.push({ id, name: body.p_name, art: body.p_art, darf_eintragen: body.p_darf_eintragen, termine_sehen: body.p_termine_sehen, link_aktiv: true, link_erstellt_am: new Date().toISOString(), zuletzt_genutzt: null, erstellt_am: new Date().toISOString() }); return send(200, { id, schluessel: "a".repeat(48) }); }
      if (f === "person_aendern") { const p2 = db.personen.find((x) => x.id === body.p_id); Object.assign(p2, { name: body.p_name, art: body.p_art, darf_eintragen: body.p_darf_eintragen, termine_sehen: body.p_termine_sehen }); return send(204); }
      if (f === "person_link_neu") return send(200, "c".repeat(48));
      if (f === "person_link_beenden") { db.personen.find((x) => x.id === body.p_id).link_aktiv = false; return send(204); }
      if (f === "person_entfernen") { db.personen = db.personen.filter((x) => x.id !== body.p_id); return send(204); }
      if (f === "meine_personen_tage") {
        const aus = []; const folge = ["S", "S", "N", "N", "X", "X", "F", "F"];
        for (let t = body.p_von, i = 0; t <= body.p_bis; t = add(t, 1), i++) if (db.personen.some((x) => x.id === LEA)) aus.push({ person_id: LEA, tag: t, schicht: folge[i % 8] });
        return send(200, aus);
      }
      if (f === "meine_gruppen") return send(200, db.gruppen);
      if (f === "gruppe_erstellen") { db.gruppen.push({ id: "g2", name: body.p_name, mitglieder: 1, von_mir: true }); return send(200, { id: "g2", schluessel: "b".repeat(48) }); }
      if (f === "gruppe_link_neu") return send(200, "d".repeat(48));
      if (f === "gruppe_verlassen") { db.gruppen = db.gruppen.filter((g) => g.id !== body.p_gruppe); return send(204); }
      const code = (t, versatz) => ["F", "F", "X", "X", "S", "S", "X"][(Date.parse(t) / 864e5 + versatz) % 7 | 0];
      if (f === "meine_gruppen_tage") {
        if (!db.gruppen.some((g) => g.id === "g1")) return send(200, []);
        const tage = (v) => Object.fromEntries(Array.from({ length: body.p_tage }, (_, i) => [add(body.p_von, i), code(add(body.p_von, i), v)]));
        return send(200, [{ id: "u1", name: "Papa", gruppen: ["g1"], tage: tage(0) }, { id: "u2", name: "Oma", gruppen: ["g1"], tage: tage(3) }]);
      }
      if (f === "gruppe_tage") {
        const tage = (v) => Object.fromEntries(Array.from({ length: body.p_tage }, (_, i) => [add(body.p_von, i), code(add(body.p_von, i), v)]));
        return send(200, [{ id: U, name: "Tarek", ich: true, tage: tage(5) }, { id: "u1", name: "Papa", ich: false, tage: tage(0) }, { id: "u2", name: "Oma", ich: false, tage: tage(3) }]);
      }
      if (f === "hat_funktion") return send(200, true);
      if (f === "abo_status" || f === "partner_einladung_status") return send(200, []);
      return send(200, null);
    }
    send(404, { message: "unbekannt " + p });
  });
}).listen(Number(process.env.PORT ?? 5457));
