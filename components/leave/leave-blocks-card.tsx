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
import { formatDE } from "@/lib/dates";
import { fetchLeaveBlocks, DataError } from "@/lib/data/staffing-rules";
import { fetchShiftOptions, type ShiftOption } from "@/lib/data/shifts";
import { createLeaveBlock, deleteLeaveBlock } from "@/lib/auth/staffing-rule-actions";
import type { FormState } from "@/lib/auth/actions";
import type { LiveLeaveBlock } from "@/lib/types";

const initialState: FormState = {};

export function LeaveBlocksCard({ canManage }: { canManage: boolean }) {
  const [blocks, setBlocks] = useState<LiveLeaveBlock[] | null>(null);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(createLeaveBlock, initialState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [blockResult, shiftResult] = await Promise.all([
        fetchLeaveBlocks(),
        fetchShiftOptions(),
      ]);
      setBlocks(blockResult);
      setShifts(shiftResult);
    } catch (caught) {
      setBlocks([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.success) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteLeaveBlock(id);
      if (result.error) setError(result.error);
      setBusyId(null);
      void load();
    });
  }

  function shiftName(shiftId: string | null) {
    if (!shiftId) return "Unternehmensweit";
    return shifts.find((s) => s.id === shiftId)?.name ?? "Unbekannte Schicht";
  }

  return (
    <Card>
      <CardHeader
        title="Urlaubssperren"
        hint="In diesen Zeiträumen kann kein Urlaub beantragt werden – geprüft direkt beim Antrag."
      />

      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <CardBody className="space-y-3 px-3 py-3">
        {blocks === null ? (
          <RowSkeleton rows={2} />
        ) : blocks.length === 0 ? (
          <EmptyState title="Keine Urlaubssperren angelegt." />
        ) : (
          blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {formatDE(block.startDate)} – {formatDE(block.endDate)}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {shiftName(block.shiftId)} · {block.reason}
                </p>
              </div>
              {canManage ? (
                <button
                  onClick={() => remove(block.id)}
                  disabled={pending && busyId === block.id}
                  className="shrink-0 rounded-lg p-2 text-ink-faint hover:bg-crit-bg hover:text-crit-fg"
                  aria-label="Urlaubssperre entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))
        )}
      </CardBody>

      {canManage ? (
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-[13px] font-medium">Neue Urlaubssperre</p>
          <form action={formAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Von">
                <Input type="date" name="start_date" required />
              </Field>
              <Field label="Bis">
                <Input type="date" name="end_date" required />
              </Field>
              <Field label="Schicht" hint="leer = unternehmensweit">
                <select
                  name="shift_id"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                >
                  <option value="">Unternehmensweit</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Grund">
              <Input name="reason" placeholder="z. B. Betriebsferien" required />
            </Field>

            {state.error ? <Alert tone="error">{state.error}</Alert> : null}

            <SubmitButton />
          </form>
        </div>
      ) : null}
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Sperre anlegen"}
    </Button>
  );
}
