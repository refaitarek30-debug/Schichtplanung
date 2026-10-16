import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { LINK_UNGUELTIG, PartnerFehler, type PartnerCode } from "./partner";

/**
 * Gruppen (Familie, Freunde) mit eigenem Konto – Migration 0152. Mitglieder
 * sehen nur, wann die anderen arbeiten (F/S/N/T), abwesend (U) oder frei
 * (X) sind – keine Termine.
 */

export interface Gruppe {
  id: string;
  name: string;
  mitglieder: number;
  vonMir: boolean;
}

export interface GruppenMitglied {
  id: string;
  name: string;
  ich: boolean;
  tage: Record<string, PartnerCode>;
}

function fehler(error: { message?: string; code?: string } | null, standard: string): never {
  if (error?.code === "PT404") throw new PartnerFehler(LINK_UNGUELTIG);
  throw new PartnerFehler(dataErrorMessage(error) ?? standard);
}

export async function fetchGruppen(): Promise<Gruppe[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_gruppen");
  if (error) fehler(error, "Die Gruppen konnten nicht geladen werden.");
  return ((data ?? []) as { id: string; name: string; mitglieder: number; von_mir: boolean }[]).map((g) => ({
    id: g.id,
    name: g.name,
    mitglieder: g.mitglieder,
    vonMir: g.von_mir,
  }));
}

export async function gruppeErstellen(name: string): Promise<{ id: string; schluessel: string }> {
  const { data, error } = await createClient().rpc("gruppe_erstellen", { p_name: name });
  const z = data as { id?: string; schluessel?: string } | null;
  if (error || !z?.id || !z.schluessel) fehler(error, "Die Gruppe konnte nicht erstellt werden.");
  return { id: z!.id!, schluessel: z!.schluessel! };
}

/** Neuer Einladungslink – der alte gilt danach nicht mehr. */
export async function gruppeLinkNeu(id: string): Promise<string> {
  const { data, error } = await createClient().rpc("gruppe_link_neu", { p_gruppe: id });
  if (error || typeof data !== "string") fehler(error, "Der Link konnte nicht erstellt werden.");
  return data as string;
}

export async function gruppeVerlassen(id: string) {
  const { error } = await createClient().rpc("gruppe_verlassen", { p_gruppe: id });
  if (error) fehler(error, "Das Austreten hat nicht geklappt.");
}

export interface GruppenEinladung {
  id: string;
  name: string;
  mitglieder: number;
  /** Schon Mitglied. */
  dabei: boolean;
  /** Hat einen eigenen Schichtkalender und darf beitreten. */
  darf: boolean;
}

export async function gruppeInfo(token: string): Promise<GruppenEinladung> {
  const { data, error } = await createClient().rpc("gruppe_info", { p_token: token });
  if (error) fehler(error, "Die Einladung konnte nicht geladen werden.");
  return data as GruppenEinladung;
}

export async function gruppeBeitreten(token: string): Promise<string> {
  const { data, error } = await createClient().rpc("gruppe_beitreten", { p_token: token });
  if (error) fehler(error, "Das Beitreten hat nicht geklappt.");
  return data as string;
}

/** Alle Mitglieder einer Gruppe mit Kürzel je Tag (höchstens 62 Tage). */
export async function fetchGruppeTage(id: string, von: string, tage: number): Promise<GruppenMitglied[]> {
  const { data, error } = await createClient().rpc("gruppe_tage", { p_gruppe: id, p_von: von, p_tage: tage });
  if (error) fehler(error, "Die Gruppe konnte nicht geladen werden.");
  return (data ?? []) as GruppenMitglied[];
}

export interface GruppenAnderer {
  id: string;
  name: string;
  gruppen: string[];
  tage: Record<string, PartnerCode>;
}

/** Die anderen aus allen eigenen Gruppen – für den eigenen Kalender. */
export async function fetchGruppenAndere(von: string, tage: number): Promise<GruppenAnderer[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_gruppen_tage", { p_von: von, p_tage: tage });
  if (error) fehler(error, "Die Gruppen konnten nicht geladen werden.");
  return (data ?? []) as GruppenAnderer[];
}

/** Hat an dem Tag frei: frei, abwesend oder nichts eingetragen. */
export function istFrei(code: PartnerCode | null | undefined): boolean {
  return !code || code === "X" || code === "U";
}
