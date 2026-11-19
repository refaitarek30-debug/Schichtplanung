"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, User, X } from "lucide-react";

/**
 * Unter der Anmeldekarte steht nur „Registrieren“. Erst ein Tipp darauf
 * öffnet die Auswahl: Privat (kostenlos) oder Unternehmen.
 */
export function RegistrierenWahl() {
  const [offen, setOffen] = useState(false);
  const schliessen = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!offen) return;
    schliessen.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOffen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [offen]);

  return (
    <>
      <div className="border-t border-line pt-5 text-center">
        <p className="text-[14px] text-ink-muted">Noch kein Konto?</p>
        <button
          type="button"
          onClick={() => setOffen(true)}
          aria-haspopup="dialog"
          data-registrieren
          className="mt-2.5 h-12 w-full rounded-2xl border border-line bg-surface text-[15px] font-semibold text-ink transition-colors hover:bg-surface-sunken active:bg-surface-sunken"
        >
          Registrieren
        </button>
      </div>

      {offen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-registrieren-wahl>
          <button type="button" aria-label="Schließen" className="absolute inset-0 bg-black/45" onClick={() => setOffen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="registrieren-titel"
            className="relative w-full max-w-[440px] rounded-t-[28px] bg-surface px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="registrieren-titel" className="text-[19px] font-semibold tracking-tight">
                Wie möchtest du starten?
              </h2>
              <button
                ref={schliessen}
                type="button"
                aria-label="Schließen"
                onClick={() => setOffen(false)}
                className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <Link href="/privat/registrieren" className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-muted">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <User className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-semibold">Privat</span>
                  <span className="block text-[13px] text-ink-muted">Dein eigener Schichtkalender – kostenlos.</span>
                </span>
              </Link>
              <Link href="/registrieren" className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-muted">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15.5px] font-semibold">Unternehmen</span>
                  <span className="block text-[13px] text-ink-muted">Schichtplan, Urlaub und Besetzung für deinen Betrieb.</span>
                </span>
              </Link>
            </div>

            <p className="mt-4 text-center text-[12.5px] leading-relaxed text-ink-faint">
              Im Betrieb angestellt? Deinen Zugang bekommst du per Einladung von deiner Schichtleitung.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
