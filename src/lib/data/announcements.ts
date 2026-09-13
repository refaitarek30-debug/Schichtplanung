import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { AnnouncementRow } from "@/lib/supabase/database.types";
import type { LiveAnnouncement } from "@/lib/types";

export class DataError extends Error {}

/**
 * Mitteilungen des eigenen Unternehmens, neueste zuerst.
 * Lesen darf sie jeder im Unternehmen (RLS), schreiben nur die Führung.
 */
export async function fetchAnnouncements(limit = 10): Promise<LiveAnnouncement[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, level, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Pick<AnnouncementRow, "id" | "title" | "body" | "level" | "active" | "created_at">[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    level: row.level === "warn" ? "warn" : "info",
    createdAt: row.created_at,
  }));
}
