import { addDays, fromISO } from "@/lib/dates";
import { idsVon, istAbwesenheit, type Schichtart, type TagEintrag } from "@/lib/privat/daten";

/**
 * Soll, Ist, Überstunden und eine Brutto-Schätzung für einen Zeitraum.
 * Alles hier ist reine Rechnung ohne Netzwerk. Stundenlohn und Zuschläge
 * bleiben auf dem Gerät (siehe `ladeGehaltEinstellungen`), nicht in der Datenbank.
 */

export interface GehaltEinstellungen {
  /** Brutto je Stunde in Euro; null = nicht eingetragen. */
  stundenlohn: number | null;
  /** Schichtbetrieb: nur dann zählen Nacht-, Sonntags- und Feiertagszuschläge. */
  schicht: boolean;
  /** Zuschläge in Prozent auf den Stundenlohn. */
  nacht: number;
  sonntag: number;
  feiertag: number;
  ueber: number;
  /** Nachtarbeit von … bis … Uhr (volle Stunden). */
  nachtVon: number;
  nachtBis: number;
}

export const GEHALT_STANDARD: GehaltEinstellungen = {
  stundenlohn: null,
  schicht: true,
  nacht: 25,
  sonntag: 50,
  feiertag: 125,
  ueber: 25,
  nachtVon: 20,
  nachtBis: 6,
};

const SCHLUESSEL = "sp_gehalt:";

const zahlOder = (w: unknown, std: number, min: number, max: number) =>
  typeof w === "number" && Number.isFinite(w) && w >= min && w <= max ? w : std;

/** Eingaben prüfen und auf erlaubte Werte begrenzen (auch für alte oder kaputte Speicherstände). */
export function bereinigeGehalt(roh: unknown): GehaltEinstellungen {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const lohn = r.stundenlohn;
  return {
    stundenlohn: typeof lohn === "number" && Number.isFinite(lohn) && lohn > 0 && lohn <= 1000 ? lohn : null,
    schicht: typeof r.schicht === "boolean" ? r.schicht : GEHALT_STANDARD.schicht,
    nacht: zahlOder(r.nacht, GEHALT_STANDARD.nacht, 0, 500),
    sonntag: zahlOder(r.sonntag, GEHALT_STANDARD.sonntag, 0, 500),
    feiertag: zahlOder(r.feiertag, GEHALT_STANDARD.feiertag, 0, 500),
    ueber: zahlOder(r.ueber, GEHALT_STANDARD.ueber, 0, 500),
    nachtVon: Math.round(zahlOder(r.nachtVon, GEHALT_STANDARD.nachtVon, 0, 23)),
    nachtBis: Math.round(zahlOder(r.nachtBis, GEHALT_STANDARD.nachtBis, 0, 23)),
  };
}

export function ladeGehaltEinstellungen(userId: string): GehaltEinstellungen {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL + userId);
    return bereinigeGehalt(roh ? JSON.parse(roh) : null);
  } catch {
    return GEHALT_STANDARD;
  }
}

export function speichereGehaltEinstellungen(userId: string, e: GehaltEinstellungen): void {
  try {
    window.localStorage.setItem(SCHLUESSEL + userId, JSON.stringify(e));
  } catch {
    // voll oder gesperrt – dann gilt die Eingabe nur bis zum Schließen
  }
}

/** Beim Konto-Löschen und Abmelden: Lohn und Sätze vom Gerät entfernen. */
export function loescheGehaltEinstellungen(userId: string): void {
  try {
    window.localStorage.removeItem(SCHLUESSEL + userId);
  } catch {
    // egal
  }
}

