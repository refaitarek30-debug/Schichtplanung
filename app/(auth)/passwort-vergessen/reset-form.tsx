"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { passwortMitCode } from "@/lib/auth/passwort-code";
import type { FormState } from "@/lib/auth/form-state";

export function CodeForm() {
  const [state, formAction] = useActionState(passwortMitCode, {} as FormState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="E-Mail oder Spitzname">
        <Input
          type="text"
          name="kennung"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
      </Field>
      <Field label="Code" hint="10 Zeichen, Groß- und Kleinschreibung egal">
        <Input
          type="text"
          name="code"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={40}
          placeholder="XXXXX-XXXXX"
          className="font-mono text-[16px] tracking-[0.12em]"
        />
      </Field>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Weiter />
    </form>
  );
}

function Weiter() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Wird geprüft …" : "Weiter"}
    </Button>
  );
}
