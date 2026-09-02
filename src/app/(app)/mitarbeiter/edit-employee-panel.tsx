"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { QualificationCheckboxes } from "@/components/leave/qualification-checkboxes";
import { updateEmployee } from "@/lib/auth/employee-actions";
import type { FormState } from "@/lib/auth/actions";
import { ROTATION_TEAMS } from "@/lib/qualifications";
import { roleLabels } from "@/lib/nav";
import type { EmployeeRecord, Role } from "@/lib/types";

const initialState: FormState = {};
const roles: Role[] = ["employee", "shift_leader", "admin"];

/**
 * Bestehenden Mitarbeiter bearbeiten. Für Schichtleitung und Administration.
 * Die Rollenauswahl ist für die Schichtleitung gesperrt – das erzwingt
 * zusätzlich ein Datenbank-Trigger, das Ausgrauen hier ist nur die
 * freundliche Variante davon.
 */
export function EditEmployeePanel({
  employee,
  canEditRole,
  onSaved,
  onCancel,
}: {
  employee: EmployeeRecord;
  canEditRole: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState(updateEmployee, initialState);

  useEffect(() => {
    if (state.success) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title={`${employee.firstName} ${employee.lastName} bearbeiten`}
        hint="Änderungen wirken sich sofort auf Schichtplan und Besetzungsrechnung aus."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="employee_id" value={employee.id} />

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
              <Input name="email" type="email" defaultValue={employee.email ?? ""} />
            </Field>
            <Field label="Personalnummer">
              <Input name="personnel_number" defaultValue={employee.personnelNumber ?? ""} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Abteilung">
              <Input name="department" defaultValue={employee.department ?? ""} />
            </Field>
            <Field label="Schichtgruppe" hint="Leer = kein Rotationsbetrieb.">
              <select
                name="rotation_team"
                defaultValue={employee.rotationTeam ?? ""}
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
            <Field
              label="Rolle"
              hint={canEditRole ? undefined : "Nur die Administration darf Rollen vergeben."}
            >
              <select
                name="role"
                defaultValue={employee.role}
                disabled={!canEditRole}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm disabled:bg-surface-muted disabled:text-ink-faint"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
              {/* Bei gesperrtem Feld sendet der Browser nichts – Wert mitschicken,
                  damit die Rolle unverändert bleibt statt zurückzufallen. */}
              {!canEditRole ? (
                <input type="hidden" name="role" value={employee.role} />
              ) : null}
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Urlaubsanspruch (Tage/Jahr)">
              <Input
                name="vacation_days"
                type="number"
                step="0.5"
                min="0"
                defaultValue={String(employee.vacationDays)}
              />
            </Field>
            <Field label="Status">
              <select
                name="active"
                defaultValue={employee.active ? "true" : "false"}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="true">Aktiv</option>
                <option value="false">Deaktiviert</option>
              </select>
            </Field>
          </div>

          <QualificationCheckboxes defaultValues={employee.qualifications} />

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <div className="flex gap-2">
            <SubmitButton />
            <Button type="button" variant="ghost" onClick={onCancel}>
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
      {pending ? "Wird gespeichert …" : "Änderungen speichern"}
    </Button>
  );
}
