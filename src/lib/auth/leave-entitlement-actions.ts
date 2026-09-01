"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Setzt den Urlaubsanspruch eines Mitarbeiters für ein Jahr. Ruft die
 * Postgres-Funktion `set_leave_entitlement()` auf, die selbst prüft, dass
 * die anfragende Person Admin oder Schichtleitung ist (`is_leadership()`)
 * und der Mitarbeiter zum eigenen Unternehmen gehört.
 */
export async function setLeaveEntitlement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "");
  const entitlementRaw = String(formData.get("entitlement") ?? "");
  const entitlement = Number.parseFloat(entitlementRaw.replace(",", "."));
  const yearRaw = formData.get("year");
  const year = yearRaw ? Number.parseInt(String(yearRaw), 10) : undefined;

  if (!employeeId) return { error: "Mitarbeiter fehlt." };
  if (!Number.isFinite(entitlement) || entitlement < 0) {
    return { error: "Der Urlaubsanspruch muss eine Zahl ab 0 sein." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_leave_entitlement", {
    p_employee_id: employeeId,
    p_entitlement: entitlement,
    ...(year ? { p_year: year } : {}),
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("keine Berechtigung")) {
      return { error: "Du hast keine Berechtigung für diesen Bereich." };
    }
    if (message.includes("nicht gefunden")) {
      return { error: "Der Mitarbeiter wurde nicht gefunden." };
    }
    return { error: dataErrorMessage(error) ?? "Speichern fehlgeschlagen." };
  }

  revalidatePath("/mitarbeiter");
  revalidatePath("/urlaub");
  revalidatePath("/dashboard");
  return { success: "Urlaubsanspruch gespeichert." };
}
