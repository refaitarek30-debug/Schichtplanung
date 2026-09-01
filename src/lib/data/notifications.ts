import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { NotificationRow } from "@/lib/supabase/database.types";

export class DataError extends Error {}

export interface LiveNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function mapNotification(row: NotificationRow): LiveNotification {
  return { id: row.id, title: row.title, body: row.body, readAt: row.read_at, createdAt: row.created_at };
}

/** Die letzten Benachrichtigungen der angemeldeten Person, neueste zuerst. */
export async function fetchNotifications(limit = 15): Promise<LiveNotification[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, company_id, employee_id, type, title, body, related_entity, related_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map(mapNotification);
}

/** Markiert eine Benachrichtigung als gelesen. RLS erlaubt nur die eigenen. */
export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (!isSupabaseConfigured || ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
}
