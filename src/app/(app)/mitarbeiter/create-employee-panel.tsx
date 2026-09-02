"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createEmployee } from "@/lib/auth/employee-actions";
import type { FormState } from "@/lib/auth/actions";
import { roleLabels } from "@/lib/nav";
import { QualificationCheckboxes } from "@/components/leave/qualification-checkboxes";
import { ROTATION_TEAMS } from "@/lib/qualifications";
import type { Role } from "@/lib/types";

const initialState: FormState = {};
const roles: Role[] = ["employee", "shift_leader", "admin"];

export function CreateEmployeePanel({ onCreated }: { onCreated: () => void }) {
  const [state, formAction] = useActionState(createEmployee, initialState);

  useEffect(() => {
    if (state.success) onCreated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title="Neuer Mitarbeiter"
        hint="Legt den Personalstammsatz an. Mit E-Mail-Adresse kann anschließend eine Einladung verschickt werden."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vorname">
              <Input name="first_name" required />
            </Field>
            <Field label="Nachname">
              <Input name="last_name" required />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-Mail" hint="Wird für die Einladung gebraucht.">
              <Input name="email" type="email" placeholder="name@unternehmen.de" />
            </Field>
            <Field label="Personalnummer">
              <Input name="personnel_number" placeholder="z. B. 10019" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Abteilung">
              <Input name="department" placeholder="z. B. Produktion" />
            </Field>
            <Field label="Schichtgruppe" hint="Leer = kein Rotationsbetrieb.">
              <select
                name="rotation_team"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">keine Rotation</option>
                {ROTATION_TEAMS.map((team) => (
                  <option key={team} value={team}>
                    Schicht {team}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rolle">
              <select
                name="role"
                defaultValue="employee"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Urlaubsanspruch (Tage/Jahr)">
            <Input name="vacation_days" type="number" step="0.5" min="0" defaultValue="30" />
          </Field>

          <QualificationCheckboxes />

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
      {pending ? "Wird angelegt …" : "Mitarbeiter anlegen"}
    </Button>
  );
}
