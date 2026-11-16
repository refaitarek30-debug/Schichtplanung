"use client";

import type { Termin } from "@/components/kalender/termine";
import { addDays } from "@/lib/dates";
import { idsVon, istAbwesenheit, textFarbe, type Schichtart, type TagEintrag } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

/**
 * Woche in 7 Spalten (Entwurf B): je Tag die Schicht als farbige Kachel mit
 * Uhrzeit, darunter die Termine, unten die Summe der Woche. Ein Tipp auf eine
 * Spalte öffnet den Tag mit Zeitleiste.
 */

const KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const std = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const uhr = (hhmm: string) => (hhmm.endsWith(":00") ? hhmm.slice(0, 2) : hhmm);

export function WochenSpalten({
  von,
  heute,
  tage,
  artNach,
  termineAm,
  feiertagVon,
  onTag,
}: {
  /** Montag der Woche */
  von: string;
  heute: string;
  tage: Record<string, TagEintrag>;
  artNach: Map<string, Schichtart>;
  termineAm: (iso: string) => Termin[];
  feiertagVon: (iso: string) => string | undefined;
  onTag: (iso: string) => void;
}) {
  const woche = Array.from({ length: 7 }, (_, i) => addDays(von, i));
  const proTag = woche.map((iso) => ({
    iso,
    arten: idsVon(tage[iso])
      .map((id) => artNach.get(id))
      .filter((a): a is Schichtart => !!a),
    termine: termineAm(iso),
    feiertag: feiertagVon(iso),
  }));

  // Summe: Arbeitsschichten (Urlaub/Krank ersetzen die Schicht des Tages), Stunden, je Schichtname.
  let schichten = 0;
  let stunden = 0;
  const je = new Map<string, number>();
  let termine = 0;
  for (const t of proTag) {
    termine += t.termine.length;
    if (t.arten.some((a) => istAbwesenheit(a))) continue;
    for (const a of t.arten) {
      if (a.art !== "arbeit") continue;
      schichten += 1;
      stunden += a.stunden;
      je.set(a.name, (je.get(a.name) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-3" data-woche-spalten>
      <div className="grid grid-cols-7 gap-1">
        {proTag.map(({ iso, arten, termine: tt, feiertag }, i) => {
          const istHeute = iso === heute;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onTag(iso)}
              className="flex min-w-0 flex-col items-stretch gap-1 text-center"
              aria-label={`${KURZ[i]} ${Number(iso.slice(8))}. öffnen`}
              data-woche-tag={iso}
            >
              <span className={cn("rounded-[12px] py-1", istHeute && "bg-ink text-surface")}>
                <span className={cn("block text-[11px] font-medium", istHeute ? "opacity-80" : "text-ink-muted", feiertag && !istHeute && "text-crit-fg")}>{KURZ[i]}</span>
                <span className="tnum block text-[17px] font-bold leading-tight">{Number(iso.slice(8))}</span>
              </span>
              {arten.length ? (
                arten.map((a) => {
                  const frei = a.art === "frei";
                  return (
                    <span
                      key={a.id}
                      className={cn("flex min-h-[58px] flex-col items-center justify-center rounded-[12px] px-0.5 py-1.5", frei && "border border-line")}
                      style={frei ? undefined : { backgroundColor: a.farbe, color: textFarbe(a.farbe) }}
                    >
                      <span className="block max-w-full truncate text-[16px] font-extrabold leading-none">{a.kuerzel || a.name.slice(0, 1)}</span>
                      <span className="mt-1 block max-w-full truncate text-[9.5px] font-medium leading-none opacity-90">
                        {a.beginn && a.ende ? `${uhr(a.beginn)}–${uhr(a.ende)}` : a.name}
                      </span>
                    </span>
                  );
                })
              ) : (
                <span className="flex min-h-[58px] items-center justify-center rounded-[12px] border border-dashed border-ink/15 text-[11px] text-ink-faint">–</span>
              )}
              {feiertag ? <span className="truncate rounded-[8px] bg-crit-bg px-0.5 py-0.5 text-[9.5px] font-semibold text-crit-fg">{feiertag}</span> : null}
              {tt.slice(0, 2).map((t) => (
                <span key={`${t.id}-${iso}`} className="rounded-[8px] bg-brand-500/10 px-0.5 py-1 text-[10px] font-semibold leading-tight">
                  {t.ganztaegig ? null : <span className="tnum block">{t.von}</span>}
                  <span className="block truncate">{t.titel}</span>
                </span>
              ))}
              {tt.length > 2 ? <span className="text-[10px] font-semibold text-ink-muted">+{tt.length - 2}</span> : null}
            </button>
          );
        })}
      </div>

      <section className="glas overflow-hidden rounded-[18px]" data-woche-summe>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              {schichten} {schichten === 1 ? "Schicht" : "Schichten"}
            </p>
            {je.size ? (
              <p className="truncate text-[12.5px] text-ink-muted">
                {[...je].map(([n, z]) => `${z} ${n}`).join(" · ")}
              </p>
            ) : null}
          </div>
          <span className="tnum shrink-0 text-[17px] font-bold">{std(stunden)} Std</span>
        </div>
        {termine ? (
          <div className="glas-linie flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-[15px] font-semibold">Termine</p>
            <span className="tnum text-[15px] font-bold">{termine}</span>
          </div>
        ) : null}
      </section>
      <p className="px-1 text-center text-[12px] text-ink-faint">Tag antippen für Uhrzeiten und Termine</p>
    </div>
  );
}
