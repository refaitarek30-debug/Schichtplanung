"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { countLeaveDays, formatDays } from "@/lib/dates";
import { holidays, staffingContext } from "@/lib/demo-data";
import { checkLeaveImpact } from "@/lib/staffing";
import type { Employee, StaffingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const panelTone: Record<StaffingStatus, string> = {
  ok: "border-ok-bg bg-ok-bg/60 text-ok-fg",
  warn: "border-warn-bg bg-warn-bg/60 text-warn-fg",
  critical: "border-crit-bg bg-crit-bg/60 text-crit-fg",
};

const panelIcon: Record<StaffingStatus, typeof Info> = {
  ok: CheckCircle2,
  warn: TriangleAlert,
  critical: TriangleAlert,
};

export function LeaveRequestForm({
  employee,
  today,
}: {
  employee: Employee;
  today: string;
}) {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const valid = endDate >= startDate;
  const days = useMemo(
    () => (valid ? countLeaveDays(startDate, endDate, holidays, halfDay) : 0),
    [startDate, endDate, halfDay, valid],
  );

  const impact = useMemo(
    () => (valid ? checkLeaveImpact(employee, startDate, endDate, staffingContext) : null),
    [employee, startDate, endDate, valid],
  );

  const Icon = impact ? panelIcon[impact.status] : Info;

  return (
    <Card>
      <CardHeader
        title="Urlaub beantragen"
        hint="Die Besetzung deiner Schicht wird direkt bei der Eingabe geprüft."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Von">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
                setSubmitted(false);
              }}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Bis">
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSubmitted(false);
              }}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={halfDay}
            disabled={startDate !== endDate}
            onChange={(e) => setHalfDay(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand-500"
          />
          Halber Tag <span className="text-ink-faint">(nur bei einem einzelnen Tag)</span>
        </label>

        <Field label="Kommentar (optional)">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="z. B. Familienurlaub"
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-faint"
          />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
          <span className="text-sm text-ink-muted">Benötigte Urlaubstage</span>
          <span className="tnum text-lg font-semibold">{formatDays(days)}</span>
        </div>

        {impact ? (
          <div className={cn("rounded-xl border px-4 py-3", panelTone[impact.status])}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="h-4 w-4" strokeWidth={2} />
              {impact.headline}
            </p>
            <ul className="mt-2 space-y-1 text-[13px] leading-snug">
              {impact.hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-crit-bg bg-crit-bg/60 px-4 py-3 text-sm text-crit-fg">
            Das Enddatum liegt vor dem Startdatum. Bitte den Zeitraum korrigieren.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setSubmitted(true)} disabled={!valid || days === 0}>
            Antrag einreichen
          </Button>
          {submitted ? (
            <span className="text-sm text-ok-fg">
              Antrag eingereicht – Status: Ausstehend.
            </span>
          ) : (
            <span className="text-[13px] text-ink-faint">
              Wird in Phase 3 in Supabase gespeichert.
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
