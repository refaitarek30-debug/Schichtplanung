"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { savePrivacySettings } from "@/lib/auth/privacy-actions";
import type { FormState } from "@/lib/auth/form-state";

type Props = {
  absenceVisibility: "minimal" | "shift";
  sicknessVisibility: "private" | "shift";
  acknowledged: boolean;
};

const initialState: FormState = {};

export function PrivacySettingsForm({
  absenceVisibility: initialAbsence,
  sicknessVisibility: initialSickness,
  acknowledged,
}: Props) {
  const [state, action] = useActionState(savePrivacySettings, initialState);
  const [absenceVisibility, setAbsenceVisibility] = useState(initialAbsence);
  const [sicknessVisibility, setSicknessVisibility] = useState(initialSickness);

  useEffect(() => {
    if (state.success) {
      // Die Server Action revalidiert den Schichtplan. Lokale Zustände bleiben
      // bewusst auf dem gerade gespeicherten Stand.
    }
  }, [state.success]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="privacy_notice_acknowledged" value="on" />
      <Card>
        <CardHeader
          title="Meine Kollegen sehen"
          hint="Die Einstellung gilt sofort und kann jederzeit widerrufen werden."
        />
        <CardBody className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="radio"
              name="absence_visibility"
              value="minimal"
              checked={absenceVisibility === "minimal"}
              onChange={() => setAbsenceVisibility("minimal")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Nur „Abwesend“</span>
              <span className="block text-[12px] text-ink-muted">
                Kolleginnen und Kollegen sehen keinen konkreten Abwesenheitsgrund.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="radio"
              name="absence_visibility"
              value="shift"
              checked={absenceVisibility === "shift"}
              onChange={() => setAbsenceVisibility("shift")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Abwesenheitsgrund in meiner Schicht</span>
              <span className="block text-[12px] text-ink-muted">
                Nur Kolleginnen und Kollegen derselben betrieblichen Schichtgruppe sehen z. B. Urlaub, V-Tag oder Schulung.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Krankheit"
          hint="Krankheit wird unabhängig von der allgemeinen Abwesenheitsfreigabe behandelt."
        />
        <CardBody className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="radio"
              name="sickness_visibility"
              value="private"
              checked={sicknessVisibility === "private"}
              onChange={() => setSicknessVisibility("private")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Nicht sichtbar</span>
              <span className="block text-[12px] text-ink-muted">
                Andere Kolleginnen und Kollegen sehen nur „Abwesend“.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
            <input
              type="radio"
              name="sickness_visibility"
              value="shift"
              checked={sicknessVisibility === "shift"}
              onChange={() => setSicknessVisibility("shift")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Für meine Schicht sichtbar</span>
              <span className="block text-[12px] text-ink-muted">
                Nur Kolleginnen und Kollegen derselben Schichtgruppe sehen „Krank“.
              </span>
            </span>
          </label>

          <p className="text-[12px] leading-snug text-ink-faint">
            Es werden keine Diagnosen oder medizinischen Freitexte erfasst.
          </p>
        </CardBody>
      </Card>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      {!acknowledged ? (
        <Alert tone="info">
          Deine freiwilligen Sichtbarkeitseinstellungen werden erst nach dem Speichern wirksam.
        </Alert>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Datenschutzeinstellungen speichern"}
    </Button>
  );
}
