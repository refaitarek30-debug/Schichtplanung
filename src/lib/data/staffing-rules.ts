import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { StaffingRuleRow } from "@/lib/supabase/database.types";
import type { LiveLeaveBlock } from "@/lib/types";

export class DataError extends Error {}

/** Urlaubssperren des eigenen Unternehmens (key = 'urlaubssperre'). */
export async function fetchLeaveBlocks(): Promise<LiveLeaveBlock[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_rules")
    .select("id, shift_id, value, active")
    .eq("key", "urlaubssperre")
    .eq("active", true)
    .order("id", { ascending: true })
    .returns<Pick<StaffingRuleRow, "id" | "shift_id" | "value" | "active">[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => ({
    id: row.id,
    shiftId: row.shift_id,
    startDate: row.value.start,
    endDate: row.value.end,
    reason: row.value.reason,
  }));
}
