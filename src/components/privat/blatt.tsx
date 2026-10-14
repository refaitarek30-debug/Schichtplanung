"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Blatt von unten (Handy) bzw. Fenster in der Mitte (Desktop). An den Body
 * gehängt, damit es über der Leiste unten liegt.
 */
export function Blatt({
  titel,
  unter,
  onClose,
  children,
  fuss,
}: {
  titel: ReactNode;
  unter?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  fuss?: ReactNode;
}) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Schließen" className="absolute inset-0 cursor-default bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-tight">{titel}</h2>
            {unter ? <div className="mt-0.5 text-[13px] text-ink-muted">{unter}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="-mr-1 rounded-full p-1.5 text-ink-muted hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {fuss ? (
          <div className="border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{fuss}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
