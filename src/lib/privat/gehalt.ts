import { addDays, fromISO } from "@/lib/dates";
import {
  dauerStunden,
  idsVon,
  istAbwesenheit,
  tagZeitSchluessel,
  type Schichtart,
  type TagEintrag,
  type TagZeit,
} from "@/lib/privat/daten";

/**
 * Soll, Ist, Überstunden und Geld je Job für einen Zeitraum.
 *
 * Mehrere Jobs (z. B. Tankstelle als Minijob und die Ausbildung): Jede
 * Arbeitsschicht gehört zu einem Job. Jeder Job hat seinen eigenen Lohn,
 * seine eigenen Zuschläge und ist entweder ein Minijob (ausgezahlt = netto),
 * eine Brutto-Schätzung oder „ohne Geld“.
 *
 * Wochenstunden und Überstunden gelten nur für den Hauptjob. Schichten ohne
 * Job zählen zum Hauptjob – so rechnet ein Konto mit nur einem Job genau wie
 * früher.
 *
 * Alles hier ist reine Rechnung ohne Netzwerk. Jobs, Lohn und Zuschläge
 * bleiben auf dem Gerät (siehe `ladeGehaltEinstellungen`), nicht in der Datenbank.
 */

export type JobArt = "minijob" | "brutto" | "ohne";
/** Normaler Job: bezahlt je Stunde oder mit festem Monatsgehalt. */
export type Bezahlung = "stunde" | "monat";

export interface Job {
  id: string;
  name: string;
  art: JobArt;
  /** Euro je Stunde; null = noch nicht eingetragen. */
  stundenlohn: number | null;
  /** Nur „Normal“: je Stunde oder festes Monatsgehalt. */
  bezahlung: Bezahlung;
  /** Festes Grundgehalt brutto im Monat (bei bezahlung = "monat"); null = noch nicht eingetragen. */
  grundgehalt: number | null;
  /** Zuschläge in Prozent auf den Stundenlohn; 0 = keiner. */
  nacht: number;
  sonntag: number;
  feiertag: number;
  /** Nur beim Hauptjob: Zuschlag für Stunden über dem Soll. */
  ueber: number;
  /** Nachtzuschlag von … bis … Uhr (volle Stunden, 24 = Mitternacht). */
  nachtVon: number;
  nachtBis: number;
  /** Minijob-Grenze im Monat; null = gesetzliche Grenze des Jahres. */
  grenze: number | null;
}

export interface GehaltEinstellungen {
  jobs: Job[];
  /** Job, für den Wochenstunden und Überstunden gelten; Schichten ohne Job gehören dazu. */
  hauptjob: string | null;
  /** Schichtart -> Job */
  zuordnung: Record<string, string>;
  /** Der Assistent ist durch (oder wurde übersprungen). */
  eingerichtet: boolean;
}

export const GEHALT_STANDARD: GehaltEinstellungen = { jobs: [], hauptjob: null, zuordnung: {}, eingerichtet: false };

export const JOB_STANDARD: Omit<Job, "id" | "name" | "art"> = {
  stundenlohn: null,
  bezahlung: "stunde",
  grundgehalt: null,
  nacht: 25,
  sonntag: 50,
  feiertag: 125,
  ueber: 25,
  nachtVon: 20,
  nachtBis: 6,
  grenze: null,
};

/**
 * Minijob-Grenze: Mindestlohn × 130 Stunden ÷ 3, aufgerundet (§ 8 Abs. 1a SGB IV).
 * Für Jahre, die hier nicht stehen, gilt der letzte bekannte Wert.
 */
const MINIJOB_GRENZE: Record<number, number> = { 2024: 538, 2025: 556, 2026: 603, 2027: 633 };
export function minijobGrenze(jahr: number): number {
  const jahre = Object.keys(MINIJOB_GRENZE).map(Number).sort((a, b) => a - b);
  const passend = jahre.filter((j) => j <= jahr).pop() ?? jahre[0]!;
  return MINIJOB_GRENZE[passend]!;
}

const SCHLUESSEL = "sp_gehalt:";

