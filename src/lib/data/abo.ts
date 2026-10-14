import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

/** Kalender-Abo (Migration 0143). Nur für freigeschaltete Personen. */

export interface AboStatus {
  aktiv: boolean;
  erstelltAm: string | null;
  zuletztAbgerufen: string | null;
}

export class AboFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new AboFehler(dataErrorMessage(error) ?? standard);
}

export async function hatKalenderAbo(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await createClient().rpc("hat_funktion", { p_name: "kalender_abo" });
  return !error && data === true;
}

export async function fetchAboStatus(): Promise<AboStatus> {
  const { data, error } = await createClient().rpc("abo_status");
  if (error) fehler(error, "Der Stand des Abos konnte nicht geladen werden.");
  const z = ((data ?? []) as { erstellt_am: string; zuletzt_abgerufen: string | null }[])[0];
  return z
    ? { aktiv: true, erstelltAm: z.erstellt_am, zuletztAbgerufen: z.zuletzt_abgerufen }
    : { aktiv: false, erstelltAm: null, zuletztAbgerufen: null };
}

/** Neuer Schlüssel – ein bestehender Link gilt danach nicht mehr. */
export async function erstelleAbo(): Promise<string> {
  const { data, error } = await createClient().rpc("abo_erstellen");
  if (error || typeof data !== "string") fehler(error, "Das Abo konnte nicht eingerichtet werden.");
  return data as string;
}

export async function beendeAbo() {
  const { error } = await createClient().rpc("abo_beenden");
  if (error) fehler(error, "Das Abo konnte nicht beendet werden.");
}
