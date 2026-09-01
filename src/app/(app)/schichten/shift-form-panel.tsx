"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createShift, updateShift } from "@/lib/auth/shift-actions";
import type { FormState } from "@/lib/auth/actions";
import type { ShiftDetail } from "@/lib/data/shifts";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { cn } from "@/lib/utils";

const initialState: FormState = {};
// Reihenfolge Mo..So, Wert entspricht dem in der DB verwendeten Wochentag
// (0 = So .. 6 = Sa), identisch zur bestehenden Anzeige in schichten/page.tsx.
const weekdayOptions = WEEKDAY_SHORT.map((label, index) => ({
  label,
  value: (index + 1) % 7,
}));

export function ShiftFormPanel({
  shift,
  onDone,
  onCancel,
}: {
  shift?: ShiftDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(shift);
  const [state, formAction] = useActionState(isEdit ? updateShift : createShift, initialState);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title={isEdit ? `${shift!.name} bearbeiten` : "Neue Schicht"}
        hint="Änderungen wirken sich sofort auf alle Besetzungsprüfungen aus."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={shift!.id} /> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input name="name" defaultValue={shift?.name} placeholder="z. B. Frühschicht" required />
            </Field>
            <Field label="Kurzname">
              <Input name="short_name" defaultValue={shift?.shortName} placeholder="z. B. F" required />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Beginn">
              <Input name="start_time" type="time" defaultValue={shift?.startTime} required />
            </Field>
            <Field label="Ende">
              <Input name="end_time" type="time" defaultValue={shift?.endTime} required />
            </Field>
            <Field label="Farbe">
              <Input name="color" type="color" defaultValue={shift?.color ?? "#2F5BEA"} className="h-[42px] p-1" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mindestbesetzung">
              <Input
                name="minimum_staff"
                type="number"
                min="0"
                step="1"
                defaultValue={shift?.minimumStaff ?? 0}
                required
              />
            </Field>
            <Field label="Soll-Besetzung">
              <Input
                name="target_staff"
                type="number"
                min="0"
                step="1"
                defaultValue={shift?.targetStaff ?? 0}
                required
              />
            </Field>
          </div>

          <Field label="Gefahren an">
            <div className="flex flex-wrap gap-2">
              {weekdayOptions.map((day) => (
                <label
                  key={day.value}
                  className={cn(
                    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line text-[12px] font-medium",
                    "has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700",
                  )}
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day.value}
                    defaultChecked={shift ? shift.weekdays.includes(day.value) : day.value >= 1 && day.value <= 5}
                    className="sr-only"
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </Field>

          {isEdit ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={shift?.active ?? true} />
              Schicht aktiv
            </label>
          ) : null}

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <div className="flex gap-2">
            <SubmitButton isEdit={isEdit} />
            <Button type="button" variant="secondary" onClick={onCancel}>
              Abbrechen
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : isEdit ? "Speichern" : "Schicht anlegen"}
    </Button>
  );
}
