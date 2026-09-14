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

/** Firmenweite Benachrichtigungs-Einstellung lesen. */
export async function fetchNotifyLeaveEmail(): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_notification_settings");
  if (error) return true;
  const row = (data ?? [])[0] as { notify_leave_email: boolean } | undefined;
  return row?.notify_leave_email ?? true;
}

export interface MailPostausgang {
  offen: number;
  gesendet: number;
  fehler: number;
  letzterVersand: string | null;
  letzterFehler: string | null;
}

/**
 * Stand des Postausgangs (nur Admin). Ob der eigene SMTP-Versand in
 * Supabase eingerichtet ist, lässt sich über die Schnittstelle nicht
 * abfragen – wohl aber, ob Nachrichten liegen bleiben. Stauen sich offene
 * Zeilen, läuft der Versand nicht.
 */
export async function fetchMailPostausgang(): Promise<MailPostausgang | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("email_outbox_status");
  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  const row = (data ?? [])[0] as
    | {
        offen: number;
        gesendet: number;
        fehler: number;
        letzter_versand: string | null;
        letzter_fehler: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    offen: Number(row.offen ?? 0),
    gesendet: Number(row.gesendet ?? 0),
    fehler: Number(row.fehler ?? 0),
    letzterVersand: row.letzter_versand,
    letzterFehler: row.letzter_fehler,
  };
}
