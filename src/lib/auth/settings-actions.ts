"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

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

/**
 * Bundesland umstellen und die Feiertage der nächsten drei Jahre neu
 * setzen (nur Admin). Die Datenbank rechnet die beweglichen Termine rund
 * um Ostern selbst aus – siehe `german_holidays()`.
 */
export async function setCompanyState(state: string): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Supabase ist nicht konfiguriert." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_state", { p_state: state });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Das Bundesland konnte nicht gespeichert werden." };
  }
  revalidatePath("/verwaltung");
  revalidatePath("/urlaub");
  return { success: "Bundesland gespeichert, Feiertage wurden neu erzeugt." };
}

/**
 * Wird an Feiertagen gearbeitet? Die Regel entscheidet, ob ein Feiertag
 * im Schichtplan als Arbeitstag gilt – und damit auch, ob er einen
 * Urlaubstag kostet. Nur Admin; geprüft wird das in der Datenbank.
 */
export async function setWorkOnHolidays(value: boolean): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Supabase ist nicht konfiguriert." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_work_on_holidays", { p_value: value });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Regel konnte nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/schichtplan");
  revalidatePath("/besetzung");
  return {
    success: value
      ? "Feiertage gelten jetzt als Arbeitstage."
      : "An Feiertagen wird nicht mehr geplant.",
  };
}

/**
 * Abwesenheitsgründe für Kollegen freigeben oder sperren (nur Admin).
 * Gesperrt sehen Beschäftigte bei anderen nur „Abwesend" – egal, was die
 * Person in ihren Datenschutz-Einstellungen gewählt hat.
 */
export async function setGruendeFuerKollegen(value: boolean): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Supabase ist nicht konfiguriert." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_gruende_fuer_kollegen", { p_value: value });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Einstellung konnte nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/schichtplan");
  revalidatePath("/dashboard");
  return {
    success: value
      ? "Kollegen sehen Abwesenheitsgründe jetzt wieder, wenn die Person sie freigegeben hat."
      : "Abwesenheitsgründe sehen jetzt nur noch Schichtleitung und Administration.",
  };
}
