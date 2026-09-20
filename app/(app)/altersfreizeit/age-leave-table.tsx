"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { confirmAgeLeave } from "@/lib/auth/age-leave-actions";
import type { FormState } from "@/lib/auth/form-state";
import { DataError } from "@/lib/data/leave";
import { fetchAgeLeaveOverview } from "@/lib/data/age-leave";
import type { LiveAgeLeaveRow } from "@/lib/types";

/**
 * Die Übersicht trennt zwei Dinge, die man nie verwechseln darf:
 *
 *   „Hinweis"    – aus dem Geburtsdatum gerechnet, unverbindlich
 *   „Festgelegt" – von einem Menschen entschieden, mit Name und Zeitpunkt
 *
 * Deshalb stehen sie in getrennten Spalten und nicht in einer. Ein
 * Vorschlag, der wie eine Zusage aussieht, wäre genau der Fehler, den die
 * Anforderung ausschließt.
 */
export function AgeLeaveTable({ jahr }: { jahr: number }) {
  const [zeilen, setZeilen] = useState<LiveAgeLeaveRow[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [state, action] = useActionState(confirmAgeLeave, {} as FormState);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      setZeilen(await fetchAgeLeaveOverview(jahr));
    } catch (caught) {
      setZeilen([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [jahr]);

  useEffect(() => {
    void laden();
  }, [laden, state.success]);

  const mitHinweis = (zeilen ?? []).filter((z) => z.autoPossible);
  const ohneGeburtsdatum = (zeilen ?? []).filter((z) => z.birthDate === null).length;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Ab 50 Jahren <strong>könnten</strong> rund 10 zusätzliche Tage in Frage kommen. Was
        tatsächlich zusteht, steht in Tarifvertrag oder Betriebsvereinbarung – die Anwendung
        rechnet das nur vor und legt nichts fest. Erst deine Eingabe hier gilt.
      </Alert>

      <Card>
        <CardHeader
          title={`Altersfreizeit ${jahr}`}
          hint={
            zeilen === null
              ? undefined
              : `${mitHinweis.length} mit Hinweis · ${ohneGeburtsdatum} ohne hinterlegtes Geburtsdatum`
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

        <CardBody className="px-3 py-3">
          {zeilen === null ? (
            <RowSkeleton rows={5} />
          ) : zeilen.length === 0 ? (
            <EmptyState title="Keine aktiven Mitarbeiter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-ink-muted">
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Gruppe</th>
                    <th className="px-2 py-2 font-medium">Geburtsdatum</th>
                    <th className="px-2 py-2 font-medium">Hinweis</th>
                    <th className="px-2 py-2 font-medium">Festgelegt</th>
                    <th className="px-2 py-2 font-medium">Entscheidung</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.employeeId} className="border-t border-line align-top">
                      <td className="px-2 py-3 font-medium">{z.employeeName}</td>
                      <td className="px-2 py-3 text-ink-muted">{z.rotationTeam ?? "–"}</td>
                      <td className="px-2 py-3 tnum text-ink-muted">
                        {z.birthDate ? (
                          <>
                            {new Date(z.birthDate).toLocaleDateString("de-DE")}
                            <span className="block text-[11px] text-ink-faint">
                              {z.ageInYear} Jahre in {jahr}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-faint">nicht hinterlegt</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {z.birthDate === null ? (
                          <span className="text-[12px] text-ink-faint">
                            ohne Datum kein Hinweis
                          </span>
                        ) : z.autoPossible ? (
                          <Badge tone="info">prüfen · ca. {z.suggestedDays} Tage</Badge>
                        ) : (
                          <span className="text-[12px] text-ink-faint">kein Hinweis</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {z.confirmed ? (
                          <>
                            <Badge tone="ok">{z.confirmedDays} Tage</Badge>
                            <span className="mt-1 block text-[11px] text-ink-faint">
                              {z.confirmedBy ?? "unbekannt"}
                              {z.confirmedAt
                                ? `, ${new Date(z.confirmedAt).toLocaleDateString("de-DE")}`
                                : ""}
                            </span>
                            {z.note ? (
                              <span className="mt-0.5 block text-[11px] text-ink-muted">
                                {z.note}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <Badge tone="neutral">offen</Badge>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <form action={action} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="employee_id" value={z.employeeId} />
                          <input type="hidden" name="year" value={jahr} />
                          <label className="sr-only" htmlFor={`tage-${z.employeeId}`}>
                            Tage für {z.employeeName}
                          </label>
                          <input
                            id={`tage-${z.employeeId}`}
                            name="days"
                            type="number"
                            min={0}
                            max={60}
                            step="0.5"
                            defaultValue={z.confirmed ? z.confirmedDays : ""}
                            placeholder="Tage"
                            className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                          />
                          <label className="sr-only" htmlFor={`notiz-${z.employeeId}`}>
                            Begründung für {z.employeeName}
                          </label>
                          <input
                            id={`notiz-${z.employeeId}`}
                            name="note"
                            type="text"
                            maxLength={200}
                            defaultValue={z.note ?? ""}
                            placeholder="Begründung (intern)"
                            className="w-44 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand-500"
                          />
                          <SpeichernKnopf />
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-[12px] leading-snug text-ink-faint">
        Die festgelegten Tage werden bewusst nicht selbsttätig ins Urlaubskonto gebucht – ein
        Konto im Nachhinein maschinell zu erhöhen wäre genau das eigenmächtige Festlegen, das
        hier ausgeschlossen ist. Trage den Wert bewusst unter Verwaltung ins Konto ein. Jede
        Änderung hier wird mit Person, Zeitpunkt und altem Wert protokolliert.
      </p>
    </div>
  );
}

function SpeichernKnopf() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-500 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
    >
      {pending ? "…" : "Festlegen"}
    </button>
  );
}
