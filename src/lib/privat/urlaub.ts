import { addDays, fromISO } from "@/lib/dates";

/**
 * Urlaubs-Planer: Zeiträume finden, in denen du mit wenigen Urlaubstagen
 * besonders lange frei hast. Reine Rechnung auf dem Gerät.
 *
 * Ein Tag ist „frei“, wenn du ohnehin nicht arbeitest (Wochenende, Feiertag
 * oder ein freier Tag in deinem Plan). Ein Arbeitstag in der Lücke kostet
 * einen Urlaubstag. Gesucht sind Zeiträume, die höchstens einen Urlaubstag
 * vor oder nach einem freien Block beginnen und enden; ein Vorschlag muss mehr
 * als doppelt so viele freie Tage bringen wie er Urlaubstage kostet.
 */

export type TagArt = "frei" | "feiertag" | "urlaub";

export interface Vorschlag {
  von: string;
  bis: string;
  /** Tage am Stück, die du frei hast */
  laenge: number;
  /** Arbeitstage darin, die du als Urlaub nehmen müsstest */
  urlaubstage: string[];
  /** laenge / Urlaubstage */
  faktor: number;
  tage: { iso: string; art: TagArt }[];
  /** Namen der Feiertage im Zeitraum */
  feiertage: string[];
}

export interface Eingabe {
  /** Suchbereich, beide Enden eingeschlossen */
  von: string;
  bis: string;
  /** Vorschläge müssen in diesem Zeitraum beginnen */
  startAb: string;
  startBis: string;
  istFrei: (iso: string) => boolean;
  feiertage: ReadonlyMap<string, string>;
  /** Urlaubstage, die noch übrig sind */
  budget: number;
  /** Höchstens so viele Tage am Stück (Standard 21) */
  maxLaenge?: number;
  /** So viele Vorschläge höchstens (Standard 8) */
  anzahl?: number;
}

export function findeUrlaub(e: Eingabe): Vorschlag[] {
  if (e.budget < 1) return [];
  const maxLaenge = e.maxLaenge ?? 21;
  const tage: string[] = [];
  for (let t = e.von; t <= e.bis; t = addDays(t, 1)) tage.push(t);
  const frei = tage.map((t) => e.istFrei(t));

  const kandidaten: Vorschlag[] = [];
  for (let a = 0; a < tage.length; a++) {
    const start = tage[a]!;
    if (start < e.startAb || start > e.startBis) continue;
    // Beginn: der erste Tag eines freien Blocks – oder ein Arbeitstag direkt davor, der den Block verlängert.
    const beginntFrei = frei[a]! && (a === 0 || !frei[a - 1]);
    const verlaengert = !frei[a]! && frei[a + 1] === true;
    if (!beginntFrei && !verlaengert) continue;
    let k = 0;
    for (let b = a; b < tage.length && b - a + 1 <= maxLaenge; b++) {
      if (!frei[b]) {
        k += 1;
        if (k > e.budget) break;
      }
      const laenge = b - a + 1;
      // Ende: der letzte Tag eines freien Blocks – oder ein Arbeitstag direkt danach.
      const endetFrei = frei[b]! && frei[b + 1] !== true;
      const verlaengertEnde = !frei[b]! && b > a && frei[b - 1] === true;
      if (!endetFrei && !verlaengertEnde) continue;
      if (k < 1 || laenge < 4 || laenge / k <= 2) continue;
      const urlaub: string[] = [];
      const fe: string[] = [];
      const liste = tage.slice(a, b + 1).map((iso, i) => {
        if (!frei[a + i]) {
          urlaub.push(iso);
          return { iso, art: "urlaub" as const };
        }
        const name = e.feiertage.get(iso);
        if (name) {
          fe.push(name);
          return { iso, art: "feiertag" as const };
        }
        return { iso, art: "frei" as const };
      });
      kandidaten.push({ von: tage[a]!, bis: tage[b]!, laenge, urlaubstage: urlaub, faktor: laenge / k, tage: liste, feiertage: fe });
    }
  }

  kandidaten.sort((x, y) => y.faktor - x.faktor || y.laenge - x.laenge || x.von.localeCompare(y.von));
  const gewaehlt: Vorschlag[] = [];
  for (const k of kandidaten) {
    if (gewaehlt.some((g) => !(k.bis < g.von || k.von > g.bis))) continue;
    gewaehlt.push(k);
    if (gewaehlt.length >= (e.anzahl ?? 8)) break;
  }
  return gewaehlt.sort((x, y) => y.faktor - x.faktor || x.von.localeCompare(y.von));
}

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export const wochentagKurz = (iso: string) => WT[fromISO(iso).getDay()]!;

