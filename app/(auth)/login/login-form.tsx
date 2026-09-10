"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signIn, type FormState } from "@/lib/auth/actions";

const initialState: FormState = {};

export function LoginForm({ next, disabled }: { next: string; disabled?: boolean }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="weiter" value={next} />

      <Field label="E-Mail">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="name@unternehmen.de"
          disabled={disabled}
        />
      </Field>

      <Field label="Passwort">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={disabled}
        />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton disabled={disabled} />

      <p className="text-center">
        <Link
          href="/passwort-vergessen"
          className="text-[13px] font-medium text-brand-600 hover:underline"
        >
          Passwort vergessen?
        </Link>
      </p>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Wird geprüft …" : "Einloggen"}
    </Button>
  );
}
