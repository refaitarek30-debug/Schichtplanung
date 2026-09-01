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
