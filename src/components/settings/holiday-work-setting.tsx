"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fetchWorkOnHolidays } from "@/lib/data/notifications";
import { setWorkOnHolidays } from "@/lib/auth/settings-actions";

/**
 * Wird an Feiertagen gearbeitet?
 *
 * Diese Regel ändert, wie viel Urlaub ein Antrag kostet – sie darf nicht
 * unsichtbar in einer Datenbankfunktion stehen. Vorgabe ist „ja": so
 * arbeiten Schichtbetriebe, und genau daran hing ein stiller Fehler, bei
 * dem Urlaubstage verschwanden.
 */
export function HolidayWorkSetting({ canManage }: { canManage: boolean }) {
  const [aktiv, setAktiv] = useState<boolean | null>(null);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchWorkOnHolidays()
      .then(setAktiv)
      .catch(() => setAktiv(true));
  }, []);

  function umschalten() {
    if (aktiv === null || !canManage) return;
    const naechste = !aktiv;
    setAktiv(naechste);
    setMeldung({});
    startTransition(async () => {
      const result = await setWorkOnHolidays(naechste);
      setMeldung(result);
      if (result.error) setAktiv(!naechste);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Feiertage"
        hint="Entscheidet, ob ein Feiertag als Schichttag gilt – und damit, ob er einen Urlaubstag kostet."
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">An Feiertagen wird gearbeitet</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
              {aktiv === false
                ? "Aus: Feiertage sind für alle frei. Sie zählen nicht zur Besetzung und kosten keinen Urlaubstag."
                : "An: Der Schichtplan läuft über Feiertage hinweg. Wer an einem Feiertag eingeplant ist und Urlaub nimmt, zahlt dafür einen Urlaubstag. Ohne Schichtgruppe bleibt der Feiertag frei."}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={aktiv ?? false}
            aria-label="An Feiertagen wird gearbeitet"
            disabled={aktiv === null || pending || !canManage}
            onClick={umschalten}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              aktiv ? "bg-brand-500" : "bg-surface-sunken"
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                aktiv ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

        <p className="text-[12px] leading-snug text-ink-faint">
          Die Umstellung wirkt sofort auf alle Berechnungen – auch auf Anträge, die
          schon gestellt, aber noch nicht entschieden sind.
        </p>
      </CardBody>
    </Card>
  );
}
