"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { roleLabels } from "@/lib/nav";
import { ProfileForm } from "./profile-form";

export default function ProfilePage() {
  const { profile, company, mode } = useSession();

  const details = [
    { label: "E-Mail", value: profile.email, note: "Änderung nur durch die Administration" },
    { label: "Rolle", value: roleLabels[profile.role], note: "wird von der Administration vergeben" },
    { label: "Unternehmen", value: company.name },
    { label: "Personalnummer", value: profile.personnelNumber ?? "nicht hinterlegt" },
    { label: "Abteilung", value: profile.department ?? "nicht hinterlegt" },
    { label: "Schicht", value: profile.shiftName ?? "keine Zuordnung" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Konto"
        title="Profil"
        description="Name und Profilbild kannst du selbst ändern. Alles andere pflegt die Administration."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ProfileForm profile={profile} readOnly={mode === "demo"} />

        <Card className="h-fit">
          <CardHeader title="Stammdaten" />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar employee={profile} className="h-12 w-12 text-base" />
              <div>
                <p className="text-sm font-medium">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-[12px] text-ink-muted">{profile.email}</p>
              </div>
            </div>

            <dl className="space-y-2">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2.5"
                >
                  <dt className="text-[12px] text-ink-muted">{item.label}</dt>
                  <dd className="text-right">
                    <span className="block text-[13px] font-medium">{item.value}</span>
                    {item.note ? (
                      <span className="block text-[11px] text-ink-faint">{item.note}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>

            <p>
              <Badge tone={profile.active ? "ok" : "critical"}>
                {profile.active ? "Konto aktiv" : "Konto deaktiviert"}
              </Badge>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
