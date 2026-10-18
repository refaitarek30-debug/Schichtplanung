/**
 * Kalender-Datei (.ics) lesen – für „Schichten übernehmen“ im Privatbereich.
 * Läuft nur im Browser, nichts davon geht an den Server.
 *
 * Gelesen wird, was Schicht-Apps und Kalender üblicherweise exportieren:
 * Ganztagstermine, Termine mit Uhrzeit (UTC „Z“, mit Zeitzone oder ohne) und
 * einfache Wiederholungen (täglich/wöchentlich). Alles andere wird nur mit
 * seinem ersten Termin gelesen.
 */

export interface Gruppe {
  /** Name des Eintrags, z. B. „Frühdienst“ */
  name: string;
  /** Tage (YYYY-MM-DD), an denen er vorkommt */
  tage: string[];
  /** Häufigste Uhrzeiten "HH:MM"; leer = ganztägig */
  beginn: string;
  ende: string;
  ganztaegig: boolean;
}

export interface LeseErgebnis {
  gruppen: Gruppe[];
  /** Anzahl gelesener Termine (VEVENT) */
  termine: number;
  /** Kleinster und größter Tag, null ohne Tage */
  von: string | null;
  bis: string | null;
  /** Wiederholungen, die nicht aufgelöst werden konnten (nur erster Termin gelesen) */
  einfach: number;
}

export class IcsFehler extends Error {}

export const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TERMINE = 20_000;
const MAX_TAGE_JE_TERMIN = 400;
const MAX_WIEDERHOLUNGEN = 800;
const FRUEHESTER_TAG = "2000-01-01";
const SPAETESTER_TAG = "2100-12-31";
const ZEITZONE = "Europe/Berlin";

function tagPlus(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/** Zeilen entfalten (Fortsetzung beginnt mit Leerzeichen oder Tab). */
function zeilen(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function entschluesseln(s: string): string {
  return s.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === "n" || c === "N" ? " " : c)).trim();
}

interface Eigenschaft {
  name: string;
  parameter: Record<string, string>;
  wert: string;
}

function eigenschaft(zeile: string): Eigenschaft | null {
  // NAME;PARAM=WERT;PARAM2="wert:mit:doppelpunkt":WERT
  let i = 0;
  let inAnf = false;
  for (; i < zeile.length; i++) {
    const c = zeile[i]!;
    if (c === '"') inAnf = !inAnf;
    else if (c === ":" && !inAnf) break;
  }
  if (i >= zeile.length) return null;
  const kopf = zeile.slice(0, i);
  const wert = zeile.slice(i + 1);
  const teile: string[] = [];
  let aktuell = "";
  inAnf = false;
  for (const c of kopf) {
    if (c === '"') inAnf = !inAnf;
    if (c === ";" && !inAnf) {
      teile.push(aktuell);
      aktuell = "";
    } else aktuell += c;
  }
  teile.push(aktuell);
  const name = teile[0]!.toUpperCase();
  const parameter: Record<string, string> = {};
  for (const t of teile.slice(1)) {
    const k = t.indexOf("=");
    if (k > 0) parameter[t.slice(0, k).toUpperCase()] = t.slice(k + 1).replace(/^"|"$/g, "");
  }
  return { name, parameter, wert };
}

interface Zeitpunkt {
  /** Tag in lokaler Zeit (Berlin, wo die Zone bekannt ist) */
  tag: string;
  /** "HH:MM" oder null bei ganztägig */
  zeit: string | null;
}

/** Datum oder Datum mit Uhrzeit lesen; UTC und Zeitzonen werden nach Berlin umgerechnet. */
function zeitpunkt(e: Eigenschaft): Zeitpunkt | null {
  const w = e.wert.trim();
  const datum = /^(\d{4})(\d{2})(\d{2})$/.exec(w);
  if (datum) return { tag: `${datum[1]}-${datum[2]}-${datum[3]}`, zeit: null };
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(w);
  if (!m) return null;
  const [, j, mo, t, h, mi, s, z] = m;
  const tag = `${j}-${mo}-${t}`;
  const hhmm = `${h}:${mi}`;
  const zone = z ? "UTC" : e.parameter.TZID;
  if (!zone || zone === ZEITZONE) return { tag, zeit: hhmm };
  try {
    const utcMs = zone === "UTC" ? Date.UTC(+j!, +mo! - 1, +t!, +h!, +mi!, +(s ?? 0)) : null;
    if (utcMs !== null) return nachBerlin(utcMs);
    // Andere Zone: die Uhrzeit dort in Berlin umrechnen (Näherung über den Versatz der Zone).
    const grob = Date.UTC(+j!, +mo! - 1, +t!, +h!, +mi!, +(s ?? 0));
    const versatz = zonenVersatz(zone, grob);
    return nachBerlin(grob - versatz);
  } catch {
    return { tag, zeit: hhmm };
  }
}

