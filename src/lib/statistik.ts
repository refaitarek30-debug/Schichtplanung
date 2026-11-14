/**
 * „Meine Zahlen“: eigene Statistik aus dem eigenen Plan – reine Rechnung, ohne
 * Speicher. Eingabe ist je Tag, was die Person selbst im Kalender sieht.
 */

export type TagArt = "arbeit" | "frei" | "urlaub" | "krank" | "sonst";

export interface StatTag {
  /** "YYYY-MM-DD" */
  iso: string;
  art: TagArt;
  stunden: number;
  nacht: boolean;
  /** Name der Schicht – für „Wechsel zwischen Schichten“. */
  schicht?: string;
}

export interface Zahlen {
  arbeitstage: number;
  stunden: number;
  sonntage: number;
  sonntagStunden: number;
  feiertage: number;
  feiertagStunden: number;
  samstage: number;
  naechte: number;
  nachtStunden: number;
  urlaub: number;
  krank: number;
  freieTage: number;
  freieWochenenden: number;
  wochenenden: number;
  laengsteSerie: number;
  laengsteFrei: number;
  wechsel: number;
  /** 0 = Sonntag … 6 = Samstag; null ohne freie Tage */
  freiTag: number | null;
  /** 0–11; null ohne Arbeit */
  fleissigsterMonat: number | null;
  /** Anteil der Stunden des Zeitraums, der Arbeit war (0–100). */
  anteilArbeit: number;
  /** Tage mit Eintrag – 0 heißt: für den Zeitraum gibt es nichts. */
  tageMitDaten: number;
  /** Arbeitstage nach dem gezählten Zeitraum, die schon im Plan stehen. */
  geplant: number;
}

/** Gezählter Zeitraum, je "YYYY-MM-DD", beide einschließlich. */
export interface Zeitraum {
  von: string;
  bis: string;
}

const plusTag = (iso: string, n = 1) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

const wt = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

/**
 * Rechnet die Zahlen für einen Zeitraum. Mit `zeitraum` zählt nur, was darin
 * liegt; Tage ohne Eintrag zwischen dem ersten Eintrag und dem Ende gelten als
 * frei (wer nichts einträgt, hat frei). Arbeitstage nach dem Ende kommen als
 * „geplant“ dazu, zählen aber nirgends mit.
 */
export function rechne(tage: StatTag[], feiertage: ReadonlySet<string>, zeitraum?: Zeitraum): Zahlen {
  const alle = [...tage].sort((a, b) => a.iso.localeCompare(b.iso));
  const drin = zeitraum ? alle.filter((t) => t.iso >= zeitraum.von && t.iso <= zeitraum.bis) : alle;
  const geplant = zeitraum ? alle.filter((t) => t.iso > zeitraum.bis && t.art === "arbeit").length : 0;
  const sortiert: StatTag[] = [];
  if (drin.length) {
    const ende = zeitraum ? zeitraum.bis : drin[drin.length - 1].iso;
    const nach = new Map(drin.map((t) => [t.iso, t]));
    for (let iso = drin[0].iso; iso <= ende; iso = plusTag(iso)) {
      sortiert.push(nach.get(iso) ?? { iso, art: "frei", stunden: 0, nacht: false });
    }
  }
  const z: Zahlen = {
    arbeitstage: 0, stunden: 0, sonntage: 0, sonntagStunden: 0, feiertage: 0, feiertagStunden: 0, samstage: 0,
    naechte: 0, nachtStunden: 0, urlaub: 0, krank: 0, freieTage: 0, freieWochenenden: 0, wochenenden: 0,
    laengsteSerie: 0, laengsteFrei: 0, wechsel: 0, freiTag: null, fleissigsterMonat: null, anteilArbeit: 0,
    tageMitDaten: drin.length, geplant,
  };
  const freiJeWt = [0, 0, 0, 0, 0, 0, 0];
  const jeMonat = new Array<number>(12).fill(0);
  const arbeit = new Map<string, boolean>();
  let serie = 0;
  let frei = 0;
  let letzteSchicht: string | undefined;

  for (const t of sortiert) {
    const w = wt(t.iso);
    const istArbeit = t.art === "arbeit";
    arbeit.set(t.iso, istArbeit);
    if (istArbeit) {
      z.arbeitstage++;
      z.stunden += t.stunden;
      jeMonat[Number(t.iso.slice(5, 7)) - 1] += 1;
      if (w === 0) {
        z.sonntage++;
        z.sonntagStunden += t.stunden;
      }
      if (w === 6) z.samstage++;
      if (feiertage.has(t.iso)) {
        z.feiertage++;
        z.feiertagStunden += t.stunden;
      }
      if (t.nacht) {
        z.naechte++;
        z.nachtStunden += t.stunden;
      }
      if (t.schicht && letzteSchicht && t.schicht !== letzteSchicht) z.wechsel++;
      if (t.schicht) letzteSchicht = t.schicht;
      serie++;
      frei = 0;
    } else {
      if (t.art === "urlaub") z.urlaub++;
      else if (t.art === "krank") z.krank++;
      else if (t.art === "frei") {
        z.freieTage++;
        freiJeWt[w]++;
      }
      frei++;
      serie = 0;
    }
    z.laengsteSerie = Math.max(z.laengsteSerie, serie);
    z.laengsteFrei = Math.max(z.laengsteFrei, frei);
  }

  // Wochenenden: Samstag und Sonntag beide im Zeitraum und beide ohne Arbeit.
  for (const t of sortiert) {
    if (wt(t.iso) !== 6) continue;
    const so = plusTag(t.iso);
    if (!arbeit.has(so)) continue;
    z.wochenenden++;
    if (!arbeit.get(t.iso) && !arbeit.get(so)) z.freieWochenenden++;
  }

  const maxFrei = Math.max(...freiJeWt);
  z.freiTag = maxFrei > 0 ? freiJeWt.indexOf(maxFrei) : null;
  const maxMonat = Math.max(...jeMonat);
  z.fleissigsterMonat = maxMonat > 0 ? jeMonat.indexOf(maxMonat) : null;
  z.anteilArbeit = sortiert.length ? Math.round((z.stunden / (sortiert.length * 24)) * 1000) / 10 : 0;
  z.stunden = Math.round(z.stunden * 10) / 10;
  return z;
}
