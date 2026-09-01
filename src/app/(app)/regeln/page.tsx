"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveBlocksCard } from "@/components/leave/leave-blocks-card";
import { useSession } from "@/context/session";
import { holidays as demoHolidays } from "@/lib/demo-data";
import { fetchHolidays } from "@/lib/data/holidays";
import { formatDE, weekdayLong } from "@/lib/dates";
import type { Holiday } from "@/lib/types";

const rules = [
  {
    title: "Mindestbesetzung je Schicht",
    value: "Aktiv",
    body: "Anträge, die die Mindestbesetzung unterschreiten, werden markiert und können nur mit Begründung genehmigt werden.",
  },
  {
    title: "Wochenenden zählen nicht als Urlaub",
    value: "Aktiv",
    body: "Samstage und Sonntage werden bei der Berechnung der Urlaubstage übersprungen.",
  },
  {
    title: "Feiertage zählen nicht als Urlaub",
    value: "Nordrhein-Westfalen",
    body: "Der Feiertagskalender bestimmt, welche Tage vom Urlaubskonto abgezogen werden.",
  },
  {
    title: "Halbe Urlaubstage",
    value: "Erlaubt",
    body: "Halbe Tage sind nur bei eintägigen Anträgen möglich.",
  },
  {
    title: "Übertrag ins Folgejahr",
    value: "Bis 31.03.",
    body: "Nicht genommene Tage verfallen nach dem Übertragungszeitraum.",
  },
];

export default function RulesPage() {
  const { mode, role } = useSession();
  const [holidays, setHolidays] = useState<Holiday[]>(demoHolidays);

  useEffect(() => {
    if (mode !== "live") return;
    fetchHolidays()
      .then(setHolidays)
      .catch(() => setHolidays([]));
  }, [mode]);

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

      {mode === "live" ? <LeaveBlocksCard canManage={role === "admin"} /> : null}

      <Card>
        <CardHeader
          title="Feiertage"
          hint="Nordrhein-Westfalen · fließen automatisch in jede Berechnung ein"
        />
        <CardBody className="px-0 py-0">
          <ul className="divide-y divide-line">
            {holidays.map((holiday) => (
              <li
                key={holiday.date}
                className="flex items-center justify-between px-5 py-2.5 text-sm"
              >
                <span>{holiday.name}</span>
                <span className="tnum text-ink-muted">
                  {weekdayLong(holiday.date).slice(0, 2)} · {formatDE(holiday.date)}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
