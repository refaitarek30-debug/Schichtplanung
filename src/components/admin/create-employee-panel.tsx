"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createEmployee } from "@/lib/auth/employee-actions";
import type { FormState } from "@/lib/auth/form-state";
import { roleLabels } from "@/lib/nav";
import { QualificationCheckboxes } from "@/components/leave/qualification-checkboxes";
import { ROTATION_TEAMS } from "@/lib/qualifications";
import type { Role } from "@/lib/types";

const initialState: FormState = {};
const roles: Role[] = ["employee", "shift_leader", "admin"];

export function CreateEmployeePanel({
  onCreated,
}: {
  /** Bekommt das Ergebnis, damit der Einladungslink oben stehen bleibt. */
  onCreated: (result: FormState) => void;
}) {
  const [state, formAction] = useActionState(createEmployee, initialState);

  useEffect(() => {
    if (state.success) onCreated(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Card>
      <CardHeader
        title="Neuer Mitarbeiter"
        hint="Mit E-Mail-Adresse wird der Zugang gleich mit eingerichtet – die Einladung geht raus, der Link zum Weitergeben erscheint darüber."
      />
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vorname">
              <Input name="first_name" required />
            </Field>
            <Field label="Nachname">
              <Input name="last_name" required />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-Mail" hint="Wird für die Einladung gebraucht.">
              <Input name="email" type="email" placeholder="name@unternehmen.de" />
            </Field>
            <Field label="Personalnummer">
              <Input name="personnel_number" placeholder="z. B. 10019" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Abteilung">
              <Input name="department" placeholder="z. B. Produktion" />
            </Field>
            <Field label="Schichtgruppe" hint="Leer = kein Rotationsbetrieb.">
              <select
                name="rotation_team"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">keine Rotation</option>
                {ROTATION_TEAMS.map((team) => (
                  <option key={team} value={team}>
                    Schicht {team}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rolle">
              <select
                name="role"
                defaultValue="employee"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Keine Vorbelegung mehr: 30 und 27 waren erfundene Zahlen, die
                wie gepflegte Daten aussahen. Wer anlegt, trägt sie bewusst ein. */}
            <Field label="Urlaubsanspruch (Tage/Jahr)">
              <Input name="vacation_days" type="number" step="0.5" min="0" defaultValue="0" />
            </Field>
            <Field label="V-Tage (Freischichten/Jahr)" hint="Eigenes Konto neben dem Urlaub.">
              <Input name="v_days" type="number" step="0.5" min="0" defaultValue="0" />
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input
              type="checkbox"
              name="shift_worker"
              defaultChecked={true}
              className="mt-0.5 h-4 w-4 rounded border-line"
            />
            <span className="text-[13px] leading-snug">
              <span className="block font-medium text-ink">Arbeitet im Schichtsystem</span>
              <span className="text-ink-muted">
                Urlaub wird dann automatisch verteilt: an Sonn- und Feiertagen sowie in der
                Nachtschicht ein Urlaubstag, weil der Zuschlag mitbezahlt wird – an allen
                anderen Tagen ein V-Tag.
              </span>
            </span>
          </label>



          {/* Eintritt und Austritt begrenzen alles, was von dieser Person
              abhängt: Einplanung, Besetzung, Urlaubsberechnung, Auswertung.
              Leer heißt „keine Grenze". */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Eintritt" hint="Erster Arbeitstag. Leer = keine Grenze.">
              <Input name="entry_date" type="date" />
            </Field>
            <Field label="Austritt" hint="Letzter Arbeitstag. Leer = unbefristet.">
              <Input name="exit_date" type="date" />
            </Field>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input
              type="checkbox"
              name="is_apprentice"
              defaultChecked={false}
              className="mt-0.5 h-4 w-4 rounded border-line accent-brand-500"
            />
            <span className="text-[13px] leading-snug">
              <span className="block font-medium text-ink">Auszubildende oder Auszubildender</span>
              <span className="text-ink-muted">
                Erscheint zusätzlich in der Ausbildungsplanung. Am Schichtplan und an der
                Urlaubsberechnung ändert das nichts.
              </span>
            </span>
          </label>

          {/* Vorgabe: kein Bildungsurlaub. Wer ihn beantragen darf, bekommt
              den Haken – hier oder später beim Bearbeiten. */}
          <label className="flex items-start gap-3 rounded-xl border border-line px-4 py-3">
            <input
              type="checkbox"
              name="bildungsurlaub_erlaubt"
              className="mt-0.5 h-4 w-4 rounded border-line accent-brand-500"
            />
            <span className="text-[13px] leading-snug">
              <span className="block font-medium text-ink">Bildungsurlaub zulässig</span>
              <span className="text-ink-muted">
                Erst mit diesem Haken kann diese Person Bildungsurlaub beantragen.
              </span>
            </span>
          </label>

          <QualificationCheckboxes />

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <SubmitButton />
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird angelegt …" : "Mitarbeiter anlegen"}
    </Button>
  );
}