/** "18,5" oder "18.5" -> 18.5; Unsinn -> null. */
export function zahlAusText(t: string): number | null {
  const s = t.trim().replace(/\s|€|%/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MIN_JE_TAG = 24 * 60;

const istWerktag = (tag: string) => {
  const w = fromISO(tag).getDay();
  return w !== 0 && w !== 6;
};

/** Sollstunden: Wochenstunden gleichmäßig auf Mo–Fr, Feiertage unter der Woche zählen nicht. */
export function sollStunden(von: string, bis: string, wochenstunden: number, feiertage: ReadonlySet<string>): number {
  let werktage = 0;
  for (let t = von; t <= bis; t = addDays(t, 1)) if (istWerktag(t) && !feiertage.has(t)) werktage += 1;
  return (werktage * wochenstunden) / 5;
}

/** Stunden eines Tages: Urlaub/Krank ersetzen die Schicht darunter (wie in der Auswertung). */
export function tagesStunden(e: TagEintrag | undefined, nach: ReadonlyMap<string, Schichtart>): number {
  const ids = idsVon(e);
  const abw = ids.filter((id) => istAbwesenheit(nach.get(id)));
  return (abw.length ? abw : ids).reduce((s, id) => s + (nach.get(id)?.stunden ?? 0), 0);
}

const minuten = (hhmm: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export interface Zuschlagsstunden {
  nacht: number;
  sonntag: number;
  feiertag: number;
}

/**
 * Stunden mit Zuschlag aus den Arbeitsschichten. Jede Minute zwischen Beginn
 * und Ende wird dem Kalendertag zugeordnet, auf den sie fällt (nach
 * Mitternacht also dem Folgetag). Sonntag und Feiertag zugleich: der höhere
 * Satz zählt, die Stunde steht dann nur dort. Nacht kommt zusätzlich dazu.
 * Ist die Schicht kürzer eingetragen als ihre Uhrzeiten (Pause), werden die
 * Stunden anteilig gekürzt.
 */
export function zuschlagsStunden(
  tage: Readonly<Record<string, TagEintrag>>,
  von: string,
  bis: string,
  nach: ReadonlyMap<string, Schichtart>,
  feiertage: ReadonlySet<string>,
  e: Pick<GehaltEinstellungen, "nacht" | "sonntag" | "feiertag" | "nachtVon" | "nachtBis">,
): Zuschlagsstunden {
  const aus: Zuschlagsstunden = { nacht: 0, sonntag: 0, feiertag: 0 };
  const nachtVon = e.nachtVon * 60;
  const nachtBis = e.nachtBis * 60;
  const istNacht = (min: number) => (nachtVon > nachtBis ? min >= nachtVon || min < nachtBis : min >= nachtVon && min < nachtBis);
  for (const [tag, eintrag] of Object.entries(tage)) {
    if (tag < von || tag > bis) continue;
    const ids = idsVon(eintrag);
    // An Urlaubs-/Krankheitstagen gibt es keine Zuschläge.
    if (ids.some((id) => istAbwesenheit(nach.get(id)))) continue;
    for (const id of ids) {
      const a = nach.get(id);
      if (!a || a.art !== "arbeit") continue;
      const b = minuten(a.beginn);
      const en = minuten(a.ende);
      if (b === null || en === null) continue;
      let spanne = en - b;
      if (spanne <= 0) spanne += MIN_JE_TAG;
      const faktor = a.stunden > 0 && a.stunden * 60 < spanne ? (a.stunden * 60) / spanne : 1;
      let n = 0;
      let s = 0;
      let f = 0;
      for (let m = 0; m < spanne; m++) {
        const abs = b + m;
        const kalenderTag = abs >= MIN_JE_TAG ? addDays(tag, Math.floor(abs / MIN_JE_TAG)) : tag;
        const imTag = abs % MIN_JE_TAG;
        if (istNacht(imTag)) n += 1;
        const hatFeiertag = feiertage.has(kalenderTag);
        const hatSonntag = fromISO(kalenderTag).getDay() === 0;
        if (hatFeiertag && (!hatSonntag || e.feiertag >= e.sonntag)) f += 1;
        else if (hatSonntag) s += 1;
      }
      aus.nacht += (n * faktor) / 60;
      aus.sonntag += (s * faktor) / 60;
      aus.feiertag += (f * faktor) / 60;
    }
  }
  return aus;
}

export interface Woche {
  /** Kalenderwoche nach ISO 8601 */
  kw: number;
  von: string;
  bis: string;
  ist: number;
  soll: number;
}

/** ISO-Kalenderwoche eines Tages. */
export function kalenderwoche(tag: string): number {
  const d = fromISO(tag);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wt = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - wt);
  const jahrStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - jahrStart) / 864e5 + 1) / 7);
}

