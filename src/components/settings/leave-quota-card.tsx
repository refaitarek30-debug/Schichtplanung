"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { fetchCompanyRules } from "@/lib/data/staffing-rules";
import { saveLeaveQuotaRules } from "@/lib/auth/staffing-rule-actions";
import type { FormState } from "@/lib/auth/form-state";

/**
 * Wie viele Tage im Jahr stehen für Sonderurlaub, Bildungsurlaub und
 * Gewerkschaftstag zur Verfügung?
 *
 * Diese Zahlen gehören dem Betrieb, nicht der Anwendung – deshalb sind sie
 * hier einstellbar und stehen nicht als feste Zahl im Programm. Die
 * Vorgabewerte sind ein Startpunkt und kein Rechtsrat.
 *
 * Die Altersfreizeit fehlt hier bewusst: sie wird nicht pauschal für den
 * Betrieb festgelegt, sondern Person für Person unter Altersfreizeit.
 */
export function LeaveQuotaCard({ canManage }: { canManage: boolean }) {
  const [state, formAction] = useActionState(saveLeaveQuotaRules, {} as FormState);
  const [werte, setWerte] = useState<{
    sonderurlaub: number;
    bildungsurlaub: number;
    gewerkschaftstag: number;
  } | null>(null);

  useEffect(() => {
    fetchCompanyRules()
      .then((r) =>
        setWerte({
          sonderurlaub: r.sonderurlaubTageJahr,
          bildungsurlaub: r.bildungsurlaubTageJahr,
          gewerkschaftstag: r.gewerkschaftstagTageJahr,
        }),
      )
      .catch(() => setWerte({ sonderurlaub: 3, bildungsurlaub: 5, gewerkschaftstag: 3 }));
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title="Tage je Jahr für weitere Abwesenheitsarten"
        hint="Gilt je Person und Kalenderjahr. Die Anwendung weist Anträge darüber hinaus ab."
      />
      <CardBody>
        {werte === null ? (
          <p className="text-sm text-ink-muted">wird geladen …</p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Sonderurlaub">
                <Input
                  name="sonderurlaub_tage_jahr"
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  defaultValue={werte.sonderurlaub}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Bildungsurlaub" hint="Zusätzlich braucht es den Haken je Mitarbeiter.">
                <Input
                  name="bildungsurlaub_tage_jahr"
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  defaultValue={werte.bildungsurlaub}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Gewerkschaftstag">
                <Input
                  name="gewerkschaftstag_tage_jahr"
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  defaultValue={werte.gewerkschaftstag}
                  disabled={!canManage}
                />
              </Field>
            </div>

            <p className="text-[12px] leading-snug text-ink-faint">
              Eine 0 nimmt die Art aus dem Antragsformular. Bereits genehmigte Tage bleiben
              bestehen – eine gesenkte Grenze wirkt nur auf neue Anträge.
            </p>

            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            {state.success ? <Alert tone="success">{state.success}</Alert> : null}

            {canManage ? <SpeichernButton /> : null}
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function SpeichernButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "wird gespeichert …" : "Speichern"}
    </Button>
  );
}
