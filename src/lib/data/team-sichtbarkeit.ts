import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

/**
 * Team-Sichtbarkeit (Migration 0237): Wer sieht meinen Namen und meine
 * Schichten? Getrennt für die eigene Schichtgruppe und die anderen. Gilt
 * gegenseitig – wer nein sagt, sieht diese Seite auch nur ohne Namen.
 * Leitung und Administration sehen immer alles. Entschieden wird in der
 * Datenbank (`team_sicht()`), hier wird nur gelesen und gespeichert.
 */
export type TeamModus = "alle" | "zustimmung";

export interface TeamSichtbarkeit {
  /** null: die Datenbank kennt die Einstellung noch nicht (Migration fehlt). */
  modus: TeamModus | null;
  eigene: boolean;
  andere: boolean;
  /** Schon einmal geantwortet? Sonst fragt die App beim Start. */
  gefragt: boolean;
  pushOhneInhalt: boolean;
}

interface PrivacyZeile {
  team_eigene: boolean | null;
  team_andere: boolean | null;
  team_gefragt_am: string | null;
  push_ohne_inhalt: boolean | null;
}

export async function ladeTeamSichtbarkeit(companyId: string): Promise<TeamSichtbarkeit> {
  const leer: TeamSichtbarkeit = { modus: null, eigene: false, andere: false, gefragt: true, pushOhneInhalt: false };
  if (!isSupabaseConfigured) return leer;
  const supabase = createClient();
  const [firma, meine] = await Promise.all([
    supabase.from("company_settings").select("team_sichtbarkeit").eq("company_id", companyId).maybeSingle(),
    supabase.from("privacy_settings").select("team_eigene, team_andere, team_gefragt_am, push_ohne_inhalt").maybeSingle(),
  ]);
  // Fehlt die Spalte noch (Migration nicht eingespielt): nichts fragen, nichts zeigen.
  if (firma.error || meine.error) return leer;
  const m = (firma.data as { team_sichtbarkeit?: string } | null)?.team_sichtbarkeit;
  const p = meine.data as PrivacyZeile | null;
  return {
    modus: m === "alle" || m === "zustimmung" ? m : null,
    eigene: p?.team_eigene === true,
    andere: p?.team_andere === true,
    gefragt: Boolean(p?.team_gefragt_am),
    pushOhneInhalt: p?.push_ohne_inhalt === true,
  };
}

/** Eigene Wahl speichern; was fehlt, bleibt wie es ist. */
export async function setzeTeamSichtbarkeit(w: { eigene?: boolean; andere?: boolean; pushOhneInhalt?: boolean }) {
  const { error } = await createClient().rpc("team_sichtbarkeit_setzen", {
    p_eigene: w.eigene ?? null,
    p_andere: w.andere ?? null,
    p_push_ohne_inhalt: w.pushOhneInhalt ?? null,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Das hat nicht geklappt. Bitte gleich noch einmal versuchen.");
}

export interface TeamZahlen {
  eigene: number;
  andere: number;
  abgelehnt: number;
  offen: number;
  nichtAngemeldet: number;
}

/** Für die Administration: nur Zahlen, keine Namen. */
export async function ladeTeamZahlen(): Promise<TeamZahlen | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await createClient().rpc("team_sichtbarkeit_zahlen");
  if (error) return null;
  const z = ((data ?? []) as { eigene: number; andere: number; abgelehnt: number; offen: number; nicht_angemeldet: number }[])[0];
  return z ? { eigene: z.eigene, andere: z.andere, abgelehnt: z.abgelehnt, offen: z.offen, nichtAngemeldet: z.nicht_angemeldet } : null;
}

export async function setzeTeamModus(companyId: string, modus: TeamModus) {
  const { error } = await createClient().from("company_settings").update({ team_sichtbarkeit: modus }).eq("company_id", companyId);
  if (error) throw new DataError(dataErrorMessage(error) ?? "Das hat nicht geklappt. Bitte gleich noch einmal versuchen.");
}