const zahlOder = (w: unknown, std: number, min: number, max: number) =>
  typeof w === "number" && Number.isFinite(w) && w >= min && w <= max ? w : std;

const lohnOder = (w: unknown) => (typeof w === "number" && Number.isFinite(w) && w > 0 && w <= 1000 ? w : null);
const gehaltOder = (w: unknown) => (typeof w === "number" && Number.isFinite(w) && w > 0 && w <= 100000 ? w : null);

/**
 * Stundenlohn aus dem Monatsgehalt: Gehalt ÷ (Wochenstunden × 13 ÷ 3).
 * 13 ÷ 3 ≈ 4,33 Wochen je Monat – so rechnen Tarifverträge und Lohnbüros
 * den Stundenwert für Zuschläge aus einem festen Monatsgehalt.
 */
export function stundenlohnAusGehalt(grundgehalt: number, wochenstunden: number): number {
  return Math.round((grundgehalt / ((wochenstunden * 13) / 3)) * 100) / 100;
}

/** Bezahlt dieser Job ein festes Monatsgehalt (und ist es eingetragen)? */
export const mitGehalt = (job: Job) => job.art === "brutto" && job.bezahlung === "monat" && job.grundgehalt !== null;

/** Stundenlohn, auf den die Zuschläge gerechnet werden; null = (noch) nicht bekannt. */
export function wirksamerStundenlohn(job: Job, wochenstunden: number | null): number | null {
  if (job.art === "brutto" && job.bezahlung === "monat") {
    return job.grundgehalt !== null && wochenstunden !== null && wochenstunden > 0 ? stundenlohnAusGehalt(job.grundgehalt, wochenstunden) : null;
  }
  return job.stundenlohn;
}

/** Anteil voller Monate im Zeitraum (ein ganzer Monat = 1, halber Monat ≈ 0,5). */
export function monatsAnteil(von: string, bis: string): number {
  let anteil = 0;
  let t = von;
  while (t <= bis) {
    const d = fromISO(t);
    const tageImMonat = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const monatsEnde = addDays(t, tageImMonat - d.getDate());
    const ende = monatsEnde < bis ? monatsEnde : bis;
    const tage = Math.round((fromISO(ende).getTime() - d.getTime()) / 864e5) + 1;
    anteil += tage / tageImMonat;
    t = addDays(ende, 1);
  }
  return anteil;
}

function bereinigeJob(roh: unknown): Job | null {
  if (!roh || typeof roh !== "object") return null;
  const r = roh as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id ? r.id.slice(0, 40) : null;
  if (!id) return null;
  const art: JobArt = r.art === "minijob" || r.art === "ohne" ? r.art : "brutto";
  const grenze = r.grenze;
  return {
    id,
    name: (typeof r.name === "string" && r.name.trim() ? r.name.trim() : "Job").slice(0, 40),
    art,
    stundenlohn: lohnOder(r.stundenlohn),
    bezahlung: r.bezahlung === "monat" && art === "brutto" ? "monat" : "stunde",
    grundgehalt: gehaltOder(r.grundgehalt),
    nacht: zahlOder(r.nacht, JOB_STANDARD.nacht, 0, 500),
    sonntag: zahlOder(r.sonntag, JOB_STANDARD.sonntag, 0, 500),
    feiertag: zahlOder(r.feiertag, JOB_STANDARD.feiertag, 0, 500),
    ueber: zahlOder(r.ueber, JOB_STANDARD.ueber, 0, 500),
    nachtVon: Math.round(zahlOder(r.nachtVon, JOB_STANDARD.nachtVon, 0, 24)),
    nachtBis: Math.round(zahlOder(r.nachtBis, JOB_STANDARD.nachtBis, 0, 24)),
    grenze: typeof grenze === "number" && Number.isFinite(grenze) && grenze > 0 && grenze <= 10000 ? grenze : null,
  };
}

/**
 * Eingaben prüfen und auf erlaubte Werte begrenzen. Alte Speicherstände (ein
 * Stundenlohn für alles) werden zu einem Job „Mein Job“, der Hauptjob ist –
 * die Zahlen bleiben dieselben.
 */