function nachBerlin(utcMs: number): Zeitpunkt {
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utcMs));
  // "2026-10-20 06:00"
  return { tag: teile.slice(0, 10), zeit: teile.slice(11, 16) };
}

/** Wie viele Millisekunden die Zone gegenüber UTC vorgeht (zu diesem Zeitpunkt). */
function zonenVersatz(zone: string, ms: number): number {
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
  const lokal = Date.parse(`${teile.slice(0, 10)}T${teile.slice(11, 19)}Z`);
  return lokal - ms;
}

interface Regel {
  freq: "DAILY" | "WEEKLY" | null;
  interval: number;
  count: number | null;
  until: string | null;
  tage: number[];
}

const WOCHENTAGE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function regel(wert: string): Regel {
  const r: Regel = { freq: null, interval: 1, count: null, until: null, tage: [] };
  for (const teil of wert.split(";")) {
    const [k, v = ""] = teil.split("=");
    if (k === "FREQ" && (v === "DAILY" || v === "WEEKLY")) r.freq = v;
    else if (k === "INTERVAL") r.interval = Math.max(1, Math.min(52, Number(v) || 1));
    else if (k === "COUNT") r.count = Math.max(1, Math.min(MAX_WIEDERHOLUNGEN, Number(v) || 1));
    else if (k === "UNTIL") {
      const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
      if (m) r.until = `${m[1]}-${m[2]}-${m[3]}`;
    } else if (k === "BYDAY") {
      r.tage = v
        .split(",")
        .map((x) => WOCHENTAGE.indexOf(x.slice(-2)))
        .filter((x) => x >= 0);
    }
  }
  return r;
}

/** Starttage einer Wiederholung (einschließlich des ersten). */
function wiederholungen(start: string, r: Regel): string[] {
  if (!r.freq) return [start];
  const grenze = r.until && r.until < SPAETESTER_TAG ? r.until : tagPlus(start, 365 * 2);
  const ende = r.count === null && !r.until ? tagPlus(start, 365) : grenze;
  const tage: string[] = [];
  const startWochentag = new Date(`${start}T12:00:00Z`).getUTCDay();
  const wochentage = r.tage.length ? r.tage : [startWochentag];
  for (let tag = start; tag <= ende && tage.length < (r.count ?? MAX_WIEDERHOLUNGEN); tag = tagPlus(tag, 1)) {
    const diff = tageZwischen(start, tag);
    if (r.freq === "DAILY") {
      if (diff % r.interval === 0) tage.push(tag);
    } else {
      const woche = Math.floor(diff / 7);
      const wt = new Date(`${tag}T12:00:00Z`).getUTCDay();
      if (woche % r.interval === 0 && wochentage.includes(wt)) tage.push(tag);
    }
  }
  return tage.length ? tage : [start];
}