/** "Do 6. bis So 9. Mai 2027" */
export function zeitraumText(von: string, bis: string): string {
  const a = fromISO(von);
  const b = fromISO(bis);
  const links = `${wochentagKurz(von)} ${a.getDate()}.`;
  const rechts = `${wochentagKurz(bis)} ${b.getDate()}. ${MONATE[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${links} bis ${rechts}`;
  if (a.getFullYear() === b.getFullYear()) return `${links} ${MONATE[a.getMonth()]} bis ${rechts}`;
  return `${links} ${MONATE[a.getMonth()]} ${a.getFullYear()} bis ${rechts}`;
}

/** Name für den Vorschlag: der Feiertag, sonst „Brückentage“. */
export function vorschlagTitel(v: Vorschlag, leer: string): string {
  const namen = [...new Set(v.feiertage)];
  if (!namen.length) return leer;
  if (namen.some((n) => /oster|karfreitag/i.test(n))) return "Ostern";
  if (namen.some((n) => /pfingst/i.test(n))) return "Pfingsten";
  if (namen.some((n) => /weihnacht|neujahr|silvester/i.test(n)) && v.von.slice(5) >= "12-15") return "Weihnachten und Neujahr";
  return namen.slice(0, 2).join(" · ");
}

// ---------------------------------------------------------------------
// Planer je Anlass (Feiertag): wie viele Urlaubstage bringen wie viele
// freie Tage am Stück? „Hebel“ = freie Tage je Urlaubstag.
// ---------------------------------------------------------------------

export interface Moeglichkeit {
  /** Urlaubstage */
  k: number;
  von: string;
  bis: string;
  /** Tage am Stück frei */
  laenge: number;
  urlaubstage: string[];
  hebel: number;
}

export interface Anlass {
  id: string;
  name: string;
  /** Die Feiertage des Anlasses (z. B. Karfreitag und Ostermontag) */
  tage: string[];
  /** Ohne Urlaub: der freie Block um den Feiertag (0 Urlaubstage) */
  ohne: { von: string; bis: string; laenge: number };
  /** 1 bis 8 Urlaubstage – je Anzahl die längste Möglichkeit */
  moeglichkeiten: Moeglichkeit[];
  /** Fällt auf einen ohnehin freien Tag (z. B. Sonntag) */
  wirkungslos: boolean;
  /** Beste Möglichkeit: höchster Hebel, bei Gleichstand weniger Urlaubstage */
  beste: Moeglichkeit | null;
}

const MAX_K = 8;
const UMKREIS = 16;

