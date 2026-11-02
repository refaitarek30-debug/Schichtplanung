"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { WEEKDAY_SHORT, addDays, formatDEShort, fromISO, jetztInBerlin } from "@/lib/dates";
import type { LiveStaffingSnapshot, StaffingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const cellTone: Record<StaffingStatus, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg ring-1 ring-inset ring-warn-dot/30",
  critical: "bg-crit-bg text-crit-fg ring-1 ring-inset ring-crit-dot/40",
};

/** „Frühschicht“ → „Früh“ – so passt die Spalte aufs Handy. */
function kurz(name: string): string {
  return name.replace(/schicht$/i, "").trim() || name;
}

function wochentag(iso: string): string {
  return WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]!;
}

/** Anwesend / Soll – ohne Soll nur die Zahl. */
function wert(s: LiveStaffingSnapshot): string {
  return s.target > 0 ? `${s.present}/${s.target}` : String(s.present);
}

/** Beginn und Ende einer Schicht ("HH:MM"), je Schicht-ID. */
export type SchichtZeiten = Record<string, { start: string; end: string }>;

/**
 * Besetzungsband: wer ist da, gemessen am Soll – die nächsten 14 Tage.
 * Handy: ein Tag je Zeile, die Schichten als Spalten. Computer: die
 * Schichten als Zeilen, die Tage nebeneinander. Oben stehen die Tage, an
 * denen eine Schicht unter die Mindestbesetzung fällt.
 *
 * Mit `zeiten` stehen die Schichten in der Reihenfolge des Tages (Früh,
 * Spät, Nacht), und eine Schicht, die schon vorbei ist, lässt sich nicht
 * mehr wählen. Alle anderen öffnen über `onWaehle` die Vorschläge.
 */
