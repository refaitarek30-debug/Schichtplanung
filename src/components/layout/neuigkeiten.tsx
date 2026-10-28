"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { Blatt } from "@/components/privat/blatt";
import { useSession } from "@/context/session";
import { hatNeues, istNeu, neuigkeitDatum, neuigkeitenFuer } from "@/lib/neuigkeiten";
import { cn } from "@/lib/utils";

/**
 * Glühbirne neben dem Profil: leuchtet gelb, wenn es seit dem letzten Öffnen
 * etwas Neues gibt. Ein Tipp öffnet die Liste – danach ist sie „gesehen“ und
 * leuchtet nicht mehr, bleibt aber zum Nachlesen da.
 *
 * `rund` für die Glas-Kopfzeilen (Handy), sonst als Knopf in der Kopfleiste.
 */
export function NeuigkeitenKnopf({
  rund = false,
  nurWennNeu = false,
  className,
}: {
  rund?: boolean;
  /** Nur zeigen, solange es Neues gibt – für volle Kopfzeilen (Kalender). */
  nurWennNeu?: boolean;
  className?: string;
}) {
  const { role, neuigkeitenGesehen, neuigkeitenGelesen } = useSession();
  const [offen, setOffen] = useState(false);
  // Was beim Öffnen neu war, bleibt in der Liste markiert, bis sie zugeht.
  const [gesehenVorher, setGesehenVorher] = useState<string | null>(null);
  const neu = hatNeues(role, neuigkeitenGesehen);
  const eintraege = neuigkeitenFuer(role);
  if (eintraege.length === 0) return null;
  if (nurWennNeu && !neu && !offen) return null;

  function oeffnen() {
    setGesehenVorher(neuigkeitenGesehen);
    setOffen(true);
    if (neu) neuigkeitenGelesen();
  }

  return (
    <>
      <button
        type="button"
        onClick={oeffnen}
        data-neuigkeiten={neu ? "neu" : ""}
        aria-label={neu ? "Neuigkeiten – es gibt Neues" : "Neuigkeiten"}
        title="Neu bei ShiftNexo"
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full transition-colors",
          rund ? "glas h-10 w-10" : "h-9 w-9 hover:bg-surface-muted",
          neu && "neuigkeiten-leuchten",
          className,
        )}
      >
        <Lightbulb
          className={cn("h-[19px] w-[19px]", neu ? "text-[#e0a800]" : "text-ink-faint")}
          fill={neu ? "rgba(255, 214, 10, 0.45)" : "none"}
          strokeWidth={1.9}
        />
      </button>
      {offen ? (
        <Blatt titel="Neu bei ShiftNexo" onClose={() => setOffen(false)}>
          <p className="-mt-1 pb-3 text-[13.5px] text-ink-muted">Was sich zuletzt geändert hat.</p>
          <ul className="space-y-2">
            {eintraege.map((n) => {
              const frisch = istNeu(n, gesehenVorher);
              return (
                <li
                  key={n.zeit + n.titel}
                  className={cn("rounded-[16px] px-4 py-3", frisch ? "bg-[rgba(255,214,10,0.12)]" : "bg-ink/[0.04]")}
                >
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    {n.titel}
                    {frisch ? (
                      <span className="rounded-full bg-[#ffd60a] px-1.5 py-px text-[10px] font-bold text-[#1b1600]">NEU</span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[12px] font-normal text-ink-faint">{neuigkeitDatum(n)}</span>
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">{n.text}</p>
                </li>
              );
            })}
          </ul>
        </Blatt>
      ) : null}
    </>
  );
}
