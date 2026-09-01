"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLeaveEntitlement } from "@/lib/auth/leave-entitlement-actions";
import type { FormState } from "@/lib/auth/actions";

const initialState: FormState = {};

export function EntitlementEditor({
  employeeId,
  year,
  value,
  disabled,
  onSaved,
}: {
  employeeId: string;
  year: number;
  value: number | null;
  disabled?: boolean;
  onSaved: (nextValue: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(setLeaveEntitlement, initialState);

  useEffect(() => {
    if (state.success) {
      setEditing(false);
    }
  }, [state.success]);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="tnum flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-ink-muted hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        title="Urlaubsanspruch bearbeiten"
      >
        {value === null ? "Urlaub: –" : `Urlaub: ${value} Tage`}
        <Pencil className="h-3 w-3" />
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        formData.set("employee_id", employeeId);
        formData.set("year", String(year));
        const next = formData.get("entitlement");
        formAction(formData);
        if (next) onSaved(Number.parseFloat(String(next).replace(",", ".")));
      }}
      className="flex items-center gap-1.5"
    >
      <Input
        name="entitlement"
        type="number"
        step="0.5"
        min="0"
        defaultValue={value ?? 30}
        className="w-20 px-2 py-1.5 text-[13px]"
        autoFocus
      />
      <SaveButton />
      <Button type="button" variant="ghost" className="px-2 py-1.5" onClick={() => setEditing(false)}>
        Abbrechen
      </Button>
      {state.error ? <span className="text-[12px] text-crit-fg">{state.error}</span> : null}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" className="px-2 py-1.5" disabled={pending}>
      {pending ? "…" : "OK"}
    </Button>
  );
}
