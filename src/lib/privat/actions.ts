"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authErrorMessage } from "@/lib/errors";
import { LEGAL_VERSIONS } from "@/lib/legal/version";
import { allow, clientKey, emailKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { ACTIVITY_COOKIE } from "@/lib/auth/idle";
import { siteOrigin } from "@/lib/auth/invite";
import { PASSWORT_MAX, PASSWORT_MIN } from "@/lib/auth/password-policy";
import type { FormState } from "@/lib/auth/form-state";

/**
 * Wie bei der Firmenregistrierung: Erfolg und „Adresse schon vergeben“
 * antworten gleich – sonst ließe sich durchprobieren, wer ein Konto hat.
 */
const BESTAETIGUNG =
  "Fast geschafft. Wir haben dir eine E-Mail geschickt – bitte bestätige deine Adresse über den " +
  "Link darin (auch im Spam-Ordner nachsehen). Hast du schon ein Konto, melde dich einfach an.";

/** Konto wieder entfernen, wenn das Anlegen danach scheitert – nur frische, leere Konten. */
async function verwirfNeuesKonto(userId: string, angelegtAm: string | undefined) {
  try {
    const alter = angelegtAm ? Date.now() - Date.parse(angelegtAm) : Number.POSITIVE_INFINITY;
    if (!(alter < 2 * 60 * 1000)) return;
    const admin = createAdminClient();
    const [{ data: profil }, { data: konto }] = await Promise.all([
      admin.from("profiles").select("id").eq("id", userId).maybeSingle(),
      admin.from("privat_konten").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    if (profil || konto) return;
    await admin.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("Aufräumen nach fehlgeschlagener Registrierung:", error instanceof Error ? error.message : error);
  }
}

export async function registrierePrivat(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Die Registrierung ist gerade nicht verfügbar." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const datenschutz = formData.get("datenschutz") === "on";

  if (!name) return { error: "Bitte gib deinen Namen an." };
  if (name.length > 80) return { error: "Der Name ist zu lang." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse an." };
  }
  if (password.length < PASSWORT_MIN) {
    return { error: `Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen lang sein.` };
  }
  if (password.length > PASSWORT_MAX) {
    return { error: `Das Passwort darf höchstens ${PASSWORT_MAX} Zeichen lang sein.` };
  }
  if (!datenschutz) return { error: "Bitte bestätige, dass du die Datenschutzerklärung gelesen hast." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Die Registrierung ist auf diesem Server gerade nicht verfügbar." };
  }

  const erlaubt =
    (await allow("privat-ip", await clientKey(), 5, 3600, true)) &&
    (await allow("privat-mail", emailKey(email), 3, 3600, true));
  if (!erlaubt) return { error: ZU_VIELE_VERSUCHE };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?weiter=/privat` },
  });
  if (error) return { error: authErrorMessage(error) ?? "Die Registrierung ist fehlgeschlagen." };

  const user = data.user;
  // Adresse schon vergeben: Supabase antwortet mit einem Scheinbenutzer.
  if (!user || (user.identities?.length ?? 0) === 0) return { success: BESTAETIGUNG };

  const { error: rpcError } = await createAdminClient().rpc("privat_konto_anlegen", {
    p_user: user.id,
    p_name: name,
    p_version: LEGAL_VERSIONS.datenschutz,
  });
  if (rpcError) {
    if ((rpcError.message ?? "").includes("Unternehmen")) return { success: BESTAETIGUNG };
    await verwirfNeuesKonto(user.id, user.created_at);
    return { error: "Das Konto konnte nicht angelegt werden. Bitte versuch es noch einmal." };
  }

  if (data.session) redirect("/privat");
  return { success: BESTAETIGUNG };
}

/**
 * Privatkonto samt allen Einträgen endgültig löschen. Nur für Privatkonten –
 * ein Firmenzugang wird hier nie gelöscht.
 */
export async function loeschePrivatkonto(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Gerade nicht möglich." };
  if (String(formData.get("bestaetigung") ?? "").trim().toUpperCase() !== "LÖSCHEN") {
    return { error: "Bitte gib zur Bestätigung LÖSCHEN ein." };
  }
  const supabase = await createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  const admin = createAdminClient();
  const [{ data: profil }, { data: konto }] = await Promise.all([
    admin.from("profiles").select("id").eq("id", userId).maybeSingle(),
    admin.from("privat_konten").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (profil || !konto) return { error: "Dieses Konto kann hier nicht gelöscht werden." };

  const { error } = await admin.auth.admin.deleteUser(userId as string);
  if (error) return { error: "Das Konto konnte nicht gelöscht werden. Bitte versuch es noch einmal." };

  await supabase.auth.signOut().catch(() => undefined);
  (await cookies()).delete(ACTIVITY_COOKIE);
  revalidatePath("/", "layout");
  redirect("/?konto=geloescht");
}

/** Einstellungen des Privatkontos speichern. */
export async function speicherePrivatEinstellungen(werte: {
  name?: string;
  bundesland?: string;
  feiertageZeigen?: boolean;
  wochenstunden?: number | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  const userId = anspruch?.claims?.sub;
  if (!userId) return { error: "Deine Sitzung ist abgelaufen." };
  const zeile: Record<string, unknown> = {};
  if (werte.name !== undefined) {
    const n = werte.name.trim();
    if (!n || n.length > 80) return { error: "Bitte einen Namen mit höchstens 80 Zeichen angeben." };
    zeile.name = n;
  }
  if (werte.bundesland !== undefined) zeile.bundesland = werte.bundesland;
  if (werte.feiertageZeigen !== undefined) zeile.feiertage_zeigen = werte.feiertageZeigen;
  if (werte.wochenstunden !== undefined) zeile.wochenstunden = werte.wochenstunden;
  const { error } = await supabase.from("privat_konten").update(zeile).eq("user_id", userId);
  if (error) return { error: "Das konnte nicht gespeichert werden." };
  revalidatePath("/privat", "layout");
  return {};
}
