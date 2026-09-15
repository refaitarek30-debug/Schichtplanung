"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createAbsence } from "@/lib/auth/absence-actions";
import type { FormState } from "@/lib/auth/form-state";
import type { EmployeeRecord } from "@/lib/types";

const initialState: FormState = {};

const TYPES = [
  { value: "krank", label: "Krankheit" },
  { value: "schulung", label: "Schulung" },
  { value: "sonstiges", label: "Sonstiges" },
];

export function AddAbsenceForm({
  employees,
  onSaved,
}: {
  employees: EmployeeRecord[];
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState(createAbsence, initialState);
  // Ein Tag ist der Normalfall; das Ende zieht deshalb mit dem Beginn mit,
  // solange es nicht von Hand gesetzt wurde.
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title="Abwesenheit erfassen"
        hint="Krankheit, Schulung oder Sonstiges – für einen Tag oder über Wochen. Wirkt sich sofort auf die Besetzung aus."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Mitarbeiter">
              <select
                name="employee_id"
                required
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">auswählen …</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Von">
              <Input
                type="date"
                name="date_from"
                required
                value={von}
                onChange={(e) => {
                  setVon(e.target.value);
                  if (!bis || bis < e.target.value) setBis(e.target.value);
                }}
              />
            </Field>
            <Field label="Bis">
              <Input
                type="date"
                name="date_to"
                required
                min={von || undefined}
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </Field>
            <Field label="Art">
              <select
                name="type"
                defaultValue="krank"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notiz (optional)">
            <Input name="note" placeholder="z. B. Gefahrgut-Auffrischung" />
          </Field>

          <p className="text-[12px] leading-snug text-ink-faint">
            Erfasst wird nur an eingeplanten Arbeitstagen. Freie Tage aus dem
            Rotationsmuster überspringt die Anwendung – dort ändert eine Abwesenheit
            nichts an der Besetzung.
          </p>

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <SubmitButton />
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Erfassen"}
    </Button>
  );
}
