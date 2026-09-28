"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { TODAY } from "@/lib/demo-data";
import { DataError } from "@/lib/data/rotation";
import { fetchShiftOptions, type ShiftOption } from "@/lib/data/shifts";
import { fetchEmployees } from "@/lib/data/employees";
import { assignShift } from "@/lib/auth/rotation-actions";
import type { FormState } from "@/lib/auth/form-state";
import type { EmployeeRecord } from "@/lib/types";

const initialState: FormState = {};

/**
 * Schichtwechsel: eine Person an einem einzelnen Tag in eine andere Schicht
 * setzen – ohne ihre feste Schichtgruppe zu ändern. Steht im Schichtplan
 * direkt unter den Abwesenheiten.
 *
 * Nur das Formular: welche Wechsel es gibt, sieht man im Plan darüber.
 * Rückgängig machen geht dort über die Zelle (andere Schicht oder „Frei“).
 *
 * `onSaved` lädt den Plan neu, damit der Wechsel sofort sichtbar ist.
 */
export function RotationEditor({ onSaved }: { onSaved?: () => void }) {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(assignShift, initialState);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [employeeResult, shiftResult] = await Promise.all([
        fetchEmployees(),
        fetchShiftOptions(),
      ]);
      setEmployees(employeeResult.filter((e) => e.active));
      setShifts(shiftResult);
    } catch (caught) {
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.success) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader
        title="Schichtwechsel"
        hint="Eine Person für einen Tag in eine andere Schicht setzen – auch Tagschicht und auch am Wochenende. Die Besetzung zählt sie an dem Tag in der neuen Schicht."
      />

      <div className="px-5 py-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <form action={formAction} className="space-y-3">
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
              <Input type="date" name="date" required min={TODAY} />
            </Field>
            <Field label="Neue Schicht">
              <select
                name="shift_id"
                required
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">auswählen …</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">Schichtwechsel gespeichert.</Alert> : null}

          <SubmitButton />
        </form>
      </div>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Schicht wechseln"}
    </Button>
  );
}
