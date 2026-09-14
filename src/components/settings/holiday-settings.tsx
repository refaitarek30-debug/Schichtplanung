"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/input";
import { formatDE, weekdayLong } from "@/lib/dates";
import { fetchCompanyState, fetchHolidays } from "@/lib/data/holidays";
import { setCompanyState } from "@/lib/auth/settings-actions";
import { GERMAN_STATES } from "@/lib/german-states";
import type { Holiday } from "@/lib/types";


/**
 * Feiertage: Bundesland wählen, den Rest rechnet die Datenbank aus.
 *
 * Ohne hinterlegte Feiertage zählt die Urlaubsberechnung sie als normale
 * Arbeitstage – genau das war bis eben der Fall, weil nur ein einzelnes
 * Jahr von Hand eingetragen war.
 */
export function HolidaySettings({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  function load() {
    fetchHolidays()
      .then(setHolidays)
      .catch(() => setHolidays([]));
  }

  useEffect(() => {
    fetchCompanyState()
      .then(setState)
      .catch(() => setState("NW"));
    load();
  }, []);

  const years = useMemo(() => {
    const found = new Set((holidays ?? []).map((h) => Number(h.date.slice(0, 4))));
    found.add(new Date().getFullYear());
    return [...found].sort();
  }, [holidays]);

  const shown = useMemo(
    () => (holidays ?? []).filter((h) => h.date.startsWith(String(year))),
    [holidays, year],
  );

  function change(next: string) {
    setState(next);
    setMsg({});
    startTransition(async () => {
      const result = await setCompanyState(next);
      setMsg(result);
      if (!result.error) load();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Feiertage"
        hint="werden aus dem Bundesland berechnet und fließen in jede Urlaubsberechnung ein"
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bundesland">
            <select
              value={state ?? "NW"}
              disabled={!canManage || pending || state === null}
              onChange={(e) => change(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm disabled:bg-surface-muted disabled:text-ink-faint"
            >
              {GERMAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Jahr">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {msg.error ? <Alert tone="error">{msg.error}</Alert> : null}
        {msg.success ? <Alert tone="success">{msg.success}</Alert> : null}

        {holidays === null ? (
          <p className="text-sm text-ink-muted">wird geladen …</p>
        ) : shown.length === 0 ? (
          <Alert tone="warning">
            Für {year} sind keine Feiertage hinterlegt. Solange das so ist, zählt jeder
            Feiertag als normaler Urlaubstag. Bundesland auswählen, dann werden sie erzeugt.
          </Alert>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {shown.map((holiday) => (
              <li
                key={holiday.date}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span>{holiday.name}</span>
                <span className="tnum text-ink-muted">
                  {weekdayLong(holiday.date).slice(0, 2)} · {formatDE(holiday.date)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <p className="text-[12px] leading-snug text-ink-faint">
            Beim Wechsel des Bundeslands werden die Feiertage der nächsten drei Jahre neu
            gesetzt. Von Hand eingetragene Betriebsruhe bleibt dabei erhalten.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
