"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { updateOwnProfile, type FormState } from "@/lib/auth/actions";
import type { SessionProfile } from "@/lib/types";

export function ProfileForm({
  profile,
  readOnly,
}: {
  profile: SessionProfile;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(updateOwnProfile, {} as FormState);

  return (
    <Card>
      <CardHeader
        title="Profil bearbeiten"
        hint="Diese Angaben sehen deine Kolleginnen und Kollegen."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vorname">
              <Input
                name="first_name"
                defaultValue={profile.firstName}
                required
                disabled={readOnly}
              />
            </Field>
            <Field label="Nachname">
              <Input
                name="last_name"
                defaultValue={profile.lastName}
                required
                disabled={readOnly}
              />
            </Field>
          </div>

          <Field label="Profilbild (URL)" hint="Leer lassen, um die Initialen zu zeigen.">
            <Input
              name="avatar_url"
              type="url"
              defaultValue={profile.avatarUrl ?? ""}
              placeholder="https://…"
              disabled={readOnly}
            />
          </Field>

          <Field label="E-Mail">
            <Input value={profile.email} disabled readOnly />
          </Field>

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}
          {readOnly ? (
            <Alert tone="warning">
              Im Demo-Modus lassen sich keine Änderungen speichern.
            </Alert>
          ) : null}

          <SubmitButton disabled={readOnly} />
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Wird gespeichert …" : "Änderungen speichern"}
    </Button>
  );
}
