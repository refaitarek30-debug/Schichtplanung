"use client";

import { useEffect } from "react";
import { useSession } from "@/context/session";
import { PRUEF_ABSTAND_MS, pruefeAenderungen } from "@/lib/live-refresh";

/**
 * Der Taktgeber. Einmal im App-Rahmen eingehängt, nicht je Seite – sonst
 * fragten zwei offene Bereiche doppelt.
 *
 * Siehe `src/lib/live-refresh.ts` für das Warum.
 */
export function LiveRefresh() {
  const { mode } = useSession();

  useEffect(() => {
    if (mode !== "live") return;

    const sichtbar = () => document.visibilityState === "visible";
    let uhr: number | undefined;

    const takt = () => {
      if (sichtbar()) void pruefeAenderungen();
    };

    function starten() {
      window.clearInterval(uhr);
      uhr = window.setInterval(takt, PRUEF_ABSTAND_MS);
    }

    // Ausgangsstand festhalten, damit der erste echte Vergleich etwas hat.
    void pruefeAenderungen();
    starten();

    // Zurück aus dem Hintergrund: sofort fragen und den Takt neu beginnen,
    // statt bis zu 60 Sekunden auf den nächsten Schlag zu warten.
    function beiSichtwechsel() {
      if (sichtbar()) {
        void pruefeAenderungen();
        starten();
      }
    }
    // iOS meldet das Zurückkehren einer vom Home-Bildschirm gestarteten App
    // nicht immer als visibilitychange; pageshow und focus fangen das auf.
    window.addEventListener("focus", beiSichtwechsel);
    window.addEventListener("pageshow", beiSichtwechsel);
    window.addEventListener("online", beiSichtwechsel);
    document.addEventListener("visibilitychange", beiSichtwechsel);

    return () => {
      window.clearInterval(uhr);
      window.removeEventListener("focus", beiSichtwechsel);
      window.removeEventListener("pageshow", beiSichtwechsel);
      window.removeEventListener("online", beiSichtwechsel);
      document.removeEventListener("visibilitychange", beiSichtwechsel);
    };
  }, [mode]);

  return null;
}
