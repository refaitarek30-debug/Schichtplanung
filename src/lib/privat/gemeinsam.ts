import { addDays, fromISO } from "@/lib/dates";
import { idsVon, type Schichtart, type TagEintrag } from "@/lib/privat/daten";
import type { PartnerCode } from "@/lib/data/partner";

/**
 * „Gemeinsam frei“: Tage, an denen du und eine andere Person gleichzeitig nicht
 * arbeiten. Frei heißt: kein Arbeitstag. Tage ohne Eintrag zählen als frei,
 * sobald für den Monat überhaupt etwas eingetragen ist – sonst ist der Monat
 * für diese Person noch „offen“ (kein Plan, also keine Aussage).
 */

/** true = frei, false = Arbeit/krank, null = offen (für den Monat nichts eingetragen) */
export type Frei = boolean | null;

const monatVon = (iso: string) => iso.slice(0, 7);

/** Meine Tage: frei sind Frei- und Urlaubstage; Arbeit und Krank nicht. */
export function meineFreiheit(tage: Readonly<Record<string, TagEintrag>>, arten: ReadonlyMap<string, Schichtart>): (iso: string) => Frei {
  const belegt = new Set<string>();
  for (const [tag, e] of Object.entries(tage)) if (idsVon(e).length) belegt.add(monatVon(tag));
  return (iso) => {
    const ids = idsVon(tage[iso]);
    if (!ids.length) return belegt.has(monatVon(iso)) ? true : null;
    // Urlaub über einer Schicht (so trägt der Urlaubs-Planer ein) zählt als frei.
    if (ids.some((id) => arten.get(id)?.art === "urlaub")) return true;
    return !ids.some((id) => {
      const a = arten.get(id);
      return a?.art === "arbeit" || a?.art === "krank";
    });
  };
}

/** Die Tage einer anderen Person als Kürzel (F/S/N/T = Arbeit, U/X = frei). */
export function andereFreiheit(codes: Readonly<Record<string, PartnerCode>> | undefined): (iso: string) => Frei {
  const belegt = new Set<string>();
  for (const tag of Object.keys(codes ?? {})) belegt.add(monatVon(tag));
  return (iso) => {
    const c = codes?.[iso];
    if (!c) return belegt.has(monatVon(iso)) ? true : null;
    return c === "X" || c === "U";
  };
}

export interface FreiTag {
  ich: Frei;
  er: Frei;
  beide: boolean;
}

export function vergleiche(von: string, bis: string, ich: (iso: string) => Frei, er: (iso: string) => Frei): Map<string, FreiTag> {
  const karte = new Map<string, FreiTag>();
  for (let t = von; t <= bis; t = addDays(t, 1)) {
    const a = ich(t);
    const b = er(t);
    karte.set(t, { ich: a, er: b, beide: a === true && b === true });
  }
  return karte;
}

export function gemeinsameTage(karte: ReadonlyMap<string, FreiTag>, von: string, bis: string): string[] {
  const aus: string[] = [];
  for (let t = von; t <= bis; t = addDays(t, 1)) if (karte.get(t)?.beide) aus.push(t);
  return aus;
}

/** Samstag und Sonntag, an denen ihr beide frei seid. */
export function ganzeWochenenden(karte: ReadonlyMap<string, FreiTag>, von: string, bis: string): { sa: string; so: string }[] {
  const aus: { sa: string; so: string }[] = [];
  for (let t = von; t <= bis; t = addDays(t, 1)) {
    if (fromISO(t).getDay() !== 6) continue;
    const so = addDays(t, 1);
    if (so <= bis && karte.get(t)?.beide && karte.get(so)?.beide) aus.push({ sa: t, so });
  }
  return aus;
}

/** Wie viele Tage in `von`–`bis` beide eingetragen haben (für den Hinweis „noch kein Plan“). */
export function hatPlan(f: (iso: string) => Frei, von: string, bis: string): boolean {
  for (let t = von; t <= bis; t = addDays(t, 1)) if (f(t) !== null) return true;
  return false;
}
