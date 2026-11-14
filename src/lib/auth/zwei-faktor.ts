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

/**
 * Muss die Person jetzt den Code eingeben? Wie zweiterFaktorOffen, aber eine
 * Sitzung von einem vertrauten Gerät (Migration 0222, „Diesem Gerät
 * vertrauen“) braucht keinen Code. Nur für Betrieb und Privat – die
 * Betreiber-Seite prüft streng mit zweiterFaktorOffen.
 */
export async function zweiterFaktorNoetig(supabase: Client): Promise<boolean> {
  if (!(await zweiterFaktorOffen(supabase))) return false;
  try {
    const { data, error } = await supabase.rpc("sitzung_vertraut");
    return error ? true : data !== true;
  } catch {
    return true;
  }
}

/** Hat die Person überhaupt einen eingerichteten zweiten Faktor? */
export async function hatZweitenFaktor(supabase: Client): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.nextLevel === "aal2";
  } catch {
    return false;
  }
}

/** Cookie mit dem Merkzeichen für „Diesem Gerät vertrauen“ (nur der Server liest es). */
export const GERAET_COOKIE = "sn_geraet";
export const GERAET_TAGE = 30;

/** Sitzungs-Kennung aus dem Zugangs-Token (für vertraute Sitzungen). */
export function sitzungAusToken(token: string | null | undefined): string | null {
  try {
    const teil = (token ?? "").split(".")[1];
    if (!teil) return null;
    const inhalt = JSON.parse(Buffer.from(teil, "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof inhalt.session_id === "string" ? inhalt.session_id : null;
  } catch {
    return null;
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
