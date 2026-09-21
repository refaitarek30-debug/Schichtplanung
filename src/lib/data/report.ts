import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

/** Eine Zeile der Auswertung: eine Person in einem Monat. */
export interface ReportRow {
  employeeId: string;
  name: string;
  rotationTeam: string | null;
  monat: number;
  sollTage: number;
  anwesendTage: number;
  krankTage: number;
  urlaubTage: number;
  vTage: number;
  sonderurlaubTage: number;
  altersfreizeitTage: number;
  bildungsurlaubTage: number;
  gewerkschaftstagTage: number;
  seminarTage: number;
  sonstigeTage: number;
  ausfallTage: number;
  sollStunden: number;
  anwesendStunden: number;
  krankStunden: number;
  ausfallStunden: number;
}

/**
 * Ausfall und Anwesenheit, je Person und Monat.
 *
 * Die Datenbank liefert bewusst die feinste Ebene. Gesamtbetrieb, Schicht
 * und Jahr entstehen daraus durch Summieren – eine eigene Abfrage je
 * Ebene wäre eine zweite Wahrheit für dieselbe Zahl.
 *
 * Ein ganzes Jahr über fünfzig Mitarbeiter braucht rund 2,7 Sekunden: die
 * Prüfung, ob ein Tag ein Arbeitstag ist, läuft für jede Kombination aus
 * Person und Tag einzeln. Das ist der Preis dafür, dass die Auswertung
 * dieselbe Funktion benutzt wie die Urlaubsberechnung und nicht von ihr
 * abweichen kann. Ein einzelner Monat liegt bei 0,23 Sekunden.
 */
export async function fetchReport(year: number, month: number | null): Promise<ReportRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("absence_report", {
    p_year: year,
    p_month: month,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    employeeId: String(row.employee_id),
    name: String(row.name),
    rotationTeam: (row.rotation_team as string) ?? null,
    monat: Number(row.monat),
    sollTage: Number(row.soll_tage),
    anwesendTage: Number(row.anwesend_tage),
    krankTage: Number(row.krank_tage),
    urlaubTage: Number(row.urlaub_tage),
    vTage: Number(row.v_tage),
    sonderurlaubTage: Number(row.sonderurlaub_tage),
    altersfreizeitTage: Number(row.altersfreizeit_tage),
    bildungsurlaubTage: Number(row.bildungsurlaub_tage),
    gewerkschaftstagTage: Number(row.gewerkschaftstag_tage),
    seminarTage: Number(row.seminar_tage),
    sonstigeTage: Number(row.sonstige_tage),
    ausfallTage: Number(row.ausfall_tage),
    sollStunden: Number(row.soll_stunden),
    anwesendStunden: Number(row.anwesend_stunden),
    krankStunden: Number(row.krank_stunden),
    ausfallStunden: Number(row.ausfall_stunden),
  }));
}

/** Eine zusammengefasste Gruppe – Betrieb, Schicht, Person oder Monat. */
export interface ReportSummary {
  schluessel: string;
  bezeichnung: string;
  sollTage: number;
  anwesendTage: number;
  seminarTage: number;
  krankTage: number;
  urlaubTage: number;
  vTage: number;
  sonderurlaubTage: number;
  altersfreizeitTage: number;
  bildungsurlaubTage: number;
  gewerkschaftstagTage: number;
  sonstigeTage: number;
  ausfallTage: number;
  sollStunden: number;
  anwesendStunden: number;
  ausfallStunden: number;
  /** Null, wenn es im Zeitraum keinen Arbeitstag gab. */
  gesundheitsrate: number | null;
  ausfallquote: number | null;
}

const LEER = {
  sollTage: 0, anwesendTage: 0, seminarTage: 0, krankTage: 0, urlaubTage: 0,
  vTage: 0, sonderurlaubTage: 0, altersfreizeitTage: 0, bildungsurlaubTage: 0,
  gewerkschaftstagTage: 0, sonstigeTage: 0, ausfallTage: 0, sollStunden: 0, anwesendStunden: 0, ausfallStunden: 0,
};

/**
 * Zeilen zu Gruppen zusammenfassen.
 *
 * Die Raten werden aus den summierten Tagen **neu gerechnet**, nicht aus
 * den Einzelraten gemittelt. Ein Mittelwert über Personen gewichtet
 * jemanden mit fünf Arbeitstagen genauso stark wie jemanden mit zwanzig
 * und ergibt eine Zahl, die zu keiner Realität gehört.
 */
export function fassenZusammen(
  zeilen: ReportRow[],
  schluesselVon: (z: ReportRow) => { schluessel: string; bezeichnung: string },
): ReportSummary[] {
  const gruppen = new Map<string, ReportSummary>();

  for (const z of zeilen) {
    const { schluessel, bezeichnung } = schluesselVon(z);
    const g =
      gruppen.get(schluessel) ??
      ({ schluessel, bezeichnung, ...LEER, gesundheitsrate: null, ausfallquote: null } as ReportSummary);

    g.sollTage += z.sollTage;
    g.anwesendTage += z.anwesendTage;
    g.seminarTage += z.seminarTage;
    g.krankTage += z.krankTage;
    g.urlaubTage += z.urlaubTage;
    g.vTage += z.vTage;
    g.sonderurlaubTage += z.sonderurlaubTage;
    g.altersfreizeitTage += z.altersfreizeitTage;
    g.bildungsurlaubTage += z.bildungsurlaubTage;
    g.gewerkschaftstagTage += z.gewerkschaftstagTage;
    g.sonstigeTage += z.sonstigeTage;
    g.ausfallTage += z.ausfallTage;
    g.sollStunden += z.sollStunden;
    g.anwesendStunden += z.anwesendStunden;
    g.ausfallStunden += z.ausfallStunden;

    gruppen.set(schluessel, g);
  }

  for (const g of gruppen.values()) {
    // Seminar zählt als Anwesenheit: die Person arbeitet, nur woanders.
    const anwesend = g.anwesendTage + g.seminarTage;
    const basis = anwesend + g.ausfallTage;
    g.gesundheitsrate = basis === 0 ? null : Math.round((1000 * anwesend) / basis) / 10;
    g.ausfallquote = basis === 0 ? null : Math.round((1000 * g.ausfallTage) / basis) / 10;
  }

  return [...gruppen.values()];
}

export const MONATSNAMEN = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
