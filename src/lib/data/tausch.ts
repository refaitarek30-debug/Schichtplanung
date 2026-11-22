import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

/**
 * Schichttausch unter Kollegen (Migration 0240). Die Regeln stehen in der
 * Datenbank – wer was darf, wann ein Tag passt –, hier wird nur gelesen und
 * aufgerufen. Fehlermeldungen kommen schon in klaren Worten zurück.
 */
export class TauschFehler extends Error {}

export type TauschStatus = "offen" | "angefragt" | "genehmigt" | "abgelehnt" | "zurueckgezogen";

export interface Tausch {
  id: string;
  tag: string;
  schicht: string | null;
  vonName: string;
  vonIch: boolean;
  status: TauschStatus;
  notiz: string | null;
  uebernehmerName: string | null;
  uebernehmerIch: boolean;
  gegenTag: string | null;
  gegenSchicht: string | null;
  /** Für offene Angebote anderer: passt es mir (frei an dem Tag)? */
  passt: boolean | null;
  grund: string | null;
}

interface Zeile {
  id: string;
  tag: string;
  schicht: string | null;
  von_name: string;
  von_ich: boolean;
  status: TauschStatus;
  notiz: string | null;
  uebernehmer_name: string | null;
  uebernehmer_ich: boolean | null;
  gegen_tag: string | null;
  gegen_schicht: string | null;
  passt: boolean | null;
  grund: string | null;
}

function fehler(e: { message?: string; code?: string } | null, sonst: string): TauschFehler {
  // Unsere eigenen Meldungen (raise exception) sind schon für Menschen geschrieben.
  const eigen = e?.code === "P0001" ? e.message : null;
  return new TauschFehler(eigen ?? dataErrorMessage(e) ?? sonst);
}

export async function ladeTausch(): Promise<Tausch[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("tausch_liste");
  // Noch keine Migration: der Reiter zeigt einen ruhigen Hinweis statt eines Fehlers.
  if (error) return null;
  return ((data ?? []) as Zeile[]).map((z) => ({
    id: z.id,
    tag: z.tag,
    schicht: z.schicht,
    vonName: z.von_name,
    vonIch: z.von_ich,
    status: z.status,
    notiz: z.notiz,
    uebernehmerName: z.uebernehmer_name,
    uebernehmerIch: z.uebernehmer_ich === true,
    gegenTag: z.gegen_tag,
    gegenSchicht: z.gegen_schicht,
    passt: z.passt,
    grund: z.grund,
  }));
}

export async function tauschAnbieten(tag: string, notiz: string) {
  const { error } = await createClient().rpc("tausch_anbieten", { p_tag: tag, p_notiz: notiz || null });
  if (error) throw fehler(error, "Das Angebot hat nicht geklappt.");
}

export async function tauschAnnehmen(id: string, gegenTag: string | null) {
  const { error } = await createClient().rpc("tausch_annehmen", { p_id: id, p_gegen_tag: gegenTag });
  if (error) throw fehler(error, "Das Übernehmen hat nicht geklappt.");
}

export async function tauschEntscheiden(id: string, ok: boolean) {
  const { error } = await createClient().rpc("tausch_entscheiden", { p_id: id, p_ok: ok });
  if (error) throw fehler(error, "Die Entscheidung hat nicht geklappt.");
}

export async function tauschZurueckziehen(id: string) {
  const { error } = await createClient().rpc("tausch_zurueckziehen", { p_id: id });
  if (error) throw fehler(error, "Das Zurückziehen hat nicht geklappt.");
}
