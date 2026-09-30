"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { siteOrigin } from "./invite";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authErrorMessage, dataErrorMessage } from "@/lib/errors";
import { LEGAL_VERSIONS } from "@/lib/legal/version";
import { allow, clientKey, emailKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { PASSWORT_MAX, PASSWORT_MIN } from "./password-policy";
import type { FormState } from "./form-state";

export type { FormState };

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

/**
 * Antwort, wenn die Adresse schon zu einem Konto gehört – und zugleich
 * Antwort bei Erfolg. Beides ist bewusst dieselbe Meldung: sonst ließe sich
 * über das Registrierungsformular durchprobieren, wer hier ein Konto hat.
 */
const BESTAETIGUNG_MELDUNG =
  "Fast geschafft. Wenn die Registrierung mit dieser Adresse möglich ist, haben wir dir eine " +
  "E-Mail zur Bestätigung geschickt – bitte auch den Spam-Ordner prüfen. Hast du schon ein " +
  "Konto, melde dich an oder nutze „Passwort vergessen“.";

/**
 * Entfernt das Konto, das diese Registrierung gerade selbst angelegt hat,
 * wenn danach die Firmenanlage scheitert. Sicherheitsgurte: nur ein sehr
 * frisches Konto und nur eines ohne Profil – ein bestehendes, womöglich noch
 * unbestätigtes Konto einer anderen Person wird nie angerührt.
 */
async function verwirfNeuesKonto(userId: string, angelegtAm: string | undefined) {
  try {
    const alter = angelegtAm ? Date.now() - Date.parse(angelegtAm) : Number.POSITIVE_INFINITY;
    if (!(alter < 2 * 60 * 1000)) return;
    const admin = createAdminClient();
    const { data: profil } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (profil) return;
    await admin.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("Aufräumen nach fehlgeschlagener Registrierung:", error instanceof Error ? error.message : error);
  }
}

/**
 * Legt ein neues Unternehmen samt erstem Administrator an – der
 * Selbstbedienungs-Weg, mit dem weitere Firmen dieselbe Anwendung nutzen
 * können.
 *
 * Ablauf (Reihenfolge ist Absicht):
 *  1. Zustimmungen und Eingaben prüfen, Ratenbegrenzung.
 *  2. `auth.signUp` OHNE Firmenzuordnung in den Metadaten. Der Trigger
 *     `handle_new_user` legt dann kein Profil an – ein Client kann sich so
 *     keiner bestehenden Firma zuordnen.
 *  3. Nur für ein wirklich neues Konto: `register_company_for_user` mit dem
 *     Service-Key. Firma, Stammsatz, Standardschichten und Profil entstehen
 *     in einer Transaktion; Rolle `admin` und alle IDs bestimmt die
 *     Datenbank, nicht der Browser. Die Zeitpunkte der Zustimmungen setzt
 *     ebenfalls die Datenbank.
 *  4. Gibt es die Adresse schon, passiert nichts – und die Antwort ist
 *     dieselbe wie bei Erfolg.
 */
export async function registerCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const companyName = String(formData.get("company_name") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("password_repeat") ?? "");
  const termsAccepted = formData.get("terms_accepted") === "on";
  const businessConfirmed = formData.get("business_confirmed") === "on";
  const privacyRead = formData.get("privacy_read") === "on";

  if (!companyName) return { error: "Bitte einen Unternehmensnamen angeben." };
  if (!firstName || !lastName) return { error: "Bitte Vor- und Nachnamen angeben." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  }
  if (companyName.length > 200 || firstName.length > 100 || lastName.length > 100) {
    return { error: "Eine der Angaben ist zu lang." };
  }
  if (password.length < PASSWORT_MIN) {
    return { error: `Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen lang sein.` };
  }
  if (password.length > PASSWORT_MAX) {
    return { error: `Das Passwort darf höchstens ${PASSWORT_MAX} Zeichen lang sein.` };
  }
  if (password !== passwordRepeat) return { error: "Die beiden Passwörter stimmen nicht überein." };

  // Pflichtangaben. Die Zeitpunkte entstehen in der Datenbank – was der
  // Browser schickt, ist kein Nachweis.
  if (!businessConfirmed) {
    return {
      error:
        "Bitte bestätige, dass du dich für ein Unternehmen bzw. im Rahmen deiner beruflichen Tätigkeit registrierst.",
    };
  }
  if (!termsAccepted) {
    return {
      error:
        "Bitte akzeptiere die Nutzungsbedingungen und den Auftragsverarbeitungsvertrag, um fortzufahren.",
    };
  }
  if (!privacyRead) {
    return { error: "Bitte bestätige, dass du die Datenschutzerklärung zur Kenntnis genommen hast." };
  }

  const erlaubt =
    (await allow("register-ip", await clientKey(), 5, 3600, true)) &&
    (await allow("register-mail", emailKey(email), 3, 3600, true));
  if (!erlaubt) return { error: ZU_VIELE_VERSUCHE };

  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (signUpError) {
    return { error: authErrorMessage(signUpError) ?? "Die Registrierung ist fehlgeschlagen." };
  }

  const user = signUpData.user;

  // Supabase verrät absichtlich nicht, dass eine Adresse schon vergeben ist:
  // es kommt HTTP 200 mit einem Scheinbenutzer ohne Sitzung und mit leerem
  // `identities` – und es wird keine Mail verschickt. Hier passiert deshalb
  // nichts, und die Antwort gleicht der bei Erfolg.
  if (!user || (user.identities?.length ?? 0) === 0) {
    return { success: BESTAETIGUNG_MELDUNG };
  }

  const { error: rpcError } = await createAdminClient().rpc("register_company_for_user", {
    p_user_id: user.id,
    p_company_name: companyName,
    p_first_name: firstName,
    p_last_name: lastName,
    p_terms_accepted: termsAccepted,
    p_business_confirmed: businessConfirmed,
    p_terms_version: LEGAL_VERSIONS.nutzungsbedingungen,
    p_avv_version: LEGAL_VERSIONS.avv,
    p_privacy_version: LEGAL_VERSIONS.datenschutz,
  });

  if (rpcError) {
    // Ein erneuter Versuch mit einer Adresse, deren (unbestätigtes) Konto
    // schon eine Firma hat: nichts anrühren, neutral antworten.
    if ((rpcError.message ?? "").includes("bereits ein Unternehmen")) {
      return { success: BESTAETIGUNG_MELDUNG };
    }
    await verwirfNeuesKonto(user.id, user.created_at);
    return { error: dataErrorMessage(rpcError) ?? "Das Unternehmen konnte nicht angelegt werden." };
  }

  // Ist die Bestätigungsmail in Supabase deaktiviert, kommt sofort eine
  // Sitzung zurück – dann direkt in den Einrichtungsassistenten. Sonst muss
  // die Adresse erst bestätigt werden.
  if (signUpData.session) {
    redirect("/einrichtung");
  }

  return { success: BESTAETIGUNG_MELDUNG };
}
