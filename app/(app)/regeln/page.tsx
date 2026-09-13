"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveBlocksCard } from "@/components/leave/leave-blocks-card";
import { AnnouncementsCard } from "@/components/settings/announcements-card";
import { HolidaySettings } from "@/components/settings/holiday-settings";
import { useSession } from "@/context/session";

const rules = [
  {
    title: "Mindestbesetzung je Schicht",
    value: "Aktiv",
    body: "Anträge, die die Mindestbesetzung unterschreiten, werden beim Beantragen und beim Genehmigen deutlich markiert. Die Entscheidung bleibt bei der Schichtleitung – ein Antrag kann trotz Warnung richtig sein.",
  },
  {
    title: "Urlaub zählt nur an eingeplanten Arbeitstagen",
    value: "Aktiv",
    body: "Abgezogen wird jeder Tag, an dem laut Schichtplan tatsächlich gearbeitet würde – im Schichtbetrieb also auch Samstag und Sonntag. Freitage aus dem Rotationsmuster kosten keinen Urlaubstag. Wer keiner Schichtgruppe zugeordnet ist, für den gilt weiterhin Montag bis Freitag.",
  },
  {
    title: "Feiertage zählen nicht als Urlaub",
    value: "je Bundesland",
    body: "Fällt ein Feiertag in den Urlaubszeitraum, wird er nicht vom Urlaubskonto abgezogen – auch dann nicht, wenn an diesem Tag eine Schicht geplant gewesen wäre.",
  },
  {
    title: "Halbe Urlaubstage",
    value: "Erlaubt",
    body: "Halbe Tage sind nur bei eintägigen Anträgen möglich.",
  },
  {
    title: "Übertrag ins Folgejahr",
    value: "Bis 31.03.",
    body: "Zum 1.1. steht der volle Jahresanspruch wieder zur Verfügung. Was im alten Jahr übrig war, wird zusätzlich übertragen – Urlaubstage wie V-Tage. Der Übertrag verfällt, wenn er bis zum 31.03. nicht genommen wurde.",
  },
];

export default function RulesPage() {
  const { mode, role } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verwaltung"
        title="Regeln"
        description="Diese Regeln steuern die Urlaubsberechnung und die automatische Besetzungsprüfung."
      />

      <Card>
        <CardHeader title="Planungsregeln" />
        <CardBody className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.title}
              className="flex flex-col gap-1.5 rounded-xl border border-line px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="max-w-xl">
                <p className="text-sm font-medium">{rule.title}</p>
                <p className="text-[13px] leading-snug text-ink-muted">{rule.body}</p>
              </div>
              <Badge tone="info">{rule.value}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      {mode === "live" ? (
        <>
          <AnnouncementsCard canManage={role !== "employee"} />
          <LeaveBlocksCard canManage={role === "admin"} />
          <HolidaySettings canManage={role === "admin"} />
        </>
      ) : null}
    </div>
  );
}
