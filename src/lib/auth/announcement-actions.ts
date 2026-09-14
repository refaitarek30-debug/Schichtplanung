"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

export type { FormState };

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Neue Mitteilung anlegen. Wer schreiben darf, entscheidet die Datenbank
 * (Policy "Mitteilungen pflegt Fuehrung") – nicht das ausgegraute Formular.
 */
export async function createAnnouncement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const level = String(formData.get("level") ?? "info") === "warn" ? "warn" : "info";

  if (!title) return { error: "Bitte einen Titel eingeben." };
  if (title.length > 120) return { error: "Der Titel ist zu lang (höchstens 120 Zeichen)." };
  if (body.length > 2000) return { error: "Der Text ist zu lang (höchstens 2000 Zeichen)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .returns<{ company_id: string }[]>()
    .maybeSingle();

  if (!profile?.company_id) return { error: "Dein Konto ist keinem Unternehmen zugeordnet." };

  const { error } = await supabase.from("announcements").insert({
    company_id: profile.company_id,
    title,
    body,
    level,
    created_by: user.id,
  });

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Mitteilung konnte nicht gespeichert werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/dashboard");
  return { success: "Mitteilung veröffentlicht." };
}

/** Mitteilung zurückziehen – bleibt als Zeile stehen, wird aber nicht mehr angezeigt. */
export async function retireAnnouncement(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ active: false }).eq("id", id);

  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Mitteilung konnte nicht entfernt werden." };
  }

  revalidatePath("/verwaltung");
  revalidatePath("/dashboard");
  return { success: "Mitteilung entfernt." };
}