export interface Rechnung {
  soll: number | null;
  ist: number;
  /** Ist minus Soll (nur wenn Soll bekannt), kann negativ sein. */
  differenz: number | null;
  wochen: Woche[];
  zuschlag: Zuschlagsstunden;
  /** Beträge in Euro; null, wenn kein Stundenlohn eingetragen ist. */
  geld: null | {
    grundlohn: number;
    nacht: number;
    sonntag: number;
    feiertag: number;
    ueber: number;
    summe: number;
  };
}

export function rechne(args: {
  tage: Readonly<Record<string, TagEintrag>>;
  von: string;
  bis: string;
  arten: readonly Schichtart[];
  feiertage: ReadonlySet<string>;
  wochenstunden: number | null;
  einst: GehaltEinstellungen;
}): Rechnung {
  const { tage, von, bis, feiertage, wochenstunden, einst } = args;
  const nach = new Map(args.arten.map((a) => [a.id, a]));
  let ist = 0;
  for (const [tag, e] of Object.entries(tage)) if (tag >= von && tag <= bis) ist += tagesStunden(e, nach);

  // Soll erst ab dem ersten eingetragenen Tag – wer mitten im Monat anfängt, hat keine Minusstunden.
  const erster = Object.keys(tage)
    .filter((t) => t >= von && t <= bis)
    .sort()[0];
  const sollVon = erster ?? addDays(bis, 1);
  const soll = wochenstunden !== null && wochenstunden > 0 ? sollStunden(sollVon, bis, wochenstunden, feiertage) : null;
  const differenz = soll === null ? null : ist - soll;

  const wochen: Woche[] = [];
  for (let t = von; t <= bis; ) {
    const w = fromISO(t).getDay() || 7;
    const ende = addDays(t, 7 - w) < bis ? addDays(t, 7 - w) : bis;
    let wIst = 0;
    for (let x = t; x <= ende; x = addDays(x, 1)) wIst += tagesStunden(tage[x], nach);
    const wSollVon = t < sollVon ? sollVon : t;
    wochen.push({
      kw: kalenderwoche(t),
      von: t,
      bis: ende,
      ist: wIst,
      soll: soll === null || wochenstunden === null || wSollVon > ende ? 0 : sollStunden(wSollVon, ende, wochenstunden, feiertage),
    });
    t = addDays(ende, 1);
  }

  const zuschlag = einst.schicht ? zuschlagsStunden(tage, von, bis, nach, feiertage, einst) : { nacht: 0, sonntag: 0, feiertag: 0 };
  let geld: Rechnung["geld"] = null;
  if (einst.stundenlohn !== null) {
    const lohn = einst.stundenlohn;
    const rund = (x: number) => Math.round(x * 100) / 100;
    const grundlohn = rund(ist * lohn);
    const nacht = rund((zuschlag.nacht * lohn * einst.nacht) / 100);
    const sonntag = rund((zuschlag.sonntag * lohn * einst.sonntag) / 100);
    const feiertag = rund((zuschlag.feiertag * lohn * einst.feiertag) / 100);
    const ueber = differenz !== null && differenz > 0 ? rund((differenz * lohn * einst.ueber) / 100) : 0;
    geld = { grundlohn, nacht, sonntag, feiertag, ueber, summe: rund(grundlohn + nacht + sonntag + feiertag + ueber) };
  }
  return { soll, ist, differenz, wochen, zuschlag, geld };
}
