import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { allow, clientKey } from "@/lib/security/rate-limit";
import { Verbinden, type Vorschau } from "./verbinden";

/**
 * Einladungslink bzw. Link aus dem QR-Code zum Verbinden zweier Konten.
 * Ohne Konto legt die Person hier gleich eins an (Spitzname und Passwort)
 * und wird danach verbunden. Verbinden kann nur, wer selbst einen Kalender
 * hat – geprüft in der Datenbank (Migrationen 0157, 0163).
 */
export const metadata: Metadata = {
  title: "Einladung – ShiftNexo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Gilt der Link, und wer lädt ein? Nur über den Server, mit Bremse je Adresse. */
async function vorschau(code: string): Promise<Vorschau | null> {
  const roh = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (roh.length !== 6) return { gueltig: false, name: "" };
  if (!isSupabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    if (!(await allow("einladung-ip", await clientKey(), 60, 3600))) return null;
    const { data, error } = await createAdminClient().rpc("einladung_vorschau", { p_code: roh });
    if (error) return null;
    const d = data as { gueltig?: boolean; name?: string } | null;
    return { gueltig: d?.gueltig === true, name: d?.name ?? "" };
  } catch {
    return null;
  }
}

export default async function VerbindenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const [{ code }, { neu }] = await Promise.all([params, searchParams]);
  return <Verbinden code={code} vorschau={await vorschau(code)} neu={neu === "1"} />;
}
