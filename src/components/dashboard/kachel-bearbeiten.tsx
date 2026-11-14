"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { kachelSichtbar, speichereKachelAuswahl, type TileOption } from "./tile-settings";

/**
 * Kacheln auf der Startseite direkt bearbeiten: lange auf eine Kachel
 * drücken, dann bekommt jede Kachel ein Minus zum Ausblenden und am Ende
 * steht „Kachel hinzufügen“. „Fertig“ beendet das. Gespeichert wird wie in
 * der Liste (Profil, gilt auf allen Geräten).
 */

interface Bearbeitung {
  bearbeiten: boolean;
  starten: () => void;
  ausblenden: (key: string) => void;
}

const Kontext = createContext<Bearbeitung | null>(null);
const LANG_MS = 500;

export function KachelBearbeitung({
  profileId,
  optionen,
  versteckt,
  onChange,
  aktiv,
  children,
}: {
  profileId: string;
  optionen: TileOption[];
  versteckt: Set<string>;
  onChange: (naechste: Set<string>) => void;
  /** Nur im echten Betrieb – in der Vorschau gibt es nichts zu speichern. */
  aktiv: boolean;
  children: ReactNode;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [, starte] = useTransition();
  const [menue, setMenue] = useState(false);

  function setze(key: string, an: boolean) {
    const option = optionen.find((o) => o.key === key);
    if (!option) return;
    const naechste = new Set(versteckt);
    if (option.optIn) {
      if (an) naechste.add(`zeige:${key}`);
      else naechste.delete(`zeige:${key}`);
    } else if (an) naechste.delete(key);
    else naechste.add(key);
    // Einstellungen der Kachel (z. B. „naechsteschicht:Berufsschule“) gehen mit weg.
    if (!an) for (const e of [...naechste]) if (e.startsWith(`${key}:`)) naechste.delete(e);
    const vorher = new Set(versteckt);
    onChange(naechste);
    setFehler(null);
    starte(async () => {
      try {
        await speichereKachelAuswahl(profileId, naechste);
      } catch {
        onChange(vorher);
        setFehler("Die Auswahl konnte nicht gespeichert werden.");
      }
    });
  }

  useEffect(() => {
    if (!bearbeiten) return;
    const taste = (e: KeyboardEvent) => e.key === "Escape" && setBearbeiten(false);
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [bearbeiten]);

  const aus = optionen.filter((o) => !kachelSichtbar(versteckt, o.key, o.optIn));
  const keineSichtbar = aus.length === optionen.length;

  const wert: Bearbeitung = {
    bearbeiten,
    starten: () => {
      if (!aktiv) return;
      setBearbeiten(true);
      try {
        navigator.vibrate?.(12);
      } catch {
        // kein Vibrieren – egal
      }
    },
    ausblenden: (key) => setze(key, false),
  };

  return (
    <Kontext.Provider value={wert}>
      {bearbeiten ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-card" data-kacheln-bearbeiten>
          <p className="text-[13.5px] text-ink-muted">Minus blendet aus · unten hinzufügen</p>
          <button type="button" onClick={() => setBearbeiten(false)} className="rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-surface">
            Fertig
          </button>
        </div>
      ) : null}
      {children}
      {aktiv && (bearbeiten || keineSichtbar) ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => (bearbeiten ? setMenue((m) => !m) : setBearbeiten(true))}
            aria-expanded={menue}
            disabled={bearbeiten && aus.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line px-3 py-3 text-[14px] font-medium text-ink-muted disabled:opacity-50"
            data-kachel-hinzufuegen
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {aus.length === 0 ? "Alle Kacheln sind da" : "Kachel hinzufügen"}
          </button>
          {menue && bearbeiten && aus.length > 0 ? (
            <ul className="absolute left-0 right-0 z-20 mt-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-card sm:left-auto sm:w-64">
              {aus.map((o) => (
                <li key={o.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setze(o.key, true);
                      setMenue(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] hover:bg-surface-muted"
                  >
                    <Plus className="h-4 w-4 text-ink-faint" /> {o.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {fehler ? <p className="text-[12.5px] text-crit-fg">{fehler}</p> : null}
    </Kontext.Provider>
  );
}

/**
 * Hülle um eine Kachel: langes Drücken startet das Bearbeiten, im
 * Bearbeiten-Modus führt ein Tippen nirgends hin und oben links steht ein
 * Minus zum Ausblenden. Ohne KachelBearbeitung darüber nur ein Durchreicher.
 */
export function KachelHuelle({ id, name, children, className }: { id: string; name: string; children: ReactNode; className?: string }) {
  const k = useContext(Kontext);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const gerade = useRef(false);

  if (!k) return <>{children}</>;

  const abbrechen = () => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
  };

  return (
    <div
      className={cn("relative min-w-0 select-none [-webkit-touch-callout:none]", className)}
      data-kachel={id}
      onPointerDown={(e) => {
        if (k.bearbeiten || e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY };
        gerade.current = false;
        uhr.current = setTimeout(() => {
          gerade.current = true;
          k.starten();
        }, LANG_MS);
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) abbrechen();
      }}
      onPointerUp={abbrechen}
      onPointerLeave={abbrechen}
      onPointerCancel={abbrechen}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        // Nach langem Drücken und im Bearbeiten-Modus nicht weiterleiten.
        if ((e.target as HTMLElement).closest("[data-kachel-weg]")) return;
        if (k.bearbeiten || gerade.current) {
          e.preventDefault();
          e.stopPropagation();
          gerade.current = false;
        }
      }}
    >
      {children}
      {k.bearbeiten ? (
        <button
          type="button"
          aria-label={`${name} ausblenden`}
          onClick={(e) => {
            e.stopPropagation();
            k.ausblenden(id);
          }}
          className="absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card"
          data-kachel-weg={id}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}
