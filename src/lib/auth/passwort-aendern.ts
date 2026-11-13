"use server";

import { createClient as createPruefClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { authErrorMessage } from "@/lib/errors";
import { allow, emailKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { PASSWORT_MAX, passwortProblem } from "./password-policy";
import { protokolliere } from "./protokoll-server";
import type { FormState } from "./form-state";

const NOT_CONFIGURED: FormState = {
  error: "Supabase ist noch nicht konfiguriert. Im produktiven Betrieb ist der Backend-Zugriff erforderlich.",
};

const FALSCHES_PASSWORT = "Das aktuelle Passwort ist falsch.";

/**
 * Das eigene Passwort ändern (Profil). Eigene Datei, damit der Weg über
 * „Passwort vergessen“ (`updatePassword` in actions.ts) unberührt bleibt –
 * der kennt kein altes Passwort, weil die Person es ja vergessen hat.
 *
 * Ablauf:
 *  1. Eingaben prüfen.
 *  2. Ratenbremse je Konto: das alte Passwort darf nicht durchprobiert werden.
 *  3. Das aktuelle Passwort prüfen – mit einem eigenen Client ohne Cookies,
 *     damit die echte Sitzung des Browsers dabei nicht angefasst wird. Die
 *     Prüf-Sitzung wird sofort wieder beendet (nur diese eine).
 *  4. Neues Passwort setzen und ins Protokoll schreiben.
 *  5. Alle anderen Geräte abmelden: wer das Passwort ändert, will meist, dass
 *     ein altes Passwort nirgends mehr gilt. Die Sitzung hier bleibt bestehen.
 */
export async function changeOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;

  const aktuell = String(formData.get("current_password") ?? "");
  const neu = String(formData.get("password") ?? "");
  const wiederholt = String(formData.get("password_repeat") ?? "");

  if (!aktuell) return { error: "Bitte gib dein aktuelles Passwort ein." };
  const problem = passwortProblem(neu);
  if (problem) return { error: problem };
  if (neu !== wiederholt) return { error: "Die beiden neuen Passwörter stimmen nicht überein." };
  if (neu === aktuell) return { error: "Das neue Passwort muss sich vom aktuellen unterscheiden." };
  // Länger als erlaubt kann das alte nicht sein – gar nicht erst anfragen.
  if (aktuell.length > PASSWORT_MAX) return { error: FALSCHES_PASSWORT };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." };

  if (!(await allow("passwort-aendern", emailKey(user.email), 5, 600))) return { error: ZU_VIELE_VERSUCHE };

  // 3. Aktuelles Passwort prüfen – ohne die Sitzung des Browsers zu berühren.
  const pruefer = createPruefClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: pruefung, error: pruefFehler } = await pruefer.auth.signInWithPassword({
    email: user.email,
    password: aktuell,
  });
  if (pruefFehler || !pruefung.session) {
    const text = (pruefFehler?.message ?? "").toLowerCase();
    if (pruefFehler?.code === "invalid_credentials" || text.includes("invalid login credentials")) {
      return { error: FALSCHES_PASSWORT };
    }
    return { error: authErrorMessage(pruefFehler) ?? "Das aktuelle Passwort konnte nicht geprüft werden." };
  }
  // Nur die Prüf-Sitzung beenden, nicht alle des Kontos.
  await pruefer.auth.signOut({ scope: "local" }).catch(() => undefined);

  // 4. Neues Passwort setzen.
  const { error } = await supabase.auth.updateUser({ password: neu, current_password: aktuell });
  if (error) {
    if ((error.message ?? "").toLowerCase().includes("reauthentication")) {
      return { error: "Bitte melde dich einmal ab und wieder an. Danach lässt sich das Passwort ändern." };
    }
    return { error: authErrorMessage(error) ?? "Die Änderung ist fehlgeschlagen." };
  }
  await protokolliere(supabase, "anmeldung.passwort", null);

  // 5. Andere Geräte abmelden. Schlägt das fehl, ist das Passwort trotzdem geändert.
  await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);

  return { success: "Passwort geändert. Auf deinen anderen Geräten musst du dich neu anmelden." };
}
