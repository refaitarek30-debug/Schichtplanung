"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { employees as demoEmployees } from "@/lib/demo-data";
import { useSession } from "@/context/session";
import { updateCompanyName } from "@/lib/auth/company-actions";
import type { FormState } from "@/lib/auth/actions";
import { DataError, fetchEmployees } from "@/lib/data/employees";
import { roleLabels } from "@/lib/nav";
import type { Role } from "@/lib/types";

const permissions: { role: Role; items: string[] }[] = [
  {
    role: "employee",
    items: [
      "eigenes Dashboard, Urlaubskonto und Schichten sehen",
      "Urlaub beantragen und offene Anträge zurückziehen",
      "Abwesenheiten im Team sehen, ohne Grund der Abwesenheit",
    ],
  },
  {
    role: "shift_leader",
    items: [
      "Mitarbeiter der eigenen Schicht sehen",
      "Urlaubsanträge genehmigen oder ablehnen",
      "Besetzung und Engpässe der eigenen Schicht prüfen",
      "Abwesenheiten erfassen und verwalten",
      "Urlaubsanspruch von Mitarbeitenden festlegen",
    ],
  },
  {
    role: "admin",
    items: [
      "Mitarbeiter anlegen, bearbeiten und deaktivieren",
      "Schichten, Schichtmodelle und Mindestbesetzung definieren",
      "Urlaubskontingente, Feiertage und Betriebsferien verwalten",
      "Rollen vergeben und Unternehmensdaten pflegen",
    ],
  },
];

const initialState: FormState = {};

export default function SettingsPage() {
  const { company, mode, role } = useSession();
  const [activeCount, setActiveCount] = useState<number | null>(
    mode === "demo" ? demoEmployees.filter((e) => e.active).length : null,
  );

  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    fetchEmployees()
      .then((rows) => {
        if (!cancelled) setActiveCount(rows.filter((r) => r.active).length);
      })
      .catch(() => {
        if (!cancelled) setActiveCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title="Einstellungen"
        description="Unternehmensdaten, Rollen und der Stand der technischen Anbindung."
      />

      <Card>
        <CardHeader title="Unternehmen" />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Detail label="Name" value={company.name} />
            <Detail label="Feiertagsregion" value="Nordrhein-Westfalen" />
            <Detail
              label="Aktive Mitarbeiter"
              value={activeCount === null ? "wird geladen …" : String(activeCount)}
            />
          </div>
          {role === "admin" ? <CompanyNameForm currentName={company.name} disabled={mode === "demo"} /> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Rollen und Berechtigungen"
          hint="Wird zusätzlich über Supabase Row Level Security erzwungen."
        />
        <CardBody className="space-y-3">
          {permissions.map((group) => (
            <div key={group.role} className="rounded-xl border border-line px-4 py-3">
              <p className="mb-2 text-sm font-medium">{roleLabels[group.role]}</p>
              <ul className="space-y-1 text-[13px] text-ink-muted">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Technischer Stand" />
        <CardBody className="space-y-2 text-sm">
          <Row label="Frontend, Designsystem, Rollenlogik" status="Phase 1 – fertig" tone="ok" />
          <Row
            label="Supabase Auth, Datenbank, RLS"
            status={mode === "live" ? "Phase 2 – aktiv" : "Phase 2 – Demo-Modus"}
            tone={mode === "live" ? "ok" : "neutral"}
          />
          <Row
            label="Urlaubskonto, Anträge, Genehmigungsworkflow"
            status={mode === "live" ? "Phase 3 – aktiv" : "Phase 3 – Demo-Modus"}
            tone={mode === "live" ? "ok" : "neutral"}
          />
          <Row label="Schichtzuordnung und Besetzungsprüfung serverseitig" status={mode === "live" ? "Phase 4 – aktiv" : "Phase 4 – Demo-Modus"} tone={mode === "live" ? "ok" : "neutral"} />
        </CardBody>
      </Card>
    </div>
  );
}

function CompanyNameForm({ currentName, disabled }: { currentName: string; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(updateCompanyName, initialState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  if (!editing) {
    return (
      <Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}>
        Firmenname ändern
      </Button>
    );
  }

  return (
    <form action={formAction} className="max-w-sm space-y-3">
      <Field label="Firmenname">
        <Input name="name" defaultValue={currentName} required />
      </Field>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div className="flex gap-2">
        <SubmitButton />
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird gespeichert …" : "Speichern"}
    </Button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-4 py-3">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Row({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: "ok" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5">
      <span>{label}</span>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}
