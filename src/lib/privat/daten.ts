import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage, datenFehlerText } from "@/lib/errors";

/** Privatbereich – Lesen und Schreiben im Browser (RLS: nur eigene Zeilen). */

export type SchichtArt = "arbeit" | "frei" | "urlaub" | "krank";

export interface Schichtart {
  id: string;
  name: string;
  kuerzel: string;
  farbe: string;
  art: SchichtArt;
  /** "HH:MM" oder "" */
  beginn: string;
  ende: string;
  stunden: number;
  reihenfolge: number;
}

export type SchichtartEingabe = Omit<Schichtart, "id"> & { id: string | null };

export interface Feiertag {
  tag: string;
  name: string;
}

export class PrivatFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new PrivatFehler(datenFehlerText(error, standard));
}

const zeit = (t: string | null) => (t ? t.slice(0, 5) : "");

interface SchichtartZeile {
  id: string;
  name: string;
  kuerzel: string;
  farbe: string;
  art: SchichtArt;
  beginn: string | null;
  ende: string | null;
  stunden: number | string;
  reihenfolge: number;
}

export async function ladeSchichtarten(): Promise<Schichtart[]> {
  const { data, error } = await createClient()
    .from("privat_schichtarten")
    .select("id, name, kuerzel, farbe, art, beginn, ende, stunden, reihenfolge")
    .order("reihenfolge")
    .order("erstellt_am");
  if (error) fehler(error, "Die Schichten konnten nicht geladen werden.");
  return ((data ?? []) as SchichtartZeile[]).map((z) => ({
    id: z.id,
    name: z.name,
    kuerzel: z.kuerzel,
    farbe: z.farbe,
    art: z.art,
    beginn: zeit(z.beginn),
    ende: zeit(z.ende),
    stunden: Number(z.stunden),
    reihenfolge: z.reihenfolge,
  }));
}

export async function speichereSchichtart(s: SchichtartEingabe): Promise<void> {
  const supabase = createClient();
  const zeile = {
    name: s.name.trim(),
    kuerzel: s.kuerzel.trim(),
    farbe: s.farbe,
    art: s.art,
    beginn: s.art === "arbeit" && s.beginn ? s.beginn : null,
    ende: s.art === "arbeit" && s.ende ? s.ende : null,
    stunden: s.stunden,
    reihenfolge: s.reihenfolge,
  };
  if (s.id) {
    const { error } = await supabase.from("privat_schichtarten").update(zeile).eq("id", s.id);
    if (error) fehler(error, "Die Schicht konnte nicht gespeichert werden.");
  } else {
    const { data: anspruch } = await supabase.auth.getClaims();
    const userId = anspruch?.claims?.sub;
    if (!userId) throw new PrivatFehler("Deine Sitzung ist abgelaufen.");
    const { error } = await supabase.from("privat_schichtarten").insert({ ...zeile, user_id: userId });
    if (error) fehler(error, "Die Schicht konnte nicht angelegt werden.");
  }
}

export async function loescheSchichtart(id: string): Promise<void> {
  const { error } = await createClient().from("privat_schichtarten").delete().eq("id", id);
  if (error) fehler(error, "Die Schicht konnte nicht gelöscht werden.");
}

/**
 * Bis zu drei Einträge je Tag (Migrationen 0148, 0184): `schicht` (Ebene 1,
 * z. B. aus der Schichtfolge), `zusatz` (Ebene 2, z. B. Urlaub an dem Tag)
 * und `dritte` (Ebene 3).
 */
export interface TagEintrag {
  schicht: string | null;
  zusatz: string | null;
  dritte: string | null;
}

export type Ebene = 1 | 2 | 3;

/** Höchstens so viele Einträge je Tag. */
export const MAX_JE_TAG = 3;

/** Die Einträge eines Tages als Liste, in Anzeige-Reihenfolge. */
export function idsVon(e: TagEintrag | undefined): string[] {
  return e ? [e.schicht, e.zusatz, e.dritte].filter((x): x is string => !!x) : [];
}

/** Liste -> Tag (aufgerückt, ohne Lücken); leer = undefined. */
export function eintragAus(ids: string[]): TagEintrag | undefined {
  if (!ids.length) return undefined;
  return { schicht: ids[0] ?? null, zusatz: ids[1] ?? null, dritte: ids[2] ?? null };
}

/** Tag -> Einträge für einen Zeitraum (beide Enden eingeschlossen). */
export async function ladeTage(von: string, bis: string): Promise<Record<string, TagEintrag>> {
  // Seitenweise: Der Server gibt je Abfrage höchstens 1000 Zeilen, ein Jahr
  // mit drei Einträgen je Tag hat bis zu 1098.
  const SEITE = 1000;
  const zeilen: { tag: string; ebene: number; schichtart_id: string }[] = [];
  for (let ab = 0; ; ab += SEITE) {
    const { data, error } = await createClient()
      .from("privat_tage")
      .select("tag, ebene, schichtart_id")
      .gte("tag", von)
      .lte("tag", bis)
      .order("tag")
      .order("ebene")
      .range(ab, ab + SEITE - 1);
    if (error) fehler(error, "Der Kalender konnte nicht geladen werden.");
    zeilen.push(...((data ?? []) as typeof zeilen));
    if ((data ?? []).length < SEITE) break;
  }
  const tage: Record<string, TagEintrag> = {};
  for (const z of zeilen) {
    const e = (tage[z.tag] ??= { schicht: null, zusatz: null, dritte: null });
    if (z.ebene === 3) e.dritte = z.schichtart_id;
    else if (z.ebene === 2) e.zusatz = z.schichtart_id;
    else e.schicht = z.schichtart_id;
  }
  return tage;
}

