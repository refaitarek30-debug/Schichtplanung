import { kuerzelAus } from "@/lib/kuerzel";
import {
  FARBEN,
  leereTage,
  loescheSchichtart,
  setzeTage,
  speichereSchichtart,
  ladeSchichtarten,
  type Ebene,
  type SchichtArt,
  type Schichtart,
  type SchichtartEingabe,
  type TagEintrag,
} from "@/lib/privat/daten";
import { stundenZwischen, type Gruppe } from "@/lib/privat/ics-lesen";

/**
 * Schichten aus einer anderen App übernehmen (Privatkonto): Namen aus der
 * Kalender-Datei den eigenen Schichtarten zuordnen, planen, was geschrieben
 * wird, und das Ganze wieder rückgängig machen können.
 */

export type Ziel = { art: "vorhanden"; id: string } | { art: "neu" } | { art: "skip" };

/** Was mit Tagen passiert, an denen schon etwas steht. */
export type Modus = "leer" | "ueber" | "zusatz";

const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

const STICHWORTE: { schluessel: string[]; art?: SchichtArt }[] = [
  { schluessel: ["frueh", "early", "morning", "morgen"] },
  { schluessel: ["spaet", "late", "nachmittag", "afternoon"] },
  { schluessel: ["nacht", "night"] },
  { schluessel: ["urlaub", "vacation", "holiday", "ferien"], art: "urlaub" },
  { schluessel: ["krank", "sick"], art: "krank" },
  { schluessel: ["frei", "off", "free", "dayoff"], art: "frei" },
];

/** Vorschlag für einen gefundenen Namen: passende eigene Schicht, neu anlegen oder überspringen. */
export function schlageVor(g: Gruppe, arten: Schichtart[]): Ziel {
  const n = normal(g.name);
  const gleich = arten.find((a) => normal(a.name) === n);
  if (gleich) return { art: "vorhanden", id: gleich.id };
  for (const s of STICHWORTE) {
    if (!s.schluessel.some((k) => n.includes(k))) continue;
    const treffer = arten.find((a) => s.schluessel.some((k) => normal(a.name).includes(k)) || (s.art && a.art === s.art));
    if (treffer) return { art: "vorhanden", id: treffer.id };
    return { art: "neu" };
  }
  if (!g.ganztaegig && g.beginn && g.ende) {
    const zeit = arten.find((a) => a.beginn === g.beginn && a.ende === g.ende);
    if (zeit) return { art: "vorhanden", id: zeit.id };
    if (g.tage.length >= 3) return { art: "neu" };
  }
  return { art: "skip" };
}

/** Die Schichtart, die für „Neue Schicht“ angelegt würde. */
export function neueArtAus(g: Gruppe, vergeben: string[], vorhandene: number, laufend: number): SchichtartEingabe {
  const n = normal(g.name);
  let art: SchichtArt = "arbeit";
  for (const s of STICHWORTE) if (s.art && s.schluessel.some((k) => n.includes(k))) art = s.art;
  if (art === "arbeit" && (g.ganztaegig || !g.beginn)) art = "frei";
  const name = g.name.slice(0, 30);
  const mitZeit = art === "arbeit" && !!g.beginn && !!g.ende;
  return {
    id: null,
    name,
    kuerzel: kuerzelAus(name, vergeben),
    farbe: FARBEN[(vorhandene + laufend) % FARBEN.length]!,
    art,
    beginn: mitZeit ? g.beginn : "",
    ende: mitZeit ? g.ende : "",
    stunden: mitZeit ? Math.min(24, stundenZwischen(g.beginn, g.ende) ?? 8) : 0,
    reihenfolge: vorhandene + laufend + 1,
  };
}

export interface PlanZeile {
  tag: string;
  ebene: Ebene;
  /** vorhandene Schichtart-Id oder "neu:<Name>" */
  ref: string;
}

export interface Plan {
  zeilen: PlanZeile[];
  /** Tage, die vorher ganz geleert werden (nur „Überschreiben“) */
  leeren: string[];
  /** Tage mit Import-Eintrag */
  tage: number;
  /** davon Tage, an denen schon etwas stand */
  belegt: number;
  /** wirklich geschriebene Tage (bei „Nur leere Tage füllen“ ohne die belegten) */
  geschrieben: number;
}

/**
 * Plan für den Import. `artVon` sagt zu einer Referenz, ob sie Arbeit oder
 * Abwesenheit/Frei ist (Arbeit steht auf Ebene 1, der Rest dahinter).
 */
