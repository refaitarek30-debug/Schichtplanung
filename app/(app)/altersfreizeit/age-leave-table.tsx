"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { setBirthDate, setStundenstand } from "@/lib/auth/age-leave-actions";
import type { FormState } from "@/lib/auth/form-state";
import { DataError } from "@/lib/data/leave";
import {
  fetchAfUebersicht,
  type LiveAfUebersichtZeile,
  type LiveStundenkontoKurz,
} from "@/lib/data/age-leave";
import { useSession } from "@/context/session";
import { formatDE, formatDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

function std(wert: number): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ARTEN = {
  af: { titel: "AF", satz: "0,83", kosten: 8, kostenText: "8", farbe: "border-l-shift-altersfrei" },
  v: { titel: "V", satz: "0,75", kosten: 7.5, kostenText: "7,5", farbe: "border-l-shift-vtag" },
} as const;

/**
 * Stundenkonten für Altersfreizeit und V-Tage.
 *
 * Eingetragen wird der Stand in Stunden mit Datum (aus der Abrechnung).
 * Darauf baut die Datenbank auf – je tatsächlich gearbeiteter Schicht
 * danach AF +0,83 / V +0,75 Std., je genommenem Tag AF −8 / V −7,5 Std.
 * Gerechnet wird nur mit Angespartem.
 *
 * Eintragen dürfen Administration und Schichtleitung; das Geburtsdatum
 * korrigiert nur die Administration.
 */
export function AgeLeaveTable() {
  const { role } = useSession();
  const istAdmin = role === "admin";
  const [zeilen, setZeilen] = useState<LiveAfUebersichtZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [state, action] = useActionState(setStundenstand, {} as FormState);
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

  const heute = new Date().toISOString().slice(0, 10);
  const meldung = state.error ?? gebState.error;
  const erfolg = state.success ?? gebState.success;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Trage je Person den <strong>aktuellen Stand in Stunden</strong> mit Datum ein (aus der
        Abrechnung). Ab dem Folgetag rechnet die App weiter: je tatsächlich gearbeiteter Schicht AF
        +0,83 Std. und V +0,75 Std., je AF-Tag −8 Std., je V-Tag −7,5 Std. Es zählt nur, was
        schon angespart ist.
      </Alert>

      <Card>
        <CardHeader title="Stundenkonten AF und V" />
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
              <div key={z.employeeId} className="rounded-xl border border-line px-3 py-2.5">
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

                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  {(["af", "v"] as const).map((art) => (
                    <KontoZeile
                      key={art}
                      art={art}
                      konto={z[art]}
                      employeeId={z.employeeId}
                      heute={heute}
                      action={action}
                    />
                  ))}
                </div>

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
        V-Tage dürfen ins Minus, AF nicht. Sonderurlaub: 4 Tage im Jahr ab dem Jahr nach dem 55.
        Geburtstag, automatisch aus dem Geburtsdatum. Jede Änderung wird mit Person, Zeitpunkt und
        altem Wert protokolliert.
      </p>
    </div>
  );
}

function KontoZeile({
  art,
  konto,
  employeeId,
  heute,
  action,
}: {
  art: "af" | "v";
  konto: LiveStundenkontoKurz;
  employeeId: string;
  heute: string;
  action: (form: FormData) => void;
}) {
  const a = ARTEN[art];
  const ueberplant = konto.ab !== null && konto.moeglich < 0;
  return (
    <div className={cn("rounded-lg border border-l-4 border-line px-2.5 py-2", a.farbe)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{a.titel}-Stunden</span>
        {konto.ab ? (
          <span
            className={cn(
              "tnum rounded-full px-2 py-0.5 text-[12px] font-medium",
              konto.stand < 0
                ? "bg-crit-bg text-crit-fg"
                : ueberplant
                  ? "bg-warn-bg text-warn-fg"
                  : "bg-ok-bg text-ok-fg",
            )}
          >
            {std(konto.stand)} Std. · noch {formatDays(Math.max(konto.moeglich, 0))} Tage
          </span>
        ) : (
          <span className="text-[12px] text-ink-faint">kein Stand eingetragen</span>
        )}
      </div>
      {konto.ab ? (
        <p className="tnum mt-1 text-[11px] leading-snug text-ink-muted">
          {std(konto.start)} am {formatDE(konto.ab)} + {konto.arbeitstage} Schichten ×{" "}
          {a.satz} ({std(konto.angespart)}) − {formatDays(konto.genommen)} genommen × {a.kostenText}
          {" "}= <span className="font-semibold text-ink">{std(konto.stand)} Std. heute</span>
          {konto.verplant > 0 ? ` · ${formatDays(konto.verplant)} Tage eingeplant` : ""}
          {ueberplant
            ? ` – eingeplant ist ${std(konto.verplant * a.kosten - konto.stand)} Std. mehr als da`
            : ""}
        </p>
      ) : null}
      <form action={action} className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="employee_id" value={employeeId} />
        <input type="hidden" name="art" value={art} />
        <input
          name="stunden"
          type="text"
          inputMode="decimal"
          placeholder="Std."
          aria-label={`${a.titel}-Stand in Stunden`}
          defaultValue={konto.ab ? String(konto.start).replace(".", ",") : ""}
          className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand-500"
        />
        <span className="text-[12px] text-ink-muted">am</span>
        <input
          name="stichtag"
          type="date"
          max={heute}
          aria-label={`${a.titel}-Stand gilt am`}
          defaultValue={konto.ab ?? heute}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand-500"
        />
        <SpeichernKnopf text="Speichern" />
        {konto.ab ? (
          <button
            type="submit"
            name="aufheben"
            value="1"
            className="rounded-lg px-1.5 py-1 text-[12px] font-medium text-ink-faint hover:text-crit-fg"
          >
            Aufheben
          </button>
        ) : null}
      </form>
    </div>
  );
}

function SpeichernKnopf({ text }: { text: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-2.5 py-1 text-[13px] font-medium text-white disabled:opacity-50"
    >
      {pending ? "…" : text}
    </button>
  );
}
