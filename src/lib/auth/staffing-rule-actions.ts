"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/** Legt eine Urlaubssperre an. Nur Admin – RLS auf `staffing_rules` erzwingt das. */
export async function createLeaveBlock(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const shiftId = String(formData.get("shift_id") ?? "") || null;

  if (!startDate || !endDate || !reason) {
    return { error: "Bitte Zeitraum und Grund angeben." };
  }
  if (endDate < startDate) {
    return { error: "Das Enddatum darf nicht vor dem Startdatum liegen." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .returns<{ company_id: string; role: string }[]>()
    .maybeSingle();

  if (!profile) return { error: "Dein Profil konnte nicht geladen werden." };
  if (profile.role !== "admin") return { error: "Du hast keine Berechtigung für diesen Bereich." };

  const { error } = await supabase.from("staffing_rules").insert({
    company_id: profile.company_id,
    shift_id: shiftId,
    key: "urlaubssperre",
    value: { start: startDate, end: endDate, reason },
    active: true,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Urlaubssperre konnte nicht gespeichert werden." };
  }

  revalidatePath("/regeln");
  return { success: "Urlaubssperre angelegt." };
}

export async function deleteLeaveBlock(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("staffing_rules").delete().eq("id", id);
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Urlaubssperre konnte nicht entfernt werden." };
  }
  revalidatePath("/regeln");
  return { success: "Urlaubssperre entfernt." };
}
