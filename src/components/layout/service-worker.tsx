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
  }, []);

  return null;
}
