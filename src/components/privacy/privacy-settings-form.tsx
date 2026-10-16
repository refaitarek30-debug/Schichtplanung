"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Gruppe, WahlZeile } from "@/components/settings/gruppe";
import { savePrivacySettings } from "@/lib/auth/privacy-actions";
import type { FormState } from "@/lib/auth/form-state";

type Props = {
  absenceVisibility: "minimal" | "shift";
  sicknessVisibility: "private" | "shift";
  acknowledged: boolean;
  /**
   * Betriebsschalter der Administration. Aus: Gründe sehen nur
   * Schichtleitung und Administration – die Wahl hier wirkt erst wieder,
   * wenn der Betrieb die Anzeige für Kollegen freigibt.
   */
  freigabeAktiv?: boolean;
};

const initialState: FormState = {};

export function PrivacySettingsForm({
  absenceVisibility: initialAbsence,
  sicknessVisibility: initialSickness,
  acknowledged,
  freigabeAktiv = false,
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
    <form action={action} className="space-y-5">
      <input type="hidden" name="privacy_notice_acknowledged" value="on" />
      {!freigabeAktiv ? (
        <Alert tone="info">
          Zurzeit sehen Kolleginnen und Kollegen bei allen nur „Abwesend“. Urlaub,
          Krankheit und andere Gründe sehen nur Schichtleitung und Administration.
          Deine Auswahl bleibt gespeichert und gilt, sobald der Betrieb die Anzeige
          für Kollegen wieder freigibt.
        </Alert>
      ) : null}

      <Gruppe titel="Meine Kollegen sehen" hinweis="Die Einstellung gilt sofort und kann jederzeit widerrufen werden.">
        <WahlZeile
          name="absence_visibility"
          value="minimal"
          aktiv={absenceVisibility === "minimal"}
          onChange={() => setAbsenceVisibility("minimal")}
          titel="Nur „Abwesend“"
          text="Kolleginnen und Kollegen sehen keinen konkreten Abwesenheitsgrund."
        />
        <WahlZeile
          name="absence_visibility"
          value="shift"
          aktiv={absenceVisibility === "shift"}
          onChange={() => setAbsenceVisibility("shift")}
          titel="Abwesenheitsgrund in meiner Schicht"
          text="Nur Kolleginnen und Kollegen derselben betrieblichen Schichtgruppe sehen z. B. Urlaub, V-Tag oder Schulung."
        />
      </Gruppe>

      <Gruppe
        titel="Krankheit"
        hinweis="Krankheit wird unabhängig von der allgemeinen Abwesenheitsfreigabe behandelt. Es werden keine Diagnosen oder medizinischen Freitexte erfasst."
      >
        <WahlZeile
          name="sickness_visibility"
          value="private"
          aktiv={sicknessVisibility === "private"}
          onChange={() => setSicknessVisibility("private")}
          titel="Nicht sichtbar"
          text="Andere Kolleginnen und Kollegen sehen nur „Abwesend“."
        />
        <WahlZeile
          name="sickness_visibility"
          value="shift"
          aktiv={sicknessVisibility === "shift"}
          onChange={() => setSicknessVisibility("shift")}
          titel="Für meine Schicht sichtbar"
          text="Nur Kolleginnen und Kollegen derselben Schichtgruppe sehen „Krank“."
        />
      </Gruppe>

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
