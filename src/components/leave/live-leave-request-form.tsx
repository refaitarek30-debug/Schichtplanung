"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DateRangeCalendar } from "./date-range-calendar";
import { formatDE, formatDays } from "@/lib/dates";
import { previewLeaveDays } from "@/lib/leave-days";
import { fetchHolidays } from "@/lib/data/holidays";
import { fetchLeaveImpact } from "@/lib/data/staffing";
import { submitLeaveRequest, type FormState } from "@/lib/auth/leave-actions";
import type { Holiday, LiveLeaveBalance, LiveLeaveImpact } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialState: FormState = {};

export function LiveLeaveRequestForm({
  employeeId,
  balance,
  today,
  onSubmitted,
}: {
  employeeId: string | null;
  balance: LiveLeaveBalance | null;
  today: string;
  onSubmitted: () => void;
}) {
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [period, setPeriod] = useState<"" | "vormittag" | "nachmittag">("");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<LiveLeaveImpact | null>(null);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [state, formAction] = useActionState(submitLeaveRequest, initialState);

  // Echte Feiertage des Unternehmens statt der Demo-Feiertage aus Phase 1 –
  // sonst kann die Vorschau von dem abweichen, was der Server (Trigger
  // leave_requests_compute_days) am Ende tatsächlich speichert.
  useEffect(() => {
    let cancelled = false;
    fetchHolidays()
      .then((result) => {
        if (!cancelled) setHolidays(result);
      })
      .catch(() => {
        if (!cancelled) setHolidays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const valid = endDate >= startDate;
  const days = useMemo(
    () =>
      valid && holidays ? previewLeaveDays(startDate, endDate, holidays, period || null) : 0,
    [startDate, endDate, period, valid, holidays],
  );

  useEffect(() => {
    if (!employeeId || !valid) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    fetchLeaveImpact(employeeId, startDate, endDate)
      .then((result) => {
        if (!cancelled) setImpact(result);
      })
      .catch(() => {
        if (!cancelled) setImpact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, startDate, endDate, valid]);

  useEffect(() => {
    if (state.success) {
      onSubmitted();
      setReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const remainingAfter = balance ? balance.remainingDays - days : null;
  const insufficientBalance = remainingAfter !== null && remainingAfter < 0;
  const staffingCritical = impact !== null && impact.worstStatus === "critical";
  const staffingWarn = impact !== null && impact.worstStatus === "warn";

  let tone: "ok" | "warn" | "critical" = "ok";
  if (insufficientBalance || staffingCritical) tone = "critical";
  else if (staffingWarn || (impact !== null && impact.overlappingEmployees > 0)) tone = "warn";

  const panelTone = {
    ok: "border-ok-bg bg-ok-bg/60 text-ok-fg",
    warn: "border-warn-bg bg-warn-bg/60 text-warn-fg",
    critical: "border-crit-bg bg-crit-bg/60 text-crit-fg",
  }[tone];
  const PanelIcon = tone === "ok" ? CheckCircle2 : TriangleAlert;

  return (
    <Card>
      <CardHeader
        title="Urlaub beantragen"
        hint="Die Anzahl Urlaubstage wird verbindlich vom Server berechnet."
      />
      <CardBody className="space-y-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="start_date" value={startDate} />
          <input type="hidden" name="end_date" value={endDate} />

          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink-muted">
              Zeitraum auswählen
            </span>
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              minDate={today}
              holidays={holidays ?? []}
              onChange={(newStart, newEnd) => {
                setStartDate(newStart);
                setEndDate(newEnd);
              }}
            />
            <p className="tnum mt-2 text-[13px] text-ink-muted">
              {startDate === endDate
                ? formatDE(startDate)
                : `${formatDE(startDate)} – ${formatDE(endDate)}`}
            </p>
          </div>

          <Field label="Tageszeit" hint="Nur bei einem einzelnen Tag wählbar.">
            <select
              name="half_day_period"
              value={period}
              disabled={startDate !== endDate}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm disabled:bg-surface-muted disabled:text-ink-faint"
            >
              <option value="">Ganzer Tag</option>
              <option value="vormittag">Halber Tag, vormittags</option>
              <option value="nachmittag">Halber Tag, nachmittags</option>
            </select>
          </Field>

          <Field label="Kommentar (optional)">
            <textarea
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="z. B. Familienurlaub"
              className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-faint"
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <span className="text-sm text-ink-muted">Benötigte Urlaubstage</span>
            <span className="tnum text-lg font-semibold">
              {holidays ? formatDays(days) : "…"}
            </span>
          </div>

          {valid ? (
            <div className={cn("rounded-xl border px-4 py-3", panelTone)}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PanelIcon className="h-4 w-4" strokeWidth={2} />
                {insufficientBalance
                  ? `Für diesen Zeitraum stehen nur noch ${formatDays(Math.max(balance?.remainingDays ?? 0, 0))} Urlaubstage zur Verfügung.`
                  : staffingCritical
                    ? "Mindestbesetzung wird unterschritten."
                    : `${formatDays(balance?.remainingDays ?? 0)} Urlaubstage verfügbar.`}
              </p>
              <ul className="mt-2 space-y-1 text-[13px] leading-snug">
                {remainingAfter !== null && !insufficientBalance ? (
                  <li>{formatDays(remainingAfter)} Tage verbleiben nach diesem Antrag.</li>
                ) : null}
                {staffingCritical ? (
                  <li>
                    An {impact!.criticalDays === 1 ? "einem Tag" : `${impact!.criticalDays} Tagen`}{" "}
                    würde die Mindestbesetzung deiner Schicht unterschritten.
                  </li>
                ) : staffingWarn ? (
                  <li>Die Besetzung deiner Schicht läge unter der Soll-Stärke, hält aber das Minimum.</li>
                ) : null}
                {impact !== null && impact.overlappingEmployees > 0 ? (
                  <li>
                    Durch diesen Antrag wären {impact.overlappingEmployees + 1} Mitarbeiter deiner
                    Schicht gleichzeitig abwesend.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : (
            <Alert tone="error">
              Das Enddatum liegt vor dem Startdatum. Bitte den Zeitraum korrigieren.
            </Alert>
          )}

          {state.error ? <Alert tone="error">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <SubmitButton disabled={!valid || !holidays || days === 0 || insufficientBalance} />
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Wird gesendet …" : "Urlaub beantragen"}
    </Button>
  );
}
