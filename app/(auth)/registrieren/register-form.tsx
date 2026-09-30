"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { VersionTag } from "@/components/legal/prose";
import { registerCompany } from "@/lib/auth/company-actions";
import type { FormState } from "@/lib/auth/form-state";
import { AVV_VERSION, DATENSCHUTZ_VERSION, NUTZUNGSBEDINGUNGEN_VERSION } from "@/lib/legal/version";

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
            maxLength={72}
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
            maxLength={72}
            disabled={disabled}
          />
        </Field>
      </div>

      {/* Pflichtangaben. Die Zeitpunkte und Fassungen der Zustimmungen
          setzt der Server bzw. die Datenbank (register_company_for_user) –
          was der Browser schickt, ist kein Nachweis. */}
      <div className="space-y-2">
        <Bestaetigung name="business_confirmed" disabled={disabled}>
          Ich registriere mich für ein Unternehmen bzw. im Rahmen meiner beruflichen Tätigkeit
          (nicht als Verbraucher) und bin berechtigt, das Unternehmen zu vertreten.
        </Bestaetigung>
        <Bestaetigung name="terms_accepted" disabled={disabled}>
          Ich akzeptiere die{" "}
          <TextLink href="/nutzungsbedingungen">
            Nutzungsbedingungen
            <VersionTag version={NUTZUNGSBEDINGUNGEN_VERSION} />
          </TextLink>{" "}
          und den{" "}
          <TextLink href="/avv">
            Auftragsverarbeitungsvertrag (Art. 28 DSGVO)
            <VersionTag version={AVV_VERSION} />
          </TextLink>
          .
        </Bestaetigung>
        <Bestaetigung name="privacy_read" disabled={disabled}>
          Ich habe die{" "}
          <TextLink href="/datenschutz">
            Datenschutzerklärung
            <VersionTag version={DATENSCHUTZ_VERSION} />
          </TextLink>{" "}
          zur Kenntnis genommen.
        </Bestaetigung>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SubmitButton disabled={disabled} />

      <p className="text-[12px] leading-snug text-ink-faint">
        Die Daten jedes Unternehmens werden technisch getrennt gespeichert und durch
        Zugriffsregeln in der Datenbank geschützt. Einzelheiten stehen in der
        Datenschutzerklärung.
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

function Bestaetigung({
  name,
  disabled,
  children,
}: {
  name: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-3">
      <input
        type="checkbox"
        name={name}
        required
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand-500"
      />
      <span className="text-[13px] leading-snug text-ink">{children}</span>
    </label>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" className="font-medium text-brand-600 hover:underline">
      {children}
    </Link>
  );
}
