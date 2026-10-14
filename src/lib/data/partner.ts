import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

/**
 * Partner im Kalender – siehe Migration 0138_kalender_partner.sql.
 *
 * Inhaber (angemeldet): Link erzeugen/beenden, Partnertage lesen/setzen.
 * Partner (ohne Konto): mit dem Schlüssel aus dem Link den Plan des
 * Inhabers lesen und die eigenen Tage setzen.
 */

export type PartnerCode = "F" | "S" | "N" | "T" | "X";

export class PartnerFehler extends Error {}

function fehler(error: Parameters<typeof dataErrorMessage>[0], standard: string): never {
  throw new PartnerFehler(dataErrorMessage(error) ?? standard);
}

export async function fetchMeinePartnerTage(von: string, bis: string): Promise<Record<string, PartnerCode>> {
  if (!isSupabaseConfigured) return {};
  const { data, error } = await createClient().rpc("meine_partner_tage", { p_von: von, p_bis: bis });
  if (error) fehler(error, "Die Partnertage konnten nicht geladen werden.");
  const tage: Record<string, PartnerCode> = {};
  for (const z of (data ?? []) as { tag: string; schicht: PartnerCode }[]) tage[z.tag] = z.schicht;
  return tage;
}

export async function setzeMeinePartnerTage(von: string, anzahl: number, code: PartnerCode | null) {
  const { error } = await createClient().rpc("meine_partner_tage_setzen", {
    p_von: von,
    p_anzahl: anzahl,
    p_schicht: code,
  });
  if (error) fehler(error, "Das konnte nicht gespeichert werden.");
}

export interface PartnerLinkStatus {
  aktiv: boolean;
  erstelltAm: string | null;
  zuletztGenutzt: string | null;
}

export async function fetchPartnerLinkStatus(): Promise<PartnerLinkStatus> {
  const { data, error } = await createClient().rpc("partner_link_status");
  if (error) fehler(error, "Der Stand der Einladung konnte nicht geladen werden.");
  const z = ((data ?? []) as { aktiv: boolean; erstellt_am: string; zuletzt_genutzt: string | null }[])[0];
  return z
    ? { aktiv: true, erstelltAm: z.erstellt_am, zuletztGenutzt: z.zuletzt_genutzt }
    : { aktiv: false, erstelltAm: null, zuletztGenutzt: null };
}

/** Neuer Schlüssel – ein bestehender Link gilt danach nicht mehr. */
export async function erstellePartnerLink(): Promise<string> {
  const { data, error } = await createClient().rpc("partner_link_erstellen");
  if (error || typeof data !== "string") fehler(error, "Der Link konnte nicht erstellt werden.");
  return data as string;
}

export async function beendePartnerLink() {
  const { error } = await createClient().rpc("partner_link_beenden");
  if (error) fehler(error, "Der Zugang konnte nicht beendet werden.");
}

// ---- Partner (ohne Anmeldung) -------------------------------------------

export interface PartnerKalender {
  name: string;
  /** Tag -> [Schicht des Inhabers, Schicht des Partners]. */
  tage: Map<string, [PartnerCode | null, PartnerCode | null]>;
}

export const LINK_UNGUELTIG = "Dieser Link ist nicht mehr gültig.";

export async function fetchPartnerKalender(token: string, von: string, tage: number): Promise<PartnerKalender> {
  const { data, error } = await createClient().rpc("partner_kalender", {
    p_token: token,
    p_von: von,
    p_tage: tage,
  });
  if (error) {
    if (error.code === "P0002") throw new PartnerFehler(LINK_UNGUELTIG);
    fehler(error, "Der Kalender konnte nicht geladen werden.");
  }
  const roh = data as { name: string; tage: [string, PartnerCode | null, PartnerCode | null][] };
  const karte = new Map<string, [PartnerCode | null, PartnerCode | null]>();
  for (const [tag, eigen, partner] of roh?.tage ?? []) karte.set(tag, [eigen, partner]);
  return { name: roh?.name ?? "", tage: karte };
}

export async function partnerTageSetzen(token: string, von: string, anzahl: number, code: PartnerCode | null) {
  const { error } = await createClient().rpc("partner_tage_setzen", {
    p_token: token,
    p_von: von,
    p_anzahl: anzahl,
    p_schicht: code,
  });
  if (error) {
    if (error.code === "P0002") throw new PartnerFehler(LINK_UNGUELTIG);
    fehler(error, "Das konnte nicht gespeichert werden.");
  }
}
