"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";
import type { Role } from "@/lib/types";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/**
 * Legt einen Personalstammsatz an – noch ohne Login. Die Einladung
 * verschickt `inviteEmployee()` in einem zweiten Schritt, sobald der Datensatz
 * existiert (entspricht dem in Phase 2 vorgesehenen Ablauf: Administrator
 * legt an → Mitarbeiter erhält Einladung → setzt Passwort).
 */
export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const personnelNumber = String(formData.get("personnel_number") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as Role;
  const vacationDaysRaw = String(formData.get("vacation_days") ?? "30");
  const vacationDays = Number.parseFloat(vacationDaysRaw.replace(",", "."));

  if (!firstName || !lastName) {
    return { error: "Vor- und Nachname dürfen nicht leer sein." };
  }
  if (!Number.isFinite(vacationDays) || vacationDays < 0) {
    return { error: "Der Urlaubsanspruch muss eine Zahl ab 0 sein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<{ role: Role; company_id: string }[]>()
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Dein Profil konnte nicht geladen werden." };
  }
  if (profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const { error } = await supabase.from("employees").insert({
    company_id: profile.company_id,
    first_name: firstName,
    last_name: lastName,
    email: email || null,
    personnel_number: personnelNumber || null,
    department: department || null,
    shift_id: shiftId || null,
    role,
    vacation_days: vacationDays,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Personalnummer ist in deinem Unternehmen bereits vergeben." };
    }
    return { error: dataErrorMessage(error) ?? "Der Mitarbeiter konnte nicht angelegt werden." };
  }

  revalidatePath("/mitarbeiter");
  return { success: `${firstName} ${lastName} wurde angelegt.` };
}

/**
 * Bearbeitet die Personalstammdaten eines bestehenden Mitarbeiters. Gleiche
 * Rechteprüfung wie bei `createEmployee()` – die Policy "Personaldaten
 * verwaltet Admin" (ALL, nur Admin) erzwingt es ohnehin auf DB-Ebene.
 */
export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const personnelNumber = String(formData.get("personnel_number") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as Role;
  const vacationDaysRaw = String(formData.get("vacation_days") ?? "30");
  const vacationDays = Number.parseFloat(vacationDaysRaw.replace(",", "."));

  if (!id) return { error: "Mitarbeiter fehlt." };
  if (!firstName || !lastName) {
    return { error: "Vor- und Nachname dürfen nicht leer sein." };
  }
  if (!Number.isFinite(vacationDays) || vacationDays < 0) {
    return { error: "Der Urlaubsanspruch muss eine Zahl ab 0 sein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<{ role: Role; company_id: string }[]>()
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Dein Profil konnte nicht geladen werden." };
  }
  if (profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const { error } = await supabase
    .from("employees")
    .update({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      personnel_number: personnelNumber || null,
      department: department || null,
      shift_id: shiftId || null,
      role,
      vacation_days: vacationDays,
    })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Personalnummer ist in deinem Unternehmen bereits vergeben." };
    }
    return { error: dataErrorMessage(error) ?? "Die Änderungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/mitarbeiter");
  return { success: `${firstName} ${lastName} wurde gespeichert.` };
}
