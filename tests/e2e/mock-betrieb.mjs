// Nachgeahmtes Supabase (Auth + PostgREST) für den Betrieb – nur im Speicher, für die Tests.
import http from "node:http";
import { randomUUID } from "node:crypto";

const U = "11111111-2222-4333-8444-555555555555";
const FIRMA = true;
const PROFIL = { id: U, company_id: "c0000000-0000-4000-8000-000000000001", employee_id: "e0", first_name: "Tarek", last_name: "Test", email: "t@example.invalid", role: process.env.ROLLE ?? "admin", avatar_url: null, active: true, hidden_dashboard_tiles: ["zeige:naechsterurlaub"], start_seite: null, start_ansicht: process.env.ANSICHT ?? "klassisch", neuigkeiten_gesehen: null,
  companies: { id: "c0000000-0000-4000-8000-000000000001", name: "Testbetrieb", logo_url: null, active: true, setup_completed_at: "2026-01-01T00:00:00Z", is_demo: false, demo_expires_at: null, v_tag_name: "Zeitausgleichstag", v_tage_name: "Zeitausgleichstage" },
  employees: { personnel_number: "100", department: null, shifts: { name: "Frühschicht" } } };
const db = {
  konto: { user_id: U, name: "Tarek Test", bundesland: "NW", feiertage_zeigen: true, wochenstunden: null },
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

const MITARBEITER = [
  ["e0", "Tarek", "Test", "admin", "s1", true],
  ["e1", "Louis", "Becker", "employee", "s2", true],
  ["e2", "Mia", "Wagner", "employee", "s1", false],
].map(([id, first_name, last_name, role, shift_id, konto]) => ({ id, company_id: "c0000000-0000-4000-8000-000000000001", personnel_number: "1", first_name, last_name, email: first_name.toLowerCase() + "@x.invalid", phone: null, role, department: null, shift_id, vacation_days: 30, active: true, rotation_team: null, v_days: 0, shift_worker: true, entry_date: null, exit_date: null, is_apprentice: false, bildungsurlaub_erlaubt: false, sonderurlaub_erlaubt: false, shifts: { name: shift_id === "s1" ? "Frühschicht" : "Spätschicht" }, _konto: konto }));
const HINWEISE = [];
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
    if (p === "/rest/v1/profiles" && m === "PATCH") { for (const k of ["start_ansicht", "neuigkeiten_gesehen"]) if (k in body) PROFIL[k] = body[k]; return send(204); }
    if (p === "/rest/v1/personal_details") {
      if (m === "PATCH") { db.geburt = { birth_date: body.birth_date ?? null, birth_date_bestaetigt: !body.birth_date || PROFIL.role === "admin" }; return send(204); }
      return liste([db.geburt ?? { birth_date: null, birth_date_bestaetigt: true }]);
    }
    if (p === "/rest/v1/profiles") return liste(url.searchParams.get("select") === "employee_id" ? MITARBEITER.filter((e) => e._konto).map((e) => ({ employee_id: e.id })) : [PROFIL]);
    if (p === "/rest/v1/employees" && m === "GET") return liste(MITARBEITER.map(({ _konto, ...e }) => e));
    if (p === "/rest/v1/anzeige_einstellungen") {
      if (m === "GET") return liste(db.anzeige ? [db.anzeige] : []);
      db.anzeige = { ...(db.anzeige ?? {}), ...(Array.isArray(body) ? body[0] : body) }; return send(201);
    }
    if (p === "/rest/v1/leave_requests" && m === "GET") {
      const r = (id, von, bis, status, tage) => ({ id, company_id: "c0000000-0000-4000-8000-000000000001", employee_id: "e0", start_date: von, end_date: bis, half_day: false, half_day_period: null, requested_days: tage, reason: null, status, rejection_reason: status === "rejected" ? "Besetzung zu knapp" : null, reviewed_by: null, reviewed_at: status === "pending" ? null : "2026-10-01T10:00:00Z", created_at: "2026-09-20T10:00:00Z", updated_at: "2026-09-20T10:00:00Z", kind: "urlaub", request_group_id: null, withdrawn_at: status === "withdrawn" ? "2026-10-02T10:00:00Z" : null, withdrawn_by: null, withdrawal_reason: null, employees: { first_name: "Tarek", last_name: "Test", shift_id: "s1", shifts: { name: "Frühschicht" } } });
      return liste(filter(q.filter(([k, v]) => k === "status" && v === "eq.pending"), [r("r1", "2026-12-21", "2026-12-24", "pending", 4), r("r2", "2027-01-05", "2027-01-07", "pending", 3), r("r3", "2026-08-03", "2026-08-14", "approved", 10), r("r4", "2026-05-11", "2026-05-12", "approved", 2), r("r5", "2026-07-01", "2026-07-03", "rejected", 3), r("r6", "2026-06-01", "2026-06-02", "withdrawn", 2)]));
    }
    if (p === "/rest/v1/leave_balances_view") return liste([{ year: new Date().getFullYear(), entitlement: 30, carried_over: 3, used_days: 20, planned_days: 2, pending_days: 1, remaining_days: 10, v_entitlement: 6, v_carried_over: 0, v_korrektur: 0, v_used_days: 4, v_pending_days: 0, v_remaining_days: 2, v_fehl_stunden: 0 }]);
    // Seite Mitteilungen: eine kommende Urlaubssperre, Mitteilungen an alle zum Anlegen.
    if (p === "/rest/v1/staffing_rules") return liste(url.searchParams.get("key") !== "eq.urlaubssperre" ? [] : [{ id: "sp1", shift_id: null, active: true, value: { start: "2027-11-09", end: "2027-11-20", reason: "Stillstand" } }]);
    if (p === "/rest/v1/announcements") {
      if (m === "POST") { const z = Array.isArray(body) ? body[0] : body; db.mitteilungen = [{ id: randomUUID(), title: z.title, body: z.body, level: z.level, active: true, created_at: new Date().toISOString() }, ...(db.mitteilungen ?? [])]; return send(201); }
      if (m === "PATCH") { const id = (url.searchParams.get("id") ?? "").replace("eq.", ""); db.mitteilungen = (db.mitteilungen ?? []).filter((x) => x.id !== id); return send(204); }
      return liste(db.mitteilungen ?? []);
    }
    if (p === "/rest/v1/privacy_settings") return liste([{ accepted_at: "2026-01-01T00:00:00Z", user_id: U }]);
    if (p === "/rest/v1/kalender_farben") return liste([{ schluessel: "schicht:F", farbe: "#E5484D" }, { schluessel: "abw:U", farbe: "#0EA5E9" }]);
    if (p === "/rest/v1/shifts") return liste([
      { id: "s1", name: "Frühschicht", short_name: "F", start_time: "06:00:00", end_time: "14:00:00", target_staff: 5, minimum_staff: 3, weekdays: [1,2,3,4,5,6,7], color: null, active: true },
      { id: "s2", name: "Spätschicht", short_name: "S", start_time: "14:00:00", end_time: "22:00:00", target_staff: 5, minimum_staff: 3, weekdays: [1,2,3,4,5,6,7], color: null, active: true },
      { id: "s3", name: "Nachtschicht", short_name: "N", start_time: "22:00:00", end_time: "06:00:00", target_staff: 4, minimum_staff: 2, weekdays: [1,2,3,4,5,6,7], color: null, active: true }]);
    if (p === "/rest/v1/privat_konten") {
      if (m === "PATCH") { Object.assign(db.konto, body); return send(204); }
      // Privatbereich erst nach „Privatbereich einrichten“ (Migration 0194).
      return liste(db.privatAn ? filter(q, [db.konto]) : []);
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
      if (f === "verbundene_tage") { const t = {}; for (let i = 0; i < body.p_tage; i++) t[add(body.p_von, i)] = ["S", "S", "N", "X"][i % 4]; return send(200, [{ id: "p2", tage: t, farben: { S: "#FF8800" } }]); }
      if (f === "verbundene_termine") return send(200, db.fremd ?? (db.fremd = [{ id: "ft1", inhaber: "p2", von_user: null, datum: "2026-10-22", bis_datum: null, titel: "⚽ Sam Fußball", ganztaegig: false, beginn: "18:00", ende: "19:30", wiederholung: "nie", notiz: "", ort: "" }]));
      if (f === "verbindung_code_erstellen") return send(200, { code: "K7P4QX", gueltig_bis: "2026-10-17T12:00:00Z" });
      if (f === "verbindung_code_info") return send(200, body.p_code === "ABC234" ? { gueltig: true, name: "Mia", eigener: false, schon: false, uebernahme: false } : { gueltig: false });
      if (f === "verbindung_annehmen") { if (body.p_code !== "ABC234") return send(200, null); db.verbindungen.push({ id: "v2", partner: "p3", name: "Mia", art: "partner", ichTermine: false, ichDarf: false, erTermine: false, erDarf: false, seit: new Date().toISOString() }); return send(200, "v2"); }
      if (f === "verbindung_aendern") { const v = db.verbindungen.find((x) => x.id === body.p_id); Object.assign(v, { art: body.p_art, ichTermine: body.p_termine, ichDarf: body.p_darf }); return send(204); }
      if (f === "verbindung_termin_speichern") { db.fremd.push({ id: randomUUID(), inhaber: body.p_partner, von_user: U, datum: body.p_datum, bis_datum: null, titel: body.p_titel, ganztaegig: body.p_ganztaegig, beginn: body.p_beginn, ende: body.p_ende, wiederholung: "nie", notiz: "", ort: "" }); return send(200, "x"); }
      if (f === "meine_partner_tage") return send(200, [{ tag: add(body.p_von, 10), schicht: "N" }]);
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
      if (f === "hinweis_senden") {
        if (!body.p_text?.trim()) return send(400, { code: "P0001", message: "Bitte einen Text eingeben." });
        const ab = body.p_push === "aus" ? null : body.p_push === "sofort" ? new Date().toISOString() : new Date(Date.now() + 9 * 3600e3).toISOString();
        const jetzt = new Date().toISOString();
        for (const id of body.p_empfaenger) { const e = MITARBEITER.find((x) => x.id === id); HINWEISE.unshift({ id: randomUUID(), employee_id: id, empfaenger: e.first_name + " " + e.last_name, text: body.p_text, ziel: body.p_ziel, push: body.p_push, push_ab: ab, zeigen_ab: body.p_push === "schicht" ? ab : null, push_gesendet: false, von_name: "Tarek Test", erstellt_am: jetzt, gelesen_am: null, zurueckgezogen_am: null }); }
        db.letzterHinweis = body; return send(200, body.p_empfaenger.length);
      }
      if (f === "meine_hinweise") return send(200, HINWEISE.filter((h) => h.employee_id === "e0" && !h.gelesen_am && !h.zurueckgezogen_am && (!h.zeigen_ab || new Date(h.zeigen_ab) <= new Date())).reverse());
      if (f === "hinweis_gelesen") { const h = HINWEISE.find((x) => x.id === body.p_id); if (h) h.gelesen_am = new Date().toISOString(); return send(204); }
      if (f === "hinweise_gesendet") return send(200, HINWEISE);
      if (f === "hinweis_zurueckziehen") { const h = HINWEISE.find((x) => x.id === body.p_id); if (h) h.zurueckgezogen_am = new Date().toISOString(); return send(204); }
      if (f === "_letzter") return send(200, db.letzterHinweis ?? null);
      if (f === "hat_funktion") return send(200, true);
      if (f === "mein_naechster_urlaub") { const h = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); return send(200, [{ von: add(h, -3), bis: add(h, 8), tage: 8, kalendertage: 12, arten: ["urlaub"], offen: false }]); }
      // ---- Ein Konto, zwei Bereiche (0194) ----
      if (f === "privatbereich_einrichten") { db.privatAn = true; db.konto.neuigkeiten_gesehen = null; return send(204); }
      if (f === "meine_betriebsschichten") {
        if (!PROFIL.active) return send(200, []);
        const aus = []; const folge = [["Frühschicht", "F"], ["Frühschicht", "F"], ["Spätschicht", "S"], ["Spätschicht", "S"], null, null];
        for (let t = body.p_von, i = 0; t <= body.p_bis; t = add(t, 1), i++) { const s2 = folge[i % 6]; aus.push(s2 ? { tag: t, name: s2[0], kuerzel: s2[1] } : { tag: t, name: "Frei", kuerzel: "FREI" }); }
        return send(200, aus);
      }
      if (f === "austritt_stand") return send(200, [{ ausgetreten: !PROFIL.active, firma: "Testbetrieb", hat_privat: !!db.privatAn, erledigt: !!PROFIL.austritt_uebernommen_am }]);
      if (f === "privat_weitermachen") { if (PROFIL.active) return send(400, { code: "P0001", message: "Das geht nur, wenn dein Zugang zum Betrieb beendet ist." }); db.privatAn = true; PROFIL.austritt_uebernommen_am = new Date().toISOString(); return send(204); }
      if (f === "privat_neuigkeiten_gelesen") { db.konto.neuigkeiten_gesehen = new Date().toISOString(); return send(204); }
      if (f === "_austritt") { PROFIL.active = false; return send(204); }
      if (f === "meine_stammdaten_setzen") { PROFIL.employees.personnel_number = body.p_personalnummer; PROFIL.employees.department = body.p_abteilung; db.stammdaten = body; return send(204); }
      if (f === "geburtsdaten_offen") return send(200, db.geburtOffen ?? (db.geburtOffen = [{ employee_id: "e1", name: "Anna Becker", birth_date: "1969-03-14", geaendert_am: new Date().toISOString() }]));
      if (f === "geburtsdatum_bestaetigen") { db.geburtOffen = (db.geburtOffen ?? []).filter((z) => z.employee_id !== body.p_employee_id); return send(204); }
      if (f === "hinweis_standard") return send(200, db.hinweisStandard ?? "schicht");
      if (f === "set_hinweis_standard") { db.hinweisStandard = body.p_wert; return send(200, null); }
      if (f === "schichtplan_kompakt") {
        const gruppen = ["Schicht A", "Schicht B", "Schicht C"]; const namen = ["Anna Becker", "Lukas Schmitz", "Mia Wagner", "Tom Hoffmann", "Rita Neumann", "Eva Musterfrau", "Ben Krause", "Ida Vogel", "Ole Brandt", "Paul Lang", "Jana Roth", "Kai Busch"];
        const folge = ["F", "F", "S", "S", "N", "N", null, null, null, null];
        const name = { F: "Frühschicht", S: "Spätschicht", N: "Nachtschicht" };
        return send(200, namen.map((n, i) => ({ employee_id: "e" + i, employee_name: n, rotation_team: gruppen[i % 3], personnel_number: String(100 + i), is_me: i === 0, is_apprentice: i === 7,
          tage: Array.from({ length: body.p_days }, (_, d) => { const t = add(body.p_from, d); const c = folge[(d + (i % 3) * 3) % 10]; const abw = i === 2 && d > 3 && d < 8 ? "U" : i === 4 && d === 6 ? "u" : i === 5 && d === 9 ? "K" : null; return [t, c ? name[c] : null, c, abw]; }) })));
      }
      if (f === "blocked_days" || f === "school_holidays_for_range") return send(200, []);
      // Entscheiden darf die Führung über alle im Testbetrieb.
      if (f === "entscheidbare_mitarbeiter") return send(200, MITARBEITER.map((e) => ({ employee_id: e.id })));
      if (f === "abo_status" || f === "partner_einladung_status") return send(200, []);
      return send(200, null);
    }
    if (FIRMA && m === "GET") return liste([]);
    send(404, { message: "unbekannt " + p });
  });
}).listen(Number(process.env.PORT ?? 5459));
