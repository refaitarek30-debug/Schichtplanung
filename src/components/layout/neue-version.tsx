"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const EIGENE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "lokal";
const ABSTAND_MS = 60_000;
const MINDESTABSTAND_MS = 5_000;

/**
 * Hinweis „Neue Version verfügbar“.
 *
 * Wer die App offen hat, während ein Update live geht, behält die alte
 * Fassung im Browser. Speichern über ein Formular, das es nicht mehr gibt,
 * schlägt dann fehl. Deshalb fragt die App jede Minute (nur sichtbar) und
 * beim Zurückkehren, welcher Build ausgeliefert wird. Weicht er ab, steht
 * oben ein Hinweis mit „Neu laden“. Bewusst kein automatisches Neuladen:
 * eine halb ausgefüllte Eingabe soll nicht verloren gehen.
 */
export function NeueVersionHinweis() {
  const [neu, setNeu] = useState(false);

  useEffect(() => {
    if (EIGENE_VERSION === "lokal") return;
    let zuletzt = 0;
    let gefunden = false;

    async function pruefen() {
      if (gefunden || document.visibilityState !== "visible") return;
      if (Date.now() - zuletzt < MINDESTABSTAND_MS) return;
      zuletzt = Date.now();
      try {
        const antwort = await fetch("/api/version", { cache: "no-store" });
        if (!antwort.ok) return;
        const { version } = (await antwort.json()) as { version?: string };
        if (version && version !== "lokal" && version !== EIGENE_VERSION) {
          gefunden = true;
          setNeu(true);
        }
      } catch {
        // Kein Netz: beim nächsten Takt wieder.
      }
    }

    const uhr = window.setInterval(pruefen, ABSTAND_MS);
    window.addEventListener("focus", pruefen);
    window.addEventListener("online", pruefen);
    document.addEventListener("visibilitychange", pruefen);
    return () => {
      window.clearInterval(uhr);
      window.removeEventListener("focus", pruefen);
      window.removeEventListener("online", pruefen);
      document.removeEventListener("visibilitychange", pruefen);
    };
  }, []);

  if (!neu) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[4.5rem] z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border border-brand-600 bg-surface py-1.5 pl-4 pr-1.5 text-[13px] shadow-pop"
    >
      <span className="font-medium">Neue Version verfügbar</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700"
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} />
        Neu laden
      </button>
    </div>
  );
}
