import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

export type FehlzeitArt = "frueher_gegangen" | "spaeter_gekommen";

/** Ein Teil einer Schicht, der nicht gearbeitet wurde. */
export interface Fehlzeit {
  id: string;
  employeeId: string;
  employeeName: string;
  rotationTeam: string | null;
  tag: string;
  art: FehlzeitArt;
  stunden: number;
  notiz: string | null;
  /** Darf die angemeldete Person den Eintrag löschen? */
  darfAendern: boolean;
}

interface FehlzeitZeile {
  id: string;
  employee_id: string;
  employee_name: string;
  rotation_team: string | null;
  tag: string;
  art: FehlzeitArt;
  stunden: number | string;
  notiz: string | null;
  darf_aendern: boolean;
}

/** Fehlzeiten im Zeitraum – nur für die Führung (prüft die Datenbank). */
export async function fetchFehlzeiten(von: string, bis: string): Promise<Fehlzeit[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fehlzeiten_liste", { p_von: von, p_bis: bis });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return ((data ?? []) as FehlzeitZeile[]).map((z) => ({
    id: z.id,
    employeeId: z.employee_id,
    employeeName: z.employee_name,
    rotationTeam: z.rotation_team,
    tag: z.tag,
    art: z.art,
    stunden: Number(z.stunden),
    notiz: z.notiz,
    darfAendern: z.darf_aendern === true,
  }));
}
