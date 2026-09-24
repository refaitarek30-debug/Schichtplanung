"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { beobachteLadesperre, installiereLadesperre } from "@/lib/ladesperre";
import { cn } from "@/lib/utils";

/**
 * Legt sich über die Seite, solange etwas gespeichert wird.
 *
 * Sofort unsichtbar, aber klickdicht – so geht kein zweiter Tipp durch.
 * Erst wenn es länger als einen Moment dauert, erscheint ein Ladesymbol,
 * damit schnelle Aktionen nicht flackern.
 */
export function LadeSperre() {
  const [laufend, setLaufend] = useState(0);
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    // Serveraktionen gehen über window.fetch – einmal je Tab umbauen.
    installiereLadesperre();
    return beobachteLadesperre(setLaufend);
  }, []);

  useEffect(() => {
    if (laufend === 0) {
      setSichtbar(false);
      return;
    }
    const uhr = window.setTimeout(() => setSichtbar(true), 400);
    return () => window.clearTimeout(uhr);
  }, [laufend]);

  if (laufend === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[70] flex items-center justify-center transition-colors",
        sichtbar ? "bg-black/25 backdrop-blur-[1px]" : "bg-transparent",
      )}
    >
      {sichtbar ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-sm font-medium shadow-pop">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" strokeWidth={2.2} />
          Wird gespeichert … bitte kurz warten
        </div>
      ) : null}
    </div>
  );
}
