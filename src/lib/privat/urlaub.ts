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
