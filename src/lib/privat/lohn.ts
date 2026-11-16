import type { Rechnung } from "@/lib/privat/gehalt";
import { abzuegeMonat, freierZuschlag, SFN_GRENZE, type Abzuege, type SteuerAngaben, type Steuerklasse, WERTE_2026 } from "@/lib/privat/netto";

/**
 * Lohn im Privatbereich: aus dem Brutto (Bereich „Geld“, je Job aus dem
 * Kalender) wird die Auszahlung geschätzt. Alles bleibt auf diesem Gerät:
 * - die Steuerangaben,
 * - der letzte Stand der Extras (nur einer, wird überschrieben),
 * - gespeicherte Monate (Ergebnis + was wirklich ausgezahlt wurde) für die Jahresübersicht.
 */

export interface SteuerDaten {
  steuerklasse: Steuerklasse;
  kinder: number;
  kirche: boolean;
  kvZusatz: number;
  kinderlosZuschlag: boolean;
  /** Feste Zulagen brutto im Monat (Schichtzulage, Erschwernis …), versteuert. */
  zulagen: number;
}

export interface Extras {
  /** Für diesen Monat (YYYY-MM). */
  monat: string;
  /** Einmalzahlung brutto (Weihnachtsgeld, Prämie, Überstunden-Auszahlung). */
  einmal: number;
  /** Steuer- und beitragsfrei (Jobticket, Inflationsprämie …). */
  frei: number;
  /** Nach den Abzügen: + Erstattung, − Vorschuss/Abzug. */
  netto: number;
}

export interface MonatGespeichert {
  brutto: number;
  netto: number;
  steuerfrei: number;
  abzuege: number;
  /** Was laut Lohnabrechnung wirklich ausgezahlt wurde; null = noch nicht eingetragen. */
  echt: number | null;
}

export interface LohnSpeicher {
  steuer: SteuerDaten | null;
  extras: Extras | null;
  monate: Record<string, MonatGespeichert>;
}

export const LOHN_LEER: LohnSpeicher = { steuer: null, extras: null, monate: {} };

export const STEUER_STANDARD: SteuerDaten = {
  steuerklasse: 1,
  kinder: 0,
  kirche: false,
  kvZusatz: WERTE_2026.kvZusatz,
  kinderlosZuschlag: true,
  zulagen: 0,
};

const SCHLUESSEL = "sp_lohn:";
const zahl = (w: unknown, std: number, min: number, max: number) => (typeof w === "number" && Number.isFinite(w) && w >= min && w <= max ? w : std);
const betrag = (w: unknown) => Math.round(zahl(w, 0, -100000, 100000) * 100) / 100;
const MONAT = /^\d{4}-\d{2}$/;

export function bereinigeLohn(roh: unknown): LohnSpeicher {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  let steuer: SteuerDaten | null = null;
  if (r.steuer && typeof r.steuer === "object") {
    const s = r.steuer as Record<string, unknown>;
    const sk = zahl(s.steuerklasse, 1, 1, 6);
    steuer = {
      steuerklasse: Math.round(sk) as Steuerklasse,
      kinder: Math.round(zahl(s.kinder, 0, 0, 12)),
      kirche: s.kirche === true,
      kvZusatz: zahl(s.kvZusatz, WERTE_2026.kvZusatz, 0, 6),
      kinderlosZuschlag: s.kinderlosZuschlag !== false,
      zulagen: Math.max(0, betrag(s.zulagen)),
    };
  }
  let extras: Extras | null = null;
  if (r.extras && typeof r.extras === "object") {
    const e = r.extras as Record<string, unknown>;
    if (typeof e.monat === "string" && MONAT.test(e.monat)) {
      extras = { monat: e.monat, einmal: Math.max(0, betrag(e.einmal)), frei: Math.max(0, betrag(e.frei)), netto: betrag(e.netto) };
    }
  }
  const monate: Record<string, MonatGespeichert> = {};
  if (r.monate && typeof r.monate === "object") {
    for (const [k, v] of Object.entries(r.monate as Record<string, unknown>)) {
      if (!MONAT.test(k) || !v || typeof v !== "object") continue;
      const m = v as Record<string, unknown>;
      const echt = typeof m.echt === "number" && Number.isFinite(m.echt) ? betrag(m.echt) : null;
      monate[k] = { brutto: betrag(m.brutto), netto: betrag(m.netto), steuerfrei: betrag(m.steuerfrei), abzuege: betrag(m.abzuege), echt };
    }
  }
  return { steuer, extras, monate };
}

