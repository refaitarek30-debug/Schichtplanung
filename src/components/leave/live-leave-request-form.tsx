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
import { fetchLeaveKindSuggestion } from "@/lib/data/leave";
import { submitLeaveRequest, type FormState } from "@/lib/auth/leave-actions";
import type {
  Holiday,
  LiveLeaveBalance,
  LiveLeaveImpact,
  LiveLeaveKindSuggestion,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const initialState: FormState = {};

type LeaveKind = "urlaub" | "v_tag";

const kindLabels: Record<LeaveKind, { singular: string; plural: string; action: string }> = {
  urlaub: { singular: "Urlaubstag", plural: "Urlaubstage", action: "Urlaub beantragen" },
  v_tag: { singular: "V-Tag", plural: "V-Tage", action: "V-Tag beantragen" },
};

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
  const [kind, setKind] = useState<LeaveKind>("urlaub");
  /** Sobald selbst umgestellt wurde, überschreibt die Empfehlung nichts mehr. */
  const [kindTouched, setKindTouched] = useState(false);
  const [suggestion, setSuggestion] = useState<LiveLeaveKindSuggestion | null>(null);
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

  // Empfehlung Urlaub vs. V-Tag – hängt am Starttag, weil sich Zuschläge
  // (Sonntag, Feiertag, Nachtschicht) genau daran entscheiden.
  useEffect(() => {
    if (!employeeId || !valid) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    fetchLeaveKindSuggestion(employeeId, startDate)
      .then((result) => {
        if (cancelled) return;
        setSuggestion(result);
        // Nur vorbelegen, solange nichts von Hand gewählt wurde.
        if (result && !kindTouched && (result.kind === "urlaub" || result.kind === "v_tag")) {
          setKind(result.kind);
        }
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
    // kindTouched bewusst nicht in den Abhängigkeiten: das Umstellen von Hand
    // soll die Empfehlung nicht neu laden, nur ihre Übernahme verhindern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, startDate, valid]);

  useEffect(() => {
    if (state.success) {
      onSubmitted();
      setReason("");
      setKindTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const labels = kindLabels[kind];
  // Zwei getrennte Konten: Urlaub und V-Tage. Geprüft wird immer das Konto,
  // das zur gewählten Art gehört.
  const accountRemaining = balance
    ? kind === "v_tag"
      ? balance.vRemainingDays
      : balance.remainingDays
    : null;
  const remainingAfter = accountRemaining !== null ? accountRemaining - days : null;
  const insufficientBalance = remainingAfter !== null && remainingAfter < 0;
  const suggestionDiffers =
    suggestion !== null &&
    (suggestion.kind === "urlaub" || suggestion.kind === "v_tag") &&
    suggestion.kind !== kind;
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
        hint="Die Anzahl Tage wird verbindlich vom Server berechnet."
      />
      <CardBody className="space-y-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="start_date" value={startDate} />
          <input type="hidden" name="end_date" value={endDate} />
          <input type="hidden" name="kind" value={kind} />

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

          <Field
            label="Art"
            hint="Vorschlag der Schichtplanung – lässt sich jederzeit umstellen."
          >
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as LeaveKind);
                setKindTouched(true);
              }}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              <option value="urlaub">
                Urlaubstag{balance ? ` · ${formatDays(balance.remainingDays)} übrig` : ""}
              </option>
              <option value="v_tag">
                V-Tag{balance ? ` · ${formatDays(balance.vRemainingDays)} übrig` : ""}
              </option>
            </select>
          </Field>

          {suggestion ? (
            <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-muted px-4 py-3 text-[13px] leading-snug text-ink-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <div>
                <p>
                  <span className="font-medium text-ink">
                    {suggestion.kind === "urlaub"
                      ? "Empfehlung: Urlaubstag"
                      : suggestion.kind === "v_tag"
                        ? "Empfehlung: V-Tag"
                        : "Keine Empfehlung"}
                  </span>{" "}
                  – {suggestion.reason}
                </p>
                {suggestionDiffers ? (
                  <button
                    type="button"
                    onClick={() => {
                      setKind(suggestion.kind as LeaveKind);
                      setKindTouched(true);
                    }}
                    className="mt-1 font-medium text-brand-600 hover:underline"
                  >
                    Empfehlung übernehmen
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

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
            <span className="text-sm text-ink-muted">Benötigte {labels.plural}</span>
            <span className="tnum text-lg font-semibold">
              {holidays ? formatDays(days) : "…"}
            </span>
          </div>

          {valid ? (
            <div className={cn("rounded-xl border px-4 py-3", panelTone)}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PanelIcon className="h-4 w-4" strokeWidth={2} />
                {insufficientBalance
                  ? `Für diesen Zeitraum stehen nur noch ${formatDays(Math.max(accountRemaining ?? 0, 0))} ${labels.plural} zur Verfügung.`
                  : staffingCritical
                    ? "Mindestbesetzung wird unterschritten."
                    : `${formatDays(accountRemaining ?? 0)} ${labels.plural} verfügbar.`}
              </p>
              <ul className="mt-2 space-y-1 text-[13px] leading-snug">
                {remainingAfter !== null && !insufficientBalance ? (
                  <li>
                    {formatDays(remainingAfter)} {labels.plural} verbleiben nach diesem Antrag.
                  </li>
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

          <SubmitButton
            label={labels.action}
            disabled={!valid || !holidays || days === 0 || insufficientBalance}
          />
        </form>
      </CardBody>
    </Card>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Wird gesendet …" : label}
    </Button>
  );
}
