import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage } from "@/lib/errors";

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
  throw new PrivatFehler(dataErrorMessage(error) ?? standard);
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
 * Bis zu zwei Einträge je Tag (Migration 0148): `schicht` (Ebene 1, z. B.
 * aus der Schichtfolge) und `zusatz` (Ebene 2, z. B. Urlaub an dem Tag).
 */
export interface TagEintrag {
  schicht: string | null;
  zusatz: string | null;
}

export type Ebene = 1 | 2;

/** Tag -> Einträge für einen Zeitraum (beide Enden eingeschlossen). */
export async function ladeTage(von: string, bis: string): Promise<Record<string, TagEintrag>> {
  const { data, error } = await createClient()
    .from("privat_tage")
    .select("tag, ebene, schichtart_id")
    .gte("tag", von)
    .lte("tag", bis)
    .limit(4000);
  if (error) fehler(error, "Der Kalender konnte nicht geladen werden.");
  const tage: Record<string, TagEintrag> = {};
  for (const z of (data ?? []) as { tag: string; ebene: number; schichtart_id: string }[]) {
    const e = (tage[z.tag] ??= { schicht: null, zusatz: null });
    if (z.ebene === 2) e.zusatz = z.schichtart_id;
    else e.schicht = z.schichtart_id;
  }
  return tage;
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

/** Alles an diesen Tagen leeren (beide Ebenen). */
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

export const FARBEN = [
  "#F5A524",
  "#22A06B",
  "#2F6FDE",
  "#E5484D",
  "#9B59D0",
  "#F76B15",
  "#0E9F9F",
  "#D6409F",
  "#6E56CF",
  "#8D6E4E",
  "#5B6472",
  "#12A594",
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