/** Feiertage eines Jahres zu Anlässen zusammenfassen (Karfreitag + Ostermontag, Weihnachten). */
export function anlaesse(
  jahr: number,
  feiertage: ReadonlyMap<string, string>,
  istFrei: (iso: string) => boolean,
): Anlass[] {
  const imJahr = [...feiertage.entries()].filter(([t]) => t.startsWith(`${jahr}-`)).sort(([a], [b]) => a.localeCompare(b));
  const gruppen: { tage: string[]; namen: string[] }[] = [];
  for (const [tag, name] of imJahr) {
    const letzte = gruppen[gruppen.length - 1];
    // Feiertage bis 4 Tage auseinander gehören zusammen (Ostern, Weihnachten).
    if (letzte && diffTage(letzte.tage[letzte.tage.length - 1]!, tag) <= 4) {
      letzte.tage.push(tag);
      letzte.namen.push(name);
    } else gruppen.push({ tage: [tag], namen: [name] });
  }
  return gruppen.map((g) => {
    const name = g.namen.length > 1 ? anlassName(g.namen) : g.namen[0]!;
    // Freier Block um die Feiertage ohne Urlaub.
    let a = g.tage[0]!;
    let b = g.tage[g.tage.length - 1]!;
    while (istFrei(addDays(a, -1)) && diffTage(addDays(a, -1), g.tage[0]!) <= UMKREIS) a = addDays(a, -1);
    while (istFrei(addDays(b, 1)) && diffTage(g.tage[g.tage.length - 1]!, addDays(b, 1)) <= UMKREIS) b = addDays(b, 1);
    // Arbeitstage innerhalb des Anlasses (z. B. zwischen Karfreitag und Ostermontag) zählen mit.
    const innen: string[] = [];
    for (let t = a; t <= b; t = addDays(t, 1)) if (!istFrei(t)) innen.push(t);
    const links: string[] = [];
    for (let t = addDays(a, -1), n = 0; n < MAX_K && diffTage(t, a) <= UMKREIS; t = addDays(t, -1)) if (!istFrei(t)) {
      links.push(t);
      n++;
    }
    const rechts: string[] = [];
    for (let t = addDays(b, 1), n = 0; n < MAX_K && diffTage(b, t) <= UMKREIS; t = addDays(t, 1)) if (!istFrei(t)) {
      rechts.push(t);
      n++;
    }

    const ausdehnen = (von: string, bis: string) => {
      let x = von;
      let y = bis;
      while (istFrei(addDays(x, -1))) x = addDays(x, -1);
      while (istFrei(addDays(y, 1))) y = addDays(y, 1);
      return { von: x, bis: y };
    };
    const moeglichkeiten: Moeglichkeit[] = [];
    for (let k = Math.max(1, innen.length); k <= MAX_K; k++) {
      let best: Moeglichkeit | null = null;
      const rest = k - innen.length;
      for (let i = 0; i <= rest; i++) {
        const j = rest - i;
        if (i > links.length || j > rechts.length) continue;
        const von = i ? links[i - 1]! : a;
        const bis = j ? rechts[j - 1]! : b;
        const w = ausdehnen(von, bis);
        const urlaub: string[] = [];
        for (let t = w.von; t <= w.bis; t = addDays(t, 1)) if (!istFrei(t)) urlaub.push(t);
        if (urlaub.length !== k) continue;
        const laenge = diffTage(w.von, w.bis) + 1;
        if (!best || laenge > best.laenge) best = { k, von: w.von, bis: w.bis, laenge, urlaubstage: urlaub, hebel: laenge / k };
      }
      if (best) moeglichkeiten.push(best);
    }
    const ohneLaenge = diffTage(a, b) + 1;
    const wirkungslos = g.tage.every((t) => {
      const w = fromISO(t).getDay();
      return w === 0 || w === 6;
    });
    const beste =
      [...moeglichkeiten].sort((x, y) => y.hebel - x.hebel || x.k - y.k)[0] ?? null;
    return { id: g.tage[0]!, name, tage: g.tage, ohne: { von: a, bis: b, laenge: innen.length ? 0 : ohneLaenge }, moeglichkeiten, wirkungslos, beste };
  });
}

function anlassName(namen: string[]): string {
  if (namen.some((n) => /karfreitag|oster/i.test(n))) return "Ostern";
  if (namen.some((n) => /weihnacht/i.test(n))) return "Weihnachten";
  if (namen.some((n) => /pfingst/i.test(n))) return "Pfingsten";
  return namen.join(" + ");
}

function diffTage(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 864e5);
}

const ueberlappt = (x: { von: string; bis: string }, y: { von: string; bis: string }) => !(x.bis < y.von || x.von > y.bis);

export type Strategie = "bruecke" | "ausschoepfen";

/** Auswahl: Anlass -> Anzahl Urlaubstage (0 = keiner). */
export type Auswahl = Record<string, number>;

/**
 * Plan vorschlagen.
 * - „Nur echte Brückentage“: je Anlass die beste Möglichkeit, wenn der Hebel
 *   über 3 liegt (ein normales langes Wochenende bringt schon 3); die besten zuerst, bis das Budget reicht.
 * - „Budget ausschöpfen“: danach so lange einen Tag dazunehmen, wo er am
 *   meisten freie Tage bringt, bis das Budget verbraucht ist.
 */
