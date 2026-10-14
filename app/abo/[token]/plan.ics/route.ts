import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { heuteInBerlin } from "@/lib/dates";
import { baueIcs, type AboTag } from "@/lib/abo/ics";

/**
 * Öffentlicher Kalender-Abo-Link. Der Schlüssel im Link ist der einzige
 * Zugang; die Datenbank prüft ihn (Migration 0143).
 */
export const dynamic = "force-dynamic";

const KOPF = { "Cache-Control": "private, no-store" };
const TAGE_PRO_ABFRAGE = 62;

function plusTage(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function hole(token: string, von: string): Promise<{ status: number; tage: AboTag[] }> {
  const antwort = await fetch(`${SUPABASE_URL}/rest/v1/rpc/abo_plan`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token, p_von: von, p_tage: TAGE_PRO_ABFRAGE }),
    cache: "no-store",
  });
  if (!antwort.ok) return { status: antwort.status, tage: [] };
  return { status: 200, tage: (await antwort.json()) as AboTag[] };
}

export async function GET(_anfrage: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const text = (s: string, status: number) =>
    new NextResponse(s, { status, headers: { ...KOPF, "Content-Type": "text/plain; charset=utf-8" } });

  if (!/^[0-9a-f]{32,128}$/.test(token)) return text("Dieser Link ist nicht mehr gültig.", 404);
  if (!isSupabaseConfigured) return text("Der Dienst ist gerade nicht erreichbar.", 503);

  // Zwei Abfragen: 14 Tage zurück bis rund drei Monate voraus.
  const heute = heuteInBerlin();
  try {
    const [a, b] = await Promise.all([hole(token, plusTage(heute, -14)), hole(token, plusTage(heute, 48))]);
    for (const r of [a, b]) {
      if (r.status === 404) return text("Dieser Link ist nicht mehr gültig.", 404);
      if (r.status !== 200) return text("Der Plan konnte gerade nicht geladen werden.", 503);
    }
    const ics = baueIcs([...a.tage, ...b.tage]);
    return new NextResponse(ics, {
      headers: {
        ...KOPF,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="schichtplan.ics"',
      },
    });
  } catch {
    return text("Der Plan konnte gerade nicht geladen werden.", 503);
  }
}