function minuten(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

export function leseIcs(text: string): LeseErgebnis {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new IcsFehler("Das ist keine Kalender-Datei (.ics).");

  const gruppen = new Map<string, { tage: Set<string>; zeiten: Map<string, number>; ganz: number; zeit: number }>();
  let termine = 0;
  let einfach = 0;
  let event: Eigenschaft[] | null = null;

  const verarbeite = (props: Eigenschaft[]) => {
    termine += 1;
    if (termine > MAX_TERMINE) throw new IcsFehler("Die Datei hat zu viele Einträge (mehr als 20.000).");
    const get = (n: string) => props.find((p) => p.name === n);
    if (get("STATUS")?.wert.toUpperCase() === "CANCELLED") return;
    const name = entschluesseln(get("SUMMARY")?.wert ?? "").replace(/\s+/g, " ");
    const s = get("DTSTART");
    if (!name || !s) return;
    const start = zeitpunkt(s);
    if (!start) return;
    const eEig = get("DTEND");
    const ende = eEig ? zeitpunkt(eEig) : null;

    let ganz = start.zeit === null;
    let tageEinzel: string[];
    let beginn = "";
    let endeZeit = "";
    if (ganz) {
      // Ganztägig: DTEND ist der erste Tag nach dem Termin.
      const letzter = ende && ende.tag > start.tag ? tagPlus(ende.tag, -1) : start.tag;
      const anzahl = Math.min(MAX_TAGE_JE_TERMIN, tageZwischen(start.tag, letzter) + 1);
      tageEinzel = Array.from({ length: Math.max(1, anzahl) }, (_, i) => tagPlus(start.tag, i));
    } else {
      beginn = start.zeit!;
      endeZeit = ende?.zeit ?? "";
      // Länger als ein Tag mit Uhrzeit (z. B. Reise): als ganztägig über die Tage lesen.
      if (ende && ende.tag > tagPlus(start.tag, 1)) {
        ganz = true;
        const anzahl = Math.min(MAX_TAGE_JE_TERMIN, tageZwischen(start.tag, ende.tag) + 1);
        tageEinzel = Array.from({ length: anzahl }, (_, i) => tagPlus(start.tag, i));
      } else tageEinzel = [start.tag];
    }

    const rr = get("RRULE");
    const r = rr ? regel(rr.wert) : null;
    if (rr && !r?.freq) einfach += 1;
    const starts = r?.freq ? wiederholungen(start.tag, r) : [start.tag];
    const g = gruppen.get(name) ?? { tage: new Set<string>(), zeiten: new Map<string, number>(), ganz: 0, zeit: 0 };
    for (const st of starts) {
      const verschub = tageZwischen(start.tag, st);
      for (const t of tageEinzel) {
        const tag = tagPlus(t, verschub);
        if (tag < FRUEHESTER_TAG || tag > SPAETESTER_TAG) continue;
        g.tage.add(tag);
      }
    }
    if (ganz) g.ganz += 1;
    else {
      g.zeit += 1;
      const k = `${beginn}|${endeZeit}`;
      g.zeiten.set(k, (g.zeiten.get(k) ?? 0) + 1);
    }
    gruppen.set(name, g);
  };

  for (const zeile of zeilen(text)) {
    const z = zeile.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(z)) event = [];
    else if (/^END:VEVENT$/i.test(z)) {
      if (event) verarbeite(event);
      event = null;
    } else if (event) {
      const e = eigenschaft(z);
      if (e) event.push(e);
    }
  }

  const liste: Gruppe[] = [];
  let von: string | null = null;
  let bis: string | null = null;
  for (const [name, g] of gruppen) {
    if (!g.tage.size) continue;
    const tage = [...g.tage].sort();
    if (von === null || tage[0]! < von) von = tage[0]!;
    if (bis === null || tage[tage.length - 1]! > bis) bis = tage[tage.length - 1]!;
    const ganztaegig = g.ganz >= g.zeit;
    let beginn = "";
    let ende = "";
    if (!ganztaegig) {
      const [haeufigste] = [...g.zeiten.entries()].sort((a, b) => b[1] - a[1])[0] ?? [""];
      [beginn = "", ende = ""] = (haeufigste ?? "").split("|");
    }
    liste.push({ name, tage, beginn, ende, ganztaegig });
  }
  // Größte Gruppen zuerst, dann nach Name.
  liste.sort((a, b) => b.tage.length - a.tage.length || a.name.localeCompare(b.name, "de"));
  return { gruppen: liste, termine, von, bis, einfach };
}

/** Dauer in Stunden zwischen zwei Uhrzeiten (über Mitternacht möglich), sonst null. */
export function stundenZwischen(beginn: string, ende: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(beginn) || !/^\d{2}:\d{2}$/.test(ende)) return null;
  let m = minuten(ende) - minuten(beginn);
  if (m <= 0) m += 24 * 60;
  return Math.round((m / 60) * 100) / 100;
}

