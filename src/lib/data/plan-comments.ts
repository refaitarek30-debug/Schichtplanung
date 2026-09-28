import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Ein Kommentar zu einem Tag einer Person im Schichtplan. */
export interface PlanKommentar {
  id: string;
  employeeId: string;
  tag: string;
  text: string;
  autorId: string | null;
  autorName: string;
  erstelltAm: string;
}

interface KommentarZeile {
  id: string;
  employee_id: string;
  tag: string;
  text: string;
  autor_id: string | null;
  autor_name: string;
  created_at: string;
}

/**
 * Kommentare im angezeigten Zeitraum. Sichtbar ist, was die Datenbank
 * freigibt (Policy „Kommentare lesen": eigenes Unternehmen).
 *
 * Schlägt der Abruf fehl, kommt eine leere Liste – ohne Kommentare bleibt
 * der Plan voll benutzbar.
 */
export async function fetchPlanKommentare(von: string, bis: string): Promise<PlanKommentar[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("plan_kommentare")
    .select("id, employee_id, tag, text, autor_id, autor_name, created_at")
    .gte("tag", von)
    .lte("tag", bis)
    .order("created_at", { ascending: true })
    .returns<KommentarZeile[]>();
  if (error) return [];
  return (data ?? []).map((z) => ({
    id: z.id,
    employeeId: z.employee_id,
    tag: z.tag,
    text: z.text,
    autorId: z.autor_id,
    autorName: z.autor_name,
    erstelltAm: z.created_at,
  }));
}
