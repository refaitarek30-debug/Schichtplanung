import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Privatbereich (Migration 0147): Schichtkalender für Einzelpersonen ohne
 * Firma. Ein Privatkonto hat kein Profil – nur eine Zeile in
 * `privat_konten`.
 */
export interface PrivatKonto {
  userId: string;
  name: string;
  bundesland: string;
  feiertageZeigen: boolean;
  wochenstunden: number | null;
}

export const getPrivatKonto = cache(async (): Promise<PrivatKonto | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("privat_konten")
    .select("user_id, name, bundesland, feiertage_zeigen, wochenstunden")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id as string,
    name: data.name as string,
    bundesland: data.bundesland as string,
    feiertageZeigen: data.feiertage_zeigen as boolean,
    wochenstunden: data.wochenstunden === null ? null : Number(data.wochenstunden),
  };
});
