import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Company, SessionProfile } from "@/lib/types";
import type { ProfileWithRelations } from "@/lib/supabase/database.types";

export interface AppSession {
  profile: SessionProfile;
  company: Company;
}

/**
 * Lädt Profil und Unternehmen des angemeldeten Benutzers.
 * `cache` sorgt dafür, dass Layout und Seiten sich einen Request teilen.
 *
 * Gibt `null` zurück, wenn niemand angemeldet ist oder Supabase fehlt.
 */
export const getAppSession = cache(async (): Promise<AppSession | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, company_id, employee_id, first_name, last_name, email, role, avatar_url, active,
       companies ( id, name, logo_url, active ),
       employees ( personnel_number, department, shifts ( name ) )`,
    )
    .eq("id", user.id)
    .returns<ProfileWithRelations[]>()
    .maybeSingle();

  if (error || !data) return null;

  const companyRow = Array.isArray(data.companies) ? data.companies[0] : data.companies;
  const employeeRow = Array.isArray(data.employees) ? data.employees[0] : data.employees;
  const shiftRow = employeeRow
    ? Array.isArray(employeeRow.shifts)
      ? employeeRow.shifts[0]
      : employeeRow.shifts
    : null;

  return {
    profile: {
      id: data.id,
      companyId: data.company_id,
      employeeId: data.employee_id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      role: data.role,
      avatarUrl: data.avatar_url,
      active: data.active,
      personnelNumber: employeeRow?.personnel_number ?? null,
      department: employeeRow?.department ?? null,
      shiftName: shiftRow?.name ?? null,
    },
    company: {
      id: companyRow?.id ?? data.company_id,
      name: companyRow?.name ?? "Unbekanntes Unternehmen",
      region: "NW",
      logoUrl: companyRow?.logo_url ?? null,
      active: companyRow?.active ?? true,
    },
  };
});
