import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { holidays as demoHolidays } from "@/lib/demo-data";
import type { Holiday } from "@/lib/types";

export class DataError extends Error {}

interface HolidayRow {
  date: string;
  name: string;
  region: string;
}

/**
 * Feiertage des eigenen Unternehmens (inkl. unternehmensübergreifender
 * Einträge mit `company_id is null`). Wird für die Live-Vorschau im
 * Antragsformular gebraucht – sonst würde die Vorschau die Demo-Feiertage
 * aus Phase 1 zeigen, während der Server serverseitig (Trigger
 * `leave_requests_compute_days`) gegen die echten Feiertage rechnet, was
 * bei einem zweiten Unternehmen mit anderen Feiertagen auseinanderlaufen kann.
 */
export async function fetchHolidays(): Promise<Holiday[]> {
  if (!isSupabaseConfigured) return demoHolidays;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("holidays")
    .select("date, name, region")
    .order("date", { ascending: true })
    .returns<HolidayRow[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => ({ date: row.date, name: row.name, region: row.region }));
}

/** Eingestelltes Bundesland des eigenen Unternehmens. */
export async function fetchCompanyState(): Promise<string> {
  if (!isSupabaseConfigured) return "NW";
  const supabase = createClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select("state")
    .returns<{ state: string | null }[]>()
    .maybeSingle();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return data?.state ?? "NW";
}

/** Ein Ferienzeitraum, wie ihn der Schichtplan markiert. */
export interface SchoolHolidayRange {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Schulferien, die einen Zeitraum berühren.
 *
 * Bewusst getrennt von `fetchHolidays()`: Feiertage sind einzelne Tage
 * und steuern die Urlaubsberechnung, Ferien sind Zeiträume und werden
 * nur angezeigt. In `holidays` hätten sie ohnehin keinen Platz – dort
 * gilt ein Eintrag je Tag, der Ostermontag läge also im Streit mit den
 * Osterferien.
 */
export async function fetchSchoolHolidays(
  from: string,
  to: string,
): Promise<SchoolHolidayRange[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase.rpc("school_holidays_for_range", {
    p_from: from,
    p_to: to,
  });
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");

  return ((data ?? []) as { name: string; start_date: string; end_date: string }[]).map((row) => ({
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}
