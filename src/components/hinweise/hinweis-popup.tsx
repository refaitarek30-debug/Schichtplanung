"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionOptional } from "@/context/session";
import { fetchMeineHinweise, hinweisGelesen, wannText, zielLabel, type MeinHinweis } from "@/lib/data/hinweise";

/**
 * Zeigt ungelesene Hinweise der Schichtleitung als Fenster – beim Öffnen der
 * App und wenn sie wieder in den Vordergrund kommt. Einer nach dem anderen;
 * „Verstanden“ (oder der Knopf zum Ziel) markiert ihn als gelesen.
 */
export function HinweisPopup() {
  const session = useSessionOptional();
  const live = session?.mode === "live";
  const router = useRouter();
  const [offen, setOffen] = useState<MeinHinweis[]>([]);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    try {
      setOffen(await fetchMeineHinweise());
    } catch {
      // Still bleiben: ein Hinweis kommt beim nächsten Öffnen wieder.
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    void laden();
    const sichtbar = () => {
      if (document.visibilityState === "visible") void laden();
    };
    document.addEventListener("visibilitychange", sichtbar);
    // Hinweise „zur Arbeitszeit“ werden erst ab Schichtbeginn sichtbar – bleibt
    // die App offen, alle 10 Minuten kurz nachsehen (nur im Vordergrund).
    const uhr = window.setInterval(sichtbar, 10 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", sichtbar);
      window.clearInterval(uhr);
    };
  }, [live, laden]);

  const h = offen[0];
  if (!h) return null;

  async function erledigt(weiter?: string) {
    if (!h) return;
    setBusy(true);
    try {
      await hinweisGelesen(h.id);
    } catch {
      // Lokal trotzdem schließen; der Server zeigt ihn sonst beim nächsten Mal erneut.
    }
    setOffen((alt) => alt.filter((x) => x.id !== h.id));
    setBusy(false);
    if (weiter) router.push(weiter);
  }

  const knopf = zielLabel(h.ziel);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-3 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hinweis-titel"
        aria-describedby="hinweis-text"
        className="w-full max-w-sm rounded-[24px] bg-surface p-5 shadow-xl mb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p id="hinweis-titel" className="text-[16px] font-semibold leading-tight">
              Hinweis von {h.vonName || "deiner Schichtleitung"}
            </p>
            <p className="text-[12.5px] text-ink-muted">
              {wannText(h.erstelltAm)}
              {offen.length > 1 ? ` · 1 von ${offen.length}` : ""}
            </p>
          </div>
        </div>
        <p id="hinweis-text" className="mt-4 whitespace-pre-line text-[15.5px] leading-relaxed">
          {h.text}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {knopf && h.ziel ? (
            <Button onClick={() => void erledigt(h.ziel!)} disabled={busy}>
              {knopf}
            </Button>
          ) : null}
          <Button variant={knopf ? "ghost" : "primary"} onClick={() => void erledigt()} disabled={busy}>
            Verstanden
          </Button>
        </div>
      </div>
    </div>
  );
}
