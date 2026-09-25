"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { setAfStand, setBirthDate } from "@/lib/auth/age-leave-actions";
import type { FormState } from "@/lib/auth/form-state";
import { DataError } from "@/lib/data/leave";
import { fetchAfUebersicht, type LiveAfUebersichtZeile } from "@/lib/data/age-leave";
import { useSession } from "@/context/session";
import { formatDE, formatDays } from "@/lib/dates";

function std(wert: number): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Altersfreizeit als Stundenkonto.
 *
 * Eingetragen wird der aktuelle Stand in Stunden mit Datum (z. B. aus der
 * Lohnabrechnung). Darauf baut die Datenbank auf: je tatsächlich
 * gearbeitetem Tag danach +0,83 Std., je AF-Tag −8 Std.
 *
 * Eintragen dürfen Administration und Schichtleitung; das Geburtsdatum
 * korrigiert nur die Administration.
 */
export function AgeLeaveTable() {
  const { role } = useSession();
  const istAdmin = role === "admin";
  const [zeilen, setZeilen] = useState<LiveAfUebersichtZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [state, action] = useActionState(setAfStand, {} as FormState);
  const [gebState, gebAction] = useActionState(setBirthDate, {} as FormState);

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
  }, [laden, state.success, gebState.success]);

  const freigeschaltet = (zeilen ?? []).filter((z) => z.freigeschaltetAb).length;
  const heute = new Date().toISOString().slice(0, 10);

  const meldung = state.error ?? gebState.error;
  const erfolg = state.success ?? gebState.success;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Trage den <strong>aktuellen Stand in Stunden</strong> ein, mit dem Datum, zu dem er gilt
        (z. B. aus der Lohnabrechnung). Ab dem Folgetag kommen je tatsächlich gearbeitetem Tag
        0,83 Std. dazu, je AF-Tag gehen 8 Std. ab. Auch schon eingeplante AF-Tage nach dem Datum
        werden abgezogen.
      </Alert>

      <Card>
        <CardHeader
          title="Altersfreizeit"
          hint={zeilen === null ? undefined : `${freigeschaltet} mit Stundenkonto`}
        />
        {fehler ? (
          <div className="px-5 pt-4">
            <Alert tone="error">{fehler}</Alert>
          </div>
        ) : null}
        {meldung ? (
          <div className="px-5 pt-4">
            <Alert tone="error">{meldung}</Alert>
          </div>
        ) : null}
        {erfolg ? (
          <div className="px-5 pt-4">
            <Alert tone="success">{erfolg}</Alert>
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
                        : "Geburtsdatum nicht eingetragen"}
                    </p>
                  </div>
                  {z.freigeschaltetAb ? (
                    <Badge tone={z.verfuegbar < 0 ? "critical" : "ok"}>
                      {std(z.standStunden)} Std. · {formatDays(z.verfuegbar)} AF-Tage
                    </Badge>
                  ) : (
                    <Badge tone="neutral">kein Stand eingetragen</Badge>
                  )}
                </div>

                {z.freigeschaltetAb ? (
                  <p className="tnum mt-1.5 text-[12px] text-ink-muted">
                    {std(z.startStunden)} Std. am {formatDE(z.freigeschaltetAb)} + {z.arbeitstage}{" "}
                    Arbeitstage ({std(z.stundenAngespart)} Std.) − {formatDays(z.genommen)} genommene
                    {z.beantragt > 0 ? ` und ${formatDays(z.beantragt)} beantragte` : ""} AF-Tage × 8
                    Std. = <span className="font-semibold text-ink">{std(z.standStunden)} Std.</span>
                  </p>
                ) : null}

                <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="employee_id" value={z.employeeId} />
                  <label className="text-[12px] text-ink-muted" htmlFor={`std-${z.employeeId}`}>
                    Stand
                  </label>
                  <input
                    id={`std-${z.employeeId}`}
                    name="stunden"
                    type="text"
                    inputMode="decimal"
                    placeholder="Std."
                    defaultValue={z.freigeschaltetAb ? String(z.startStunden).replace(".", ",") : ""}
                    className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                  <label className="text-[12px] text-ink-muted" htmlFor={`am-${z.employeeId}`}>
                    Std. am
                  </label>
                  <input
                    id={`am-${z.employeeId}`}
                    name="stichtag"
                    type="date"
                    max={heute}
                    defaultValue={z.freigeschaltetAb ?? heute}
                    className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                  <SpeichernKnopf text="Speichern" />
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

                {/* Geburtsdatum korrigieren: nur Administration, und nur wer
                    schon einen Zugang hat – das Datum hängt am Zugang. */}
                {istAdmin && z.hatProfil ? (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[12px] text-ink-faint hover:text-ink">
                      Geburtsdatum korrigieren
                    </summary>
                    <form action={gebAction} className="mt-1.5 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="employee_id" value={z.employeeId} />
                      <input
                        name="birth_date"
                        type="date"
                        max={heute}
                        defaultValue={z.birthDate ?? ""}
                        aria-label={`Geburtsdatum von ${z.employeeName}`}
                        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                      />
                      <SpeichernKnopf text="Übernehmen" />
                    </form>
                  </details>
                ) : null}
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <p className="text-[12px] leading-snug text-ink-faint">
        Sonderurlaub: 4 Tage im Jahr ab dem Jahr nach dem 55. Geburtstag – automatisch aus dem
        Geburtsdatum. Das Geburtsdatum trägt jede Person einmal selbst ein, danach kann es nur
        die Administration ändern. Jede Änderung wird mit Person, Zeitpunkt und altem Wert
        protokolliert.
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