export function ladeLohn(userId: string): LohnSpeicher {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL + userId);
    return bereinigeLohn(roh ? JSON.parse(roh) : null);
  } catch {
    return LOHN_LEER;
  }
}

export function speichereLohn(userId: string, l: LohnSpeicher): void {
  try {
    window.localStorage.setItem(SCHLUESSEL + userId, JSON.stringify(l));
  } catch {
    // voll oder gesperrt
  }
}

export interface Zeile {
  text: string;
  betrag: number;
  detail?: string;
}

export interface Auszahlung {
  brutto: number;
  steuerfrei: number;
  abzuege: Abzuege | null;
  netto: number;
  /** Bausteine für die Anzeige. */
  bausteine: Zeile[];
  /** true, wenn ein normaler Job mit Brutto da ist (sonst nur Minijobs). */
  mitSteuer: boolean;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Auszahlung für einen Monat: Hauptjob (und weitere normale Jobs in Steuerklasse VI)
 * mit Steuer und Sozialversicherung, Minijobs wie ausgezahlt, dazu die Extras.
 */
export function rechneAuszahlung(re: Rechnung, steuer: SteuerDaten, extras: Omit<Extras, "monat"> | null, bundesland: string): Auszahlung {
  const angaben = (sk: Steuerklasse): SteuerAngaben => ({
    steuerklasse: sk,
    kinder: steuer.kinder,
    kirche: steuer.kirche,
    kvZusatz: steuer.kvZusatz,
    kinderlosZuschlag: steuer.kinderlosZuschlag,
    bundesland,
  });
  const ex = extras ?? { einmal: 0, frei: 0, netto: 0 };
  let brutto = 0;
  let steuerfrei = 0;
  let netto = 0;
  let abz: Abzuege | null = null;
  const bausteine: Zeile[] = [];
  let mitSteuer = false;

  const normale = re.jobs.filter((j) => j.geld && j.job.art === "brutto");
  const haupt = normale.find((j) => j.istHaupt) ?? normale[0] ?? null;
  for (const jr of normale) {
    const g = jr.geld!;
    const istHaupt = jr === haupt;
    const lohn = g.stundenlohn ?? 0;
    let frei = 0;
    let svFrei = 0;
    for (const [art, b] of [
      ["nacht", g.nacht],
      ["sonntag", g.sonntag],
      ["feiertag", g.feiertag],
    ] as const) {
      const f = freierZuschlag(jr.zuschlag[art], lohn, jr.job[art], SFN_GRENZE[art], b);
      frei += f.steuerfrei;
      svFrei += f.svfrei;
    }
    const zulagen = istHaupt ? steuer.zulagen : 0;
    const laufend = g.summe + zulagen;
    const einmal = istHaupt ? ex.einmal : 0;
    const a = abzuegeMonat({
      steuerpflichtig: laufend - frei,
      svpflichtig: laufend - svFrei,
      einmal,
      angaben: angaben(istHaupt ? steuer.steuerklasse : 6),
    });
    brutto += laufend + einmal;
    steuerfrei += frei;
    netto += laufend + einmal - a.summe;
    abz = abz ? summiere(abz, a) : a;
    mitSteuer = true;
    bausteine.push({ text: normale.length > 1 ? jr.job.name : "Lohn aus dem Kalender", betrag: g.summe });
    if (zulagen > 0) bausteine.push({ text: "Feste Zulagen", betrag: zulagen });
    if (einmal > 0) bausteine.push({ text: "Einmalzahlung", betrag: einmal });
  }
  for (const jr of re.jobs.filter((j) => j.geld && j.job.art === "minijob")) {
    brutto += jr.geld!.summe;
    netto += jr.geld!.summe;
    bausteine.push({ text: `${jr.job.name} (Minijob)`, betrag: jr.geld!.summe });
  }
  if (ex.frei > 0) {
    brutto += ex.frei;
    steuerfrei += ex.frei;
    netto += ex.frei;
    bausteine.push({ text: "Steuerfrei extra", betrag: ex.frei });
  }
  if (ex.netto !== 0) {
    netto += ex.netto;
    bausteine.push({ text: ex.netto > 0 ? "Plus nach Abzügen" : "Abzug nach Abzügen", betrag: ex.netto });
  }
  return { brutto: r2(brutto), steuerfrei: r2(steuerfrei), abzuege: abz, netto: r2(netto), bausteine, mitSteuer };
}

function summiere(a: Abzuege, b: Abzuege): Abzuege {
  const s = {} as Abzuege;
  for (const k of Object.keys(a) as (keyof Abzuege)[]) s[k] = r2(a[k] + b[k]);
  return s;
}
