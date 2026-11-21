"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { kachelGroesse, kachelReihe, kachelSichtbar, speichereKachelAuswahl, type KachelGroesse, type TileOption } from "./tile-settings";

/**
 * Kacheln auf der Startseite direkt bearbeiten: lange auf eine Kachel
 * drücken, dann bekommt jede Kachel ein Minus zum Ausblenden, unten die
 * Größe (S/M/L) und lässt sich per Ziehen verschieben. Am Ende steht
 * „Kachel hinzufügen“. „Fertig“ beendet das. Gespeichert wird wie in der
 * Liste (Profil, gilt auf allen Geräten).
 */

interface Bearbeitung {
  bearbeiten: boolean;
  starten: () => void;
  ausblenden: (key: string) => void;
  groesse: (key: string) => KachelGroesse;
  setzeGroesse: (key: string, g: KachelGroesse) => void;
  platz: (key: string) => number | undefined;
  setzeReihe: (reihe: string[], speichern: boolean) => void;
}

/** Spalten auf dem Handy (Raster mit 4 Spalten): S = 1, M = 2, L = 4. */
const SPANNE: Record<KachelGroesse, string> = {
  S: "max-lg:col-span-1",
  M: "max-lg:col-span-2",
  L: "max-lg:col-span-4",
};

const Kontext = createContext<Bearbeitung | null>(null);
const LANG_MS = 500;

export function KachelBearbeitung({
  profileId,
  optionen,
  versteckt,
  onChange,
  aktiv,
  children,
  danach,
  standardGroesse = () => "M",
}: {
  profileId: string;
  optionen: TileOption[];
  versteckt: Set<string>;
  onChange: (naechste: Set<string>) => void;
  /** Nur im echten Betrieb – in der Vorschau gibt es nichts zu speichern. */
  aktiv: boolean;
  children: ReactNode;
  /** Was nach dem Kachel-Raster kommt, aber auch Kacheln enthält (z. B. „Nächster Urlaub“). */
  danach?: ReactNode;
  /** Vorgabe der Größe je Kachel (je nach Ansicht). */
  standardGroesse?: (key: string) => KachelGroesse;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [, starte] = useTransition();
  const [menue, setMenue] = useState(false);

  /** Liste ändern und im Hintergrund speichern (bei Fehler zurück). */
  function aendern(naechste: Set<string>, speichern = true) {
    const vorher = new Set(versteckt);
    onChange(naechste);
    if (!speichern) return;
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

  const reihe = kachelReihe(versteckt);
  const wert: Bearbeitung = {
    groesse: (key) => kachelGroesse(versteckt, key, standardGroesse(key)),
    setzeGroesse: (key, g) => {
      const naechste = new Set([...versteckt].filter((e) => !e.startsWith(`groesse:${key}:`)));
      if (g !== standardGroesse(key)) naechste.add(`groesse:${key}:${g}`);
      aendern(naechste);
    },
    platz: (key) => {
      if (!reihe.length) return undefined;
      const i = reihe.indexOf(key);
      return i < 0 ? 100 : i;
    },
    setzeReihe: (neu, speichern) => {
      const naechste = new Set([...versteckt].filter((e) => !e.startsWith("reihe:")));
      naechste.add(`reihe:${neu.join(",")}`);
      aendern(naechste, speichern);
    },
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
          <p className="min-w-0 text-[13px] leading-snug text-ink-muted">Ziehen zum Verschieben · S M L für die Größe</p>
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => aendern(new Set([...versteckt].filter((e) => !e.startsWith("reihe:") && !e.startsWith("groesse:"))))}
              className="text-[13px] font-semibold text-brand-600"
              data-kacheln-vorgabe
            >
              Vorgabe
            </button>
            <button type="button" onClick={() => setBearbeiten(false)} className="rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-surface">
              Fertig
            </button>
          </span>
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
      {danach}
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

  const groesse = k.groesse(id);
  const platz = k.platz(id);

  /** Im Bearbeiten-Modus: halten und über eine andere Kachel ziehen tauscht den Platz. */
  function ziehen(e: React.PointerEvent<HTMLDivElement>) {
    if (!k || (e.target as HTMLElement).closest("button")) return;
    const eigene = e.currentTarget;
    const raster = eigene.parentElement;
    if (!raster?.hasAttribute("data-kachel-raster")) return;
    const reiheJetzt = () =>
      [...raster.querySelectorAll<HTMLElement>(":scope > [data-kachel]")]
        .map((el, i) => ({ id: el.dataset.kachel!, o: Number(el.style.order || 0), i }))
        .sort((a, b) => a.o - b.o || a.i - b.i)
        .map((x) => x.id);
    let reihe = reiheJetzt();
    eigene.setPointerCapture(e.pointerId);
    eigene.style.opacity = "0.7";
    const bewegt = (ev: PointerEvent) => {
      const unter = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-kachel]");
      const ziel = unter?.dataset.kachel;
      if (!ziel || ziel === id || unter?.parentElement !== raster) return;
      const neu = reihe.filter((x) => x !== id);
      neu.splice(neu.indexOf(ziel) + (reihe.indexOf(ziel) > reihe.indexOf(id) ? 1 : 0), 0, id);
      reihe = neu;
      k!.setzeReihe(neu, false);
    };
    const los = () => {
      eigene.style.opacity = "";
      eigene.removeEventListener("pointermove", bewegt);
      eigene.removeEventListener("pointerup", los);
      eigene.removeEventListener("pointercancel", los);
      k!.setzeReihe(reihe, true);
    };
    eigene.addEventListener("pointermove", bewegt);
    eigene.addEventListener("pointerup", los);
    eigene.addEventListener("pointercancel", los);
  }

  return (
    <div
      className={cn(
        "relative min-w-0 select-none [-webkit-touch-callout:none] [&>*:first-child]:h-full",
        SPANNE[groesse],
        k.bearbeiten && "touch-none cursor-grab rounded-[20px] outline-dashed outline-[1.5px] outline-offset-2 outline-brand-500/50",
        className,
      )}
      style={platz === undefined ? undefined : { order: platz }}
      data-kachel={id}
      data-groesse={groesse}
      onPointerDown={(e) => {
        if (k.bearbeiten) return ziehen(e);
        if (e.button !== 0) return;
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
      // Kein Ziehen des Links durch den Browser – sonst bricht das eigene Verschieben ab.
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        // Nach langem Drücken und im Bearbeiten-Modus nicht weiterleiten.
        if ((e.target as HTMLElement).closest("[data-kachel-weg], [data-kachel-groesse]")) return;
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
      {k.bearbeiten ? (
        <span className="absolute bottom-1.5 right-1.5 z-10 flex gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-card" data-kachel-groesse={id}>
          {(["S", "M", "L"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-label={`${name}: Größe ${g}`}
              aria-pressed={groesse === g}
              onClick={(e) => {
                e.stopPropagation();
                k.setzeGroesse(id, g);
              }}
              className={cn(
                "h-6 w-6 rounded-full text-[11px] font-bold",
                groesse === g ? "bg-brand-600 text-white" : "text-ink-muted",
              )}
              data-kachel-weg-nicht
            >
              {g}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );
}
