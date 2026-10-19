import { aufGeraet, ausGeraet } from "@/lib/geraete-speicher";
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

export function merkeEigeneTage(schluessel: string, tage: Map<string, LiveShiftPlanCell>, imPlan: boolean): void {
  const eintraege: Gemerkt["tage"] = [];
  for (const [tag, zelle] of tage) {
    const { personnelNumber: _weg, ...rest } = zelle;
    void _weg;
    eintraege.push([tag, rest]);
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
