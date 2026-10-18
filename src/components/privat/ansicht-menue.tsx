"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CalendarRange, Check, ChevronDown, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type Ansicht = "woche" | "monat" | "jahr";

const ANSICHTEN = [
  { id: "woche", name: "Woche", icon: CalendarRange },
  { id: "monat", name: "Monat", icon: CalendarDays },
  { id: "jahr", name: "Jahr", icon: LayoutGrid },
] as const;

/**
 * Ansicht wählen: ein Knopf im Kopf zeigt die aktuelle Ansicht, Antippen
 * klappt Woche, Monat und Jahr auf. Spart die breite Umschalt-Zeile.
 */
export function AnsichtMenue({ ansicht, onWahl }: { ansicht: Ansicht; onWahl: (a: Ansicht) => void }) {
  const [offen, setOffen] = useState(false);
  const aktuell = ANSICHTEN.find((a) => a.id === ansicht) ?? ANSICHTEN[1];
  const AktuellesIcon = aktuell.icon;

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [offen]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label={`Ansicht wählen, jetzt ${aktuell.name}`}
        title="Ansicht"
        onClick={() => setOffen((o) => !o)}
        className="glas flex h-11 shrink-0 items-center justify-center gap-0.5 rounded-full px-2.5 text-ink [@media(max-width:360px)]:h-9 [@media(max-width:360px)]:px-2"
      >
        <AktuellesIcon className="h-[19px] w-[19px]" />
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {offen ? (
        <>
          {/* Fängt den Tipp daneben ab: schließt das Menü, ohne dahinter etwas auszulösen. */}
          <button type="button" tabIndex={-1} aria-hidden onClick={() => setOffen(false)} className="fixed inset-0 z-20 cursor-default" />
          <div
            role="menu"
            aria-label="Ansicht"
            className="glas-dicht glas-voll absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-[11rem] rounded-[20px] p-1.5 [animation:menue-auf_.16s_ease-out] motion-reduce:[animation:none]"
          >
            {ANSICHTEN.map((a) => {
              const Icon = a.icon;
              const an = a.id === ansicht;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={an}
                  onClick={() => {
                    setOffen(false);
                    onWahl(a.id);
                  }}
                  className={cn(
                    "flex h-11 w-full items-center gap-2.5 rounded-[14px] px-3 text-left text-[15px] font-semibold",
                    an ? "bg-brand-500/10 text-brand-600" : "text-ink",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {a.name}
                  {an ? <Check className="ml-auto h-[18px] w-[18px]" strokeWidth={2.6} /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
