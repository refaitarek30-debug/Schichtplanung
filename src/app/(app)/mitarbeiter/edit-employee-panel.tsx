"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { updateEmployee } from "@/lib/auth/employee-actions";
import type { FormState } from "@/lib/auth/actions";
import { fetchShiftOptions, type ShiftOption } from "@/lib/data/shifts";
import { roleLabels } from "@/lib/nav";
import type { EmployeeRecord, Role } from "@/lib/types";

const initialState: FormState = {};
const roles: Role[] = ["employee", "shift_leader", "admin"];

export function EditEmployeePanel({
  employee,
  onSaved,
  onCancel,
}: {
  employee: EmployeeRecord;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState(updateEmployee, initialState);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);

  useEffect(() => {
    fetchShiftOptions()
      .then(setShifts)
      .catch(() => setShifts([]));
  }, []);

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title={`${employee.firstName} ${employee.lastName} bearbeiten`}
        hint="Änderungen an der Rolle wirken sich sofort auf die Berechtigungen aus."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={employee.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vorname">
              <Input name="first_name" defaultValue={employee.firstName} required />
            </Field>
            <Field label="Nachname">
              <Input name="last_name" defaultValue={employee.lastName} required />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-Mail" hint="Wird für die Einladung gebraucht.">
              <Input
                name="email"
                type="email"
                defaultValue={employee.email ?? ""}
                placeholder="name@unternehmen.de"
              />
            </Field>
            <Field label="Personalnummer">
              <Input
                name="personnel_number"
                defaultValue={employee.personnelNumber ?? ""}
                placeholder="z. B. 10019"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Abteilung">
              <Input
                name="department"
                defaultValue={employee.department ?? ""}
                placeholder="z. B. Produktion"
              />
            </Field>
            <Field label="Schicht">
              <select
                name="shift_id"
                defaultValue={employee.shiftId ?? ""}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">keine Zuordnung</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rolle">
              <select
                name="role"
                defaultValue={employee.role}
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

          <Field
            label="Urlaubsanspruch beim Anlegen (Tage/Jahr)"
            hint="Nur der Startwert für neue Jahre. Den laufenden Anspruch änderst du direkt in der Liste."
          >
            <Input
              name="vacation_days"
              type="number"
              step="0.5"
              min="0"
              defaultValue={employee.vacationDays}
            />
          </Field>

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <div className="flex gap-2">
            <SubmitButton />
            <Button type="button" variant="secondary" onClick={onCancel}>
              Abbrechen
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Speichern"}
    </Button>
  );
}
