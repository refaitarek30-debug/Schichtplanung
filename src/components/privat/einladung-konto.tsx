"use client";

import Link from "next/link";
import { PrivatRegistrierung } from "./registrierung";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Konto anlegen direkt aus einer Einladung: Spitzname und Passwort, danach
 * geht es zurück zum Link (weiter) – dort wird verbunden bzw. beigetreten.
 * Wer schon ein Konto hat, meldet sich an und landet ebenfalls wieder hier.
 */
export function EinladungKonto({ weiter, knopf }: { weiter: string; knopf: string }) {
  return (
    <div className="text-left">
      <p className="text-center text-[13px] text-ink-muted">Nur Spitzname und Passwort – keine E-Mail nötig.</p>
      <PrivatRegistrierung disabled={!isSupabaseConfigured} weiter={weiter} knopf={knopf} />
      <p className="mt-4 text-center text-[14px] text-ink-muted">
        Schon ein Konto?{" "}
        <Link href={`/login?weiter=${encodeURIComponent(weiter)}`} className="font-semibold text-brand-600">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
