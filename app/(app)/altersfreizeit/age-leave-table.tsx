"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { setAfFreischaltung } from "@/lib/auth/age-leave-actions";
import type { FormState } from "@/lib/auth/form-state";
import { DataError } from "@/lib/data/leave";
import { fetchAfUebersicht, type LiveAfUebersichtZeile } from "@/lib/data/age-leave";
import { formatDE, formatDays } from "@/lib/dates";

function std(wert: number): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Altersfreizeit als Stundenkonto.
 *
 * Die Administration schaltet frei (mit Datum). Ab dann gibt es je
 * tatsächlich gearbeitetem Tag 0,83 Stunden, je 7,5 Stunden einen AF-Tag.
 * Urlaub, V-Tage, Krankheit, Schulung und alle anderen freien Tage zählen
 * nicht. Das Konto läuft über den Jahreswechsel weiter.
 */
export function AgeLeaveTable() {
  const [zeilen, setZeilen] = useState<LiveAfUebersichtZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [state, action] = useActionState(setAfFreischaltung, {} as FormState);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      setZeilen(await fetchAfUebersicht());
    } catch (caught) {
      setZeilen([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden, state.success]);

  const freigeschaltet = (zeilen ?? []).filter((z) => z.freigeschaltetAb).length;
  const ab50 = (zeilen ?? []).filter((z) => (z.alterHeute ?? 0) >= 50 && !z.freigeschaltetAb).length;
  const heute = new Date();
  const jahresbeginn = `${heute.getFullYear()}-01-01`;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Je <strong>tatsächlich gearbeitetem</strong> Tag gibt es 0,83 Stunden, ab 7,5 Stunden
        einen AF-Tag. Urlaub, V-Tage, Krankheit und alle anderen freien Tage zählen nicht. Der
        Rest läuft ins nächste Jahr weiter.
      </Alert>

      <Card>
        <CardHeader
          title="Altersfreizeit"
          hint={
            zeilen === null
              ? undefined
              : `${freigeschaltet} freigeschaltet${ab50 > 0 ? ` · ${ab50} ab 50 ohne Freischaltung` : ""}`
          }
        />
        {fehler ? (
          <div className="px-5 pt-4">
            <Alert tone="error">{fehler}</Alert>
          </div>
        ) : null}
        {state.error ? (
          <div className="px-5 pt-4">
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="px-5 pt-4">
            <Alert tone="success">{state.success}</Alert>
          </div>
        ) : null}

        <CardBody className="space-y-2 px-3 py-3">
          {zeilen === null ? (
            <RowSkeleton rows={5} />
          ) : zeilen.length === 0 ? (
            <EmptyState title="Keine aktiven Mitarbeiter." />
          ) : (
            zeilen.map((z) => (
              <div
                key={z.employeeId}
                className={
                  z.freigeschaltetAb
                    ? "rounded-xl border border-l-4 border-line border-l-shift-altersfrei bg-shift-altersfrei/5 px-3 py-2.5"
                    : "rounded-xl border border-line px-3 py-2.5"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {z.employeeName}
                      {z.rotationTeam ? (
                        <span className="font-normal text-ink-faint"> · Schicht {z.rotationTeam}</span>
                      ) : null}
                    </p>
                    <p className="tnum text-[12px] text-ink-muted">
                      {z.birthDate
                        ? `geb. ${formatDE(z.birthDate)} · ${z.alterHeute} Jahre`
                        : "Geburtsdatum nicht hinterlegt"}
                      {(z.alterHeute ?? 0) >= 50 && !z.freigeschaltetAb ? (
                        <Badge tone="info" className="ml-2">
                          ab 50 – prüfen
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  {z.freigeschaltetAb ? (
                    <Badge tone={z.verfuegbar < 0 ? "critical" : "ok"}>
                      {formatDays(z.verfuegbar)} AF-Tage verfügbar
                    </Badge>
                  ) : (
                    <Badge tone="neutral">nicht freigeschaltet</Badge>
                  )}
                </div>

                {z.freigeschaltetAb ? (
                  <p className="tnum mt-1.5 text-[12px] text-ink-muted">
                    seit {formatDE(z.freigeschaltetAb)}: {z.arbeitstage} Arbeitstage ={" "}
                    {std(z.stunden)} Std. → {formatDays(z.tageErworben)} Tage erworben ·{" "}
                    {formatDays(z.genommen)} genommen · {formatDays(z.beantragt)} beantragt · Rest{" "}
                    {std(z.restStunden)} von 7,50 Std.
                  </p>
                ) : null}

                <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="employee_id" value={z.employeeId} />
                  <label className="text-[12px] text-ink-muted" htmlFor={`ab-${z.employeeId}`}>
                    freigeschaltet ab
                  </label>
                  <input
                    id={`ab-${z.employeeId}`}
                    name="ab"
                    type="date"
                    defaultValue={z.freigeschaltetAb ?? jahresbeginn}
                    className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                  <SpeichernKnopf text={z.freigeschaltetAb ? "Ändern" : "Freischalten"} />
                  {z.freigeschaltetAb ? (
                    <button
                      type="submit"
                      name="aufheben"
                      value="1"
                      className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-faint hover:text-crit-fg"
                    >
                      Aufheben
                    </button>
                  ) : null}
                </form>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <p className="text-[12px] leading-snug text-ink-faint">
        Direkt im Schichtplan eingetragene AF-Tage zählen als genommen. Jede Freischaltung und
        jede Änderung wird mit Person, Zeitpunkt und altem Wert protokolliert.
      </p>
    </div>
  );
}

function SpeichernKnopf({ text }: { text: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-shift-altersfrei px-3 py-1.5 text-[13px] font-medium text-shift-altersfrei-ink disabled:opacity-50"
    >
      {pending ? "…" : text}
    </button>
  );
}