export function bereinigeGehalt(roh: unknown): GehaltEinstellungen {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  if (Array.isArray(r.jobs)) {
    const jobs = r.jobs.map(bereinigeJob).filter((j): j is Job => !!j).slice(0, 8);
    const ids = new Set(jobs.map((j) => j.id));
    const zuordnung: Record<string, string> = {};
    if (r.zuordnung && typeof r.zuordnung === "object") {
      for (const [art, job] of Object.entries(r.zuordnung as Record<string, unknown>)) {
        if (typeof job === "string" && ids.has(job)) zuordnung[art] = job;
      }
    }
    const haupt = typeof r.hauptjob === "string" && ids.has(r.hauptjob) ? r.hauptjob : null;
    return { jobs, hauptjob: haupt, zuordnung, eingerichtet: r.eingerichtet === true || jobs.length > 0 };
  }
  // Alter Stand: ein Lohn, ein Schalter „in Schicht“.
  const lohn = lohnOder(r.stundenlohn);
  if (lohn === null) return GEHALT_STANDARD;
  const schicht = typeof r.schicht === "boolean" ? r.schicht : true;
  const job: Job = {
    id: "mein-job",
    name: "Mein Job",
    art: "brutto",
    stundenlohn: lohn,
    bezahlung: "stunde",
    grundgehalt: null,
    nacht: schicht ? zahlOder(r.nacht, JOB_STANDARD.nacht, 0, 500) : 0,
    sonntag: schicht ? zahlOder(r.sonntag, JOB_STANDARD.sonntag, 0, 500) : 0,
    feiertag: schicht ? zahlOder(r.feiertag, JOB_STANDARD.feiertag, 0, 500) : 0,
    ueber: zahlOder(r.ueber, JOB_STANDARD.ueber, 0, 500),
    nachtVon: Math.round(zahlOder(r.nachtVon, JOB_STANDARD.nachtVon, 0, 24)),
    nachtBis: Math.round(zahlOder(r.nachtBis, JOB_STANDARD.nachtBis, 0, 24)),
    grenze: null,
  };
  return { jobs: [job], hauptjob: job.id, zuordnung: {}, eingerichtet: true };
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

/** Zu welchem Job gehört eine Schicht? null = zu keinem (dann zählt der Hauptjob). */
export function jobVon(einst: GehaltEinstellungen, schichtartId: string): Job | null {
  const id = einst.zuordnung[schichtartId] ?? einst.hauptjob;
  return einst.jobs.find((j) => j.id === id) ?? null;
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

/**
 * Die Schicht, wie sie an diesem Tag gilt: mit anderer Uhrzeit, wenn eine
 * eingetragen ist. Die Pause der Schicht (Uhrzeiten länger als die Stunden)
 * bleibt gleich.
 */
export function schichtAmTag(a: Schichtart, z: TagZeit | undefined): Schichtart {
  if (!z) return a;
  const neu = dauerStunden(z.beginn, z.ende);
  if (neu === null) return a;
  const alt = a.beginn && a.ende ? dauerStunden(a.beginn, a.ende) : null;
  const pause = alt !== null && a.stunden > 0 && a.stunden < alt ? alt - a.stunden : 0;
  return { ...a, beginn: z.beginn, ende: z.ende, stunden: Math.max(0, Math.round((neu - pause) * 100) / 100) };
}

type Zeiten = Readonly<Record<string, TagZeit>>;

/** Die Schichten eines Tages, wie sie gelten (mit Tages-Uhrzeit). */
function schichtenAm(tag: string, e: TagEintrag | undefined, nach: ReadonlyMap<string, Schichtart>, zeiten: Zeiten): Schichtart[] {
  return idsVon(e)
    .map((id) => nach.get(id))
    .filter((a): a is Schichtart => !!a)
    .map((a) => schichtAmTag(a, zeiten[tagZeitSchluessel(tag, a.id)]));
}

/**
 * Stunden eines Tages: Urlaub/Krank ersetzen die Schicht darunter (wie in der Auswertung).
 * `zaehlt`: nur diese Schichten (z. B. ohne die des Minijobs).
 */
export function tagesStunden(
  e: TagEintrag | undefined,
  nach: ReadonlyMap<string, Schichtart>,
  tag = "",
  zeiten: Zeiten = {},
  zaehlt: (a: Schichtart) => boolean = () => true,
): number {
  const alle = schichtenAm(tag, e, nach, zeiten);
  const abw = alle.filter((a) => istAbwesenheit(a));
  return (abw.length ? abw : alle.filter(zaehlt)).reduce((s, a) => s + a.stunden, 0);
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
 * Stunden mit Zuschlag aus den Arbeitsschichten eines Jobs. Jede Minute
 * zwischen Beginn und Ende wird dem Kalendertag zugeordnet, auf den sie fällt
 * (nach Mitternacht also dem Folgetag). Sonntag und Feiertag zugleich: der
 * höhere Satz zählt, die Stunde steht dann nur dort. Nacht kommt zusätzlich
 * dazu. Ist die Schicht kürzer eingetragen als ihre Uhrzeiten (Pause), werden
 * die Stunden anteilig gekürzt.
 */
export function zuschlagsStunden(
  tage: Readonly<Record<string, TagEintrag>>,
  von: string,
  bis: string,
  nach: ReadonlyMap<string, Schichtart>,
  feiertage: ReadonlySet<string>,
  e: Pick<Job, "nacht" | "sonntag" | "feiertag" | "nachtVon" | "nachtBis">,
  zeiten: Zeiten = {},
  gehoert: (a: Schichtart) => boolean = () => true,
): Zuschlagsstunden {
  const aus: Zuschlagsstunden = { nacht: 0, sonntag: 0, feiertag: 0 };
  const nachtVon = (e.nachtVon % 24) * 60;
  const nachtBis = (e.nachtBis % 24) * 60;
  const istNacht = (min: number) =>
    nachtVon === nachtBis ? false : nachtVon > nachtBis ? min >= nachtVon || min < nachtBis : min >= nachtVon && min < nachtBis;
  for (const [tag, eintrag] of Object.entries(tage)) {
    if (tag < von || tag > bis) continue;
    const alle = schichtenAm(tag, eintrag, nach, zeiten);
    // An Urlaubs-/Krankheitstagen gibt es keine Zuschläge.
    if (alle.some((a) => istAbwesenheit(a))) continue;
    for (const a of alle) {
      if (a.art !== "arbeit" || !gehoert(a)) continue;
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

export interface JobRechnung {
  job: Job;
  istHaupt: boolean;
  /** Bezahlte Stunden (beim Hauptjob mit Urlaub/Krank). */
  stunden: number;
  /** Anzahl Arbeitsschichten im Zeitraum. */
  schichten: number;
  zuschlag: Zuschlagsstunden;
  /** null, wenn „ohne Geld“ oder kein Lohn/Gehalt eingetragen. */
  geld: null | {
    /** Festes Monatsgehalt (anteilig für den Zeitraum) statt Stunden × Lohn. */
    ausGehalt: boolean;
    /** Stundenlohn, auf den die Zuschläge gerechnet sind; null = unbekannt (Wochenstunden fehlen). */
    stundenlohn: number | null;
    grundlohn: number;
    nacht: number;
    sonntag: number;
    feiertag: number;
    ueber: number;
    summe: number;
  };
  /** Nur Minijob: was zur Grenze zählt, und die Grenze. */
  minijob: null | { zaehlt: number; grenze: number };
}

export interface Rechnung {
  soll: number | null;
  /** Stunden für Soll/Überstunden: alles außer den Schichten anderer Jobs. */
  ist: number;
  /** Ist minus Soll (nur wenn Soll bekannt), kann negativ sein. */
  differenz: number | null;
  wochen: Woche[];
  jobs: JobRechnung[];
  /** Summe aller Jobs mit Geld; null, wenn keiner Geld hat. */
  summe: number | null;
}

const rund = (x: number) => Math.round(x * 100) / 100;

export function rechne(args: {
  tage: Readonly<Record<string, TagEintrag>>;
  von: string;
  bis: string;
  arten: readonly Schichtart[];
  feiertage: ReadonlySet<string>;
  wochenstunden: number | null;
  einst: GehaltEinstellungen;
  zeiten?: Zeiten;
}): Rechnung {
  const { tage, von, bis, feiertage, wochenstunden, einst } = args;
  const zeiten = args.zeiten ?? {};
  const nach = new Map(args.arten.map((a) => [a.id, a]));
  const haupt = einst.jobs.find((j) => j.id === einst.hauptjob) ?? null;
  // Zählt zum Soll/Ist: alles, was nicht ausdrücklich einem anderen Job gehört.
  const zumHaupt = (a: Schichtart) => {
    const j = einst.zuordnung[a.id];
    return !j || j === haupt?.id || !einst.jobs.some((x) => x.id === j);
  };

  let ist = 0;
  for (const [tag, e] of Object.entries(tage)) if (tag >= von && tag <= bis) ist += tagesStunden(e, nach, tag, zeiten, zumHaupt);

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
    for (let x = t; x <= ende; x = addDays(x, 1)) wIst += tagesStunden(tage[x], nach, x, zeiten, zumHaupt);
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

  const jahr = Number(bis.slice(0, 4));
  const jobs: JobRechnung[] = einst.jobs.map((job) => {
    const istHaupt = job.id === haupt?.id;
    const gehoert = (a: Schichtart) => a.art === "arbeit" && (istHaupt ? zumHaupt(a) : einst.zuordnung[a.id] === job.id);
    let stunden = 0;
    let schichten = 0;
    for (const [tag, e] of Object.entries(tage)) {
      if (tag < von || tag > bis) continue;
      const alle = schichtenAm(tag, e, nach, zeiten);
      const meine = alle.filter(gehoert);
      schichten += meine.length;
      if (alle.some((a) => istAbwesenheit(a))) continue;
      stunden += meine.reduce((s, a) => s + a.stunden, 0);
    }
    // Hauptjob: bezahlt wird wie bisher das Ist (mit Urlaub/Krank).
    if (istHaupt) stunden = ist;
    const zuschlag = zuschlagsStunden(tage, von, bis, nach, feiertage, job, zeiten, gehoert);
    let geld: JobRechnung["geld"] = null;
    const ausGehalt = mitGehalt(job);
    if (job.art !== "ohne" && (ausGehalt || job.stundenlohn !== null)) {
      // Festes Gehalt: Grundgehalt (anteilig, wenn der Zeitraum kein ganzer Monat ist), Zuschläge auf
      // den daraus gerechneten Stundenlohn. Sonst wie bisher Stunden × Stundenlohn.
      const lohn = wirksamerStundenlohn(job, wochenstunden);
      const z = lohn ?? 0;
      const grundlohn = ausGehalt ? rund(job.grundgehalt! * monatsAnteil(von, bis)) : rund(stunden * z);
      const nacht = rund((zuschlag.nacht * z * job.nacht) / 100);
      const sonntag = rund((zuschlag.sonntag * z * job.sonntag) / 100);
      const feiertag = rund((zuschlag.feiertag * z * job.feiertag) / 100);
      const ueber = istHaupt && differenz !== null && differenz > 0 ? rund((differenz * z * job.ueber) / 100) : 0;
      geld = { ausGehalt, stundenlohn: lohn, grundlohn, nacht, sonntag, feiertag, ueber, summe: rund(grundlohn + nacht + sonntag + feiertag + ueber) };
    }
    // Zuschläge für Nacht, Sonntag und Feiertag sind steuer- und beitragsfrei
    // und zählen in der Regel nicht zur Minijob-Grenze.
    const minijob =
      job.art === "minijob" && geld ? { zaehlt: rund(geld.grundlohn + geld.ueber), grenze: job.grenze ?? minijobGrenze(jahr) } : null;
    return { job, istHaupt, stunden, schichten, zuschlag, geld, minijob };
  });
  const mitGeld = jobs.filter((j) => j.geld);
  const summe = mitGeld.length ? rund(mitGeld.reduce((s, j) => s + j.geld!.summe, 0)) : null;
  return { soll, ist, differenz, wochen, jobs, summe };
}
