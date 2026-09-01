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
  startTime: string;
  endTime: string;
  targetStaff: number;
  minimumStaff: number;
  weekdays: number[];
}

interface ShiftDetailRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  target_staff: number;
  minimum_staff: number;
  weekdays: number[];
}

/** Vollständige Schichtdaten des eigenen Unternehmens (für Anzeige/Berechnung). */
export async function fetchShiftDetails(): Promise<ShiftDetail[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select("id, name, start_time, end_time, target_staff, minimum_staff, weekdays")
    .order("name", { ascending: true })
    .returns<ShiftDetailRow[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    startTime: row.start_time?.slice(0, 5) ?? "",
    endTime: row.end_time?.slice(0, 5) ?? "",
    targetStaff: row.target_staff,
    minimumStaff: row.minimum_staff,
    weekdays: row.weekdays,
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
