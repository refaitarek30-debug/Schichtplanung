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
  // Token lokal prüfen statt beim Anmeldedienst nachzufragen (siehe
  // src/lib/supabase/middleware.ts). Die Rechte prüft ohnehin die
  // Datenbank bei jeder Abfrage.
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) return null;
  const user = { id: userId };

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, company_id, employee_id, first_name, last_name, email, role, avatar_url, active,
       hidden_dashboard_tiles,
       companies ( id, name, logo_url, active, setup_completed_at, is_demo, demo_expires_at ),
       employees ( personnel_number, department, shifts ( name ) )`,
    )
    .eq("id", user.id)
    .returns<ProfileWithRelations[]>()
    .maybeSingle();

  if (error || !data) return null;

  // Nur für die Administration nachfragen – alle anderen haben ohnehin
  // keinen Zugang. Geht die Frage schief, bleibt der Menüpunkt weg; die
  // Anmeldung selbst hängt nicht daran.
  let protokoll = false;
  if (data.role === "admin") {
    try {
      const { data: darf } = await supabase.rpc("darf_protokoll");
      protokoll = darf === true;
    } catch {
      protokoll = false;
    }
  }

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
      hiddenDashboardTiles: data.hidden_dashboard_tiles ?? [],
      protokoll,
    },
    company: {
      id: companyRow?.id ?? data.company_id,
      name: companyRow?.name ?? "Unbekanntes Unternehmen",
      region: "NW",
      logoUrl: companyRow?.logo_url ?? null,
      active: companyRow?.active ?? true,
      setupCompletedAt: companyRow?.setup_completed_at ?? null,
      isDemo: companyRow?.is_demo === true,
      demoExpiresAt: companyRow?.demo_expires_at ?? null,
    },
  };
});
