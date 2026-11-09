"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "@/lib/auth/actions";
import { privatWeitermachen } from "@/lib/auth/bereich-actions";
import { leereZwischenspeicher, vergissGemerkteKalender } from "@/lib/zwischenspeicher";
import { forgetIdentity } from "@/lib/supabase/identity";

/**
 * Nach dem Austritt (Zugang im Betrieb beendet – von Hand oder automatisch am
 * Tag nach dem letzten Arbeitstag): Der Privatbereich wird ohne Frage
 * eingerichtet, die Person landet direkt darin. Dort erscheint einmal ein
 * Hinweis mit dem, was mitgekommen ist, der Datenschutzerklärung und dem Weg
 * zum Löschen (AustrittHinweis im Privatrahmen).
 */
export function PrivatWeiter({ firma }: { firma: string | null; hatPrivat: boolean }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const gestartet = useRef(false);

  function weiter() {
    starte(async () => {
      setFehler(null);
      vergissGemerkteKalender();
      const r = await privatWeitermachen();
      if (r?.error) setFehler(r.error);
    });
  }

  useEffect(() => {
    if (gestartet.current) return;
    gestartet.current = true;
    weiter();
    // Nur einmal beim Öffnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="privat flex min-h-dvh items-center justify-center px-3 py-10">
      <div className="glas w-full max-w-md rounded-[28px] p-6" data-privat-weiter>
        <div className="text-[34px]" aria-hidden>
          🏠
        </div>
        <h1 className="mt-2 text-[24px] font-bold leading-tight">Dein Privatbereich</h1>
        <p className="mt-2 text-[15px] leading-snug text-ink-muted">
          {firma ? `Dein Zugang bei ${firma} ist beendet.` : "Dein Zugang zum Betrieb ist beendet."} Deinen Kalender
          nutzt du privat weiter – kostenlos.
        </p>

        {fehler ? (
          <>
            <p className="mt-3 text-[14px] font-medium text-crit-fg">{fehler}</p>
            <button
              type="button"
              disabled={laeuft}
              onClick={weiter}
              className="mt-4 h-12 w-full rounded-[16px] bg-brand-600 text-[16px] font-semibold text-white disabled:opacity-60"
            >
              {laeuft ? "Einen Moment …" : "Noch einmal versuchen"}
            </button>
          </>
        ) : (
          <p className="mt-4 text-[15px] font-semibold text-ink" aria-live="polite">
            Wird eingerichtet …
          </p>
        )}

        <form
          action={signOut}
          onSubmit={() => {
            leereZwischenspeicher();
            forgetIdentity();
          }}
        >
          <button type="submit" className="mt-3 h-11 w-full rounded-[16px] text-[15px] font-semibold text-ink-muted">
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
