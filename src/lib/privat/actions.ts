"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authErrorMessage } from "@/lib/errors";
import { LEGAL_VERSIONS } from "@/lib/legal/version";
import { allow, clientKey, emailKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE } from "@/lib/auth/idle";
import { PRIVAT_DOMAIN, pruefeSpitzname, spitznameZuEmail } from "./spitzname";
import { siteOrigin } from "@/lib/auth/invite";
import { PASSWORT_MAX, PASSWORT_MIN } from "@/lib/auth/password-policy";
import type { FormState } from "@/lib/auth/form-state";

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

  const spitzname = String(formData.get("spitzname") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const datenschutz = formData.get("datenschutz") === "on";

  const nameFehler = pruefeSpitzname(spitzname);
  if (nameFehler) return { error: nameFehler };
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

  const email = spitznameZuEmail(spitzname);
  const erlaubt =
    (await allow("privat-ip", await clientKey(), 5, 3600, true)) &&
    (await allow("privat-mail", emailKey(email), 3, 3600, true));
  if (!erlaubt) return { error: ZU_VIELE_VERSUCHE };

  // Ohne Bestätigungsmail: Das Konto wird mit dem Dienstschlüssel als
  // bestätigt angelegt, danach meldet sich die Person gleich an.
  const admin = createAdminClient();
  const { data: angelegt, error: anlegeFehler } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (anlegeFehler || !angelegt.user) {
    const text = (anlegeFehler?.message ?? "").toLowerCase();
    if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
      return { error: "Dieser Spitzname ist schon vergeben. Bitte wähle einen anderen." };
    }
    if (text.includes("password")) {
      return { error: "Das Passwort ist zu schwach oder zu leicht zu erraten. Bitte wähle ein anderes." };
    }
    console.error("Privatkonto anlegen:", anlegeFehler?.message);
    return { error: "Die Registrierung ist fehlgeschlagen. Bitte versuch es noch einmal." };
  }
  const user = angelegt.user;

  const { error: rpcError } = await admin.rpc("privat_konto_anlegen", {
    p_user: user.id,
    p_name: spitzname,
    p_version: LEGAL_VERSIONS.datenschutz,
  });
  if (rpcError) {
    await verwirfNeuesKonto(user.id, user.created_at);
    return { error: "Das Konto konnte nicht angelegt werden. Bitte versuch es noch einmal." };
  }

  const supabase = await createClient();
  const { error: anmeldeFehler } = await supabase.auth.signInWithPassword({ email, password });
  if (anmeldeFehler) {
    return { error: "Das Konto ist angelegt. Bitte melde dich jetzt mit Spitzname und Passwort an." };
  }
  (await cookies()).set(ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVITY_COOKIE_MAX_AGE,
  });
  revalidatePath("/", "layout");
  redirect("/privat");
}

/**
 * Freiwillig eine echte E-Mail-Adresse hinterlegen – nur damit „Passwort
 * vergessen“ funktioniert. Die Adresse gilt erst nach Klick auf den Link in
 * der Bestätigungsmail.
 */
export async function speicherePrivatEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "Gerade nicht möglich." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse an." };
  }
  if (email.endsWith(`@${PRIVAT_DOMAIN}`)) return { error: "Bitte gib eine gültige E-Mail-Adresse an." };
  if (!(await allow("privat-email-aendern", await clientKey(), 5, 3600))) return { error: ZU_VIELE_VERSUCHE };

  const supabase = await createClient();
  const { data: anspruch } = await supabase.auth.getClaims();
  if (!anspruch?.claims?.sub) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };
  const origin = await siteOrigin();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${origin}/auth/callback?weiter=/privat/mehr` });
  if (error) return { error: authErrorMessage(error) ?? "Das hat nicht geklappt." };
  return { success: "Wir haben dir eine E-Mail geschickt. Bitte bestätige die Adresse über den Link darin." };
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
