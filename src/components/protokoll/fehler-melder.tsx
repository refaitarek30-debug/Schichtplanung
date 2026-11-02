"use client";

import { useEffect } from "react";
import { melde } from "@/lib/protokoll-melden";
import {
  darfNachAnmeldungNeuLaden,
  holeUnlesbareAnmeldung,
  istKeineAntwort,
} from "@/lib/anmelde-aussetzer";

/**
 * Meldet eine angezeigte Fehlermeldung einmal ins Protokoll. Steht in
 * `Alert` (tone="error") – so landet jede Fehlermeldung der App dort, ohne
 * dass jede Seite einzeln daran denken muss.
 */
export function FehlerAnzeigeMelden({ text }: { text: string }) {
  useEffect(() => {
    void melde("fehler.anzeige", text);
  }, [text]);
  return null;
}

/** Diese Meldungen sagen nichts über die App – Browser-Eigenheiten. */
function belanglos(nachricht: string): boolean {
  return (
    nachricht === "Script error." ||
    nachricht.includes("ResizeObserver loop") ||
    nachricht.includes("AbortError") ||
    nachricht.includes("The user aborted a request")
  );
}

/**
 * Technische Fehler im Browser, die sonst niemand mitbekommt: ein Absturz
 * beim Zeichnen einer Seite, ein nicht abgefangener Fehler in einem Abruf.
 */
export function AbsturzMelder() {
  useEffect(() => {
    // Die Anmeldung bekam keine lesbare Antwort und die Zielseite wurde
    // direkt geladen: einmal festhalten, dass es das gab und es geklappt hat.
    if (holeUnlesbareAnmeldung()) {
      void melde(
        "fehler.absturz",
        "Anmeldung: Der Server antwortete nicht lesbar. Die Zielseite wurde direkt geladen, die Anmeldung stand.",
      );
    }

    /**
     * Meldet den Fehler. Direkt nach der Anmeldung (Aussetzer des Servers)
     * lädt die Seite danach einmal neu, damit niemand davon etwas merkt –
     * die Meldung geht vorher raus.
     */
    const melden = (nachricht: string) => {
      if (istKeineAntwort(nachricht) && darfNachAnmeldungNeuLaden()) {
        const warte = new Promise<void>((fertig) => window.setTimeout(fertig, 1500));
        void Promise.race([
          melde("fehler.absturz", `${nachricht} Direkt nach der Anmeldung – Seite einmal automatisch neu geladen.`),
          warte,
        ]).then(() => window.location.reload());
        return;
      }
      void melde("fehler.absturz", nachricht);
    };
    const beiFehler = (ereignis: ErrorEvent) => {
      const nachricht = ereignis.message || String(ereignis.error ?? "");
      if (!nachricht || belanglos(nachricht)) return;
      melden(nachricht);
    };
    const beiAblehnung = (ereignis: PromiseRejectionEvent) => {
      const grund = ereignis.reason;
      const nachricht =
        grund instanceof Error ? `${grund.name}: ${grund.message}` : String(grund ?? "");
      if (!nachricht || belanglos(nachricht)) return;
      melden(nachricht);
    };
    window.addEventListener("error", beiFehler);
    window.addEventListener("unhandledrejection", beiAblehnung);
    return () => {
      window.removeEventListener("error", beiFehler);
      window.removeEventListener("unhandledrejection", beiAblehnung);
    };
  }, []);
  return null;
}
