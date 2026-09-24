"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

export interface TileOption {
  /** Stabiler Schlüssel – wird in `profiles.hidden_dashboard_tiles` gespeichert. */
  key: string;
  label: string;
  /**
   * Standardmäßig aus – jeder schaltet die Kachel selbst ein. Gespeichert
   * wird dann `zeige:<key>` in derselben Liste.
   */
  optIn?: boolean;
}

/** Ist die Kachel sichtbar – nach der gespeicherten Liste? */
export function kachelSichtbar(gespeichert: Set<string>, key: string, optIn = false): boolean {
  return optIn ? gespeichert.has(`zeige:${key}`) : !gespeichert.has(key);
}

/**
 * Auswahl, welche Kacheln auf dem eigenen Dashboard stehen.
 *
 * Gespeichert werden die *ausgeblendeten* Schlüssel, nicht die sichtbaren:
 * so ist die Vorgabe „alles sichtbar“, und eine Kachel, die später
 * dazukommt, erscheint bei allen von selbst.
 *
 * Die Auswahl liegt am Profil und nicht im Browser – wer am Telefon die
 * Krankenzahlen ausblendet, findet sie am Rechner genauso ausgeblendet.
 * Sie wirkt sofort und wird im Hintergrund gespeichert; scheitert das
 * Speichern, sagt die Karte es, statt still zum alten Stand zu springen.
 */
export function TileSettings({
  profileId,
  optionen,
  versteckt,
  onChange,
}: {
  profileId: string;
  optionen: TileOption[];
  versteckt: Set<string>;
  onChange: (naechste: Set<string>) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  // Klick daneben und Escape schließen das Menü – sonst bleibt es beim
  // Weiterscrollen offen über dem Inhalt stehen.
  useEffect(() => {
    if (!offen) return;
    function beiKlick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOffen(false);
    }
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [offen]);

  function umschalten(key: string, optIn = false) {
    const naechste = new Set(versteckt);
    const eintrag = optIn ? `zeige:${key}` : key;
    if (naechste.has(eintrag)) naechste.delete(eintrag);
    else naechste.add(eintrag);

    const vorher = new Set(versteckt);
    onChange(naechste);
    setFehler(null);

    if (!isSupabaseConfigured) return;
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("profiles")
          .update({ hidden_dashboard_tiles: [...naechste] })
          .eq("id", profileId);
        if (error) throw error;
      } catch {
        onChange(vorher);
        setFehler("Die Auswahl konnte nicht gespeichert werden.");
      }
    });
  }

  const sichtbar = optionen.filter((o) => kachelSichtbar(versteckt, o.key, o.optIn)).length;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-haspopup="true"
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-muted hover:text-ink"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} />
        Kacheln
        <span className="tnum text-ink-faint">
          {sichtbar}/{optionen.length}
        </span>
      </button>

      {offen ? (
        <div className="absolute right-0 z-20 mt-1.5 w-60 rounded-xl border border-line bg-surface p-2 shadow-card">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
            Auf meinem Dashboard
          </p>
          {optionen.map((o) => {
            const an = kachelSichtbar(versteckt, o.key, o.optIn);
            return (
              <label
                key={o.key}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-muted",
                  pending && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={an}
                  onChange={() => umschalten(o.key, o.optIn)}
                  className="h-4 w-4 rounded border-line accent-brand-500"
                />
                <span>{o.label}</span>
              </label>
            );
          })}
          {fehler ? (
            <p className="px-2 pb-1 pt-2 text-[12px] text-crit-fg">{fehler}</p>
          ) : (
            <p className="px-2 pb-1 pt-2 text-[11px] text-ink-faint">
              Gilt nur für dich, auf allen Geräten.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
