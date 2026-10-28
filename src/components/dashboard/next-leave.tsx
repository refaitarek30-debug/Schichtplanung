"use client";

import { useEffect, useState } from "react";
import { Palmtree } from "lucide-react";
import { formatDE, formatDEShort, fromISO } from "@/lib/dates";
import { fetchNaechsterUrlaub, type LiveNaechsterUrlaub } from "@/lib/data/leave";
import type { LiveLeaveRequest } from "@/lib/types";
import { cn } from "@/lib/utils";


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
  kompakt = false,
}: {
  antraege: LiveLeaveRequest[] | null;
  heute: string;
  /** Startseite „Kompakt“: flacher, mit Rest-Tagen und Fortschritt. */
  kompakt?: boolean;
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

  if (kompakt) return <KompaktUrlaub zeitraum={zeitraum} heute={heute} laeuft={laeuft} />;

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
            {/* Der ganze zusammenhängende Zeitraum, nicht nur der Beginn –
                Urlaub, V-Tage und Sonderurlaub am Stück. */}
            <span className="tnum block text-[15px] font-semibold leading-snug">
              {zeitraum.von === zeitraum.bis
                ? formatDE(zeitraum.von)
                : `${formatDE(zeitraum.von)} – ${formatDE(zeitraum.bis)}`}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-muted">
              <span className="tnum">
                {zeitraum.kalendertage} {zeitraum.kalendertage === 1 ? "Tag" : "Tage"} frei
              </span>
              {zeitraum.offen ? (
                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-medium text-warn-fg">
                  noch beantragt
                </span>
              ) : null}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

const TAG_MS = 864e5;
const tageZwischen = (von: string, bis: string) => Math.round((fromISO(bis).getTime() - fromISO(von).getTime()) / TAG_MS);

/**
 * „Kompakt“: eine flache grüne Zeile – Zeitraum links, rechts wie lange
 * noch (im Urlaub) bzw. wann es losgeht, darunter der Fortschritt.
 */
function KompaktUrlaub({
  zeitraum,
  heute,
  laeuft,
}: {
  zeitraum: LiveNaechsterUrlaub | null | undefined;
  heute: string;
  laeuft: boolean;
}) {
  const gesamt = zeitraum ? tageZwischen(zeitraum.von, zeitraum.bis) + 1 : 0;
  const noch = zeitraum ? (laeuft ? tageZwischen(heute, zeitraum.bis) + 1 : tageZwischen(heute, zeitraum.von)) : 0;
  const anteil = zeitraum && laeuft && gesamt > 0 ? Math.min(1, Math.max(0, (gesamt - noch + 1) / gesamt)) : 0;

  return (
    <div
      data-urlaub-kompakt
      className="relative overflow-hidden rounded-[22px] border border-ok-dot/25 bg-gradient-to-br from-ok-bg to-surface px-4 py-3 shadow-card"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface/80 text-[20px] shadow-[0_1px_4px_rgba(0,0,0,0.08)]" aria-hidden>
          🌴
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ok-fg">
            {laeuft ? "Du bist im Urlaub" : "Nächster Urlaub"}
            {zeitraum?.offen ? <span className="ml-1.5 normal-case tracking-normal text-warn-fg">· noch beantragt</span> : null}
          </span>
          {zeitraum === undefined ? (
            <span className="block text-[14px] text-ink-faint">wird geladen …</span>
          ) : zeitraum === null ? (
            <span className="block text-[14px] text-ink-muted">Noch kein Urlaub eingetragen.</span>
          ) : (
            <span className="tnum block truncate text-[17px] font-bold leading-tight">
              {zeitraum.von === zeitraum.bis ? formatDEShort(zeitraum.von) : `${formatDEShort(zeitraum.von)} – ${formatDEShort(zeitraum.bis)}`}
              <span className="ml-1.5 text-[13px] font-medium text-ink-muted">
                · {zeitraum.kalendertage} {zeitraum.kalendertage === 1 ? "Tag" : "Tage"}
              </span>
            </span>
          )}
        </span>
        {zeitraum ? (
          <span className="shrink-0 text-right leading-none">
            <span className="tnum block text-[24px] font-bold text-ok-fg">{noch}</span>
            <span className="block pt-0.5 text-[11.5px] font-medium text-ink-muted">
              {laeuft ? (noch === 1 ? "Tag noch" : "Tage noch") : noch === 1 ? "Tag bis dahin" : "Tage bis dahin"}
            </span>
          </span>
        ) : null}
      </div>
      {zeitraum && laeuft ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ok-fg/15" aria-hidden>
          <div className="h-full rounded-full bg-ok-fg" style={{ width: `${Math.round(anteil * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}
