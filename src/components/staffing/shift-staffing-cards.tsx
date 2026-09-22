"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { DataError } from "@/lib/data/employees";
import { fetchShiftStaffingOverview, type LiveShiftStaffing } from "@/lib/data/staffing";
import { saveShiftStaffing } from "@/lib/auth/shift-actions";
import type { FormState } from "@/lib/auth/form-state";
import { cn } from "@/lib/utils";

export function ShiftStaffingCards({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<LiveShiftStaffing[] | null>(null);
  const [details, setDetails] = useState<ShiftDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // "Zugeordnet" kommt aus shift_staffing_overview und damit aus dem
      // echten Plan des Tages. Vorher wurde gezählt, wer diese Schicht fest
      // zugeordnet hat – im Rotationsbetrieb ist das niemand, deshalb stand
      // dort immer 0.
      const [overview, detailResult] = await Promise.all([
        fetchShiftStaffingOverview(),
        fetchShiftDetails(),
      ]);
      setRows(overview);
      setDetails(detailResult);
    } catch (caught) {
      setRows([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (rows === null) return <p className="text-sm text-ink-muted">wird geladen …</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => {
        const detail = details.find((d) => d.id === row.shiftId);
        return (
          <ShiftStaffingCard
            key={row.shiftId}
            row={row}
            zeiten={detail ? `${detail.startTime}–${detail.endTime} Uhr` : undefined}
            weekdays={detail?.weekdays ?? []}
            canEdit={canEdit}
            onSaved={load}
          />
        );
      })}
    </div>
  );
}

/**
 * Eine Schicht mit ihren Besetzungsvorgaben.
 *
 * Soll und Mindest steuern jede Urlaubsentscheidung: `staffing_snapshot`
 * und `check_leave_staffing_impact` vergleichen die Anwesenheit genau
 * damit. Stehen sie auf 0, entsteht nie eine Warnung – deshalb sind sie
 * hier direkt bearbeitbar und nicht in einem Untermenü versteckt.
 */
function ShiftStaffingCard({
  row,
  zeiten,
  weekdays,
  canEdit,
  onSaved,
}: {
  row: LiveShiftStaffing;
  zeiten?: string;
  weekdays: number[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState(saveShiftStaffing, {} as FormState);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    if (state.success) {
      setOffen(false);
      onSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const ohneVorgabe = row.target === 0 && row.minimum === 0;

  return (
    <Card>
      <CardHeader title={row.shiftName} hint={zeiten} />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Zugeordnet" value={row.assigned} />
          <Metric label="Soll" value={row.target} />
          <Metric label="Mindest" value={row.minimum} />
        </div>

        {ohneVorgabe ? (
          <Alert tone="warning">
            Ohne Soll- und Mindestbesetzung prüft die Anwendung diese Schicht nicht. Urlaubsanträge
            lösen dann keine Warnung aus.
          </Alert>
        ) : null}

        <WeekdayRow weekdays={weekdays} />

        {canEdit ? (
          offen ? (
            <form action={formAction} className="space-y-3 border-t border-line pt-3">
              <input type="hidden" name="shift_id" value={row.shiftId} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Soll">
                  <Input
                    name="target_staff"
                    type="number"
                    min={0}
                    max={999}
                    step={1}
                    defaultValue={row.target}
                  />
                </Field>
                <Field label="Mindest">
                  <Input
                    name="minimum_staff"
                    type="number"
                    min={0}
                    max={999}
                    step={1}
                    defaultValue={row.minimum}
                  />
                </Field>
              </div>
              <p className="text-[12px] leading-snug text-ink-faint">
                Die Mindestbesetzung darf nicht über der Sollbesetzung liegen. Änderungen wirken
                sofort auf Urlaubsprüfung und Besetzungswarnungen.
              </p>
              {state.error ? <Alert tone="error">{state.error}</Alert> : null}
              <div className="flex gap-2">
                <SpeichernButton />
                <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                  Abbrechen
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setOffen(true)}>
              Besetzung bearbeiten
            </Button>
          )
        ) : null}
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


function WeekdayRow({ weekdays }: { weekdays: number[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        Laufende Tage
      </p>
      <div className="flex gap-1">
        {WEEKDAY_SHORT.map((label, index) => {
          const weekday = (index + 1) % 7;
          const active = weekdays.includes(weekday);
          return (
            <span
              key={label}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-medium",
                active ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint",
              )}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-muted px-2 py-2.5">
      <p className="tnum text-lg font-semibold tracking-tight">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}
