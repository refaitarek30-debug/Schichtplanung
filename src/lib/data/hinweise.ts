import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { datenFehlerText } from "@/lib/errors";

/**
 * Hinweise an einzelne Personen (Migration 0187). Die Schichtleitung schickt
 * einen kurzen Text; die Person sieht ihn beim nächsten Öffnen als Fenster
 * und bestätigt mit „Verstanden“. Eine Antwort gibt es bewusst nicht.
 */

export class HinweisFehler extends Error {}

/** Wohin der Knopf im Hinweis führt. */
export const HINWEIS_ZIELE = [
  { wert: "", label: "Kein Knopf" },
  { wert: "/urlaub", label: "Urlaub beantragen" },
  { wert: "/meine-schichten", label: "Meine Schichten" },
  { wert: "/kalender", label: "Kalender" },
] as const;

export type HinweisZiel = "/urlaub" | "/meine-schichten" | "/kalender" | "/start";

export function zielLabel(ziel: string | null): string | null {
  return HINWEIS_ZIELE.find((z) => z.wert && z.wert === ziel)?.label ?? null;
}

/**
 * Wann der Hinweis ankommt: „schicht“ = Fenster und Mitteilung erst ab der
 * nächsten Schicht, „sofort“ = gleich, „aus“ = gleich in der App, ohne Handy.
 */
export type HinweisPush = "schicht" | "sofort" | "aus";

export const HINWEIS_PUSH_WERTE: HinweisPush[] = ["schicht", "sofort", "aus"];

/** Vorgabe des Betriebs für das Senden-Fenster (Migration 0191). */
export async function fetchHinweisStandard(): Promise<HinweisPush> {
  if (!isSupabaseConfigured) return "schicht";
  const { data, error } = await createClient().rpc("hinweis_standard");
  // Noch ohne Migration oder Fehler: wie bisher „Zur Arbeitszeit“.
  if (error) return "schicht";
  return HINWEIS_PUSH_WERTE.includes(data as HinweisPush) ? (data as HinweisPush) : "schicht";
}

/** Häufige Hinweise zum Antippen – Text bleibt danach änderbar. */
export const HINWEIS_VORLAGEN = [
  "Bitte stell deinen Urlaubsantrag noch einmal – jetzt sollte es klappen.",
  "Bitte schau dir deinen Schichtplan an, es gibt eine Änderung.",
  "Bitte melde dich kurz bei mir.",
  "Bitte prüf deine Angaben im Profil.",
] as const;

export interface MeinHinweis {
  id: string;
  text: string;
  ziel: string | null;
  vonName: string;
  erstelltAm: string;
}

export interface GesendeterHinweis {
  id: string;
  employeeId: string;
  empfaenger: string;
  text: string;
  ziel: string | null;
  push: HinweisPush;
  pushAb: string | null;
  pushGesendet: boolean;
  vonName: string;
  erstelltAm: string;
  gelesenAm: string | null;
  zurueckgezogenAm: string | null;
}

export async function hinweisSenden(
  empfaenger: string[],
  text: string,
  ziel: string | null,
  push: HinweisPush,
): Promise<number> {
  if (!isSupabaseConfigured) throw new HinweisFehler("Hinweise gibt es nur im Live-Modus.");
  const { data, error } = await createClient().rpc("hinweis_senden", {
    p_empfaenger: empfaenger,
    p_text: text,
    p_ziel: ziel || null,
    p_push: push,
  });
  if (error) throw new HinweisFehler(datenFehlerText(error, "Der Hinweis konnte nicht gesendet werden."));
  return typeof data === "number" ? data : 0;
}

export async function fetchMeineHinweise(): Promise<MeinHinweis[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("meine_hinweise");
  if (error) throw new HinweisFehler(datenFehlerText(error, "Die Hinweise konnten nicht geladen werden."));
  const zeilen = (data ?? []) as { id: string; text: string; ziel: string | null; von_name: string; erstellt_am: string }[];
  return zeilen.map((h) => ({
    id: h.id,
    text: h.text,
    ziel: h.ziel,
    vonName: h.von_name,
    erstelltAm: h.erstellt_am,
  }));
}

export async function hinweisGelesen(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await createClient().rpc("hinweis_gelesen", { p_id: id });
  if (error) throw new HinweisFehler(datenFehlerText(error, "Das konnte nicht gespeichert werden."));
}

export async function fetchGesendeteHinweise(limit = 30): Promise<GesendeterHinweis[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await createClient().rpc("hinweise_gesendet", { p_limit: limit });
  if (error) throw new HinweisFehler(datenFehlerText(error, "Die Hinweise konnten nicht geladen werden."));
  const zeilen = (data ?? []) as {
    id: string;
    employee_id: string;
    empfaenger: string;
    text: string;
    ziel: string | null;
    push: string;
    push_ab: string | null;
    push_gesendet: boolean;
    von_name: string;
    erstellt_am: string;
    gelesen_am: string | null;
    zurueckgezogen_am: string | null;
  }[];
  return zeilen.map((h) => ({
    id: h.id,
    employeeId: h.employee_id,
    empfaenger: h.empfaenger,
    text: h.text,
    ziel: h.ziel,
    push: (h.push as HinweisPush) ?? "aus",
    pushAb: h.push_ab,
    pushGesendet: h.push_gesendet,
    vonName: h.von_name,
    erstelltAm: h.erstellt_am,
    gelesenAm: h.gelesen_am,
    zurueckgezogenAm: h.zurueckgezogen_am,
  }));
}

export async function hinweisZurueckziehen(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await createClient().rpc("hinweis_zurueckziehen", { p_id: id });
  if (error) throw new HinweisFehler(datenFehlerText(error, "Der Hinweis konnte nicht zurückgezogen werden."));
}

/** „heute 14:05“, „gestern 9:30“, „Mo, 3.11. 6:15“ – deutsche Zeit. */
export function wannText(iso: string, jetzt = new Date()): string {
  const d = new Date(iso);
  const tag = (x: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(x);
  const uhr = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", minute: "2-digit" }).format(d);
  const heute = tag(jetzt);
  const morgen = new Date(jetzt.getTime() + 86_400_000);
  const gestern = new Date(jetzt.getTime() - 86_400_000);
  if (tag(d) === heute) return `heute ${uhr}`;
  if (tag(d) === tag(morgen)) return `morgen ${uhr}`;
  if (tag(d) === tag(gestern)) return `gestern ${uhr}`;
  const datum = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(d);
  return `${datum} ${uhr}`;
}
