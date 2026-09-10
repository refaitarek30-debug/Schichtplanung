import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { employees as demoEmployees, getShift } from "@/lib/demo-data";
import type { EmployeeRecord } from "@/lib/types";
import type { EmployeeWithShift } from "@/lib/supabase/database.types";

export class DataError extends Error {}

/** Demo-Daten in dieselbe Form bringen wie die Supabase-Zeilen. */
function demoRecords(): EmployeeRecord[] {
  return demoEmployees.map((person, index) => ({
    id: person.id,
    companyId: person.companyId,
    personnelNumber: String(10001 + index),
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: null,
    role: person.role,
    department: person.jobTitle,
    shiftId: person.shiftId,
    shiftName: getShift(person.shiftId)?.name ?? null,
    vacationDays: person.entitlement,
    active: person.active,
    hasAccount: true,
    qualifications: [],
    rotationTeam: null,
  }));
}

/**
 * Mitarbeiter des eigenen Unternehmens.
 * Die Mandantentrennung erzwingt Row Level Security – hier steht bewusst
 * kein `eq("company_id", …)`, das wäre nur Kosmetik.
 */
export async function fetchEmployees(): Promise<EmployeeRecord[]> {
  if (!isSupabaseConfigured) return demoRecords();

  const supabase = createClient();
  const [employeesResult, profilesResult] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, company_id, personnel_number, first_name, last_name, email, phone, role, department, shift_id, vacation_days, active, qualifications, rotation_team, shifts ( name )",
      )
      .order("last_name", { ascending: true })
      .returns<EmployeeWithShift[]>(),
    supabase
      .from("profiles")
      .select("employee_id")
      .returns<{ employee_id: string | null }[]>(),
  ]);

  if (employeesResult.error) {
    throw new DataError(dataErrorMessage(employeesResult.error) ?? "Unbekannter Fehler");
  }
  // Ein Fehler beim Profil-Abgleich soll die Liste nicht blockieren – dann
  // zeigt sie eben vorsichtshalber "keine Einladung" für alle an.
  const linkedEmployeeIds = new Set(
    (profilesResult.data ?? []).map((row) => row.employee_id).filter(Boolean),
  );

  return (employeesResult.data ?? []).map((row) => {
    const shift = Array.isArray(row.shifts) ? row.shifts[0] : row.shifts;
    return {
      id: row.id,
      companyId: row.company_id,
      personnelNumber: row.personnel_number,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      department: row.department,
      shiftId: row.shift_id,
      shiftName: shift?.name ?? null,
      vacationDays: row.vacation_days,
      active: row.active,
      hasAccount: linkedEmployeeIds.has(row.id),
      qualifications: row.qualifications ?? [],
      rotationTeam: row.rotation_team ?? null,
    };
  });
}

/** Aktivieren oder deaktivieren. Scheitert für Nicht-Admins an der Policy. */
export async function setEmployeeActive(id: string, active: boolean) {
  if (!isSupabaseConfigured) {
    throw new DataError("Im Demo-Modus lassen sich keine Daten ändern.");
  }
  const supabase = createClient();
  const { error } = await supabase.from("employees").update({ active }).eq("id", id);
  if (error) throw new DataError(dataErrorMessage(error) ?? "Änderung fehlgeschlagen.");
}
