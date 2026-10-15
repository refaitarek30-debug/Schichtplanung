import { createClient } from "@/lib/supabase/client";
import { dataErrorMessage } from "@/lib/errors";

/**
 * Mein Kalender (Firma): eigene Farben und private Einträge (Migration
 * 0149). Nur die Person selbst sieht und ändert das – die Firma nicht,
 * und der echte Schichtplan bleibt unberührt.
 */

export interface EigeneArt {
  id: string;
  name: string;
  kuerzel: string;
  farbe: string;
  /** "HH:MM" oder "" */
  beginn: string;
  ende: string;
  reihenfolge: number;
}

export type EigeneArtEingabe = Omit<EigeneArt, "id"> & { id: string | null };

export class EigeneFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new EigeneFehler(dataErrorMessage(error) ?? standard);
}

const zeit = (t: string | null) => (t ? t.slice(0, 5) : "");

async function meineId(): Promise<string> {
  const { data } = await createClient().auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) throw new EigeneFehler("Deine Sitzung ist abgelaufen. Bitte neu anmelden.");
  return id;
}

// ---- Eigene Eintragsarten ---------------------------------------------

export async function ladeEigeneArten(): Promise<EigeneArt[]> {
  const { data, error } = await createClient()
    .from("kalender_eigene_arten")
    .select("id, name, kuerzel, farbe, beginn, ende, reihenfolge")
    .order("reihenfolge")
    .order("erstellt_am");
  if (error) fehler(error, "Deine eigenen Einträge konnten nicht geladen werden.");
  return (
    (data ?? []) as {
      id: string;
      name: string;
      kuerzel: string;
      farbe: string;
      beginn: string | null;
      ende: string | null;
      reihenfolge: number;
    }[]
  ).map((z) => ({ ...z, beginn: zeit(z.beginn), ende: zeit(z.ende) }));
}

export async function speichereEigeneArt(a: EigeneArtEingabe): Promise<void> {
  const supabase = createClient();
  const zeile = {
    name: a.name.trim(),
    kuerzel: a.kuerzel.trim(),
    farbe: a.farbe,
    beginn: a.beginn && a.ende ? a.beginn : null,
    ende: a.beginn && a.ende ? a.ende : null,
    reihenfolge: a.reihenfolge,
  };
  if (a.id) {
    const { error } = await supabase.from("kalender_eigene_arten").update(zeile).eq("id", a.id);
    if (error) fehler(error, "Der Eintrag konnte nicht gespeichert werden.");
  } else {
    const { error } = await supabase.from("kalender_eigene_arten").insert({ ...zeile, user_id: await meineId() });
    if (error) fehler(error, "Der Eintrag konnte nicht angelegt werden.");
  }
}

/** Löscht die Art – und damit alle Tage, an denen sie steht. */
export async function loescheEigeneArt(id: string): Promise<void> {
  const { error } = await createClient().from("kalender_eigene_arten").delete().eq("id", id);
  if (error) fehler(error, "Der Eintrag konnte nicht gelöscht werden.");
}

// ---- Eigene Einträge an Tagen -----------------------------------------

/** Tag -> Art-ID für einen Zeitraum (beide Enden eingeschlossen). */
export async function ladeEigeneTage(von: string, bis: string): Promise<Record<string, string>> {
  const { data, error } = await createClient()
    .from("kalender_eigene_tage")
    .select("tag, art_id")
    .gte("tag", von)
    .lte("tag", bis)
    .limit(1000);
  if (error) fehler(error, "Deine eigenen Einträge konnten nicht geladen werden.");
  const tage: Record<string, string> = {};
  for (const z of (data ?? []) as { tag: string; art_id: string }[]) tage[z.tag] = z.art_id;
  return tage;
}

/** Einen eigenen Eintrag an Tagen setzen (null = entfernen). */
export async function setzeEigeneTage(tage: string[], artId: string | null): Promise<void> {
  if (!tage.length) return;
  const supabase = createClient();
  if (artId === null) {
    const { error } = await supabase.from("kalender_eigene_tage").delete().in("tag", tage);
    if (error) fehler(error, "Das konnte nicht gespeichert werden.");
    return;
  }
  const userId = await meineId();
  const { error } = await supabase
    .from("kalender_eigene_tage")
    .upsert(tage.map((tag) => ({ user_id: userId, tag, art_id: artId })), { onConflict: "user_id,tag" });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

// ---- Eigene Farben für Schichten und Abwesenheiten ---------------------

export async function ladeFarben(): Promise<Record<string, string>> {
  const { data, error } = await createClient().from("kalender_farben").select("schluessel, farbe");
  if (error) fehler(error, "Deine Farben konnten nicht geladen werden.");
  const farben: Record<string, string> = {};
  for (const z of (data ?? []) as { schluessel: string; farbe: string }[]) farben[z.schluessel] = z.farbe;
  return farben;
}

/** Farbe setzen – null stellt die Standardfarbe wieder her. */
export async function setzeFarbe(schluessel: string, farbe: string | null): Promise<void> {
  const supabase = createClient();
  if (farbe === null) {
    const { error } = await supabase.from("kalender_farben").delete().eq("schluessel", schluessel);
    if (error) fehler(error, "Die Farbe konnte nicht zurückgesetzt werden.");
    return;
  }
  const { error } = await supabase
    .from("kalender_farben")
    .upsert({ user_id: await meineId(), schluessel, farbe }, { onConflict: "user_id,schluessel" });
  if (error) fehler(error, "Die Farbe konnte nicht gespeichert werden.");
}