export function planVorschlag(liste: Anlass[], budget: number, strategie: Strategie, nurAb?: string): Auswahl {
  const auswahl: Auswahl = {};
  const nutzbar = liste.filter((a) => !nurAb || a.tage[a.tage.length - 1]! >= nurAb);
  const gewaehlt = () =>
    nutzbar.filter((a) => auswahl[a.id]).map((a) => a.moeglichkeiten.find((m) => m.k === auswahl[a.id])!);
  let rest = budget;
  const reihenfolge = [...nutzbar].filter((a) => !a.wirkungslos && a.beste && a.beste.hebel > 3).sort((x, y) => y.beste!.hebel - x.beste!.hebel);
  for (const a of reihenfolge) {
    const m = a.beste!;
    if (m.k > rest) continue;
    if (gewaehlt().some((g) => ueberlappt(g, m))) continue;
    auswahl[a.id] = m.k;
    rest -= m.k;
  }
  if (strategie === "ausschoepfen") {
    for (let runde = 0; runde < 200 && rest > 0; runde++) {
      let best: { id: string; k: number; gewinn: number } | null = null;
      for (const a of nutzbar) {
        const jetzt = auswahl[a.id] ?? 0;
        const vorher = jetzt ? a.moeglichkeiten.find((m) => m.k === jetzt)!.laenge : 0;
        for (const m of a.moeglichkeiten) {
          if (m.k <= jetzt || m.k - jetzt > rest) continue;
          const andere = nutzbar.filter((b) => b.id !== a.id && auswahl[b.id]).map((b) => b.moeglichkeiten.find((x) => x.k === auswahl[b.id])!);
          if (andere.some((g) => ueberlappt(g, m))) continue;
          const gewinn = (m.laenge - vorher) / (m.k - jetzt);
          if (gewinn >= 1 && (!best || gewinn > best.gewinn)) best = { id: a.id, k: m.k, gewinn };
        }
      }
      if (!best) break;
      rest -= best.k - (auswahl[best.id] ?? 0);
      auswahl[best.id] = best.k;
    }
  }
  return auswahl;
}

/** „Mo 04.01.“ */
export function datumKurz(iso: string): string {
  const d = fromISO(iso);
  return `${wochentagKurz(iso)} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

/** Den Plan als Text – zum Kopieren in einen Antrag oder den Familienchat. */
export function planText(jahr: number, land: string, zeilen: { anlass: Anlass; m: Moeglichkeit }[]): string {
  const urlaub = zeilen.reduce((s, z) => s + z.m.k, 0);
  const frei = zeilen.reduce((s, z) => s + z.m.laenge, 0);
  const kopf = `Mein Urlaubsplan ${jahr} (${land}): ${frei} freie Tage mit ${urlaub} Urlaubstagen`;
  const teile = zeilen.map(
    (z) => `• ${z.anlass.name}: Urlaub ${z.m.urlaubstage.map(datumKurz).join(", ")} → frei ${datumKurz(z.m.von)}–${datumKurz(z.m.bis)} (${z.m.laenge} Tage)`,
  );
  return [kopf, ...teile].join("\n");
}

/** Den Plan als Kalender-Datei: je Urlaubstag ein ganztägiger Termin. */
export function planIcs(jahr: number, zeilen: { anlass: Anlass; m: Moeglichkeit }[]): string {
  const stempel = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const tag = (iso: string) => iso.replace(/-/g, "");
  const ereignisse = zeilen.flatMap((z) =>
    z.m.urlaubstage.map((iso) =>
      [
        "BEGIN:VEVENT",
        `UID:urlaub-${iso}-${jahr}@shiftnexo.de`,
        `DTSTAMP:${stempel}`,
        `DTSTART;VALUE=DATE:${tag(iso)}`,
        `DTEND;VALUE=DATE:${tag(addDays(iso, 1))}`,
        `SUMMARY:Urlaub (${z.anlass.name.replace(/[,;\\]/g, " ")})`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      ].join("\r\n"),
    ),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ShiftNexo//Urlaubsplaner//DE", "CALSCALE:GREGORIAN", ...ereignisse, "END:VCALENDAR"].join("\r\n");
}
