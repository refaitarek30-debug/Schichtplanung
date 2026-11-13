import type { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Zwei-Faktor-Anmeldung (Migration 0219).
 *
 * Wer einen zweiten Faktor hat, braucht nach dem Passwort noch den Code aus
 * der Authenticator-App. Die eigentliche Sperre sitzt in der Datenbank
 * (zugang_ok): ohne bestätigten Code gibt es keine Firmendaten. Diese
 * Prüfung hier sorgt nur dafür, dass die Person zur Code-Eingabe geschickt
 * wird statt auf eine leere Seite.
 *
 * Liest nur die Sitzung aus dem Cookie – kein Aufruf beim Anmeldedienst.
 */
export async function zweiterFaktorOffen(supabase: Client): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
  } catch {
    return false;
  }
}

/** Hat die Sitzung einen bestätigten zweiten Faktor (aal2)? */
export async function zweiterFaktorBestaetigt(supabase: Client): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === "aal2";
  } catch {
    return false;
  }
}

/** Pflicht für Administration und Schichtleitung (nicht in der Demo). */
export function zweiFaktorPflicht(role: Role, istDemo: boolean): boolean {
  return !istDemo && (role === "admin" || role === "shift_leader");
}

/** Interner Rücksprung nach der Code-Eingabe. */
export function zielMitWeiter(pfad: string, weiter: string): string {
  return weiter ? `${pfad}?weiter=${encodeURIComponent(weiter)}` : pfad;
}

export const GESPERRT_TEXT =
  "Dein Zugang ist nach 5 falschen Versuchen gesperrt. Bitte wende dich an die Administration deines Betriebs – sie kann dich wieder freischalten.";
