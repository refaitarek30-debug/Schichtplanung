/**
 * Netto aus Brutto – Schätzung nach dem amtlichen Programmablaufplan für die
 * maschinelle Lohnsteuer 2026 (BMF, Stand 12.11.2025), vereinfacht auf
 * gesetzlich Versicherte ohne Freibeträge auf der Lohnsteuerkarte.
 *
 * Reine Rechnung ohne Netzwerk. Keine Lohnabrechnung – Abweichungen von
 * einigen Euro sind normal (Rundungen, Sonderfälle, Tarifdetails).
 */

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

/** Werte 2026 (PAP 2026, Sozialversicherung 2026). */
export const WERTE_2026 = {
  grundfreibetrag: 12348,
  w1stkl5: 14071,
  w2stkl5: 34939,
  w3stkl5: 222260,
  solzFrei: 20350,
  /** Beitragsbemessungsgrenzen im Jahr / Monat */
  bbgRv: 101400,
  bbgKv: 69750,
  bbgRvMonat: 8450,
  bbgKvMonat: 5812.5,
  rv: 0.093,
  av: 0.013,
  kvAllgemein: 0.07,
  /** Durchschnittlicher Zusatzbeitrag 2026 in Prozent */
  kvZusatz: 2.9,
  pv: 0.018,
  pvSachsen: 0.023,
  pvKinderlos: 0.006,
  pvJeKind: 0.0025,
  arbeitnehmerPausch: 1230,
  sonderausgabenPausch: 36,
  alleinerziehend: 4260,
  kinderfreibetrag: 9756,
} as const;

const W = WERTE_2026;
const ab = (x: number) => Math.floor(x);
const cent = (x: number) => Math.floor(x * 100) / 100;

/** Einkommensteuer-Grundtarif 2026 (§ 32a EStG), x = zu versteuerndes Einkommen. */
export function tarif2026(xRoh: number): number {
  const x = ab(xRoh);
  if (x <= W.grundfreibetrag) return 0;
  if (x <= 17799) {
    const y = (x - W.grundfreibetrag) / 10000;
    return ab((914.51 * y + 1400) * y);
  }
  if (x <= 69878) {
    const z = (x - 17799) / 10000;
    return ab((173.1 * z + 2397) * z + 1034.87);
  }
  if (x <= 277825) return ab(0.42 * x - 11135.63);
  return ab(0.45 * x - 19470.38);
}

function up56(zx: number): number {
  const diff = (tarif2026(zx * 1.25) - tarif2026(zx * 0.75)) * 2;
  const mist = ab(zx * 0.14);
  return Math.max(mist, diff);
}

/** Steuerklasse V und VI (§ 39b Abs. 2 Satz 7 EStG). */
function mst56(zzx: number): number {
  if (zzx > W.w2stkl5) {
    let st = up56(W.w2stkl5);
    if (zzx > W.w3stkl5) st += (W.w3stkl5 - W.w2stkl5) * 0.42 + (zzx - W.w3stkl5) * 0.45;
    else st += (zzx - W.w2stkl5) * 0.42;
    return ab(st);
  }
  const vergl = up56(zzx);
  if (zzx <= W.w1stkl5) return vergl;
  const hoch = up56(W.w1stkl5) + (zzx - W.w1stkl5) * 0.42;
  return ab(Math.min(hoch, vergl));
}

export interface SteuerAngaben {
  steuerklasse: Steuerklasse;
  /** Kinder (Freibeträge für Kinder; Pflegeversicherung). */
  kinder: number;
  /** Kirchensteuer zahlen? */
  kirche: boolean;
  /** Zusatzbeitrag der Krankenkasse in Prozent (z. B. 2,9). */
  kvZusatz: number;
  /** Ohne Kinder und mindestens 23 Jahre: Zuschlag zur Pflegeversicherung. */
  kinderlosZuschlag: boolean;
  /** Bundesland (z. B. "NW") – für Kirchensteuersatz und Pflegeversicherung in Sachsen. */
  bundesland: string;
}

/** Arbeitnehmer-Satz Pflegeversicherung. */
export function pvSatz(a: SteuerAngaben): number {
  let s = a.bundesland === "SN" ? W.pvSachsen : W.pv;
  if (a.kinder === 0 && a.kinderlosZuschlag) s += W.pvKinderlos;
  if (a.kinder >= 2) s -= Math.min(4, a.kinder - 1) * W.pvJeKind;
  return s;
}

const kvSatz = (a: SteuerAngaben) => W.kvAllgemein + a.kvZusatz / 200;

/** Vorsorgepauschale (UPEVP mit Höchstbetrag zur Arbeitslosenversicherung). */
function vorsorge(zre4: number, a: SteuerAngaben): number {
  const rvBasis = Math.min(zre4, W.bbgRv);
  const vspr = rvBasis * W.rv;
  const vspkvpv = Math.min(zre4, W.bbgKv) * (kvSatz(a) + pvSatz(a));
  let vsp = vspr + vspkvpv;
  if (a.steuerklasse !== 6) {
    const hb = Math.min(1900, rvBasis * W.av + vspkvpv);
    vsp = Math.max(vsp, vspr + hb);
  }
  return Math.ceil(vsp);
}

