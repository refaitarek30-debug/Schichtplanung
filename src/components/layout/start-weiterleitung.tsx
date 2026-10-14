"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { startPfad } from "@/lib/start-seite";

/**
 * Auffangnetz für die Startseite.
 *
 * Normalerweise führt /start auf die gewählte Seite. Wer die App aber über
 * ein altes Lesezeichen oder ein bereits installiertes Symbol öffnet, landet
 * noch auf /dashboard. Beim ersten Aufruf je Browser-Sitzung wird deshalb
 * einmal weitergeleitet – danach nie wieder, damit „Start“ im Menü das
 * Dashboard zeigt und nicht ständig zurückspringt.
 */
export function StartWeiterleitung({ startSeite }: { startSeite: string | null }) {
  const pfad = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("sp_start_geprueft")) return;
      window.sessionStorage.setItem("sp_start_geprueft", "1");
    } catch {
      return; // ohne Speicher lieber nicht umleiten – sonst Endlosschleife möglich
    }
    const ziel = startPfad(startSeite);
    if (pfad === "/dashboard" && ziel !== "/dashboard") router.replace(ziel);
    // Nur beim ersten Laden der App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
