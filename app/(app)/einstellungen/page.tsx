"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { employees } from "@/lib/demo-data";
import { useSession } from "@/context/session";
import { createClient } from "@/lib/supabase/client";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { MailDeliveryCard } from "@/components/settings/mail-delivery-card";
import { ThemeToggle } from "@/components/layout/theme";
import { PrivacySettingsPanel } from "./privacy-settings-panel";
import { StartSeiteCard } from "@/components/settings/start-seite-card";
import { KalenderAboCard } from "@/components/settings/kalender-abo-card";
import { Gruppe, LinkZeile, Zeile } from "@/components/settings/gruppe";
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
  const istAdmin = profile?.role === "admin";
  const live = mode === "live";
  const [aktive, setAktive] = useState<number | null>(live ? null : employees.filter((e) => e.active).length);

  useEffect(() => {
    if (!live || !istAdmin) return;
    let aktiv = true;
    createClient()
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .then(({ count }) => {
        if (aktiv) setAktive(count ?? null);
      });
    return () => {
      aktiv = false;
    };
  }, [live, istAdmin]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-7">
      <PageHeader title="Einstellungen" description={istAdmin ? "Deine Einstellungen und der Betrieb." : "Deine persönlichen Einstellungen."} />

      <Gruppe>
        <Link
          href="/profil"
          className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:px-5"
        >
          <Avatar employee={profile} className="h-12 w-12 text-[15px]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold">
              {profile.firstName} {profile.lastName}
            </span>
            <span className="block truncate text-[13px] text-ink-muted">
              {roleLabels[profile.role]} · {company.name}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
        </Link>
      </Gruppe>

      <Gruppe titel="Darstellung">
        <Zeile titel="Farbschema" text="Gilt nur auf diesem Gerät – für die Nachtschicht meist dunkel." rechts={<ThemeToggle />} />
      </Gruppe>

      {live ? <StartSeiteCard /> : null}

      {live ? <PrivacySettingsPanel /> : null}

      {live ? <KalenderAboCard /> : null}

      {live && istAdmin ? (
        <>
          <Gruppe titel="Unternehmen">
            <Zeile titel="Name" inline rechts={<span className="text-[15px] text-ink-muted">{company.name}</span>} />
            <Zeile
              titel="Aktive Mitarbeiter"
              inline
              rechts={<span className="tnum text-[15px] text-ink-muted">{aktive ?? "…"}</span>}
            />
            <LinkZeile
              href="/einrichtung"
              titel="Einrichtung"
              text={
                company.setupCompletedAt
                  ? "Abgeschlossen – der Assistent lässt sich jederzeit erneut durchgehen."
                  : "Noch offen. Ohne hinterlegte Feiertage rechnet die Urlaubsberechnung falsch."
              }
            />
          </Gruppe>
          <NotificationSettings />
          <MailDeliveryCard />
        </>
      ) : null}

      <Gruppe titel="Rollen und Berechtigungen">
        {permissions.map((group) => (
          <details key={group.role} className="group px-4 py-3.5 sm:px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              {roleLabels[group.role]}
              <ChevronDown className="h-4 w-4 text-ink-faint transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-2.5 space-y-1.5 text-[13px] leading-snug text-ink-muted">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                  {item}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Gruppe>
    </div>
  );
}
