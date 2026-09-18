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

  const { error } = await supabase.rpc("save_privacy_settings", {
    p_absence_visibility: absenceVisibility,
    p_sickness_visibility: sicknessVisibility,
    p_notice_acknowledged: acknowledge,
  });

  if (error) {
    return {
      error:
        dataErrorMessage(error) ??
        "Die Datenschutzeinstellungen konnten nicht gespeichert werden.",
    };
  }

  revalidatePath("/profil");
  revalidatePath("/profil/datenschutz");
  revalidatePath("/schichtplan");
  revalidatePath("/dashboard");
  return { success: "Datenschutzeinstellungen gespeichert." };
}

export { NOTICE_VERSION };