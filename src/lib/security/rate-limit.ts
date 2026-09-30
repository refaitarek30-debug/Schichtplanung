import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Ratenbegrenzung für öffentliche Aktionen (Anmeldung, Passwort-Reset,
 * Registrierung). Gezählt wird in der Datenbank (`rate_limit_hit`, nur für die
 * Dienstrolle), damit die Grenze über alle Serverinstanzen gilt.
 *
 * Datensparsamkeit: in die Datenbank gelangt nie eine Klartext-IP oder
 * -E-Mail, sondern ein mit dem Dienstschlüssel gesalzener SHA-256-Hash. Der
 * Hash lässt sich nicht ohne den Schlüssel zurückrechnen, und die Einträge
 * werden nach einem Tag gelöscht.
 */

function hash(wert: string): string {
  const salz = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${salz}|${wert}`).digest("hex");
}

/** Client-Adresse hinter dem Vercel-Proxy; ohne Angabe ein fester Wert. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const weitergeleitet = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return hash(`ip:${weitergeleitet || h.get("x-real-ip") || "unbekannt"}`);
}

export function emailKey(email: string): string {
  return hash(`mail:${email.trim().toLowerCase()}`);
}

/**
 * true = der Versuch ist erlaubt. Fällt der Zähler selbst aus, entscheidet
 * `failClosed`: Anmeldung und Reset bleiben dann nutzbar (sonst legt ein
 * Ausfall der Zähltabelle alle Anmeldungen lahm), die Firmenregistrierung
 * nicht.
 */
export async function allow(
  bucket: string,
  keyHash: string,
  max: number,
  windowSeconds: number,
  failClosed = false,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error("Ratenbegrenzung nicht verfügbar:", error instanceof Error ? error.message : error);
    return !failClosed;
  }
}

export const ZU_VIELE_VERSUCHE =
  "Zu viele Versuche. Bitte warte einige Minuten und versuche es dann erneut.";
