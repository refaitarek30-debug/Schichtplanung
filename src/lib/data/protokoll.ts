import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

/** Ein Eintrag im Protokoll – so, wie `protokoll_liste()` ihn liefert. */
export interface ProtokollEintrag {
  id: string;
  zeit: string;
  aktion: string;
  /** Wer gehandelt hat. `null` = System (Datenbank-Job, Import, unbekannt). */
  akteur: string | null;
  /** Um wen es geht, sofern eine Person betroffen ist. */
  betroffen: string | null;
  details: Record<string, unknown>;
}

export type ProtokollArt = "anmeldung" | "aenderung" | "fehler";

export interface ProtokollZahlen {
  anmeldungen: number;
  personen: number;
  aenderungen: number;
  fehler: number;
  fehlanmeldungen: number;
}

interface ListeZeile {
  id: string;
  zeit: string;
  aktion: string;
  akteur: string | null;
  betroffen: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Protokoll der eigenen Firma, neueste Einträge zuerst. `vor` blättert:
 * nur Einträge älter als dieser Zeitpunkt.
 *
 * Die Berechtigung prüft die Datenbank – wer nicht freigeschaltet ist,
 * bekommt einen Fehler, keine leere Liste.
 */
export async function fetchProtokoll(
  tage: number,
  art: ProtokollArt | null,
  vor: string | null,
  limit = 150,
): Promise<ProtokollEintrag[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("protokoll_liste", {
    p_tage: tage,
    p_art: art,
    p_vor: vor,
    p_limit: limit,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Das Protokoll konnte nicht geladen werden.");
  return ((data ?? []) as ListeZeile[]).map((z) => ({
    id: z.id,
    zeit: z.zeit,
    aktion: z.aktion,
    akteur: z.akteur,
    betroffen: z.betroffen,
    details: z.details ?? {},
  }));
}

export async function fetchProtokollZahlen(tage: number): Promise<ProtokollZahlen> {
  const leer = { anmeldungen: 0, personen: 0, aenderungen: 0, fehler: 0, fehlanmeldungen: 0 };
  if (!isSupabaseConfigured) return leer;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("protokoll_zahlen", { p_tage: tage });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Das Protokoll konnte nicht geladen werden.");
  const zeile = ((data ?? []) as Record<string, number | string>[])[0];
  if (!zeile) return leer;
  return {
    anmeldungen: Number(zeile.anmeldungen ?? 0),
    personen: Number(zeile.personen ?? 0),
    aenderungen: Number(zeile.aenderungen ?? 0),
    fehler: Number(zeile.fehler ?? 0),
    fehlanmeldungen: Number(zeile.fehlanmeldungen ?? 0),
  };
}
