"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { updatePassword, type FormState } from "@/lib/auth/actions";

export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, {} as FormState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Neues Passwort">
        <Input type="password" name="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Passwort wiederholen">
        <Input
          type="password"
          name="password_repeat"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Passwort speichern"}
    </Button>
  );
}
