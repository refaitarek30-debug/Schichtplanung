"use client";

import { useEffect } from "react";

/**
 * Meldet den Service Worker an. Rendert nichts – steht nur im Layout, damit
 * die Registrierung genau einmal pro Seitenaufruf passiert.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Ohne Service Worker läuft die Anwendung ganz normal weiter.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    // Der Kalender kam vom Gerät, inzwischen gibt es aber eine neue App-Fassung (sw.js meldet
    // „neue-fassung“): gleich nach dem Öffnen einmal neu laden, damit Neuerungen sofort da sind.
    // Später nicht mehr – dann soll nichts mitten in der Benutzung springen.
    const nachricht = (e: MessageEvent) => {
      if ((e.data as { typ?: string } | null)?.typ === "neue-fassung" && performance.now() < 15_000) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("message", nachricht);
    return () => navigator.serviceWorker.removeEventListener("message", nachricht);
  }, []);

  return null;
}
