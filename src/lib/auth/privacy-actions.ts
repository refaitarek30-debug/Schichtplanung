"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

const NOTICE_VERSION = "1.0";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

function isAbsenceVisibility(value: string): value is "minimal" | "shift" {
  return value === "minimal" || value === "shift";
}

function isSicknessVisibility(value: string): value is "private" | "shift" {
  return value === "private" || value === "shift";
}

export async function savePrivacySettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const absenceVisibility = String(formData.get("absence_visibility") ?? "");
  const sicknessVisibility = String(formData.get("sickness_visibility") ?? "");
  const acknowledge = formData.get("privacy_notice_acknowledged") === "on";

  if (!isAbsenceVisibility(absenceVisibility)) {
    return { error: "Ungültige Einstellung für Abwesenheiten." };
  }
  if (!isSicknessVisibility(sicknessVisibility)) {
    return { error: "Ungültige Einstellung für Krankheit." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };
  }

  const { data: current, error: currentError } = await supabase
    .from("privacy_settings")
    .select(
      "user_id, company_id, absence_visibility, sickness_visibility, privacy_notice_version, accepted_at, updated_at, absence_revoked_at, sickness_revoked_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentError) {
    return { error: dataErrorMessage(currentError) ?? "Die Datenschutzeinstellungen konnten nicht geladen werden." };
  }

  const payload = {
    absence_visibility: absenceVisibility,
    sickness_visibility: sicknessVisibility,
    privacy_notice_version:
      acknowledge || current?.privacy_notice_version === NOTICE_VERSION
        ? NOTICE_VERSION
        : (current?.privacy_notice_version ?? NOTICE_VERSION),
    accepted_at:
      acknowledge || current?.privacy_notice_version === NOTICE_VERSION
        ? (current?.accepted_at ?? new Date().toISOString())
        : current?.accepted_at,
  };

  const { error } = current
    ? await supabase.from("privacy_settings").update(payload).eq("user_id", user.id)
    : await supabase.from("privacy_settings").insert({
        user_id: user.id,
        absence_visibility: absenceVisibility,
        sickness_visibility: sicknessVisibility,
        privacy_notice_version: NOTICE_VERSION,
        accepted_at: acknowledge ? new Date().toISOString() : null,
      });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Datenschutzeinstellungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/profil");
  revalidatePath("/profil/datenschutz");
  revalidatePath("/schichtplan");
  revalidatePath("/dashboard");
  return { success: "Datenschutzeinstellungen gespeichert." };
}

export { NOTICE_VERSION };