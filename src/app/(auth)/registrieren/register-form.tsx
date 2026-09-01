"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { registerCompany, type FormState } from "@/lib/auth/company-actions";

const initialState: FormState = {};

export function RegisterForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction] = useActionState(registerCompany, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Unternehmensname">
        <Input name="company_name" required placeholder="Muster GmbH" disabled={disabled} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vorname">
          <Input name="first_name" required disabled={disabled} />
        </Field>
        <Field label="Nachname">
          <Input name="last_name" required disabled={disabled} />
        </Field>
      </div>

      <Field label="E-Mail">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="du@unternehmen.de"
          disabled={disabled}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Passwort">
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={disabled}
          />
        </Field>
        <Field label="Passwort wiederholen">
          <Input
            type="password"
            name="password_repeat"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={disabled}
          />
        </Field>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SubmitButton disabled={disabled} />

      <p className="text-[12px] leading-snug text-ink-faint">
        Deine Daten sind vollständig von anderen Unternehmen getrennt – niemand außerhalb
        deines eigenen Unternehmens kann sie sehen.
      </p>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Wird angelegt …" : "Unternehmen anlegen"}
    </Button>
  );
}
