"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type WischModus = boolean | "kopf";

/**
 * Nach unten wischen schließt das Blatt (`"kopf"`: nur am Griff und Titel):
 * Es folgt dem Finger und gleitet hinaus – oder federt zurück, wenn man nicht
 * weit genug gezogen hat. Liegt der Inhalt gescrollt, scrollt er erst; ganz
 * oben zieht der nächste Wisch das Blatt zu.
 */
export function useWischZu(blatt: React.RefObject<HTMLElement | null>, modus: WischModus, onClose: () => void) {
  const aktiv = modus !== false;
  const nurKopf = modus === "kopf";
  const zu = useRef(onClose);
  useEffect(() => {
    zu.current = onClose;
  });

  useEffect(() => {
    const el = blatt.current;
    if (!el || !aktiv) return;
    let s: { x: number; y: number; scroller: HTMLElement | null; ziehen: boolean; dy: number; v: number; letztY: number; letztT: number } | null = null;

    const scrollerVon = (ziel: EventTarget | null): HTMLElement | null => {
      for (let n = ziel as HTMLElement | null; n && n !== el; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
      }
      return null;
    };
    const setze = (y: number, dauer = 0) => {
      el.style.transition = dauer ? `transform ${dauer}ms cubic-bezier(.22,1,.36,1)` : "none";
      el.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
    };

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      // Formulare: nur am Griff und an der Titelzeile ziehen – nie mitten in Eingaben.
      if (nurKopf && !(e.target as Element | null)?.closest?.("[data-wisch-kopf]")) return;
      const t = e.touches[0]!;
      s = { x: t.clientX, y: t.clientY, scroller: scrollerVon(e.target), ziehen: false, dy: 0, v: 0, letztY: t.clientY, letztT: e.timeStamp };
    };
    const bewegt = (e: TouchEvent) => {
      if (!s) return;
      const t = e.touches[0]!;
      const dy = t.clientY - s.y;
      const dx = t.clientX - s.x;
      if (!s.ziehen) {
        // Nach oben, zur Seite oder gescrollter Inhalt: nicht unsere Geste.
        if (dy < -6 || Math.abs(dx) > 12 || (s.scroller && s.scroller.scrollTop > 0)) {
          s = null;
          return;
        }
        if (dy > 6 && dy > Math.abs(dx) * 1.2) s.ziehen = true;
        else return;
      }
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - s.letztT;
      if (dt > 0) s.v = (t.clientY - s.letztY) / dt;
      s.letztY = t.clientY;
      s.letztT = e.timeStamp;
      s.dy = Math.max(0, dy);
      setze(s.dy);
    };
    const ende = () => {
      const g = s;
      s = null;
      if (!g?.ziehen) return;
      if (g.dy > 90 || (g.v > 0.5 && g.dy > 24)) {
        setze(el.offsetHeight + 40, 170);
        window.setTimeout(() => zu.current(), 150);
      } else {
        setze(0, 220);
      }
    };
    const abbruch = () => {
      const g = s;
      s = null;
      if (g?.ziehen) setze(0, 220);
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", bewegt, { passive: false });
    el.addEventListener("touchend", ende);
    el.addEventListener("touchcancel", abbruch);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", bewegt);
      el.removeEventListener("touchend", ende);
      el.removeEventListener("touchcancel", abbruch);
    };
  }, [blatt, aktiv, nurKopf]);
}

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
  wischZu = true,
}: {
  titel: ReactNode;
  unter?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  fuss?: ReactNode;
  /** Nach unten wischen schließt. Formulare setzen "kopf": gezogen wird nur am Griff und Titel. */
  wischZu?: WischModus;
}) {
  const blatt = useRef<HTMLDivElement>(null);
  useWischZu(blatt, wischZu, onClose);
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
        ref={blatt}
        role="dialog"
        aria-modal="true"
        className="glas-dicht relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-[30px]"
      >
        <span aria-hidden data-wisch-kopf className="mx-auto mt-2 block h-1.5 w-10 shrink-0 rounded-full bg-ink/15" />
        <div data-wisch-kopf className="flex items-start justify-between gap-3 px-5 pb-2 pt-2">
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
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 pt-2">{children}</div>
        {fuss ? (
          <div className="glas-linie border-t px-5 pb-4 pt-3">{fuss}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
