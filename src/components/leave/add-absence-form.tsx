"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createAbsence } from "@/lib/auth/absence-actions";
import type { FormState } from "@/lib/auth/actions";
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

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title="Abwesenheit erfassen"
        hint="Krankheit, Schulung oder Sonstiges – wirkt sich sofort auf die Besetzung aus."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <Field label="Datum">
              <Input type="date" name="date" required />
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
