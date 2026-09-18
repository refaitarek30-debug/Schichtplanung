"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { employees } from "@/lib/demo-data";
import { useSession } from "@/context/session";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { MailDeliveryCard } from "@/components/settings/mail-delivery-card";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme";
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

export default function SettingsPage() {
  const { company, mode, profile } = useSession();
  // Der Postausgang zeigt Adressen und Namen von Beschäftigten – die
  // Datenbank gibt ihn ohnehin nur der Administration heraus.
  const istAdmin = profile?.role === "admin";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title="Einstellungen"
        description="Unternehmensdaten, Rollen und der Stand der technischen Anbindung."
      />

      <Card>
        <CardHeader
          title="Darstellung"
          hint="gilt nur auf diesem Gerät – für die Nachtschicht meist dunkel"
        />
        <CardBody>
          <ThemeToggle />
        </CardBody>
      </Card>

      {mode === "live" ? (
        <Card>
          <CardHeader
            title="Was meine Schicht von mir sieht"
            hint="Gilt nur für dich. Jede und jeder entscheidet das selbst."
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-prose text-sm text-ink-muted">
              Du legst fest, ob Kolleginnen und Kollegen deiner Schicht den
              Grund deiner Abwesenheit sehen – Urlaub, V-Tag oder Schulung –
              oder nur „Abwesend“. Krankheit ist davon getrennt und
              standardmäßig privat. Ohne deine Freigabe sieht niemand einen
              Grund; du kannst sie jederzeit wieder zurücknehmen.
            </p>
            <Link
              href="/profil/datenschutz"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              Sichtbarkeit festlegen
            </Link>
          </CardBody>
        </Card>
      ) : null}

      {mode === "live" ? <NotificationSettings /> : null}
      {mode === "live" && istAdmin ? <MailDeliveryCard /> : null}

      {mode === "live" && istAdmin ? (
        <Card>
          <CardHeader
            title="Einrichtung"
            hint="Feiertage, Schichtmuster und Mitarbeiter in drei geführten Schritten."
          />
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {company.setupCompletedAt
                ? "Abgeschlossen. Der Assistent lässt sich jederzeit erneut durchgehen – geändert wird nur, was du speicherst."
                : "Noch offen. Ohne hinterlegte Feiertage rechnet die Urlaubsberechnung falsch."}
            </p>
            <Link
              href="/einrichtung"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              {company.setupCompletedAt ? "Assistent öffnen" : "Einrichtung fortsetzen"}
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Unternehmen" />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Detail label="Name" value={company.name} />
          <Detail
            label="Aktive Mitarbeiter"
            value={String(employees.filter((e) => e.active).length)}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Rollen und Berechtigungen"
          hint="Wird in Phase 2 zusätzlich über Supabase Row Level Security erzwungen."
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
