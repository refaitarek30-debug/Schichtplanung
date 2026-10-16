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
    <div className="privat-schrift fixed inset-0 z-50 flex items-end justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center">
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 cursor-default bg-black/20"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="glas-dicht relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-[30px]"
      >
        <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-ink/15" />
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-2">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-tight">{titel}</h2>
            {unter ? <div className="mt-0.5 text-[13px] text-ink-muted">{unter}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.07] text-ink-muted"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {fuss ? (
          <div className="glas-linie border-t px-5 pb-4 pt-3">{fuss}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