export function planeImport(
  gruppen: Gruppe[],
  ziele: Record<string, Ziel>,
  vorhanden: Record<string, TagEintrag>,
  modus: Modus,
  artVon: (ref: string) => SchichtArt,
): Plan {
  const proTag = new Map<string, string[]>();
  for (const g of gruppen) {
    const z = ziele[g.name];
    if (!z || z.art === "skip") continue;
    const ref = z.art === "vorhanden" ? z.id : `neu:${g.name}`;
    for (const tag of g.tage) {
      const liste = proTag.get(tag) ?? [];
      if (!liste.includes(ref)) liste.push(ref);
      proTag.set(tag, liste);
    }
  }

  const zeilen: PlanZeile[] = [];
  const leeren: string[] = [];
  let belegt = 0;
  let geschrieben = 0;
  for (const [tag, refs] of [...proTag.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Arbeit zuerst, dann Frei/Urlaub/Krank – höchstens zwei Einträge je Tag.
    const ziele2 = [...refs].sort((a, b) => Number(artVon(b) === "arbeit") - Number(artVon(a) === "arbeit")).slice(0, 2);
    const e = vorhanden[tag];
    const stehtSchon = !!(e?.schicht || e?.zusatz);
    if (stehtSchon) belegt += 1;

    if (!stehtSchon || modus === "ueber") {
      if (stehtSchon) leeren.push(tag);
      ziele2.forEach((ref, i) => zeilen.push({ tag, ebene: (i + 1) as Ebene, ref }));
      geschrieben += 1;
    } else if (modus === "zusatz") {
      if (!e?.schicht) {
        ziele2.forEach((ref, i) => zeilen.push({ tag, ebene: (i + 1) as Ebene, ref }));
        geschrieben += 1;
      } else {
        const weitere = ziele2.find((ref) => ref !== e.schicht);
        if (weitere && weitere !== e.zusatz) {
          zeilen.push({ tag, ebene: 2, ref: weitere });
          geschrieben += 1;
        }
      }
    }
    // modus === "leer" mit belegtem Tag: nichts schreiben
  }
  return { zeilen, leeren, tage: proTag.size, belegt, geschrieben };
}

const BLOCK = 120;

async function inBloecken(liste: string[], f: (teil: string[]) => Promise<void>) {
  for (let i = 0; i < liste.length; i += BLOCK) await f(liste.slice(i, i + BLOCK));
}

export interface Ergebnis {
  geschrieben: number;
  belegt: number;
  /** Zustand vor dem Import für alle angefassten Tage (für „Rückgängig“) */
  vorher: Record<string, TagEintrag>;
  betroffen: string[];
  angelegt: string[];
}

/** Führt den Plan aus: neue Schichtarten anlegen, Tage schreiben. */
export async function fuehreAus(
  plan: Plan,
  neu: SchichtartEingabe[],
  vorhanden: Record<string, TagEintrag>,
): Promise<Ergebnis> {
  const vorherIds = new Set((await ladeSchichtarten()).map((a) => a.id));
  for (const a of neu) await speichereSchichtart(a);
  const jetzt = neu.length ? await ladeSchichtarten() : [];
  const neueIds = new Map<string, string>();
  const angelegt: string[] = [];
  for (const a of neu) {
    const treffer = jetzt.filter((x) => !vorherIds.has(x.id) && x.name === a.name.trim() && !angelegt.includes(x.id)).pop();
    if (treffer) {
      neueIds.set(`neu:${a.name}`, treffer.id);
      angelegt.push(treffer.id);
    }
  }

  const betroffen = [...new Set([...plan.zeilen.map((z) => z.tag), ...plan.leeren])];
  const vorher: Record<string, TagEintrag> = {};
  for (const t of betroffen) vorher[t] = vorhanden[t] ?? { schicht: null, zusatz: null };

  await inBloecken(plan.leeren, (teil) => leereTage(teil));
  const gruppen = new Map<string, string[]>();
  for (const z of plan.zeilen) {
    const id = z.ref.startsWith("neu:") ? neueIds.get(z.ref) : z.ref;
    if (!id) throw new Error("Eine neue Schicht konnte nicht angelegt werden.");
    const k = `${z.ebene}|${id}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), z.tag]);
  }
  for (const [k, tage] of gruppen) {
    const [ebene, id] = k.split("|") as [string, string];
    await inBloecken(tage, (teil) => setzeTage(teil, id, Number(ebene) as Ebene));
  }
  return { geschrieben: plan.geschrieben, belegt: plan.belegt, vorher, betroffen, angelegt };
}

/** Nimmt den Import zurück: angefasste Tage wieder wie vorher, neue Schichten wieder weg. */
export async function macheRueckgaengig(erg: Ergebnis): Promise<void> {
  await inBloecken(erg.betroffen, (teil) => leereTage(teil));
  const gruppen = new Map<string, string[]>();
  for (const [tag, e] of Object.entries(erg.vorher)) {
    if (e.schicht) gruppen.set(`1|${e.schicht}`, [...(gruppen.get(`1|${e.schicht}`) ?? []), tag]);
    if (e.zusatz) gruppen.set(`2|${e.zusatz}`, [...(gruppen.get(`2|${e.zusatz}`) ?? []), tag]);
  }
  for (const [k, tage] of gruppen) {
    const [ebene, id] = k.split("|") as [string, string];
    await inBloecken(tage, (teil) => setzeTage(teil, id, Number(ebene) as Ebene));
  }
  for (const id of erg.angelegt) await loescheSchichtart(id);
}
