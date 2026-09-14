"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createEmployee } from "@/lib/auth/employee-actions";
import type { FormState } from "@/lib/auth/form-state";
import { ROTATION_TEAMS } from "@/lib/qualifications";
import { roleLabels } from "@/lib/nav";
import type { SetupState } from "@/lib/data/setup";
import type { Role } from "@/lib/types";

const initialState: FormState = {};
const roles: Role[] = ["employee", "shift_leader", "admin"];

/**
 * Schritt 3 – Mitarbeiter.
 *
 * Bewusst nur das Nötigste: Name, Adresse, Schichtgruppe, Rolle. Alles
 * Weitere (Qualifikationen, Urlaubsanspruch, Personalnummer) lässt sich
 * später auf der Mitarbeiterseite nachtragen – wer zwanzig Leute anlegt,
 * will hier nicht zwanzigmal durch zehn Felder.
 *
 * Steht eine E-Mail-Adresse dabei, richtet `createEmployee()` den Zugang
 * gleich mit ein und erzeugt den Einladungslink.
 */
export function SchrittMitarbeiter({
  stand,
  onFertig,
}: {
  stand: SetupState | null;
  onFertig: () => void | Promise<void>;
}) {
  const [state, formAction] = useActionState(createEmployee, initialState);

  useEffect(() => {
    if (state.success) void onFertig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Schritt 3 · Wer arbeitet hier?"
          hint="Dein eigener Stammsatz ist bei der Registrierung schon entstanden."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-muted px-4 py-3">
              <p className="text-[12px] text-ink-muted">Angelegt</p>
              <p className="tnum mt-0.5 text-lg font-semibold">
                {stand?.mitarbeiter ?? 0}{" "}
                {stand?.mitarbeiter === 1 ? "Person" : "Personen"}
              </p>
            </div>
            <div className="rounded-xl bg-surface-muted px-4 py-3">
              <p className="text-[12px] text-ink-muted">Davon mit Schichtgruppe</p>
              <p className="tnum mt-0.5 text-lg font-semibold">
                {stand?.mitarbeiterMitGruppe ?? 0}
              </p>
            </div>
          </div>

          {stand && stand.musterVorhanden && stand.mitarbeiterMitGruppe === 0 ? (
            <Alert tone="warning">
              Das Schichtmuster ist gespeichert, aber noch niemandem zugeordnet. Erst mit
              einer Schichtgruppe (A–D) taucht jemand im Schichtplan auf.
            </Alert>
          ) : null}

          <p className="text-sm leading-relaxed text-ink-muted">
            Deinen eigenen Eintrag kannst du unter{" "}
            <Link href="/mitarbeiter" className="font-medium text-brand-600 hover:underline">
              Mitarbeiter
            </Link>{" "}
            vervollständigen – Personalnummer, Abteilung und Schichtgruppe. Dort lassen
            sich auch alle weiteren Angaben nachtragen.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Mitarbeiter anlegen"
          hint="Mit E-Mail-Adresse wird der Zugang gleich mit eingerichtet."
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

            <Field label="E-Mail (optional)" hint="Ohne Adresse entsteht nur der Stammsatz.">
              <Input name="email" type="email" placeholder="name@unternehmen.de" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Schichtgruppe" hint="Ohne Gruppe erscheint niemand im Schichtplan.">
                <select
                  name="rotation_team"
                  defaultValue=""
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                >
                  <option value="">keine</option>
                  {ROTATION_TEAMS.map((team) => (
                    <option key={team} value={team}>
                      Gruppe {team}
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

            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            {state.success ? <Alert tone="success">{state.success}</Alert> : null}

            <SendeKnopf />

            <p className="text-[12px] leading-snug text-ink-faint">
              Urlaubsanspruch (30 Tage) und V-Tage (27) werden vorbelegt und lassen sich
              unter Mitarbeiter je Person ändern.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function SendeKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird angelegt …" : "Mitarbeiter anlegen"}
    </Button>
  );
}
