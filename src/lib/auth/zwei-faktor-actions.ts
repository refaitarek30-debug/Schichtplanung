"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { safeInternalPath } from "@/lib/security/safe-path";
import { allow, clientKey, ZU_VIELE_VERSUCHE } from "@/lib/security/rate-limit";
import { anmeldeEingabeZuEmail } from "@/lib/privat/spitzname";
import type { FormState } from "./form-state";
import { geraet, protokolliere } from "./protokoll-server";
import { betreiberPruefen } from "./betreiber";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { GERAET_COOKIE, GERAET_TAGE } from "./zwei-faktor";

/**
 * „Diesem Gerät vertrauen“ (Migration 0222): zufälliges Merkzeichen ins Cookie
 * (nur der Server liest es), Prüfwert in die Datenbank. Schlägt etwas fehl,
 * fragt die App beim nächsten Mal eben wieder nach dem Code.
 */
async function geraetMerken(userId: string | null) {
  if (!userId) return;
  const merkzeichen = randomBytes(32).toString("base64url");
  try {
    const { error } = await createAdminClient().rpc("geraet_merken", {
      p_user: userId,
      p_token_hash: createHash("sha256").update(merkzeichen).digest("hex"),
      p_geraet: (await geraet()) ?? "unbekanntes Gerät",
    });
    if (error) return;
  } catch {
    return;
  }
  (await cookies()).set(GERAET_COOKIE, merkzeichen, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GERAET_TAGE * 24 * 60 * 60,
  });
}

/**
 * Zwei-Faktor-Anmeldung und Sperre (Migration 0219).
 *
 * Einrichten: QR-Code in der Authenticator-App scannen, ersten Code
 * eingeben – danach ist der Faktor aktiv und die Sitzung bestätigt.
 * Anmelden: nach dem Passwort den 6-stelligen Code. Falsche Codes zählen wie
 * falsche Passwörter; nach 5 Fehlversuchen ist das Konto gesperrt.
 */

const NICHT_KONFIGURIERT = "Die Anmeldung ist gerade nicht verfügbar.";

function nurZiffern(code: string): string {
  return code.replace(/\D/g, "").slice(0, 6);
}

/**
 * Einrichten, Schritt 1: neuen Faktor anlegen und den QR-Code liefern.
 *
 * `behalten`: ein Faktor, dessen Schlüssel das Gerät noch kennt (Seite neu
 * geladen, z. B. nach dem Wechsel in die Authenticator-App). Den lassen wir
 * stehen – sonst passt der schon gescannte Schlüssel nicht mehr zum Konto.
 */
