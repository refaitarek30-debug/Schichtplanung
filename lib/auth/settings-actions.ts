"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

/** Firmenweite Benachrichtigungs-Einstellung ändern (nur Admin). */
export async function setNotifyLeaveEmail(enabled: boolean): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Supabase ist nicht konfiguriert." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notification_settings", {
    p_notify_leave_email: enabled,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Einstellung konnte nicht gespeichert werden." };
  }
  revalidatePath("/einstellungen");
  return {
    success: enabled
      ? "E-Mail-Benachrichtigung bei Urlaubsanträgen ist aktiviert."
      : "E-Mail-Benachrichtigung bei Urlaubsanträgen ist deaktiviert.",
  };
}
