import { aufGeraet, ausGeraet, beimLeerenAuch } from "@/lib/geraete-speicher";
import type { LiveShiftPlanCell } from "@/lib/types";

/**
 * Eigene Schichten eines Kalenderausschnitts auf dem Gerät merken (siehe
 * geraete-speicher.ts). Nur die Zeilen der eigenen Person – ohne
 * Personalnummer; Partner und andere Personen werden nie gemerkt.
 */
interface Gemerkt {
  tage: [string, Omit<LiveShiftPlanCell, "personnelNumber">][];
  imPlan: boolean;
}

/**
 * Gesundheitsangaben bleiben vom Gerät fern: „krank“ wird dort nur als
 * „abwesend“ gemerkt. Mit Netz zeigt der Kalender wieder „Krank“.
 */
function neutral(code: string | null): string | null {
  if (code === "K") return "A";
  if (code === "k") return "a";
  return code;
}

export function merkeEigeneTage(schluessel: string, tage: Map<string, LiveShiftPlanCell>, imPlan: boolean): void {
  const eintraege: Gemerkt["tage"] = [];
  for (const [tag, zelle] of tage) {
    const { personnelNumber: _weg, ...rest } = zelle;
    void _weg;
    eintraege.push([tag, { ...rest, absenceCode: neutral(rest.absenceCode) }]);
  }
  aufGeraet(schluessel, { tage: eintraege, imPlan } satisfies Gemerkt);
}

export function holeEigeneTage(schluessel: string): { tage: Map<string, LiveShiftPlanCell>; imPlan: boolean } | undefined {
  const g = ausGeraet<Gemerkt>(schluessel);
  if (!g || !Array.isArray(g.tage)) return undefined;
  return {
    tage: new Map(g.tage.map(([tag, z]) => [tag, { ...z, personnelNumber: null } as LiveShiftPlanCell])),
    imPlan: g.imPlan === true,
  };
}

/**
 * Vorrat: die eigenen Schichten für lange Zeit im Voraus (bis 5 Jahre), damit
 * der Kalender beim Wischen und ohne Netz sofort alles zeigt. Ein einziger
 * Eintrag je Konto und Betrieb, dieselben Regeln wie oben (nur eigene Zeilen,
 * verfällt nach 14 Tagen ohne Auffrischen, weg beim Abmelden).
 */
/** Kurzform je Tag: [Schicht, Kürzel, Abwesenheit, Gruppe, VJ, Azubi] – spart Platz auf dem Gerät. */
type Kurz = [string | null, string | null, string | null, string | null, 0 | 1, 0 | 1];

interface Vorrat {
  /** Die eigene Person (gleich an jedem Tag). */
  person: { id: string; name: string } | null;
  tage: Record<string, Kurz>;
  /** Startdatum des Monatsrasters → wann zuletzt geholt. */
  monate: Record<string, number>;
  imPlan: boolean;
}

let imSpeicher: { schluessel: string; v: Vorrat } | null = null;
beimLeerenAuch(() => {
  imSpeicher = null;
});

function vorrat(schluessel: string): Vorrat {
  if (imSpeicher?.schluessel === schluessel) return imSpeicher.v;
  const g = ausGeraet<Vorrat>(schluessel);
  const v: Vorrat = g && g.tage && g.monate ? g : { person: null, tage: {}, monate: {}, imPlan: false };
  imSpeicher = { schluessel, v };
  return v;
}

/** Wann dieser Monat (Rasterstart) zuletzt in den Vorrat kam – 0 = nie. */
export function vorratStand(schluessel: string, start: string): number {
  return vorrat(schluessel).monate[start] ?? 0;
}

export function inVorrat(
  schluessel: string,
  start: string,
  tageImRaster: string[],
  tage: Map<string, LiveShiftPlanCell>,
  imPlan: boolean,
  speichern = true,
): void {
  const v = vorrat(schluessel);
  for (const t of tageImRaster) delete v.tage[t];
  for (const [tag, z] of tage) {
    v.person = { id: z.employeeId, name: z.employeeName };
    v.tage[tag] = [z.shiftName, z.shiftCode, neutral(z.absenceCode), z.rotationTeam, z.isVj ? 1 : 0, z.isApprentice ? 1 : 0];
  }
  v.monate[start] = Date.now();
  v.imPlan = v.imPlan || imPlan;
  if (speichern) aufGeraet(schluessel, v);
}

export function vorratSpeichern(schluessel: string): void {
  if (imSpeicher?.schluessel === schluessel) aufGeraet(schluessel, imSpeicher.v);
}

export function ausVorrat(
  schluessel: string,
  start: string,
  tageImRaster: string[],
): { tage: Map<string, LiveShiftPlanCell>; imPlan: boolean } | undefined {
  const v = vorrat(schluessel);
  if (!v.monate[start]) return undefined;
  const tage = new Map<string, LiveShiftPlanCell>();
  for (const day of tageImRaster) {
    const k = v.tage[day];
    if (!k || !v.person) continue;
    tage.set(day, {
      employeeId: v.person.id,
      employeeName: v.person.name,
      rotationTeam: k[3],
      personnelNumber: null,
      day,
      shiftName: k[0],
      shiftCode: k[1],
      absenceCode: k[2],
      isMe: true,
      isVj: k[4] === 1,
      isApprentice: k[5] === 1,
    } as LiveShiftPlanCell);
  }
  return { tage, imPlan: v.imPlan };
}
