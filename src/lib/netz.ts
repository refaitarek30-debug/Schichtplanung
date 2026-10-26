"use client";

import { useSyncExternalStore } from "react";

function abonnieren(aufruf: () => void) {
  window.addEventListener("online", aufruf);
  window.addEventListener("offline", aufruf);
  return () => {
    window.removeEventListener("online", aufruf);
    window.removeEventListener("offline", aufruf);
  };
}

/** Hat das Gerät gerade Netz? Auf dem Server und beim ersten Zeichnen: ja. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    abonnieren,
    () => navigator.onLine,
    () => true,
  );
}

/** Ohne Hook, z. B. in einem Fehler-Zweig. */
export function istOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
