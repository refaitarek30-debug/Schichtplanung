"use client";

import { useEffect } from "react";
import { melde } from "@/lib/protokoll-melden";

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
    const beiFehler = (ereignis: ErrorEvent) => {
      const nachricht = ereignis.message || String(ereignis.error ?? "");
      if (!nachricht || belanglos(nachricht)) return;
      void melde("fehler.absturz", nachricht);
    };
    const beiAblehnung = (ereignis: PromiseRejectionEvent) => {
      const grund = ereignis.reason;
      const nachricht =
        grund instanceof Error ? `${grund.name}: ${grund.message}` : String(grund ?? "");
      if (!nachricht || belanglos(nachricht)) return;
      void melde("fehler.absturz", nachricht);
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