export async function zweiFaktorStarten(
  behalten?: string | null,
): Promise<{ factorId?: string; qr?: string; secret?: string; uri?: string; weiter?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const supabase = await createClient();

  const { data: liste, error: listeFehler } = await supabase.auth.mfa.listFactors();
  if (listeFehler) return { error: "Bitte neu anmelden und noch einmal versuchen." };
  if ((liste?.totp ?? []).length > 0) return { error: "Die Zwei-Faktor-Anmeldung ist schon eingerichtet." };

  const offen = (liste?.all ?? []).filter((f) => f.status !== "verified");
  if (behalten && offen.some((f) => f.id === behalten)) {
    // Andere halbfertige Versuche aufräumen, den gemerkten behalten.
    for (const f of offen) if (f.id !== behalten) await supabase.auth.mfa.unenroll({ factorId: f.id });
    return { factorId: behalten, weiter: true };
  }
  // Halbfertige Versuche von vorher aufräumen – sonst sammelt sich pro
  // abgebrochenem Einrichten ein unbestätigter Faktor an.
  for (const f of offen) await supabase.auth.mfa.unenroll({ factorId: f.id });

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "ShiftNexo",
    friendlyName: `ShiftNexo ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data || data.type !== "totp") {
    return { error: "Das Einrichten hat gerade nicht geklappt. Bitte gleich noch einmal versuchen." };
  }
  // Das SVG kommt roh im data-Link; sauber kodiert zeigt es jeder Browser.
  const svg = data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, "");
  return {
    factorId: data.id,
    qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

/** Einrichten, Schritt 2: ersten Code bestätigen. */
export async function zweiFaktorBestaetigen(
  factorId: string,
  eingabe: string,
  merken = false,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const code = nurZiffern(eingabe);
  if (code.length !== 6) return { error: "Bitte den 6-stelligen Code aus der App eingeben." };
  if (!(await allow("mfa-einrichten", await clientKey(), 30, 600))) return { error: ZU_VIELE_VERSUCHE };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return { error: "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben – er wechselt alle 30 Sekunden." };
  }
  await protokolliere(supabase, "anmeldung", "Zwei-Faktor-Anmeldung eingerichtet");
  if (merken) {
    const { data: nutzer } = await supabase.auth.getUser();
    await geraetMerken(nutzer.user?.id ?? null);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Anmeldung: Code nach dem Passwort prüfen. */
export async function zweiFaktorPruefen(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const code = nurZiffern(String(formData.get("code") ?? ""));
  const weiter = safeInternalPath(String(formData.get("weiter") ?? ""), "/start");
  if (code.length !== 6) return { error: "Bitte den 6-stelligen Code aus der App eingeben." };
  if (!(await allow("mfa-ip", await clientKey(), 40, 600))) return { error: ZU_VIELE_VERSUCHE };

  const supabase = await createClient();
  const { data: liste, error: listeFehler } = await supabase.auth.mfa.listFactors();
  if (listeFehler) redirect("/login");
  const faktor = liste?.totp?.[0];
  // Kein Faktor mehr (zum Beispiel von der Administration zurückgesetzt):
  // dann gibt es auch nichts mehr zu bestätigen.
  if (!faktor) redirect(weiter);

  const { data: nutzer } = await supabase.auth.getUser();
  const userId = nutzer.user?.id ?? null;

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: faktor.id, code });
  if (error) {
    let gesperrt = false;
    try {
      const { data } = await createAdminClient().rpc("anmeldung_fehlversuch_konto", { p_user: userId });
      gesperrt = data === true;
    } catch {
      // Ohne Service-Schlüssel (Vorschau) gibt es keinen Zähler.
    }
    if (gesperrt) {
      await supabase.auth.signOut();
      redirect("/login?fehler=gesperrt");
    }
    return { error: "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben." };
  }

  try {
    await createAdminClient().rpc("anmeldung_erfolgreich", { p_user: userId });
  } catch {
    // Zähler ist Beiwerk.
  }
  await protokolliere(supabase, "anmeldung", `mit Zwei-Faktor-Code · ${(await geraet()) ?? "unbekanntes Gerät"}`);
  if (formData.get("merken") === "on") await geraetMerken(userId);
  revalidatePath("/", "layout");
  redirect(weiter);
}

/** Profil: Zwei-Faktor-Anmeldung selbst ausschalten (nur ohne Pflicht). */
export async function zweiFaktorAusschalten(): Promise<{ ok?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const supabase = await createClient();
  const { data: rolle } = await supabase.rpc("auth_role");
  if (rolle === "admin" || rolle === "shift_leader") {
    return { error: "Für Administration und Schichtleitung ist die Zwei-Faktor-Anmeldung Pflicht." };
  }
  const { data: liste, error } = await supabase.auth.mfa.listFactors();
  if (error) return { error: "Bitte neu anmelden und noch einmal versuchen." };
  for (const f of liste?.all ?? []) {
    const { error: weg } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (weg) return { error: "Das Ausschalten hat nicht geklappt. Bitte neu anmelden und noch einmal versuchen." };
  }
  await supabase.rpc("meine_geraete_vergessen");
  (await cookies()).delete(GERAET_COOKIE);
  await supabase.auth.refreshSession();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Profil: alle vertrauten Geräte vergessen – beim nächsten Anmelden überall wieder der Code. */
export async function meineGeraeteVergessen(): Promise<{ ok?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("meine_geraete_vergessen");
  if (error) return { error: "Das hat gerade nicht geklappt. Bitte gleich noch einmal versuchen." };
  (await cookies()).delete(GERAET_COOKIE);
  return { ok: true };
}

/** Verwaltung: Sperre einer Person aufheben (nur Administration). */
export async function zugangFreischalten(employeeId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("anmeldesperre_aufheben", { p_employee: employeeId });
  if (error) return { error: dataErrorMessage(error) ?? "Das Freischalten hat nicht geklappt." };
  return { ok: true };
}

/** Verwaltung: zweiten Faktor einer Person löschen – Handy verloren (nur Administration). */
export async function zweiFaktorFuerMitarbeiterZuruecksetzen(employeeId: string): Promise<{ ok?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  const supabase = await createClient();
  const { error } = await supabase.rpc("zwei_faktor_zuruecksetzen", { p_employee: employeeId });
  if (error) return { error: dataErrorMessage(error) ?? "Das Zurücksetzen hat nicht geklappt." };
  return { ok: true };
}

/** Betreiber (/plattform): Konto entsperren oder zweiten Faktor zurücksetzen. */
export async function plattformZugang(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: NICHT_KONFIGURIERT };
  // Betreiber mit Zwei-Faktor-Code, nicht der Notfallzugang (Migration 0221).
  const betreiber = await betreiberPruefen({ aendern: true });
  if (!betreiber) return { error: "Du hast keine Berechtigung für diesen Bereich." };
  const { admin } = betreiber;

  const kennung = String(formData.get("kennung") ?? "").trim();
  const aktion = String(formData.get("aktion") ?? "");
  if (!kennung) return { error: "Bitte Spitzname oder E-Mail eingeben." };
  if (aktion !== "entsperren" && aktion !== "zwei_faktor") return { error: "Unbekannte Aktion." };

  const { data, error } = await admin.rpc("platform_zugang", { p_email: anmeldeEingabeZuEmail(kennung), p_aktion: aktion });
  if (error) return { error: dataErrorMessage(error) ?? "Das hat nicht geklappt." };
  if (data !== true) return { error: "Zu dieser Angabe gibt es kein Konto." };
  revalidatePath("/plattform");
  return {
    success: aktion === "entsperren" ? `${kennung} ist wieder freigeschaltet.` : `Zwei-Faktor-Anmeldung von ${kennung} ist zurückgesetzt.`,
  };
}

/** Profil: Ist die Zwei-Faktor-Anmeldung an, und ist sie Pflicht? */
export async function meinZweiFaktorStatus(): Promise<{ aktiv: boolean; pflicht: boolean } | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const [{ data: liste, error }, { data: rolle }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.rpc("auth_role"),
  ]);
  if (error) return null;
  return { aktiv: (liste?.totp ?? []).length > 0, pflicht: rolle === "admin" || rolle === "shift_leader" };
}
