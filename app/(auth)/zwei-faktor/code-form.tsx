"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { zweiFaktorPruefen } from "@/lib/auth/zwei-faktor-actions";
import type { FormState } from "@/lib/auth/form-state";

function Absenden() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Wird geprüft …" : "Bestätigen"}
    </Button>
  );
}

export function CodeForm({ weiter }: { weiter: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(zweiFaktorPruefen, {});
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="weiter" value={weiter} />
      <Field label="Code aus der App">
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          placeholder="123456"
          className="text-center text-[22px] tracking-[0.3em]"
        />
      </Field>
      <label className="flex items-start gap-2.5 text-[14px] leading-snug">
        <input type="checkbox" name="merken" defaultChecked className="mt-0.5 h-4 w-4" data-geraet-merken />
        <span>
          Diesem Gerät 30 Tage vertrauen
          <span className="block text-[12.5px] text-ink-muted">
            Danach reicht hier das Passwort. Nach 7 Tagen ohne Anmeldung fragt ShiftNexo wieder. Nicht auf fremden oder
            geteilten Geräten.
          </span>
        </span>
      </label>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Absenden />
    </form>
  );
}
