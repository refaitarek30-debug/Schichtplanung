"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Formular in einzelnen Schritten: eine Frage pro Bildschirm, oben der
 * Fortschritt, unten „Weiter“ und „Zurück“. Gedacht für alles, was Fremde
 * ausfüllen (Registrierung) – das wirkt kürzer und überfordert nicht.
 *
 * Alle Schritte bleiben im Formular eingehängt (nur unsichtbar), damit am
 * Ende ein einziges normales Absenden alle Felder an die Server-Aktion
 * schickt. „Weiter“ prüft nur die Felder des aktuellen Schritts.
 */
export interface Schritt {
  /** Kurzer Name für die Fortschrittsanzeige. */
  name: string;
  /** Die Frage oder Überschrift des Schritts. */
  frage: string;
  hinweis?: ReactNode;
  inhalt: ReactNode;
  /** Zusätzliche Prüfung beim „Weiter“. Gibt einen Fehlertext zurück oder null. */
  pruefen?: (formular: HTMLFormElement) => string | null;
}

export function SchrittFolge({
  schritte,
  abschluss,
  meldung,
  disabled,
}: {
  schritte: Schritt[];
  /** Der Absende-Knopf im letzten Schritt. */
  abschluss: ReactNode;
  /** Antwort des Servers (Fehler/Erfolg), unter dem letzten Schritt. */
  meldung?: ReactNode;
  disabled?: boolean;
}) {
  const [nr, setNr] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const bereiche = useRef<(HTMLDivElement | null)[]>([]);
  const letzter = nr === schritte.length - 1;

  function aktuellGueltig(): boolean {
    const bereich = bereiche.current[nr];
    if (!bereich) return true;
    const felder = Array.from(bereich.querySelectorAll<HTMLInputElement>("input, select, textarea"));
    for (const feld of felder) {
      if (!feld.checkValidity()) {
        feld.reportValidity();
        return false;
      }
    }
    const form = bereich.closest("form");
    const text = form ? (schritte[nr]?.pruefen?.(form) ?? null) : null;
    setFehler(text);
    return text === null;
  }

  function weiter() {
    if (!aktuellGueltig()) return;
    setFehler(null);
    setNr((n) => Math.min(n + 1, schritte.length - 1));
    // Das erste Feld des nächsten Schritts gleich bereit machen.
    window.requestAnimationFrame(() => {
      bereiche.current[nr + 1]?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button[data-wahl]")?.focus();
    });
  }

  function zurueck() {
    setFehler(null);
    setNr((n) => Math.max(n - 1, 0));
  }

  // Enter springt zum nächsten Schritt statt das Formular vorzeitig abzuschicken.
  function taste(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || letzter) return;
    const ziel = e.target as HTMLElement;
    if (ziel.tagName === "TEXTAREA" || ziel.tagName === "BUTTON") return;
    e.preventDefault();
    weiter();
  }

  return (
    <div
      onKeyDown={taste}
      // Sobald etwas geändert oder gewählt wird, ist der alte Hinweis überholt.
      onInput={() => setFehler(null)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-wahl]")) setFehler(null);
      }}
    >
      {/* Fortschritt */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-[12px] font-medium text-ink-muted">
          <span>
            Schritt {nr + 1} von {schritte.length}
          </span>
          <span>{schritte[nr]?.name}</span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {schritte.map((s, i) => (
            <span
              key={s.name}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= nr ? "bg-brand-500" : "bg-line")}
            />
          ))}
        </div>
      </div>

      {schritte.map((s, i) => (
        <div
          key={s.name}
          ref={(el) => {
            bereiche.current[i] = el;
          }}
          hidden={i !== nr}
          aria-hidden={i !== nr}
        >
          <h2 className="text-[20px] font-semibold leading-tight tracking-tight">{s.frage}</h2>
          {s.hinweis ? <div className="mt-1.5 text-[13.5px] leading-snug text-ink-muted">{s.hinweis}</div> : null}
          <div className="mt-4 space-y-4">{s.inhalt}</div>
        </div>
      ))}

      {fehler ? (
        <p role="alert" className="mt-3 text-[13px] text-crit-fg">
          {fehler}
        </p>
      ) : null}

      {letzter ? <div className="mt-4 space-y-3">{meldung}</div> : null}

      <div className="mt-5 flex items-center gap-2">
        {nr > 0 ? (
          <button
            type="button"
            onClick={zurueck}
            className="flex h-11 items-center gap-1 rounded-xl px-3 text-[14px] font-semibold text-ink-muted hover:bg-surface-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Zurück
          </button>
        ) : null}
        <div className="flex-1">
          {letzter ? (
            abschluss
          ) : (
            <button
              type="button"
              onClick={weiter}
              disabled={disabled}
              className="h-11 w-full rounded-xl bg-brand-500 text-[15px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Weiter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Große Auswahlknöpfe für Ja/Nein- und Mehrfachfragen innerhalb eines Schritts. */
export function Wahl<T extends string>({
  name,
  werte,
  wert,
  onWahl,
}: {
  name: string;
  werte: { wert: T; titel: string; text?: string }[];
  wert: T | null;
  onWahl: (w: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2">
      {werte.map((w) => (
        <button
          key={w.wert}
          type="button"
          role="radio"
          data-wahl
          aria-checked={wert === w.wert}
          onClick={() => onWahl(w.wert)}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
            wert === w.wert ? "border-brand-500 bg-brand-50" : "border-line bg-surface hover:bg-surface-muted",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
              wert === w.wert ? "border-brand-500" : "border-line",
            )}
          >
            {wert === w.wert ? <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> : null}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">{w.titel}</span>
            {w.text ? <span className="mt-0.5 block text-[13px] text-ink-muted">{w.text}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
