"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { GERMAN_STATES, stateName } from "@/lib/german-states";
import { setCompanyState } from "@/lib/auth/settings-actions";
import type { SetupState } from "@/lib/data/setup";

/**
 * Schritt 1 – Feiertage.
 *
 * Steht bewusst am Anfang: ohne hinterlegte Feiertage zählt die
 * Urlaubsberechnung sie als normale Arbeitstage, und jeder Antrag, der
 * vorher gestellt wurde, ist falsch gerechnet.
 */
export function SchrittBundesland({
  stand,
  onFertig,
}: {
  stand: SetupState | null;
  onFertig: () => void | Promise<void>;
}) {
  const [land, setLand] = useState(stand?.bundesland ?? "NW");
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  function speichern() {
    setMeldung({});
    startTransition(async () => {
      const result = await setCompanyState(land);
      setMeldung(result);
      if (!result.error) await onFertig();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Schritt 1 · In welchem Bundesland liegt der Betrieb?"
        hint="Daraus werden die gesetzlichen Feiertage der nächsten Jahre berechnet."
      />
      <CardBody className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          Feiertage kosten keinen Urlaubstag. Sind sie nicht hinterlegt, zählt die
          Berechnung sie als normale Arbeitstage – und jeder Antrag über einen Feiertag
          hinweg zieht einen Tag zu viel ab.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bundesland">
            <select
              value={land}
              disabled={pending}
              onChange={(e) => setLand(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm disabled:bg-surface-muted"
            >
              {GERMAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-[12px] text-ink-muted">Bereits hinterlegt</p>
            <p className="tnum mt-0.5 text-lg font-semibold">
              {stand?.feiertage ?? 0} Feiertage
            </p>
            {stand?.bundesland ? (
              <p className="mt-0.5 text-[12px] text-ink-faint">
                für {stateName(stand.bundesland) ?? stand.bundesland}
              </p>
            ) : null}
          </div>
        </div>

        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={speichern} disabled={pending}>
            {pending ? "Feiertage werden erzeugt …" : "Bundesland übernehmen"}
          </Button>
          <span className="text-[12px] text-ink-faint">
            Erzeugt die Feiertage der nächsten drei Jahre neu.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
