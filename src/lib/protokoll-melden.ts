"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type MeldeArt = "abmeldung.inaktiv" | "fehler.anzeige" | "fehler.absturz";

/** Je Seitenaufruf höchstens so viele Meldungen – der Rest wäre Wiederholung. */
const HOECHSTENS = 20;

const gemeldet = new Set<string>();

const OEFFENTLICH = [
  "/login",
  "/registrieren",
  "/passwort",
  "/einladung",
  "/impressum",
  "/datenschutz",
  "/nutzungsbedingungen",
  "/avv",
];

/** Seiten ohne Anmeldung: dort gibt es niemanden, dem eine Meldung gehört. */
function oeffentlicheSeite(pfad: string): boolean {
  return (
    pfad === "/" ||
    OEFFENTLICH.some((p) => pfad === p || pfad.startsWith(`${p}/`) || pfad.startsWith(`${p}-`))
  );
}

/**
 * Etwas ins Protokoll melden. Läuft nebenher: Fehler beim Melden werden
 * verschluckt, dieselbe Meldung auf derselben Seite geht nur einmal raus.
 * Die Datenbank begrenzt zusätzlich auf 40 Meldungen je Person und zehn
 * Minuten.
 */
export function melde(art: MeldeArt, text: string | null): Promise<void> {
  if (!isSupabaseConfigured || typeof window === "undefined") return Promise.resolve();
  const seite = window.location.pathname;
  if (oeffentlicheSeite(seite)) return Promise.resolve();

  const schluessel = `${art}|${seite}|${text ?? ""}`;
  if (gemeldet.has(schluessel) || gemeldet.size >= HOECHSTENS) return Promise.resolve();
  gemeldet.add(schluessel);

  try {
    return Promise.resolve(
      createClient().rpc("protokoll_melden", {
        p_art: art,
        p_text: text ? text.slice(0, 500) : null,
        p_seite: seite,
      }),
    ).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}