interface JahresSteuer {
  lohnsteuer: number;
  /** Bemessungsgrundlage für Soli und Kirchensteuer (mit Freibeträgen für Kinder). */
  bemessung: number;
}

function jahresSteuer(zre4: number, a: SteuerAngaben): JahresSteuer {
  const sk = a.steuerklasse;
  const anp = sk < 6 ? Math.min(W.arbeitnehmerPausch, Math.max(0, zre4)) : 0;
  const sap = sk < 6 ? W.sonderausgabenPausch : 0;
  const efa = sk === 2 ? W.alleinerziehend : 0;
  const zve = Math.max(0, ab(zre4 - anp - sap - efa - vorsorge(zre4, a)));
  const kztab = sk === 3 ? 2 : 1;
  const st = (z: number) => {
    const x = ab(z / kztab);
    return sk < 5 ? tarif2026(x) * kztab : mst56(x);
  };
  const kfb = sk <= 3 ? a.kinder * W.kinderfreibetrag : sk === 4 ? a.kinder * (W.kinderfreibetrag / 2) : 0;
  return { lohnsteuer: st(zve), bemessung: st(Math.max(0, zve - kfb)) };
}

function soli(bemessung: number, sk: Steuerklasse): number {
  const frei = W.solzFrei * (sk === 3 ? 2 : 1);
  if (bemessung <= frei) return 0;
  return Math.min(bemessung * 0.055, (bemessung - frei) * 0.119);
}

/** Kirchensteuer: 8 % in Bayern und Baden-Württemberg, sonst 9 %. */
export const kirchenSatz = (bundesland: string) => (bundesland === "BY" || bundesland === "BW" ? 0.08 : 0.09);

export interface Abzuege {
  lohnsteuer: number;
  soli: number;
  kirche: number;
  kv: number;
  rv: number;
  av: number;
  pv: number;
  summe: number;
}

/**
 * Abzüge für einen Monat.
 * - `steuerpflichtig`: laufender Lohn, der versteuert wird
 * - `svpflichtig`: laufender Lohn, auf den Sozialbeiträge fallen
 * - `einmal`: Einmalzahlung (Weihnachtsgeld, Prämie) – versteuert als sonstiger Bezug
 */
export function abzuegeMonat(args: { steuerpflichtig: number; svpflichtig: number; einmal: number; angaben: SteuerAngaben }): Abzuege {
  const { angaben: a } = args;
  const laufend = Math.max(0, args.steuerpflichtig);
  const einmal = Math.max(0, args.einmal);
  const jahr = jahresSteuer(laufend * 12, a);
  const mit = einmal > 0 ? jahresSteuer(laufend * 12 + einmal, a) : jahr;
  const lstSonst = Math.max(0, mit.lohnsteuer - jahr.lohnsteuer);
  const bemSonst = Math.max(0, mit.bemessung - jahr.bemessung);

  const lohnsteuer = cent(jahr.lohnsteuer / 12) + lstSonst;
  const soliLfd = cent(soli(jahr.bemessung, a.steuerklasse) / 12);
  const soliSonst = soli(mit.bemessung, a.steuerklasse) > 0 ? bemSonst * 0.055 : 0;
  const ks = a.kirche ? kirchenSatz(a.bundesland) : 0;
  const kirche = cent((jahr.bemessung / 12 + bemSonst) * ks);

  // Sozialversicherung: Einmalzahlung vereinfacht im selben Monat bis zur Monatsgrenze.
  const sv = Math.max(0, args.svpflichtig) + einmal;
  const kvBasis = Math.min(sv, W.bbgKvMonat);
  const rvBasis = Math.min(sv, W.bbgRvMonat);
  const kv = cent(kvBasis * kvSatz(a));
  const pv = cent(kvBasis * pvSatz(a));
  const rv = cent(rvBasis * W.rv);
  const av = cent(rvBasis * W.av);
  const r = (x: number) => Math.round(x * 100) / 100;
  const teile = { lohnsteuer: r(lohnsteuer), soli: r(soliLfd + soliSonst), kirche: r(kirche), kv, rv, av, pv };
  return { ...teile, summe: r(Object.values(teile).reduce((s, x) => s + x, 0)) };
}

/** Grenzen der Steuerfreiheit für Zuschläge (§ 3b EStG) in Prozent vom Grundlohn. */
export const SFN_GRENZE = { nacht: 25, sonntag: 50, feiertag: 125 } as const;

/**
 * Steuer- und beitragsfreier Teil eines Zuschlags: steuerfrei bis zur Grenze
 * auf höchstens 50 €/Std Grundlohn, beitragsfrei auf höchstens 25 €/Std.
 */
export function freierZuschlag(stunden: number, stundenlohn: number, prozent: number, grenze: number, betrag: number) {
  const p = Math.min(prozent, grenze) / 100;
  const steuerfrei = Math.min(betrag, stunden * Math.min(stundenlohn, 50) * p);
  const svfrei = Math.min(betrag, stunden * Math.min(stundenlohn, 25) * p);
  return { steuerfrei, svfrei };
}