export function LiveCoverageStrip({
  dates,
  snapshots,
  loading,
  zeiten,
  onWaehle,
}: {
  dates: string[];
  snapshots: LiveStaffingSnapshot[] | null;
  loading: boolean;
  zeiten?: SchichtZeiten;
  onWaehle?: (s: LiveStaffingSnapshot) => void;
}) {
  const jetzt = useJetzt();
  const beginn = (s: LiveStaffingSnapshot) => zeiten?.[s.shiftId]?.start ?? "99:99";
  const ersteJeName = new Map<string, LiveStaffingSnapshot>();
  for (const s of snapshots ?? []) if (s.shiftName && !ersteJeName.has(s.shiftName)) ersteJeName.set(s.shiftName, s);
  const shiftNames = [...ersteJeName.values()]
    .sort((a, b) => beginn(a).localeCompare(beginn(b)))
    .map((s) => s.shiftName!);
  const finde = (name: string, iso: string) =>
    (snapshots ?? []).find((s) => s.shiftName === name && s.date === iso);
  /** Schicht schon zu Ende (deutsche Zeit) – eine Nachtschicht endet am Folgetag. */
  const vorbei = (s: LiveStaffingSnapshot) => {
    const z = zeiten?.[s.shiftId];
    if (!z) return false;
    const endTag = z.end <= z.start ? addDays(s.date, 1) : s.date;
    return `${endTag}T${z.end}` <= jetzt;
  };
  const knapp = dates
    .flatMap((iso) => shiftNames.map((name) => finde(name, iso)))
    .filter((s): s is LiveStaffingSnapshot => !!s && s.status === "critical" && !vorbei(s));

  return (
    <Card data-besetzungsband>
      <CardHeader
        title="Besetzung · nächste 14 Tage"
        hint={
          onWaehle
            ? "Anwesend / Soll – rot heißt unter Mindestbesetzung. Schicht antippen für Vorschläge."
            : "Anwesend / Soll – rot heißt unter Mindestbesetzung."
        }
      />

      {!loading && knapp.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-5" data-zu-knapp>
          {knapp.slice(0, 4).map((s) => (
            <button
              type="button"
              key={`${s.shiftId}-${s.date}`}
              onClick={onWaehle ? () => onWaehle(s) : undefined}
              disabled={!onWaehle}
              className="inline-flex items-center gap-1.5 rounded-full bg-crit-bg px-3 py-1.5 text-[13px] font-semibold text-crit-fg enabled:hover:ring-1 enabled:hover:ring-crit-dot/40"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {kurz(s.shiftName ?? "")} {wochentag(s.date)} {formatDEShort(s.date)} – {s.present} von {s.minimum}
            </button>
          ))}
          {knapp.length > 4 ? (
            <span className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1.5 text-[13px] font-semibold text-ink-muted">
              + {knapp.length - 4} weitere
            </span>
          ) : null}
        </div>
      ) : null}

      <CardBody className="px-0 py-0">
        {loading ? (
          <RowSkeleton rows={4} />
        ) : shiftNames.length === 0 ? (
          <EmptyState title="Keine Besetzungsdaten gefunden." />
        ) : (
          <>
            {/* Handy: Tage untereinander */}
            <table className="w-full border-separate border-spacing-0 sm:hidden" data-band-handy>
              <thead>
                <tr>
                  <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                    Tag
                  </th>
                  {shiftNames.map((name) => (
                    <th key={name} className="px-1 pb-2 pt-3 text-center text-[12.5px] font-semibold text-ink-muted">
                      {kurz(name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((iso, i) => (
                  <tr key={iso} className={cn(i === 0 && "bg-brand-50/60")}>
                    <th className="whitespace-nowrap border-t border-line px-4 py-2 text-left">
                      <span className="text-[14px] font-semibold">{wochentag(iso)}</span>{" "}
                      <span className="tnum text-[13px] text-ink-muted">{formatDEShort(iso)}</span>
                    </th>
                    {shiftNames.map((name) => {
                      const s = finde(name, iso);
                      return (
                        <td key={name} className="border-t border-line px-1 py-2 text-center">
                          <Zelle s={s} name={name} iso={iso} vorbei={!!s && vorbei(s)} onWaehle={onWaehle} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Computer: Tage nebeneinander */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] border-separate border-spacing-0" data-band-breit>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      Schicht
                    </th>
                    {dates.map((iso, i) => (
                      <th key={iso} className={cn("px-1 pb-2 pt-3 text-center", i === 0 && "rounded-t-lg bg-brand-50/60")}>
                        <span className="block text-[11.5px] font-semibold text-ink-muted">{wochentag(iso)}</span>
                        <span className="tnum block text-[11.5px] text-ink-faint">{formatDEShort(iso)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shiftNames.map((name) => (
                    <tr key={name}>
                      <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-5 py-1.5 text-left">
                        <span className="block text-[14px] font-semibold">{kurz(name)}</span>
                      </th>
                      {dates.map((iso, i) => {
                        const s = finde(name, iso);
                        return (
                          <td key={iso} className={cn("px-1 py-1.5 text-center", i === 0 && "bg-brand-50/60")}>
                            <Zelle s={s} name={name} iso={iso} breit vorbei={!!s && vorbei(s)} onWaehle={onWaehle} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
      <div className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-3 text-[12px] text-ink-muted">
        <Legend className="bg-ok-dot" label="ausreichend besetzt" />
        <Legend className="bg-warn-dot" label="knapp" />
        <Legend className="bg-crit-dot" label="unter Mindestbesetzung" />
        {zeiten ? <Legend className="bg-ink-faint/40" label="schon vorbei" /> : null}
      </div>
    </Card>
  );
}

/** Uhrzeit in deutscher Zeit, jede Minute neu – damit eine Schicht von selbst „vorbei“ wird. */
function useJetzt(): string {
  const [jetzt, setJetzt] = useState(jetztInBerlin);
  useEffect(() => {
    const id = window.setInterval(() => setJetzt(jetztInBerlin()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return jetzt;
}

function Zelle({
  s,
  name,
  iso,
  breit,
  vorbei,
  onWaehle,
}: {
  s?: LiveStaffingSnapshot;
  name: string;
  iso: string;
  breit?: boolean;
  vorbei?: boolean;
  onWaehle?: (s: LiveStaffingSnapshot) => void;
}) {
  const groesse = breit ? "h-11 min-w-[3.25rem]" : "h-10 min-w-[3.5rem]";
  if (!s) {
    return (
      <span className={cn("mx-auto flex items-center justify-center rounded-xl bg-surface-muted text-[12px] text-ink-faint", groesse)}>
        –
      </span>
    );
  }
  const klasse = "tnum mx-auto flex items-center justify-center rounded-xl px-1.5 text-[14.5px] font-bold leading-none";
  const titel = `${name} am ${formatDEShort(iso)}: ${s.present} anwesend, Soll ${s.target}, Mindest ${s.minimum}`;
  // Schon vorbei: nur noch zum Nachsehen, grau und nicht wählbar.
  if (vorbei || !onWaehle) {
    return (
      <span
        className={cn(klasse, groesse, vorbei ? "bg-surface-muted text-ink-faint" : cellTone[s.status])}
        title={vorbei ? `${titel} – schon vorbei` : titel}
        data-vorbei={vorbei ? "" : undefined}
      >
        {wert(s)}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onWaehle(s)}
      className={cn(klasse, groesse, cellTone[s.status], "hover:brightness-110 active:scale-95")}
      title={`${titel} – Vorschläge ansehen`}
      aria-label={`${name} am ${formatDEShort(iso)}, ${s.present} von ${s.target} – Vorschläge ansehen`}
      data-zelle
    >
      {wert(s)}
    </button>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  );
}
