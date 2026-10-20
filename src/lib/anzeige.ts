"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { datenFehlerText } from "@/lib/errors";
import { ANZEIGE_SPEICHER } from "@/lib/anzeige-skript";

/**
 * Persönliche Anzeige (Migration 0174): Wochenende hervorheben, Schichtplan
 * kompakt oder groß, eigene Farben im Schichtplan. Gespeichert im Konto,
 * damit es auf jedem Gerät gleich aussieht – und zusätzlich auf dem Gerät,
 * damit die Seite schon beim ersten Zeichnen richtig aussieht.
 */

export type Wochenende = "aus" | "leicht" | "kraeftig";
export type PlanAnsicht = "kompakt" | "gross";

export interface Anzeige {
  wochenende: Wochenende;
  planAnsicht: PlanAnsicht;
  planEigeneFarben: boolean;
}

export const STANDARD_ANZEIGE: Anzeige = { wochenende: "leicht", planAnsicht: "kompakt", planEigeneFarben: false };
const SPEICHER = ANZEIGE_SPEICHER;

function gueltig(roh: unknown): Anzeige {
  const a = (roh ?? {}) as Partial<Anzeige>;
  return {
    wochenende: a.wochenende === "aus" || a.wochenende === "kraeftig" ? a.wochenende : "leicht",
    planAnsicht: a.planAnsicht === "gross" ? "gross" : "kompakt",
    planEigeneFarben: a.planEigeneFarben === true,
  };
}

/** Wochenende als Attribut am <html>-Element – die Farben macht globals.css. */
function anwenden(a: Anzeige) {
  document.documentElement.setAttribute("data-wochenende", a.wochenende);
}

// ---- Gemeinsamer Stand für alle Bausteine einer Seite -----------------------

let stand: Anzeige | null = null;
let geladen = false;
const hoerer = new Set<() => void>();

function ausSpeicher(): Anzeige {
  try {
    return gueltig(JSON.parse(window.localStorage.getItem(SPEICHER) ?? "{}"));
  } catch {
    return STANDARD_ANZEIGE;
  }
}

function setzeStand(neu: Anzeige) {
  stand = neu;
  anwenden(neu);
  try {
    window.localStorage.setItem(SPEICHER, JSON.stringify(neu));
  } catch {
    // Ohne Gerätespeicher gilt es eben nur bis zum Neuladen.
  }
  hoerer.forEach((h) => h());
}

// ---- Einführung: einmal pro Konto, nicht pro Gerät ---------------------------

interface KontoStand {
  geladen: boolean;
  einfuehrungGesehen: boolean;
}
const KONTO_LEER: KontoStand = { geladen: false, einfuehrungGesehen: false };
let kontoStand: KontoStand = KONTO_LEER;

function setzeKonto(neu: KontoStand) {
  kontoStand = neu;
  hoerer.forEach((h) => h());
}

/** Ob das Konto die Einführung schon gesehen hat – erst sicher, wenn `geladen` stimmt. */
export function useEinfuehrungImKonto(): KontoStand {
  return useSyncExternalStore(abonnieren, () => kontoStand, () => KONTO_LEER);
}

export async function setzeEinfuehrungGesehen(): Promise<void> {
  setzeKonto({ geladen: true, einfuehrungGesehen: true });
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return;
    await supabase
      .from("anzeige_einstellungen")
      .upsert({ user_id: userId, einfuehrung_gesehen: true, geaendert_am: new Date().toISOString() }, { onConflict: "user_id" });
  } catch {
    // Dann gilt es zumindest auf diesem Gerät (der Aufrufer merkt es sich zusätzlich lokal).
  }
}

async function ausKonto() {
  geladen = true;
  try {
    const { data, error } = await createClient()
      .from("anzeige_einstellungen")
      .select("wochenende, plan_ansicht, plan_eigene_farben, einfuehrung_gesehen")
      .maybeSingle();
    if (error) return;
    setzeKonto({ geladen: true, einfuehrungGesehen: data?.einfuehrung_gesehen === true });
    if (!data) return;
    setzeStand(
      gueltig({ wochenende: data.wochenende, planAnsicht: data.plan_ansicht, planEigeneFarben: data.plan_eigene_farben }),
    );
  } catch {
    // Ohne Verbindung bleibt der Stand vom Gerät.
  }
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  if (!geladen) void ausKonto();
  return () => hoerer.delete(h);
}

function lesen(): Anzeige {
  if (!stand) stand = ausSpeicher();
  return stand;
}

/** Ändern: sofort sichtbar, dann im Konto gespeichert. Wirft bei Fehler. */
export async function setzeAnzeige(teil: Partial<Anzeige>): Promise<void> {
  const vorher = lesen();
  const neu = gueltig({ ...vorher, ...teil });
  setzeStand(neu);
  const supabase = createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;
  const { error } = await supabase.from("anzeige_einstellungen").upsert(
    {
      user_id: userId,
      wochenende: neu.wochenende,
      plan_ansicht: neu.planAnsicht,
      plan_eigene_farben: neu.planEigeneFarben,
      geaendert_am: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    setzeStand(vorher);
    throw new Error(datenFehlerText(error, "Die Einstellung konnte nicht gespeichert werden."));
  }
}

export function useAnzeige(): Anzeige {
  return useSyncExternalStore(abonnieren, lesen, () => STANDARD_ANZEIGE);
}
