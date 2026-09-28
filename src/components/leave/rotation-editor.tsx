"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/ui/skeleton";
import { formatDE, addDays } from "@/lib/dates";
import { TODAY } from "@/lib/demo-data";
import { fetchShiftAssignments, DataError } from "@/lib/data/rotation";
import { fetchShiftOptions, type ShiftOption } from "@/lib/data/shifts";
import { fetchEmployees } from "@/lib/data/employees";
import { assignShift, removeShiftAssignment } from "@/lib/auth/rotation-actions";
import type { FormState } from "@/lib/auth/form-state";
import type { EmployeeRecord, LiveShiftAssignment } from "@/lib/types";

const initialState: FormState = {};

/**
 * Schichtwechsel: eine Person an einem einzelnen Tag in eine andere Schicht
 * setzen – ohne ihre feste Schichtgruppe zu ändern. Steht im Schichtplan
 * direkt unter den Abwesenheiten (vorher als „Neue Ausnahme“ unter
 * Verwaltung → Schichten). Die Besetzung zählt die Person an dem Tag in der
 * neuen Schicht.
 *
 * `onSaved` lädt den Plan darüber neu, damit der Wechsel sofort sichtbar ist.
 */
export function RotationEditor({
  companyId,
  onSaved,
}: {
  companyId: string;
  onSaved?: () => void;
}) {
  const [assignments, setAssignments] = useState<LiveShiftAssignment[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(assignShift, initialState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [assignmentResult, employeeResult, shiftResult] = await Promise.all([
        fetchShiftAssignments(companyId, TODAY, addDays(TODAY, 27)),
        fetchEmployees(),
        fetchShiftOptions(),
      ]);
      setAssignments(assignmentResult);
      setEmployees(employeeResult.filter((e) => e.active));
      setShifts(shiftResult);
    } catch (caught) {
      setAssignments([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.success) {
      load();
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await removeShiftAssignment(id);
      if (result.error) setError(result.error);
      setBusyId(null);
      void load();
      if (!result.error) onSaved?.();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Schichtwechsel"
        hint="Eine Person für einen Tag in eine andere Schicht setzen – auch Tagschicht und auch am Wochenende. Die feste Schichtgruppe bleibt, die Besetzung zählt die Person an dem Tag in der neuen Schicht."
      />

      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <CardBody className="space-y-3 px-3 py-3">
        {assignments === null ? (
          <RowSkeleton rows={2} />
        ) : assignments.length === 0 ? (
          <EmptyState title="Keine Schichtwechsel in den nächsten vier Wochen." />
        ) : (
          assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.employeeName}</p>
                <p className="text-[12px] text-ink-muted">
                  {formatDE(a.date)} · {a.shiftName || "frei"}
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                disabled={pending && busyId === a.id}
                className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-crit-bg hover:text-crit-fg"
                aria-label="Schichtwechsel entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </CardBody>

      <div className="border-t border-line px-5 py-4">
        <p className="mb-3 text-[13px] font-medium">Neuer Schichtwechsel</p>
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
