import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { zweiterFaktorBestaetigt, zweiterFaktorOffen } from "@/lib/auth/zwei-faktor";

export interface Konsole {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  email: string;
  /** Notfallzugang (Migration 0221): nur lesen. */
  nurLesen: boolean;
}

/**
 * Zugang zur Betreiber-Konsole – einmal je Anfrage geprüft (cache), von
 * Rahmen und jeder Seite aufgerufen. Wer kein Betreiber ist, bekommt eine
 * 404 (die Konsole soll nicht einmal bestätigt werden). Betreiber brauchen
 * immer den Zwei-Faktor-Code – „Gerät vertrauen“ gilt hier nicht.
 */
export const konsoleZugang = cache(async (): Promise<Konsole> => {
  if (!isSupabaseConfigured) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    notFound();
  }
  const { data: istBetreiber, error } = await admin.rpc("is_platform_admin", { p_user_id: user.id });
  if (error || istBetreiber !== true) notFound();

  if (await zweiterFaktorOffen(supabase)) redirect("/zwei-faktor?weiter=/plattform");
  if (!(await zweiterFaktorBestaetigt(supabase))) redirect("/zwei-faktor/einrichten?pflicht=1&weiter=/plattform");

  const { data: darf, error: darfFehler } = await admin.rpc("platform_darf_aendern", { p_user_id: user.id });
  return { admin, userId: user.id, email: user.email ?? "", nurLesen: !darfFehler && darf === false };
});

/**
 * Reines Betreiber-Konto: Betreiber ohne Betrieb. Es landet nach der
 * Anmeldung direkt in der Konsole – Kalender und Privatbereich braucht es
 * nicht. Betreiber mit eigenem Betrieb starten wie gewohnt.
 */
export async function istKonsolenKonto(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("is_platform_admin", { p_user_id: userId });
    if (data !== true) return false;
    const { data: profil, error } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    return !error && !profil;
  } catch {
    return false;
  }
}
