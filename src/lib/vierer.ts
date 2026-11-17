import { formatDE } from "@/lib/dates";
import type { LiveViererTag } from "@/lib/types";

/**
 * 4er-Regel (Vorgabe Urlaub 2027, nur Hinweis): je Schichtgruppe und Tag
 * höchstens 4 Personen mit Urlaub, VJ oder V. Sind es 4, muss mindestens
 * einer davon einen V-Tag (widerrufbar) haben – damit man jemanden
 * herbeirufen kann.
 *
 * `tage` kommt aus vierer_regel_tage() (die ANDEREN der Gruppe), `eigene`
 * sagt, was die Person an dem Tag selbst nehmen würde.
 */
export function viererHinweis(
  tage: LiveViererTag[],
  eigene: (tag: string) => "U" | "VJ" | "V" | null,
): { zuViele: string[]; ohneV: string[]; text: string | null } {
  const zuViele: string[] = [];
  const ohneV: string[] = [];
  for (const t of tage) {
    const e = eigene(t.tag);
    if (!e) continue;
    if (t.andere >= 4) zuViele.push(t.tag);
    else if (t.andere === 3 && t.andereV === 0 && e !== "V") ohneV.push(t.tag);
  }
  const liste = (x: string[]) => (x.length > 4 ? `${x.slice(0, 4).map(formatDE).join(", ")} und ${x.length - 4} weitere` : x.map(formatDE).join(", "));
  const teile: string[] = [];
  if (zuViele.length) teile.push(`Schon 4 aus der Gruppe weg (Urlaub/VJ/V) am ${liste(zuViele)}.`);
  if (ohneV.length) teile.push(`Dann wären 4 weg, aber keiner mit V-Tag (widerrufbar) am ${liste(ohneV)}.`);
  return { zuViele, ohneV, text: teile.length ? teile.join(" ") : null };
}
