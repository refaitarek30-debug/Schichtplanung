"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { setBirthDate, setStundenstand, vTageBuchen } from "@/lib/auth/age-leave-actions";
import type { FormState } from "@/lib/auth/form-state";
import { DataError } from "@/lib/data/leave";
import {
  fetchAfUebersicht,
  fetchVTageUebersicht,
  type LiveAfUebersichtZeile,
  type LiveStundenkontoKurz,
  type LiveVTageZeile,
} from "@/lib/data/age-leave";
import { useSession } from "@/context/session";
import { formatDE, formatDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

function std(wert: number): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ARTEN = {
  af: { titel: "AF", farbe: "border-l-shift-altersfrei" },
} as const;

/**
 * Altersfreizeit als Stundenkonto und V-Tage in Tagen.
 *
 * AF: eingetragen wird der Stand in Stunden mit Datum (aus der Abrechnung).
 * Darauf baut die Datenbank auf – je tatsächlich gearbeiteter Schicht
 * +0,83 Std., je AF-Tag −8 Std. Gerechnet wird nur mit Angespartem.
 *
 * V-Tage: schlicht in Tagen. Die Führung fügt Tage hinzu oder zieht sie ab;
 * die Schichtleitung nur für die eigene Schicht.
 *
 * Eintragen dürfen Administration und Schichtleitung; das Geburtsdatum
 * korrigiert nur die Administration.
 */
export function AgeLeaveTable() {
  const { role } = useSession();
  const istAdmin = role === "admin";
  const [zeilen, setZeilen] = useState<LiveAfUebersichtZeile[] | null>(null);
  const [vTage, setVTage] = useState<Map<string, LiveVTageZeile>>(new Map());
  const jetzt = new Date().getFullYear();
  const [jahr, setJahr] = useState(jetzt);
  const [fehler, setFehler] = useState<string | null>(null);
  const [state, action] = useActionState(setStundenstand, {} as FormState);
  const [gebState, gebAction] = useActionState(setBirthDate, {} as FormState);
  const [vState, vAction] = useActionState(vTageBuchen, {} as FormState);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const [af, v] = await Promise.all([fetchAfUebersicht(), fetchVTageUebersicht(jahr)]);
      setZeilen(af);
      setVTage(v);
    } catch (caught) {
      setZeilen([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [jahr]);

  useEffect(() => {
    void laden();
  }, [laden, state.success, gebState.success, vState.success]);

  const heute = new Date().toISOString().slice(0, 10);
  const meldung = state.error ?? gebState.error ?? vState.error;
  const erfolg = state.success ?? gebState.success ?? vState.success;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        <strong>AF:</strong> aktuellen Stand in Stunden mit Datum eintragen (aus der Abrechnung).
        Danach rechnet die App weiter: je gearbeiteter Schicht +0,83 Std., je AF-Tag −8 Std.{" "}
        <strong>V-Tage:</strong> werden in Tagen geführt – einfach Tage hinzufügen oder abziehen.
      </Alert>

      <Card>
        <CardHeader
          title="AF-Stunden und V-Tage"
          action={
            <select
              value={jahr}
              onChange={(e) => setJahr(Number(e.target.value))}
              aria-label="Jahr für die V-Tage"
              className="tnum rounded-lg border border-line bg-surface px-2 py-1 text-[13px]"
            >
              {[jetzt, jetzt + 1].map((y) => (
                <option key={y} value={y}>
                  V-Tage {y}
                </option>
              ))}
            </select>
          }
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
                  <KontoZeile
                    art="af"
                    konto={z.af}
                    employeeId={z.employeeId}
                    heute={heute}
                    action={action}
                  />
                  <VTageKonto
                    konto={vTage.get(z.employeeId) ?? null}
                    employeeId={z.employeeId}
                    name={z.employeeName}
                    jahr={jahr}
                    action={vAction}
                  />
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
        V-Tage dürfen ins Minus, AF nicht. Jede Änderung an den V-Tagen steht mit Person, Zeitpunkt
        und Grund im Protokoll. Sonderurlaub: 4 Tage im Jahr ab dem Jahr nach dem 55.
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
  art: "af";
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
        <span className="text-[13px] font-semibold">Altersfreizeit</span>
        {konto.ab ? (
          <span
            className={cn(
              "tnum rounded-full px-2.5 py-0.5 text-[15px] font-semibold",
              konto.stand < 0
                ? "bg-crit-bg text-crit-fg"
                : ueberplant
                  ? "bg-warn-bg text-warn-fg"
                  : "bg-ok-bg text-ok-fg",
            )}
          >
            {formatDays(Math.max(konto.moeglich, 0))} Tage frei
          </span>
        ) : (
          <span className="text-[12px] text-ink-faint">kein Stand eingetragen</span>
        )}
      </div>
      {konto.ab ? (
        <p className="tnum mt-1 text-[11px] leading-snug text-ink-muted">
          {std(konto.stand)} Std. angespart
          {konto.genommen > 0 ? ` · ${formatDays(konto.genommen)} genommen` : ""}
          {konto.verplant > 0 ? ` · ${formatDays(konto.verplant)} eingeplant` : ""}
          {ueberplant ? " · mehr eingeplant als angespart" : ""}
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

/**
 * V-Tage einer Person: Stand in Tagen, darunter Hinzufügen und Abziehen.
 * Die Schichtleitung sieht die Knöpfe nur bei der eigenen Schicht.
 */
function VTageKonto({
  konto,
  employeeId,
  name,
  jahr,
  action,
}: {
  konto: LiveVTageZeile | null;
  employeeId: string;
  name: string;
  jahr: number;
  action: (form: FormData) => void;
}) {
  return (
    <div className="rounded-lg border border-l-4 border-line border-l-shift-vtag px-2.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">V-Tage {jahr}</span>
        {konto ? (
          <span
            className={cn(
              "tnum rounded-full px-2.5 py-0.5 text-[15px] font-semibold",
              konto.rest < 0 ? "bg-crit-bg text-crit-fg" : "bg-shift-vtag/20 text-ink",
            )}
          >
            {formatDays(konto.rest)} {Math.abs(konto.rest) === 1 ? "Tag" : "Tage"}
          </span>
        ) : (
          <span className="text-[12px] text-ink-faint">kein Konto</span>
        )}
      </div>
      {konto ? (
        <p className="tnum mt-1 text-[11px] leading-snug text-ink-muted">
          {formatDays(konto.anspruch)} Anspruch
          {konto.uebertrag > 0 ? ` + ${formatDays(konto.uebertrag)} Übertrag` : ""}
          {konto.korrektur !== 0
            ? ` ${konto.korrektur > 0 ? "+" : "−"} ${formatDays(Math.abs(konto.korrektur))} ${
                konto.korrektur > 0 ? "hinzugefügt" : "abgezogen"
              }`
            : ""}
          {konto.genommen > 0 ? ` − ${formatDays(konto.genommen)} genommen` : ""}
          {konto.beantragt > 0 ? ` − ${formatDays(konto.beantragt)} beantragt` : ""}
        </p>
      ) : null}
      {konto?.darfBuchen ? (
        <form action={action} className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="employee_id" value={employeeId} />
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="jahr" value={jahr} />
          <input
            name="tage"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0.5"
            max="100"
            defaultValue="1"
            aria-label={`Anzahl V-Tage für ${name}`}
            className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand-500"
          />
          <span className="text-[12px] text-ink-muted">Tage</span>
          <VKnopf richtung="auf" />
          <VKnopf richtung="ab" />
          <input
            name="grund"
            type="text"
            maxLength={200}
            placeholder="Grund (optional)"
            aria-label={`Grund für die Änderung bei ${name}`}
            className="min-w-0 flex-1 basis-40 rounded-lg border border-line bg-surface px-2 py-1 text-sm outline-none focus:border-brand-500"
          />
        </form>
      ) : konto ? (
        <p className="mt-1 text-[11px] text-ink-faint">Ändern kann die Schichtleitung dieser Schicht.</p>
      ) : null}
    </div>
  );
}

function VKnopf({ richtung }: { richtung: "auf" | "ab" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="richtung"
      value={richtung}
      disabled={pending}
      className={cn(
        "rounded-lg px-2.5 py-1 text-[13px] font-semibold text-white disabled:opacity-50",
        richtung === "auf" ? "bg-ok-fg" : "bg-crit-fg",
      )}
    >
      {richtung === "auf" ? "+ hinzufügen" : "− abziehen"}
    </button>
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
