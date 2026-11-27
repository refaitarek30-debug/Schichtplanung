"use client";

import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { fetchVerbundenHinweise, verbundenHinweiseGesehen, type VerbundenHinweis } from "@/lib/data/verbindungen";
import { cn } from "@/lib/utils";

/**
 * Verbundene Personen klingeln höchstens dreimal (Migration 0248). Was danach
 * kam, steht beim Öffnen hier als kleiner Hinweis – die Einträge selbst sind
 * schon im Kalender.
 */
export function VerbundenHinweisStreifen({ className }: { className?: string }) {
  const [liste, setListe] = useState<VerbundenHinweis[]>([]);

  useEffect(() => {
    let aktiv = true;
    const laden = () => {
      if (document.visibilityState !== "visible") return;
      fetchVerbundenHinweise()
        .then((l) => aktiv && setListe(l))
        .catch(() => undefined); // nur ein Hinweis – ohne Netz einfach nicht zeigen
    };
    laden();
    document.addEventListener("visibilitychange", laden);
    return () => {
      aktiv = false;
      document.removeEventListener("visibilitychange", laden);
    };
  }, []);

  if (liste.length === 0) return null;

  function zu() {
    setListe([]);
    void verbundenHinweiseGesehen().catch(() => undefined);
  }

  const text =
    liste.length === 1
      ? `${liste[0].name} hat noch ${liste[0].anzahl} weitere ${liste[0].anzahl === 1 ? "Änderung" : "Änderungen"} bei dir gemacht.`
      : `Weitere Änderungen bei dir: ${liste.map((h) => `${h.name} ${h.anzahl}`).join(", ")}.`;

  return (
    <div data-verbunden-hinweis role="status" className={cn("glas mx-3.5 mb-2 flex min-h-11 items-center rounded-[14px] sm:mx-0", className)}>
      <span className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
        <Users className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 px-2.5 py-2 text-[13.5px] font-semibold leading-snug">{text}</span>
      <button
        type="button"
        onClick={zu}
        aria-label="Hinweis schließen"
        className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted active:bg-black/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
