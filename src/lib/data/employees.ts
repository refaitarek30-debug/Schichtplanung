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
    qualificationLabels: [],
    rotationTeam: null,
    vDays: 27,
    shiftWorker: true,
    entryDate: null,
    exitDate: null,
    isApprentice: false,
    bildungsurlaubErlaubt: false,
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
  const [employeesResult, profilesResult, qualsResult] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, company_id, personnel_number, first_name, last_name, email, phone, role, department, shift_id, vacation_days, active, rotation_team, v_days, shift_worker, entry_date, exit_date, is_apprentice, bildungsurlaub_erlaubt, shifts ( name )",
      )
      .order("last_name", { ascending: true })
      .returns<EmployeeWithShift[]>(),
    supabase
      .from("profiles")
      .select("employee_id")
      .returns<{ employee_id: string | null }[]>(),
    // Qualifikationen stehen seit Migration 0050 in eigenen Tabellen. Die
    // Spalte employees.qualifications wird nicht mehr gelesen.
    supabase
      .from("employee_qualifications")
      .select("employee_id, qualifications ( key, label )")
      .returns<
        {
          employee_id: string;
          qualifications: { key: string; label: string } | { key: string; label: string }[] | null;
        }[]
      >(),
  ]);

  if (employeesResult.error) {
    throw new DataError(dataErrorMessage(employeesResult.error) ?? "Unbekannter Fehler");
  }
  // Ein Fehler beim Profil-Abgleich soll die Liste nicht blockieren – dann
  // zeigt sie eben vorsichtshalber "keine Einladung" für alle an.
  const linkedEmployeeIds = new Set(
    (profilesResult.data ?? []).map((row) => row.employee_id).filter(Boolean),
  );

  // Ebenso hier: scheitert der Abgleich, bleibt die Liste nutzbar und
  // zeigt für alle keine Qualifikation an.
  const qualsByEmployee = new Map<string, { keys: string[]; labels: string[] }>();
  for (const row of qualsResult.data ?? []) {
    const bezug = Array.isArray(row.qualifications) ? row.qualifications[0] : row.qualifications;
    if (!bezug?.key) continue;
    const bisher = qualsByEmployee.get(row.employee_id) ?? { keys: [], labels: [] };
    bisher.keys.push(bezug.key);
    bisher.labels.push(bezug.label);
    qualsByEmployee.set(row.employee_id, bisher);
  }

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
      qualifications: qualsByEmployee.get(row.id)?.keys ?? [],
      qualificationLabels: qualsByEmployee.get(row.id)?.labels ?? [],
      rotationTeam: row.rotation_team ?? null,
      vDays: row.v_days ?? 0,
      shiftWorker: row.shift_worker ?? true,
      entryDate: row.entry_date ?? null,
      exitDate: row.exit_date ?? null,
      isApprentice: row.is_apprentice ?? false,
      bildungsurlaubErlaubt: row.bildungsurlaub_erlaubt ?? false,
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
