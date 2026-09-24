"use client";

import { useEffect, useState } from "react";
import { Palmtree } from "lucide-react";
import { formatDE, fromISO, WEEKDAY_SHORT, formatDays } from "@/lib/dates";
import { artenText } from "@/lib/leave-groups";
import { fetchNaechsterUrlaub, type LiveNaechsterUrlaub } from "@/lib/data/leave";
import type { LiveLeaveRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

function wochentag(iso: string): string {
  return WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7];
}

/**
 * Der nächste eigene Urlaub – oder der laufende – als reiner Kasten.
 *
 * Zeitraum „am Stück": Anträge, zwischen denen laut Plan nur freie Tage
 * liegen, gehören zusammen (Urlaub am Donnerstag, zwei freie Tage, dann
 * V-Tage = ein Urlaub). Das rechnet die Datenbank, weil nur sie den Plan
 * jedes Tages kennt.
 *
 * `antraege` dient nur als Auslöser: ändern sich die eigenen Anträge, wird
 * neu gefragt.
 */
export function NextLeaveCard({
  antraege,
  heute,
}: {
  antraege: LiveLeaveRequest[] | null;
  heute: string;
}) {
  const [zeitraum, setZeitraum] = useState<LiveNaechsterUrlaub | null | undefined>(undefined);

  useEffect(() => {
    let abgebrochen = false;
    fetchNaechsterUrlaub()
      .then((z) => !abgebrochen && setZeitraum(z))
      .catch(() => !abgebrochen && setZeitraum(null));
    return () => {
      abgebrochen = true;
    };
  }, [antraege]);

  const laeuft = zeitraum ? zeitraum.von <= heute : false;

  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          zeitraum ? "bg-ok-bg text-ok-fg" : "bg-surface-muted text-ink-faint",
        )}
      >
        <Palmtree className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink-muted">
          {laeuft ? "Du bist im Urlaub" : "Dein nächster Urlaub"}
        </span>
        {zeitraum === undefined ? (
          <span className="block text-sm text-ink-faint">wird geladen …</span>
        ) : zeitraum === null ? (
          <span className="block text-sm text-ink-muted">Noch kein Urlaub eingetragen.</span>
        ) : (
          <>
            <span className="tnum block text-[15px] font-semibold leading-snug">
              {zeitraum.von === zeitraum.bis
                ? `${wochentag(zeitraum.von)}, ${formatDE(zeitraum.von)}`
                : `${wochentag(zeitraum.von)}, ${formatDE(zeitraum.von)} – ${wochentag(zeitraum.bis)}, ${formatDE(zeitraum.bis)}`}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-muted">
              <span className="tnum">
                {zeitraum.kalendertage} {zeitraum.kalendertage === 1 ? "Tag" : "Tage"} frei ·{" "}
                {formatDays(zeitraum.tage)} {zeitraum.tage === 1 ? "Tag" : "Tage"}{" "}
                {artenText(zeitraum.arten)}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  zeitraum.offen ? "bg-warn-bg text-warn-fg" : "bg-ok-bg text-ok-fg",
                )}
              >
                {zeitraum.offen ? "noch beantragt" : "genehmigt"}
              </span>
            </span>
          </>
        )}
      </span>
    </div>
  );
}