/**
 * Mehrere Tage genau so speichern, wie sie in `neu` stehen (undefined =
 * Tag leer). Je Ebene und Wert ein Aufruf, damit ein Pinsel-Strich über
 * viele Tage nicht viele Anfragen braucht.
 */
export async function speichereTage(neu: Record<string, TagEintrag | undefined>): Promise<void> {
  const leer = Object.entries(neu).filter(([, e]) => !e).map(([t]) => t);
  if (leer.length) await leereTage(leer);
  const gruppen = new Map<string, string[]>();
  for (const [tag, e] of Object.entries(neu)) {
    if (!e) continue;
    ([e.schicht, e.zusatz, e.dritte] as (string | null)[]).forEach((id, i) => {
      const k = `${i + 1}|${id ?? ""}`;
      gruppen.set(k, [...(gruppen.get(k) ?? []), tag]);
    });
  }
  for (const [k, tage] of gruppen) {
    const [ebene, id] = k.split("|") as [string, string];
    await setzeTage(tage, id || null, Number(ebene) as Ebene);
  }
}

/** Eine Ebene an einem oder mehreren Tagen setzen (null = leeren). */
export async function setzeTage(tage: string[], schichtartId: string | null, ebene: Ebene = 1): Promise<void> {
  if (!tage.length) return;
  const supabase = createClient();
  if (schichtartId === null) {
    const { error } = await supabase.from("privat_tage").delete().in("tag", tage).eq("ebene", ebene);
    if (error) fehler(error, "Das konnte nicht gespeichert werden.");
    return;
  }
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) throw new PrivatFehler("Deine Sitzung ist abgelaufen.");
  const { error } = await supabase
    .from("privat_tage")
    .upsert(tage.map((tag) => ({ user_id: userId, tag, ebene, schichtart_id: schichtartId })), {
      onConflict: "user_id,tag,ebene",
    });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

/** Alles an diesen Tagen leeren (alle Ebenen). */
export async function leereTage(tage: string[]): Promise<void> {
  if (!tage.length) return;
  const { error } = await createClient().from("privat_tage").delete().in("tag", tage);
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

/** Abwesenheiten (Urlaub, Krank) kommen als Zusatz auf eine Schicht. */
export const istAbwesenheit = (a: Pick<Schichtart, "art"> | undefined) => a?.art === "urlaub" || a?.art === "krank";

export async function wendeRotationAn(
  start: string,
  bis: string,
  muster: (string | null)[],
  ueberschreiben: boolean,
): Promise<number> {
  const { data, error } = await createClient().rpc("privat_rotation_anwenden", {
    p_start: start,
    p_bis: bis,
    p_muster: muster,
    p_ueberschreiben: ueberschreiben,
  });
  if (error) fehler(error, "Die Schichtfolge konnte nicht eingetragen werden.");
  return Number(data ?? 0);
}

export async function ladeFeiertage(jahr: number): Promise<Feiertag[]> {
  const { data, error } = await createClient().rpc("privat_feiertage", { p_jahr: jahr });
  if (error) return [];
  return (data ?? []) as Feiertag[];
}

// ---- Hilfen ----------------------------------------------------------

/** Stunden zwischen zwei Uhrzeiten, über Mitternacht hinweg. */
export function dauerStunden(beginn: string, ende: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(beginn) || !/^\d{2}:\d{2}$/.test(ende)) return null;
  const [bh, bm] = beginn.split(":").map(Number);
  const [eh, em] = ende.split(":").map(Number);
  let min = eh! * 60 + em! - (bh! * 60 + bm!);
  if (min <= 0) min += 24 * 60;
  return Math.round((min / 60) * 100) / 100;
}

/** Helle Farben bekommen dunkle Schrift, dunkle helle – in beiden Themen lesbar. */
export function textFarbe(farbe: string): string {
  const n = Number.parseInt(farbe.slice(1), 16);
  if (Number.isNaN(n)) return "#fff";
  const kanal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
  // Kontrast gegen Weiß bzw. Fast-Schwarz vergleichen und den besseren nehmen.
  return (1.05 / (l + 0.05)) >= ((l + 0.05) / 0.06) ? "#fff" : "#16181d";
}

/** Gefülltes Kästchen in der Schichtfarbe. */
export function farbStil(farbe: string): { backgroundColor: string; color: string } {
  return { backgroundColor: farbe, color: textFarbe(farbe) };
}

/**
 * Farbauswahl, nach Farbton sortiert. Gelb und Orange sind klar getrennt
 * (Zitronengelb – Bernstein – Orange). Gespeicherte Farben bleiben gültig,
 * auch wenn sie hier nicht mehr stehen.
 */
export const FARBEN = [
  // Rot und Pink
  "#E5484D",
  "#B42318",
  "#D6409F",
  "#F472B6",
  // Orange und Gelb
  "#F76B15",
  "#F5A524",
  "#FDE047",
  // Grün
  "#84CC16",
  "#22A06B",
  "#166534",
  "#34D399",
  "#0E9F9F",
  // Blau
  "#0EA5E9",
  "#2F6FDE",
  "#1E3A8A",
  // Lila
  "#C084FC",
  "#9B59D0",
  "#6E56CF",
  // Braun, Grau, Schwarz
  "#8D6E4E",
  "#A1A1AA",
  "#5B6472",
  "#1A1A1A",
];

export const ART_TEXT: Record<SchichtArt, string> = {
  arbeit: "Arbeit",
  frei: "Frei",
  urlaub: "Urlaub",
  krank: "Krank",
};

export const BUNDESLAENDER: { code: string; name: string }[] = [
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];
