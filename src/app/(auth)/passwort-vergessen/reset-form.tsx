"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";

export function ResetForm() {
  const [state, formAction] = useActionState(requestPasswordReset, {} as FormState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="E-Mail">
        <Input type="email" name="email" autoComplete="email" required />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Wird gesendet …" : "Link senden"}
    </Button>
  );
}
