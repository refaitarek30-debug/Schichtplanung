"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type React from "react";
import { createPortal, flushSync } from "react-dom";
import { Eraser, Ellipsis, Paintbrush, Plus, X } from "lucide-react";
import { farbStil } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

/**
 * Gemeinsam für „Mein Kalender“ (Firma) und den Privatkalender: der
 * Pinsel-Knopf unten rechts, die Pinsel-Leiste und das Blättern der Monate
 * durch Wischen nach oben oder unten – mit Bewegung.
 */

/** Runder Pinsel-Knopf unten rechts auf dem Kalender. */
export function PinselKnopf({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Mit dem Pinsel eintragen"
      onClick={onClick}
      className="glas-dicht absolute bottom-4 right-4 z-[5] max-sm:right-7 flex h-12 w-12 items-center justify-center rounded-full text-ink shadow-[0_10px_26px_rgba(31,41,77,0.22)] transition-transform active:scale-95"
    >
      <Paintbrush className="h-[22px] w-[22px]" />
    </button>
  );
}

export interface PinselEintrag {
  id: string;
  name: string;
  kuerzel: string;
  farbe: string;
}

/** Breiter Bildschirm (Computer): dort gibt es keine schwebende untere Leiste. */
function useBreit() {
  return useSyncExternalStore(
    (melde) => {
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", melde);
      return () => m.removeEventListener("change", melde);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

/**
 * Leiste unten: Kreis mit Kürzel und Name je Eintrag, Leeren, Neu; X schließt.
 * Sie schwebt an der Stelle der unteren Leiste und deckt diese zu, solange der
 * Pinsel offen ist – der Kalender darüber behält seine Größe. Sie sitzt direkt
 * im Dokument (Portal), sonst läge die Navigation wegen des eigenen
 * Stapels der Kalenderfläche darüber und finge die Tipps ab.
 */
export function PinselLeiste({
  eintraege,
  aktiv,
  onWahl,
  onNeu,
  onMehr,
  onClose,
  nurHandy,
}: {
  eintraege: PinselEintrag[];
  /** Id des gewählten Eintrags oder "leer" */
  aktiv: string | null;
  onWahl: (id: string) => void;
  /** Neuen Eintrag anlegen (ohne: kein „Neu“). */
  onNeu?: () => void;
  /** Weitere Einstellungen (drei Punkte neben dem X), z. B. „Kalender anpassen“. */
  onMehr?: () => void;
  onClose: () => void;
  /** Am Computer gibt es keine untere Leiste: dort bleibt die Pinsel-Leiste im Seitenrahmen. */
  nurHandy?: boolean;
}) {
  const fach = (an: boolean) =>
    cn(
      "relative flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[22px] px-2.5",
      an && "bg-ink/[0.07]",
    );
  const kreis = (an: boolean) =>
    cn(
      "flex h-[34px] w-[34px] items-center justify-center rounded-full text-[12.5px] font-bold [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7",
      an && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
    );
  const strich = <span aria-hidden className="absolute left-0 top-1/2 h-8 w-px -translate-y-1/2 bg-ink/10" />;
  const breit = useBreit();
  const imFluss = !!nurHandy && breit;

  const leiste = (
    <div
      className={cn(
        "privat-schrift [animation:pinsel-hoch_.24s_cubic-bezier(.2,.8,.2,1)] motion-reduce:[animation:none]",
        imFluss
          ? "relative mt-3 shrink-0"
          : "fixed inset-x-3 bottom-[max(0.6rem,env(safe-area-inset-bottom))] z-[45] mx-auto max-w-md",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Pinsel beenden"
        className="absolute -top-6 right-2 z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_6px_18px_rgba(31,41,77,0.25)]"
      >
        <X className="h-5 w-5" strokeWidth={2.6} />
      </button>
      {onMehr ? (
        <button
          type="button"
          onClick={onMehr}
          aria-label="Kalender anpassen"
          className="absolute -top-6 right-[3.5rem] z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_6px_18px_rgba(31,41,77,0.25)]"
        >
          <Ellipsis className="h-5 w-5" strokeWidth={2.6} />
        </button>
      ) : null}
      <div
        role="toolbar"
        aria-label="Pinsel: Eintrag wählen, dann Tage antippen – oder kurz halten und über die Tage wischen"
        className="glas-dicht glas-voll flex h-[4.4rem] touch-pan-x select-none items-stretch overflow-x-auto overflow-y-hidden overscroll-contain rounded-[28px] px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [@media(max-height:700px)]:h-[4rem]"
      >
        {eintraege.map((a, i) => (
          <button key={a.id} type="button" onClick={() => onWahl(a.id)} aria-pressed={aktiv === a.id} className={fach(aktiv === a.id)}>
            {i > 0 ? strich : null}
            <span className={kreis(aktiv === a.id)} style={farbStil(a.farbe)}>
              {a.kuerzel}
            </span>
            <span className="max-w-[6.5rem] truncate text-[12.5px] font-semibold leading-tight">{a.name}</span>
          </button>
        ))}
        {eintraege.length ? (
          <button type="button" onClick={() => onWahl("leer")} aria-pressed={aktiv === "leer"} className={fach(aktiv === "leer")}>
            {strich}
            <span className={cn(kreis(aktiv === "leer"), "bg-ink/[0.08] text-ink-muted")}>
              <Eraser className="h-4 w-4" />
            </span>
            <span className="text-[12.5px] font-semibold leading-tight">Leeren</span>
          </button>
        ) : null}
        {onNeu ? (
          <button type="button" onClick={onNeu} className={fach(false)}>
            {eintraege.length ? strich : null}
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-dashed border-ink/30 text-ink-muted [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7">
              <Plus className="h-4 w-4" />
            </span>
            <span className="whitespace-nowrap text-[12.5px] font-semibold leading-tight text-ink-muted">
              {eintraege.length ? "Neu" : "Eigenen Eintrag anlegen"}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
  return imFluss ? leiste : createPortal(leiste, document.body);
}

/**
 * Pinsel auf der Monatsfläche. Normales Wischen blättert den Monat (griffe
 * von useMonatWischen laufen weiter mit). Wer einen Tag kurz hält (0,5 s,
 * das Handy vibriert), malt: Jeder überfahrene Tag (Zelle mit data-iso)
 * kommt in den Strich und wird markiert; beim Loslassen geht der ganze
 * Strich auf einmal an onStrich. Ein einfacher Tipp bleibt ein Klick auf die
 * Zelle – den Klick nach einem Strich schluckt geschluckt().
 */
const HALTEN_MS = 500;

export function usePinselStrich(
  onStrich: (tage: string[]) => void,
  monat: ReturnType<typeof useMonatWischen>["griffe"] | ReturnType<typeof useMonatKarussell>["griffe"],
) {
  const strich = useRef<{ id: number; tage: string[]; aktiv: boolean; x: number; y: number; uhr: number | null } | null>(null);
  const [markiert, setMarkiert] = useState<ReadonlySet<string>>(LEER_MENGE);
  const schlucken = useRef(0);
  const fertig = useRef(onStrich);
  useEffect(() => {
    fertig.current = onStrich;
  });

  function tagBei(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-iso]");
    return el?.dataset.iso ?? null;
  }

  function abbrechen() {
    const s = strich.current;
    if (s?.uhr) window.clearTimeout(s.uhr);
    strich.current = null;
    setMarkiert(LEER_MENGE);
  }

  const griffe = {
    onPointerDown: (e: React.PointerEvent) => {
      monat.onPointerDown(e);
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const iso = (e.target as Element).closest<HTMLElement>("[data-iso]")?.dataset.iso;
      if (!iso) return;
      abbrechen();
      const s = { id: e.pointerId, tage: [iso], aktiv: false, x: e.clientX, y: e.clientY, uhr: null as number | null };
      s.uhr = window.setTimeout(() => {
        s.uhr = null;
        if (strich.current !== s) return;
        s.aktiv = true;
        // Das Blättern abbrechen: die Fläche springt zurück, der Finger malt.
        monat.onPointerCancel();
        setMarkiert(new Set(s.tage));
        try {
          navigator.vibrate?.(12);
        } catch {
          // ohne Vibration
        }
      }, HALTEN_MS);
      strich.current = s;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = strich.current;
      if (s?.aktiv && s.id === e.pointerId) {
        const iso = tagBei(e.clientX, e.clientY);
        if (!iso || s.tage.includes(iso)) return;
        s.tage.push(iso);
        setMarkiert(new Set(s.tage));
        return;
      }
      // Vor Ablauf der Haltezeit bewegt: Das ist Wischen, kein Malen.
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) abbrechen();
      monat.onPointerMove(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = strich.current;
      if (s?.aktiv && s.id === e.pointerId) {
        strich.current = null;
        setMarkiert(LEER_MENGE);
        schlucken.current = Date.now();
        fertig.current(s.tage);
        return;
      }
      abbrechen();
      monat.onPointerUp(e);
    },
    onPointerCancel: () => {
      abbrechen();
      monat.onPointerCancel();
    },
  };

  return {
    griffe,
    markiert,
    /** Der Klick direkt nach einem Strich gehört schon zum Strich. */
    geschluckt: () => Date.now() - schlucken.current < 600,
  };
}

const LEER_MENGE: ReadonlySet<string> = new Set();

/**
 * Monate blättern durch Wischen nach oben (weiter) oder unten (zurück). Die
 * Fläche folgt dem Finger, gleitet beim Blättern hinaus und der neue Monat
 * von der anderen Seite herein. Bei „Bewegung reduzieren“ ohne Animation.
 */
export function useMonatWischen(springe: (schritt: number) => void) {
  const flaeche = useRef<HTMLDivElement>(null);
  const wisch = useRef<{ x: number; y: number; senkrecht: boolean; h: number; letztY: number; letztT: number; v: number } | null>(null);
  const gewischt = useRef(false);
  const blaettert = useRef(false);
  const bild = useRef<number | null>(null);

  function setze(y: number, h: number, dauer = 0, kurve = "cubic-bezier(.22,1,.36,1)") {
    const el = flaeche.current;
    if (!el) return;
    el.style.transition = dauer ? `transform ${dauer}ms ${kurve}, opacity ${dauer}ms ${kurve}` : "none";
    el.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
    el.style.opacity = y ? String(Math.max(0, 1 - Math.abs(y) / (h * 0.5))) : "";
  }

  function blaettern(schritt: number, ab = 0) {
    const el = flaeche.current;
    const ruhig = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || ruhig || blaettert.current) {
      if (el) setze(0, 1);
      springe(schritt);
      return;
    }
    blaettert.current = true;
    const h = el.offsetHeight || 1;
    const weg = h * 0.24;
    // Vom aktuellen Stand aus weiter hinaus – je näher am Ziel, desto kürzer.
    const rest = Math.max(0.25, 1 - Math.abs(ab) / weg);
    const raus = Math.round(55 + 60 * rest);
    setze(schritt > 0 ? -weg : weg, h, raus, "cubic-bezier(.4,0,1,1)");
    window.setTimeout(() => {
      springe(schritt);
      setze(schritt > 0 ? h * 0.1 : -h * 0.1, h);
      // Erst zeichnen lassen, dann hineingleiten. Schon vor dem Ende wieder
      // wischbar, damit mehrere Monate hintereinander flott gehen.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setze(0, h, 190);
          window.setTimeout(() => (blaettert.current = false), 100);
        }),
      );
    }, raus);
  }

  const griffe = {
    onPointerDown: (e: React.PointerEvent) => {
      gewischt.current = false;
      if (blaettert.current) return;
      const h = flaeche.current?.offsetHeight || 1;
      wisch.current = { x: e.clientX, y: e.clientY, senkrecht: false, h, letztY: e.clientY, letztT: e.timeStamp, v: 0 };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = wisch.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const dt = e.timeStamp - s.letztT;
      if (dt > 0) s.v = (e.clientY - s.letztY) / dt;
      s.letztY = e.clientY;
      s.letztT = e.timeStamp;
      if (!s.senkrecht && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.2) s.senkrecht = true;
      if (!s.senkrecht) return;
      // Die Fläche folgt dem Finger – einmal je Bild, nicht je Ereignis.
      if (bild.current) cancelAnimationFrame(bild.current);
      bild.current = requestAnimationFrame(() => {
        bild.current = null;
        setze(dy * 0.85, s.h);
      });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = wisch.current;
      wisch.current = null;
      if (bild.current) cancelAnimationFrame(bild.current);
      bild.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      // Weit genug gezogen – oder kurz und schnell geschnippt.
      const schnell = Math.abs(s.v) > 0.3 && Math.abs(dy) > 16;
      if ((Math.abs(dy) > 36 || schnell) && Math.abs(dy) > Math.abs(dx) * 1.3) {
        gewischt.current = true;
        // Nur den Klick direkt danach schlucken.
        window.setTimeout(() => (gewischt.current = false), 120);
        blaettern(dy < 0 ? 1 : -1, dy * 0.85);
      } else if (s.senkrecht) {
        setze(0, s.h, 260);
      }
    },
    onPointerCancel: () => {
      const s = wisch.current;
      wisch.current = null;
      if (bild.current) cancelAnimationFrame(bild.current);
      bild.current = null;
      if (s?.senkrecht) setze(0, s.h, 260);
    },
  };

  return { flaeche, griffe, blaettern, gewischt };
}


/**
 * Monate wie ein Karussell blättern: Vormonat, aktueller Monat und Folgemonat
 * liegen nebeneinander; beim Wischen (seitlich oder nach oben/unten) folgen alle
 * dem Finger, beim Loslassen rastet der nächste Monat weich ein. Wer diesen
 * Haken nutzt, zeichnet drei Seiten (`seite(-1)`, `seite(0)`, `seite(1)`) in
 * einen gemeinsamen Rahmen (`flaeche`). Bei „Bewegung reduzieren“ ohne Animation.
 */
export function useMonatKarussell(springe: (schritt: number) => void) {
  const flaeche = useRef<HTMLDivElement>(null);
  const seiten = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const stand = useRef<{
    x: number;
    y: number;
    achse: "x" | "y" | null;
    groesse: number;
    d: number;
    letzt: number;
    letztT: number;
    v: number;
  } | null>(null);
  const gewischt = useRef(false);
  const laeuft = useRef(false);
  const bild = useRef<number | null>(null);
  const uhr = useRef<number | null>(null);
  const KURVE = "cubic-bezier(.22,1,.36,1)";

  const seite = (i: -1 | 0 | 1) => (el: HTMLDivElement | null) => {
    seiten.current[i + 1] = el;
  };

  function lege(achse: "x" | "y", d: number, groesse: number, dauer = 0) {
    seiten.current.forEach((el, i) => {
      if (!el) return;
      el.style.visibility = "visible";
      el.style.transition = dauer ? `transform ${dauer}ms ${KURVE}` : "none";
      const v = d + (i - 1) * groesse;
      el.style.transform = achse === "x" ? `translate3d(${v}px,0,0)` : `translate3d(0,${v}px,0)`;
    });
  }

  function ruhe() {
    for (const el of seiten.current) {
      if (!el) continue;
      el.style.transition = "none";
      el.style.transform = "";
      el.style.visibility = "";
    }
  }

  function ende(achse: "x" | "y", d: number, groesse: number, schritt: number) {
    if (schritt === 0) {
      lege(achse, 0, groesse, 220);
      uhr.current = window.setTimeout(() => {
        ruhe();
        laeuft.current = false;
      }, 230);
      return;
    }
    const rest = 1 - Math.min(1, Math.abs(d) / groesse);
    const dauer = Math.round(150 + 150 * rest);
    lege(achse, -schritt * groesse, groesse, dauer);
    uhr.current = window.setTimeout(() => {
      // Erst den neuen Monat zeichnen lassen, dann die Seiten zurücksetzen – kein Flackern.
      flushSync(() => springe(schritt));
      ruhe();
      laeuft.current = false;
    }, dauer + 15);
  }

  /** Per Knopf blättern (Pfeile): gleiche Bewegung, ohne Finger. */
  function blaettern(schritt: number) {
    const el = flaeche.current;
    const ruhig = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!el || ruhig || laeuft.current) {
      if (!laeuft.current) springe(schritt);
      return;
    }
    laeuft.current = true;
    const groesse = el.offsetWidth || 1;
    lege("x", 0, groesse);
    void el.offsetWidth; // erst die Ausgangslage zeichnen, dann bewegen
    ende("x", 0, groesse, schritt);
  }

  const griffe = {
    onPointerDown: (e: React.PointerEvent) => {
      gewischt.current = false;
      if (laeuft.current) return;
      const el = flaeche.current;
      stand.current = {
        x: e.clientX,
        y: e.clientY,
        achse: null,
        groesse: 1,
        d: 0,
        letzt: 0,
        letztT: e.timeStamp,
        v: 0,
      };
      if (el) stand.current.groesse = Math.max(el.offsetWidth, el.offsetHeight) || 1;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = stand.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.achse) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.achse = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : Math.abs(dy) > Math.abs(dx) * 1.2 ? "y" : null;
        if (!s.achse) return;
        const el = flaeche.current;
        if (el) s.groesse = (s.achse === "x" ? el.offsetWidth : el.offsetHeight) || 1;
      }
      const d = s.achse === "x" ? dx : dy;
      const dt = e.timeStamp - s.letztT;
      if (dt > 0) s.v = (d - s.letzt) / dt;
      s.letzt = d;
      s.letztT = e.timeStamp;
      s.d = Math.max(-s.groesse, Math.min(s.groesse, d));
      // Die Seiten folgen dem Finger – einmal je Bild, nicht je Ereignis.
      if (bild.current) cancelAnimationFrame(bild.current);
      const achse = s.achse;
      bild.current = requestAnimationFrame(() => {
        bild.current = null;
        lege(achse, s.d, s.groesse);
      });
    },
    onPointerUp: () => {
      const s = stand.current;
      stand.current = null;
      if (bild.current) cancelAnimationFrame(bild.current);
      bild.current = null;
      if (!s?.achse) return;
      const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      // Weit genug gezogen – oder kurz und schnell geschnippt.
      const weit = Math.abs(s.d) > s.groesse * 0.2;
      const schnell = Math.abs(s.v) > 0.35 && Math.abs(s.d) > 14;
      const schritt = weit || schnell ? (s.d < 0 ? 1 : -1) : 0;
      gewischt.current = Math.abs(s.d) > 10;
      window.setTimeout(() => (gewischt.current = false), 120);
      if (ruhig) {
        ruhe();
        if (schritt) springe(schritt);
        return;
      }
      laeuft.current = true;
      ende(s.achse, s.d, s.groesse, schritt);
    },
    onPointerCancel: () => {
      const s = stand.current;
      stand.current = null;
      if (bild.current) cancelAnimationFrame(bild.current);
      bild.current = null;
      if (s?.achse) {
        laeuft.current = true;
        ende(s.achse, s.d, s.groesse, 0);
      }
    },
  };

  useEffect(
    () => () => {
      if (uhr.current) window.clearTimeout(uhr.current);
      if (bild.current) cancelAnimationFrame(bild.current);
    },
    [],
  );

  return { flaeche, seite, griffe, blaettern, gewischt };
}
