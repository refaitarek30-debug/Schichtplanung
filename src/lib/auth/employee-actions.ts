"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./actions";
import type { Role } from "@/lib/types";
import type { Qualification } from "@/lib/qualifications";
import { QUALIFICATIONS } from "@/lib/qualifications";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus.",
};

/** Nur bekannte Werte übernehmen – schützt vor beliebigen Strings aus dem FormData. */
function parseQualifications(formData: FormData): Qualification[] {
  const known = new Set<string>(QUALIFICATIONS);
  return formData
    .getAll("qualifications")
    .map((v) => String(v))
    .filter((v) => known.has(v)) as Qualification[];
}

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

  const rotationTeam = String(formData.get("rotation_team") ?? "").trim();

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
    qualifications: parseQualifications(formData),
    rotation_team: rotationTeam || null,
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
 * Ändert einen bestehenden Personalstammsatz. Spiegelt `createEmployee()`
 * bewusst 1:1 in Feldern und Prüfungen – nur `.update()` statt `.insert()`,
 * zusätzlich `employee_id` zum Identifizieren der Zeile. RLS
 * ("Personaldaten verwaltet Admin") erzwingt Admin-only zusätzlich
 * serverseitig, unabhängig von der Rollenprüfung hier.
 */
export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const personnelNumber = String(formData.get("personnel_number") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim();
  const shiftId = String(formData.get("shift_id") ?? "").trim();
  const role = String(formData.get("role") ?? "employee") as Role;
  const vacationDaysRaw = String(formData.get("vacation_days") ?? "30");
  const vacationDays = Number.parseFloat(vacationDaysRaw.replace(",", "."));
  const active = formData.get("active") !== "false";

  if (!employeeId) {
    return { error: "Kein Mitarbeiter ausgewählt." };
  }
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
  // Bearbeiten dürfen Schichtleitung und Administration – anders als das
  // Anlegen, das der Administration vorbehalten bleibt.
  if (profile.role !== "admin" && profile.role !== "shift_leader") {
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
      active,
      qualifications: parseQualifications(formData),
      rotation_team: String(formData.get("rotation_team") ?? "").trim() || null,
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Diese Personalnummer ist in deinem Unternehmen bereits vergeben." };
    }
    return { error: dataErrorMessage(error) ?? "Der Mitarbeiter konnte nicht geändert werden." };
  }

  revalidatePath("/mitarbeiter");
  return { success: `${firstName} ${lastName} wurde aktualisiert.` };
}

/**
 * Löscht einen Personalstammsatz endgültig – anders als das bloße
 * Deaktivieren (bleibt für den normalen Alltag die richtige Wahl, siehe
 * `setEmployeeActive()` in `data/employees.ts`). Nur Admin.
 *
 * Sicherheitsbremse: hat die Person bereits einen Login (eine Zeile in
 * `profiles`), wird das Löschen verweigert. Grund: `profiles.employee_id`
 * verweist per `ON DELETE SET NULL` auf diese Zeile – ein Hard-Delete
 * würde den Zugang als „Karteileiche" ohne Personalstammsatz zurücklassen,
 * statt sauber aufzuräumen. Erst deaktivieren bzw. den Zugang entfernen,
 * dann löschen.
 */
export async function deleteEmployee(employeeId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (!employeeId) return { error: "Kein Mitarbeiter ausgewählt." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .returns<{ role: Role; company_id: string }[]>()
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return { error: "Du hast keine Berechtigung für diesen Bereich." };
  }

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId);

  if ((count ?? 0) > 0) {
    return {
      error:
        "Diese Person hat noch einen Zugang. Bitte zuerst deaktivieren – ein Löschen würde den Zugang ohne Personalstammsatz zurücklassen.",
    };
  }

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  if (error) {
    return { error: dataErrorMessage(error) ?? "Der Mitarbeiter konnte nicht gelöscht werden." };
  }

  revalidatePath("/mitarbeiter");
  return { success: "Mitarbeiter gelöscht." };
}
