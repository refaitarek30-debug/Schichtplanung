"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE } from "@/lib/auth/idle";
import { allow, clientKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import type { FormState } from "@/lib/auth/form-state";

const NICHT_VERFUEGBAR: FormState = {
  error: "Die Live-Demo ist gerade nicht verfügbar. Bitte versuche es später erneut.",
};

/**
 * Live-Demo starten.
 *
 * Kein gemeinsames Demo-Konto: jeder Start legt ein eigenes Konto mit
 * zufälligem Passwort und einen eigenen Mandanten (Kopie der Vorlagefirma)
 * an. Das Passwort verlässt den Server nie – angemeldet wird direkt hier.
 * Mandant und Konto löscht die Datenbank nach Ablauf (demo_cleanup).
 */
export async function startDemo(_prev: FormState, _formData: FormData): Promise<FormState> {
  void _formData;
  if (!isSupabaseConfigured) return NICHT_VERFUEGBAR;

  const supabase = await createClient();
  const {
    data: { user: angemeldet },
  } = await supabase.auth.getUser();
  if (angemeldet) {
    return {
      error: "Sie sind bereits angemeldet. Bitte melden Sie sich zuerst ab, um die Live-Demo zu starten.",
    };
  }

  // Ohne Dienstschlüssel (z. B. Vorschau-Umgebung) gibt es keine Demo – und
  // keine irreführende „Zu viele Versuche“-Meldung der Ratenbegrenzung.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NICHT_VERFUEGBAR;
  }

  if (!(await allow("demo-ip", await clientKey(), 5, 3600, true))) {
    return { error: ZU_VIELE_VERSUCHE };
  }

  // example.com ist für Beispiele reserviert: an diese Adresse geht nie Post.
  const email = `demo-${randomUUID()}@example.com`;
  const password = randomBytes(32).toString("base64url");

  const { data: erstellt, error: kontoFehler } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { demo: true },
  });
  if (kontoFehler || !erstellt.user) {
    console.error("Demo-Konto:", kontoFehler?.message);
    return NICHT_VERFUEGBAR;
  }
  const userId = erstellt.user.id;

  const { data: companyId, error: demoFehler } = await admin.rpc("demo_create", { p_user_id: userId });
  if (demoFehler || typeof companyId !== "string") {
    console.error("Demo anlegen:", demoFehler?.message);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    return { error: dataErrorMessage(demoFehler) ?? NICHT_VERFUEGBAR.error };
  }

  // Offene Beispielanträge – schlägt das fehl, läuft die Demo trotzdem.
  await admin.rpc("demo_seed_pending", { p_company: companyId, p_user: userId });

  const { error: anmeldeFehler } = await supabase.auth.signInWithPassword({ email, password });
  if (anmeldeFehler) {
    console.error("Demo-Anmeldung:", anmeldeFehler.message);
    return NICHT_VERFUEGBAR;
  }

  (await cookies()).set(ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVITY_COOKIE_MAX_AGE,
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
