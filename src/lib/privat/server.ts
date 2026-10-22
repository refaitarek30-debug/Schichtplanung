import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hatEchteEmail } from "./spitzname";

/**
 * Privatbereich (Migration 0147): Schichtkalender für Einzelpersonen ohne
 * Firma. Ein Privatkonto hat kein Profil – nur eine Zeile in
 * `privat_konten`.
 */
export interface PrivatKonto {
  userId: string;
  name: string;
  /** Echte E-Mail-Adresse, falls hinterlegt (sonst nur der interne Spitzname-Zugang). */
  email: string | null;
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
    .select("user_id, name, bundesland, feiertage_zeigen, wochenstunden, kontakt_email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const adresse = typeof anspruch?.claims?.email === "string" ? anspruch.claims.email : null;
  return {
    userId: data.user_id as string,
    name: data.name as string,
    email: (data.kontakt_email as string | null) ?? (hatEchteEmail(adresse) ? adresse : null),
    bundesland: data.bundesland as string,
    feiertageZeigen: data.feiertage_zeigen as boolean,
    wochenstunden: data.wochenstunden === null ? null : Number(data.wochenstunden),
  };
});
