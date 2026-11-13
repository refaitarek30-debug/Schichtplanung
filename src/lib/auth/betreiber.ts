import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface Betreiber {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
}

/**
 * Prüft für eine Betreiber-Aktion (Server-Aktion = öffentlicher Endpunkt):
 * angemeldet, Betreiber, mit Zwei-Faktor-Code bestätigt (Migration 0219) und
 * – bei `aendern` – kein Notfallzugang, der nur lesen darf (Migration 0221).
 * Gibt null zurück, wenn etwas davon fehlt.
 */
export async function betreiberPruefen({ aendern }: { aendern: boolean }): Promise<Betreiber | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return null;
  if (aendern) {
    const { data, error } = await admin.rpc("platform_darf_aendern", { p_user_id: user.id });
    // Fehlt die Funktion noch (Migration 0221 nicht eingespielt), gilt die alte Prüfung.
    if (!error) return data === true ? { admin, userId: user.id } : null;
  }
  const { data } = await admin.rpc("is_platform_admin", { p_user_id: user.id });
  return data === true ? { admin, userId: user.id } : null;
}
