"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { registerCompany } from "@/lib/auth/company-actions";
import type { FormState } from "@/lib/auth/form-state";

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

      {/* Pflichtangabe: ab hier trägt das Unternehmen echte
          Beschäftigtendaten ein. Den Zeitstempel der Zustimmung setzt
          register_company() in der Datenbank. */}
      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3">
        <input
          type="checkbox"
          name="avv_accepted"
          required
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand-500"
        />
        <span className="text-[13px] leading-snug text-ink">
          Ich habe die{" "}
          <Link
            href="/datenschutz"
            target="_blank"
            className="font-medium text-brand-600 hover:underline"
          >
            Datenschutzerklärung
          </Link>{" "}
          gelesen und akzeptiere den Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.
        </span>
      </label>

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
