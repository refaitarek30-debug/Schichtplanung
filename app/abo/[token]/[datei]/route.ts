import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { heuteInBerlin } from "@/lib/dates";
import { baueIcs, teilAusDatei, type AboTag, type AboTermin } from "@/lib/abo/ics";

/**
 * Öffentlicher Kalender-Abo-Link. Der Schlüssel im Link ist der einzige
 * Zugang; die Datenbank prüft ihn (Migration 0143).
 */
export const dynamic = "force-dynamic";

/** Fehler und „Link ungültig“ nie zwischenspeichern. */
const KOPF = { "Cache-Control": "private, no-store" };
/**
 * Der Plan selbst: Kalender-Apps (Apple, Google, Outlook) fragen den Link von
 * sich aus in kurzen Abständen ab – das war mit Abstand die teuerste Abfrage
 * der Datenbank (rund 0,4 s je Aufruf). Ein kurzer Zwischenspeicher am Rand
 * des Netzes fängt die Wiederholungen ab: höchstens alle 10 Minuten kommt
 * eine Anfrage bis zur Datenbank. Ein beendeter Link gilt damit bis zu 10
 * Minuten nach; der Schlüssel im Link bleibt Teil der Adresse, andere
 * Links teilen sich nichts.
 */
const KOPF_PLAN = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" };
const TAGE_PRO_ABFRAGE = 62;

function plusTage(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function rpc<T>(name: string, body: object): Promise<{ status: number; daten: T | null }> {
  const antwort = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!antwort.ok) return { status: antwort.status, daten: null };
  return { status: 200, daten: (await antwort.json()) as T };
}

const hole = (token: string, von: string) =>
  rpc<AboTag[]>("abo_plan", { p_token: token, p_von: von, p_tage: TAGE_PRO_ABFRAGE });

export async function GET(_anfrage: Request, { params }: { params: Promise<{ token: string; datei: string }> }) {
  const { token, datei } = await params;
  const text = (s: string, status: number) =>
    new NextResponse(s, { status, headers: { ...KOPF, "Content-Type": "text/plain; charset=utf-8" } });

  const teil = teilAusDatei(datei);
  if (!teil || !/^[0-9a-f]{32,128}$/.test(token)) return text("Dieser Link ist nicht mehr gültig.", 404);
  if (!isSupabaseConfigured) return text("Der Dienst ist gerade nicht erreichbar.", 503);

  // Plan: zwei Abfragen, 14 Tage zurück bis rund drei Monate voraus.
  // Termine nur für den Gesamtkalender und „Meine Termine“.
  const heute = heuteInBerlin();
  const mitPlan = teil !== "termine";
  const mitTerminen = teil === "alles" || teil === "termine";
  try {
    const leer = { status: 200, daten: [] };
    const [a, b, t] = await Promise.all([
      mitPlan ? hole(token, plusTage(heute, -14)) : leer,
      mitPlan ? hole(token, plusTage(heute, 48)) : leer,
      mitTerminen ? rpc<AboTermin[]>("abo_termine", { p_token: token }) : leer,
    ]);
    for (const r of [a, b, t]) {
      if (r.status === 404) return text("Dieser Link ist nicht mehr gültig.", 404);
      if (r.status !== 200) return text("Der Plan konnte gerade nicht geladen werden.", 503);
    }
    const ics = baueIcs(
      [...((a.daten as AboTag[] | null) ?? []), ...((b.daten as AboTag[] | null) ?? [])],
      teil,
      new Date(),
      (t.daten as AboTermin[] | null) ?? [],
    );
    return new NextResponse(ics, {
      headers: {
        ...KOPF_PLAN,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${datei}"`,
      },
    });
  } catch {
    return text("Der Plan konnte gerade nicht geladen werden.", 503);
  }
}
