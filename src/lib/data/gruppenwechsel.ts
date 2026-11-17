import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

/** Geplanter Wechsel in eine andere Schichtgruppe ab einem Datum (Migration 0232). */
export interface Gruppenwechsel {
  id: string;
  ab: string;
  vonTeam: string | null;
  nachTeam: string;
  vollzogen: boolean;
}

/** Wechsel einer Person, ältester zuerst. null = Funktion noch nicht eingespielt. */
export async function ladeGruppenwechsel(employeeId: string): Promise<Gruppenwechsel[] | null> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient()
    .from("employee_gruppenwechsel")
    .select("id, ab, von_team, nach_team, vollzogen_am")
    .eq("employee_id", employeeId)
    .order("ab");
  if (error) return null;
  return ((data ?? []) as { id: string; ab: string; von_team: string | null; nach_team: string; vollzogen_am: string | null }[]).map((r) => ({
    id: r.id,
    ab: r.ab,
    vonTeam: r.von_team,
    nachTeam: r.nach_team,
    vollzogen: !!r.vollzogen_am,
  }));
}

export async function planeGruppenwechsel(employeeId: string, ab: string, nachTeam: string): Promise<string | null> {
  const { error } = await createClient().rpc("gruppenwechsel_planen", { p_employee_id: employeeId, p_ab: ab, p_nach_team: nachTeam });
  return error ? (dataErrorMessage(error) ?? "Der Wechsel konnte nicht gespeichert werden.") : null;
}

export async function loescheGruppenwechsel(id: string): Promise<string | null> {
  const { error } = await createClient().rpc("gruppenwechsel_loeschen", { p_id: id });
  return error ? (dataErrorMessage(error) ?? "Der Wechsel konnte nicht gestrichen werden.") : null;
}
