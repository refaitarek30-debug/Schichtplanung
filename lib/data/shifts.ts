import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";

export class DataError extends Error {}

export interface ShiftOption {
  id: string;
  name: string;
}

export interface ShiftDetail {
  id: string;
  name: string;
  shortName: string;
  startTime: string;
  endTime: string;
  targetStaff: number;
  minimumStaff: number;
  weekdays: number[];
  color: string | null;
  active: boolean;
}

interface ShiftDetailRow {
  id: string;
  name: string;
  short_name: string;
  start_time: string;
  end_time: string;
  target_staff: number;
  minimum_staff: number;
  weekdays: number[];
  color: string | null;
  active: boolean;
}

/** Vollständige Schichtdaten des eigenen Unternehmens (für Anzeige/Berechnung). */
export async function fetchShiftDetails(): Promise<ShiftDetail[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select("id, name, short_name, start_time, end_time, target_staff, minimum_staff, weekdays, color, active")
    .order("name", { ascending: true })
    .returns<ShiftDetailRow[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    startTime: row.start_time?.slice(0, 5) ?? "",
    endTime: row.end_time?.slice(0, 5) ?? "",
    targetStaff: row.target_staff,
    minimumStaff: row.minimum_staff,
    weekdays: row.weekdays,
    color: row.color,
    active: row.active,
  }));
}
export async function fetchShiftOptions(): Promise<ShiftOption[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<ShiftOption[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return data ?? [];
}
