import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import type { StaffingRuleRow } from "@/lib/supabase/database.types";
import type { LiveLeaveBlock } from "@/lib/types";

export class DataError extends Error {}

/** Urlaubssperren des eigenen Unternehmens (key = 'urlaubssperre'). */
export async function fetchLeaveBlocks(): Promise<LiveLeaveBlock[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_rules")
    .select("id, shift_id, value, active")
    .eq("key", "urlaubssperre")
    .eq("active", true)
    .order("id", { ascending: true })
    .returns<Pick<StaffingRuleRow, "id" | "shift_id" | "value" | "active">[]>();

  if (error) throw new DataError(dataErrorMessage(error) ?? "Unbekannter Fehler");
  return (data ?? []).map((row) => ({
    id: row.id,
    shiftId: row.shift_id,
    startDate: row.value.start,
    endDate: row.value.end,
    reason: row.value.reason,
  }));
}

/** Die betriebsweiten Regelwerte aus `staffing_rules`. */
export interface CompanyRules {
  /** Mindestruhezeit zwischen zwei Einsätzen, in Stunden. */
  ruhezeitStunden: number;
  /** Höchstdauer eines geplanten Einsatzes, in Stunden. */
  maxSchichtdauerStunden: number;
  /** Umrechnung Tage → Stunden in der Auswertung. */
  stundenProArbeitstag: number;
  /** Zielwert der Gesundheitsrate in Prozent. */
  gesundheitsrateZiel: number;
  /** Jahresobergrenze Sonderurlaub, in Tagen je Person. */
  sonderurlaubTageJahr: number;
  /** Jahresobergrenze Bildungsurlaub, in Tagen je Person. */
  bildungsurlaubTageJahr: number;
  /** Jahresobergrenze Gewerkschaftstage, in Tagen je Person. */
  gewerkschaftstagTageJahr: number;
}

const VORGABE: CompanyRules = {
  ruhezeitStunden: 11,
  maxSchichtdauerStunden: 8,
  stundenProArbeitstag: 8,
  gesundheitsrateZiel: 96,
  // Startwerte, kein Rechtsrat: massgeblich ist, was der Betrieb einträgt.
  sonderurlaubTageJahr: 3,
  bildungsurlaubTageJahr: 5,
  gewerkschaftstagTageJahr: 1,
};

/**
 * Betriebsregeln lesen.
 *
 * Die Werte stehen in `staffing_rules`, derselben Tabelle wie die
 * Urlaubssperren – eine eigene Tabelle wäre eine zweite Wahrheit für
 * dieselbe Sache. Fehlt ein Eintrag, gilt die Vorgabe; dieselben Werte
 * setzt auch `company_rule_number()` in der Datenbank ein, damit Anzeige
 * und Berechnung nicht auseinanderlaufen.
 */
export async function fetchCompanyRules(): Promise<CompanyRules> {
  if (!isSupabaseConfigured) return VORGABE;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("staffing_rules")
    .select("key, value, shift_id, active")
    .is("shift_id", null)
    .eq("active", true);

  // Ein Ladefehler soll die Seite nicht blockieren – dann gelten die
  // Vorgaben, und die Auswertung rechnet trotzdem richtig, weil die
  // Datenbank ihre eigenen Werte benutzt.
  if (error) return VORGABE;

  const werte = new Map<string, Record<string, unknown>>();
  for (const zeile of (data ?? []) as { key: string; value: Record<string, unknown> }[]) {
    werte.set(zeile.key, zeile.value);
  }

  const zahl = (key: string, feld: string, vorgabe: number) => {
    const roh = werte.get(key)?.[feld];
    const n = Number(roh);
    return Number.isFinite(n) ? n : vorgabe;
  };

  return {
    ruhezeitStunden: zahl("ruhezeit_stunden", "stunden", VORGABE.ruhezeitStunden),
    maxSchichtdauerStunden: zahl(
      "max_schichtdauer_stunden",
      "stunden",
      VORGABE.maxSchichtdauerStunden,
    ),
    stundenProArbeitstag: zahl("stunden_pro_arbeitstag", "stunden", VORGABE.stundenProArbeitstag),
    gesundheitsrateZiel: zahl("gesundheitsrate_ziel", "prozent", VORGABE.gesundheitsrateZiel),
    sonderurlaubTageJahr: zahl("sonderurlaub_tage_jahr", "tage", VORGABE.sonderurlaubTageJahr),
    bildungsurlaubTageJahr: zahl(
      "bildungsurlaub_tage_jahr",
      "tage",
      VORGABE.bildungsurlaubTageJahr,
    ),
    gewerkschaftstagTageJahr: zahl(
      "gewerkschaftstag_tage_jahr",
      "tage",
      VORGABE.gewerkschaftstagTageJahr,
    ),
  };
}
