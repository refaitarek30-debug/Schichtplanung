"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE } from "./idle";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { FormState } from "./form-state";
import { allow, clientKey, emailKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { anmeldeEingabeZuEmail } from "@/lib/privat/spitzname";
import { geraet, protokolliere } from "./protokoll-server";

/**
 * Passwort zurücksetzen mit einem Code statt per E-Mail (Migration 0172).
 *
 *  - Betrieb: Administration oder Schichtleitung erzeugt in der Verwaltung
 *    einen Einmal-Code für eine Person und gibt ihn persönlich weiter.
 *  - Privat: eigener Wiederherstellungs-Code aus „Mehr“; verloren → Support.
 *
 * Eingelöst wird nur hier auf dem Server. Danach ist die Person angemeldet
 * und landet beim Formular „Neues Passwort“ (zweimal eingeben).
 */

const NICHT_KONFIGURIERT: FormState = { error: "Die Anmeldung ist gerade nicht verfügbar." };
const FALSCH = "Code oder Angaben stimmen nicht – oder der Code ist abgelaufen.";

export async function passwortMitCode(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NICHT_KONFIGURIERT;

  const kennung = String(formData.get("kennung") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!kennung || !code) return { error: "Bitte E-Mail oder Spitzname und den Code eingeben." };
  if (code.length > 40 || kennung.length > 200) return { error: FALSCH };

  const email = anmeldeEingabeZuEmail(kennung);
  const erlaubt =
    (await allow("code-ip", await clientKey(), 20, 3600)) && (await allow("code-mail", emailKey(email), 10, 3600));
  if (!erlaubt) return { error: ZU_VIELE_VERSUCHE };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NICHT_KONFIGURIERT;
  }

  const { data, error } = await admin.rpc("passwort_code_einloesen", { p_email: email, p_code: code });
  if (error) return { error: "Das hat gerade nicht geklappt. Bitte gleich noch einmal versuchen." };
  const status = (data as { status?: string } | null)?.status;
  if (status === "gesperrt") return { error: "Zu viele falsche Versuche. Bitte in 15 Minuten erneut probieren." };
  if (status !== "ok") return { error: FALSCH };

  // Der Code stimmt: eine Sitzung anlegen wie beim Link „Passwort vergessen“,
  // nur ohne Mail – Link erzeugen und sofort hier einlösen.
  const link = await admin.auth.admin.generateLink({ type: "recovery", email });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return { error: "Das hat gerade nicht geklappt. Bitte die Leitung um einen neuen Code bitten." };

  const supabase = await createClient();
  const { error: fehler } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (fehler) return { error: "Das hat gerade nicht geklappt. Bitte die Leitung um einen neuen Code bitten." };

  await protokolliere(supabase, "anmeldung", `über Passwort-Code · ${(await geraet()) ?? "unbekanntes Gerät"}`);
  (await cookies()).set(ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVITY_COOKIE_MAX_AGE,
  });
  redirect("/passwort-neu?mit=code");
}

/** Verwaltung: Code für eine Person erzeugen (Administration, Schichtleitung). */
export async function passwortCodeFuerMitarbeiter(employeeId: string): Promise<{ code?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("passwort_code_fuer_mitarbeiter", { p_employee: employeeId });
  if (error) return { error: dataErrorMessage(error) ?? "Der Code ließ sich nicht erzeugen." };
  return { code: String(data) };
}

/** Privat: neuen eigenen Wiederherstellungs-Code erzeugen (der alte gilt danach nicht mehr). */
export async function meinWiederherstellungscode(): Promise<{ code?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mein_wiederherstellungscode");
  if (error) return { error: dataErrorMessage(error) ?? "Der Code ließ sich nicht erzeugen." };
  return { code: String(data) };
}

/** Betreiber (/plattform): Code für ein Privatkonto, das seinen Code verloren hat. */
export async function plattformPasswortCode(_prev: FormState & { code?: string }, formData: FormData): Promise<FormState & { code?: string }> {
  if (!isSupabaseConfigured) return NICHT_KONFIGURIERT;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Bitte neu anmelden." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NICHT_KONFIGURIERT;
  }
  const { data: istBetreiber } = await admin.rpc("is_platform_admin", { p_user_id: user.id });
  if (istBetreiber !== true) return { error: "Du hast keine Berechtigung für diesen Bereich." };

  const kennung = String(formData.get("kennung") ?? "").trim();
  if (!kennung) return { error: "Bitte Spitzname oder E-Mail eingeben." };
  const { data, error } = await admin.rpc("plattform_passwort_code", { p_email: anmeldeEingabeZuEmail(kennung) });
  if (error) return { error: dataErrorMessage(error) ?? "Der Code ließ sich nicht erzeugen." };
  return { code: String(data), success: kennung };
}
