"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
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

  revalidatePath("/verwaltung");
  return { success: "Urlaubssperre angelegt." };
}

export async function deleteLeaveBlock(id: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.from("staffing_rules").delete().eq("id", id);
  if (error) {
    return { error: dataErrorMessage(error) ?? "Die Urlaubssperre konnte nicht entfernt werden." };
  }
  revalidatePath("/verwaltung");
  return { success: "Urlaubssperre entfernt." };
}

/**
 * Die Jahresobergrenzen für Sonderurlaub, Bildungsurlaub und
 * Gewerkschaftstag speichern.
 *
 * Sie stehen in `staffing_rules` wie Ruhezeit und Schichtdauer – dieselbe
 * Tabelle, dieselbe Leseart über `company_rule_number()`. Damit ist
 * ausgeschlossen, dass Anzeige und Prüfung auseinanderlaufen.
 *
 * `staffing_rules` hat `unique (company_id, shift_id, key)`, und NULL gilt
 * im UNIQUE als verschieden. Für betriebsweite Regeln greift `upsert`
 * deshalb nicht – erst aktualisieren, und nur wenn keine Zeile betroffen
 * war, einfügen.
 */
export async function saveLeaveQuotaRules(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const felder = [
    ["sonderurlaub_tage_jahr", "Sonderurlaub"],
    ["bildungsurlaub_tage_jahr", "Bildungsurlaub"],
    ["gewerkschaftstag_tage_jahr", "Gewerkschaftstag"],
  ] as const;

  const werte: { key: string; tage: number }[] = [];
  for (const [key, name] of felder) {
    const roh = String(formData.get(key) ?? "").replace(",", ".");
    const tage = Number(roh);
    if (!Number.isFinite(tage) || tage < 0 || tage > 60) {
      return { error: `${name}: bitte eine Tageszahl zwischen 0 und 60 angeben.` };
    }
    werte.push({ key, tage });
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

  for (const { key, tage } of werte) {
    const { data: geaendert, error: updateError } = await supabase
      .from("staffing_rules")
      .update({ value: { tage }, active: true })
      .eq("company_id", profile.company_id)
      .is("shift_id", null)
      .eq("key", key)
      .select("id");

    if (updateError) {
      return { error: dataErrorMessage(updateError) ?? "Die Regel konnte nicht gespeichert werden." };
    }
    if ((geaendert ?? []).length === 0) {
      const { error: insertError } = await supabase.from("staffing_rules").insert({
        company_id: profile.company_id,
        shift_id: null,
        key,
        value: { tage },
        active: true,
      });
      if (insertError) {
        return {
          error: dataErrorMessage(insertError) ?? "Die Regel konnte nicht angelegt werden.",
        };
      }
    }
  }

  revalidatePath("/verwaltung");
  revalidatePath("/urlaub");
  return { success: "Jahresobergrenzen gespeichert." };
}
