"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";

export type { FormState };

/**
 * Altersfreizeit verbindlich festlegen.
 *
 * Die Prüfung der Rolle, des Mandanten und der Wertebereiche steckt in
 * `confirm_age_leave()` in der Datenbank – dort, wo sie sich nicht umgehen
 * lässt. Hier wird nur das Formular in Zahlen übersetzt; was hier steht,
 * ist Bequemlichkeit, keine Absicherung.
 */
export async function confirmAgeLeave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }

  const employeeId = String(formData.get("employee_id") ?? "");
  const jahr = Number(formData.get("year"));
  const tageRoh = String(formData.get("days") ?? "").replace(",", ".");
  const tage = Number(tageRoh);
  const notiz = String(formData.get("note") ?? "");

  if (!employeeId) return { error: "Kein Mitarbeiter ausgewählt." };
  if (!Number.isInteger(jahr)) return { error: "Ungültiges Jahr." };
  if (!Number.isFinite(tage) || tage < 0 || tage > 60) {
    return { error: "Bitte eine Tageszahl zwischen 0 und 60 angeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_age_leave", {
    p_employee_id: employeeId,
    p_year: jahr,
    p_days: tage,
    p_note: notiz.trim() || null,
  });

  if (error) {
    return {
      error: dataErrorMessage(error) ?? "Die Altersfreizeit konnte nicht gespeichert werden.",
    };
  }

  revalidatePath("/altersfreizeit");
  revalidatePath("/profil");
  return { success: "Altersfreizeit verbindlich festgelegt." };
}

/**
 * AF-Stundenstand eintragen (Administration und Schichtleitung): Stunden zum
 * Stichtag. Ab dem Folgetag rechnet die Datenbank weiter. „Aufheben" nimmt
 * die Freischaltung zurück.
 */
export async function setAfStand(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }
  const employeeId = String(formData.get("employee_id") ?? "");
  const aufheben = formData.get("aufheben") === "1";
  const stichtag = String(formData.get("stichtag") ?? "").trim();
  const stunden = Number(String(formData.get("stunden") ?? "").replace(",", "."));

  if (!employeeId) return { error: "Kein Mitarbeiter ausgewählt." };
  if (!aufheben) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stichtag)) {
      return { error: "Bitte das Datum angeben, zu dem der Stand gilt." };
    }
    if (!Number.isFinite(stunden)) {
      return { error: "Bitte den Stundenstand als Zahl angeben, z. B. 34 oder 12,5." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_af_stand", {
    p_employee_id: employeeId,
    p_stunden: aufheben ? 0 : stunden,
    p_stichtag: aufheben ? null : stichtag,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Stand konnte nicht gespeichert werden." };
  }

  revalidatePath("/altersfreizeit");
  revalidatePath("/urlaub");
  return { success: aufheben ? "Altersfreizeit aufgehoben." : "AF-Stand gespeichert." };
}

/** Geburtsdatum korrigieren – nur Administration. */
export async function setBirthDate(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) {
    return { error: "Supabase ist nicht konfiguriert." };
  }
  const employeeId = String(formData.get("employee_id") ?? "");
  const datum = String(formData.get("birth_date") ?? "").trim();
  if (!employeeId) return { error: "Kein Mitarbeiter ausgewählt." };
  if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { error: "Bitte ein gültiges Datum angeben." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_birth_date", {
    p_employee_id: employeeId,
    p_birth_date: datum || null,
  });
  if (error) {
    return { error: dataErrorMessage(error) ?? "Das Geburtsdatum konnte nicht gespeichert werden." };
  }
  revalidatePath("/altersfreizeit");
  revalidatePath("/meine-schichten");
  return { success: "Geburtsdatum gespeichert." };
}
