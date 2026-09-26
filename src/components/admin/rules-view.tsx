"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HolidaySettings } from "@/components/settings/holiday-settings";
import { QualificationsCard } from "@/components/settings/qualifications-card";
import { StaffingNeedsCard } from "@/components/settings/staffing-needs-card";
import { LeaveQuotaCard } from "@/components/settings/leave-quota-card";
import { HolidayWorkSetting } from "@/components/settings/holiday-work-setting";
import { ReasonVisibilitySetting } from "@/components/settings/reason-visibility-setting";
import { useSession } from "@/context/session";
import { AdminViewHeader } from "./view-header";

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
    title: "An Feiertagen wird gearbeitet",
    value: "einstellbar",
    body: "Im durchlaufenden Betrieb läuft die Anlage auch an Feiertagen weiter. Wer an einem Feiertag eingeplant ist und dafür Urlaub nimmt, zahlt einen Urlaubstag – der Tag zählt wie jeder andere Schichttag. Wer keiner Schichtgruppe zugeordnet ist, hat an Feiertagen frei; dort wird nichts abgezogen. Unten umstellbar, falls in eurem Betrieb an Feiertagen niemand arbeitet.",
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

export function RulesView() {
  const { mode, role } = useSession();

  return (
    <div className="space-y-5">
      <AdminViewHeader description="Diese Regeln steuern die Urlaubsberechnung und die automatische Besetzungsprüfung." />

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

      {/* Mitteilungen und Urlaubssperren standen bis hierhin dazwischen.
          Sie liegen jetzt unter Führung → Mitteilungen: Regeln stellt man
          einmal beim Einrichten ein, eine Mitteilung schreibt man mitten
          im Tagesgeschäft. */}
      {mode === "live" ? (
        <>
          <QualificationsCard canManage={role === "admin"} />
          <StaffingNeedsCard canManage={role === "admin"} />
          <LeaveQuotaCard canManage={role === "admin"} />
          <HolidayWorkSetting canManage={role === "admin"} />
          <ReasonVisibilitySetting canManage={role === "admin"} />
          <HolidaySettings canManage={role === "admin"} />
        </>
      ) : null}
    </div>
  );
}
