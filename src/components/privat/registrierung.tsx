"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { registrierePrivat } from "@/lib/privat/actions";
import type { FormState } from "@/lib/auth/form-state";

const anfang: FormState = {};

export function PrivatRegistrierung({
  disabled,
  weiter,
  knopf = "Kostenlos starten",
}: {
  disabled?: boolean;
  /** Nach dem Anlegen dorthin (Einladung). */
  weiter?: string;
  knopf?: string;
}) {
  const [state, action] = useActionState(registrierePrivat, anfang);

  if (state.success) {
    return (
      <div className="mt-6">
        <Alert tone="success">{state.success}</Alert>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      {weiter ? <input type="hidden" name="weiter" value={weiter} /> : null}
      <Field label="Spitzname" hint="3–24 Zeichen: a–z, Ziffern, . _ -">
        <Input
          name="spitzname"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={24}
          placeholder="z. B. tarek_nachtschicht"
          disabled={disabled}
        />
      </Field>
      <Field label="Passwort" hint="mindestens 8 Zeichen – bitte merken, es gibt keine Bestätigungsmail">
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          disabled={disabled}
        />
      </Field>
      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3">
        <input
          type="checkbox"
          name="datenschutz"
          required
          disabled={disabled}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand-500"
        />
        <span className="text-[13px] leading-snug">
          Ich habe die{" "}
          <Link href="/datenschutz" target="_blank" className="font-medium text-brand-600 hover:underline">
            Datenschutzerklärung
          </Link>{" "}
          gelesen.
        </span>
      </label>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Absenden disabled={disabled} text={knopf} />
    </form>
  );
}

function Absenden({ disabled, text }: { disabled?: boolean; text: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Wird angelegt …" : text}
    </Button>
  );
}
