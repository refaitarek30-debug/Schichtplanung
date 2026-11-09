"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { PasswortInput } from "@/components/ui/passwort-input";
import { changeOwnPassword } from "@/lib/auth/passwort-aendern";
import type { FormState } from "@/lib/auth/form-state";
import { PASSWORT_MAX, PASSWORT_MIN } from "@/lib/auth/password-policy";

export function PasswortAendernForm({ readOnly }: { readOnly?: boolean }) {
  const [state, formAction] = useActionState(changeOwnPassword, {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);

  // Nach dem Speichern die Felder leeren – ein Passwort soll nicht stehen bleiben.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <CardHeader title="Passwort ändern" />
      <CardBody>
        {readOnly ? (
          <Alert tone="info">Im Demo-Modus kannst du das Passwort nicht ändern.</Alert>
        ) : (
          <form ref={formRef} action={formAction} className="space-y-3" data-passwort-aendern>
            <Field label="Aktuelles Passwort">
              <PasswortInput
                name="current_password"
                autoComplete="current-password"
                required
                maxLength={PASSWORT_MAX}
              />
            </Field>
            <Field label="Neues Passwort" hint={`Mindestens ${PASSWORT_MIN} Zeichen.`}>
              <PasswortInput
                name="password"
                autoComplete="new-password"
                required
                minLength={PASSWORT_MIN}
                maxLength={PASSWORT_MAX}
              />
            </Field>
            <Field label="Neues Passwort wiederholen">
              <PasswortInput
                name="password_repeat"
                autoComplete="new-password"
                required
                minLength={PASSWORT_MIN}
                maxLength={PASSWORT_MAX}
              />
            </Field>

            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            {state.success ? <Alert tone="success">{state.success}</Alert> : null}

            <p className="text-[12px] text-ink-muted">
              Danach wirst du auf deinen anderen Geräten abgemeldet. Hier bleibst du angemeldet.
            </p>
            <SubmitButton />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Passwort ändern"}
    </Button>
  );
}
