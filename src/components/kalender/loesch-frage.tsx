"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Rückfrage vor dem Löschen von Schichten (Kalender privat und Firma):
 * frage({ titel, text, onJa }) öffnet ein kleines Fenster über allem, auch
 * über offenen Blättern. „Abbrechen“, Escape und ein Tipp daneben lassen
 * alles wie es ist.
 */
interface Frage {
  titel: string;
  text?: string;
  knopf?: string;
  onJa: () => void;
}

export function useLoeschFrage() {
  const [frage, setFrage] = useState<Frage | null>(null);
  return {
    frage: (f: Frage) => setFrage(f),
    fenster: frage ? (
      <LoeschFenster
        frage={frage}
        onNein={() => setFrage(null)}
        onJa={() => {
          setFrage(null);
          frage.onJa();
        }}
      />
    ) : null,
  };
}

function LoeschFenster({ frage, onJa, onNein }: { frage: Frage; onJa: () => void; onNein: () => void }) {
  const nein = useRef<HTMLButtonElement>(null);
  const abbrechen = useRef(onNein);
  useEffect(() => {
    abbrechen.current = onNein;
  });
  useEffect(() => {
    nein.current?.focus();
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Nur die Frage schließen, nicht auch das Blatt darunter.
      e.stopPropagation();
      abbrechen.current();
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, []);

  return createPortal(
    <div className="privat-schrift fixed inset-0 z-[80] flex items-center justify-center px-6">
      <button type="button" aria-label="Abbrechen" tabIndex={-1} onClick={onNein} className="absolute inset-0 bg-black/35" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="loesch-frage-titel"
        className="relative w-full max-w-xs rounded-[22px] bg-surface p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
      >
        <p id="loesch-frage-titel" className="text-[17px] font-semibold leading-snug">
          {frage.titel}
        </p>
        {frage.text ? <p className="mt-1.5 text-[14px] leading-snug text-ink-muted">{frage.text}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            ref={nein}
            type="button"
            onClick={onNein}
            className="rounded-[14px] bg-ink/[0.07] px-3 py-3 text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onJa}
            className="rounded-[14px] bg-[#e5484d] px-3 py-3 text-[15px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {frage.knopf ?? "Löschen"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
