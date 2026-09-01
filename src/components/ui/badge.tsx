import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LeaveStatus, StaffingStatus } from "@/lib/types";

const tones = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  critical: "bg-crit-bg text-crit-fg",
  info: "bg-info-bg text-info-fg",
  plan: "bg-plan-bg text-plan-fg",
  neutral: "bg-surface-sunken text-ink-muted",
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const staffingTone: Record<StaffingStatus, Tone> = {
  ok: "ok",
  warn: "warn",
  critical: "critical",
};

export const staffingLabel: Record<StaffingStatus, string> = {
  ok: "Besetzung ausreichend",
  warn: "Unter Soll-Besetzung",
  critical: "Mindestbesetzung unterschritten",
};

export const leaveStatusTone: Record<LeaveStatus, Tone> = {
  pending: "info",
  approved: "ok",
  rejected: "critical",
  withdrawn: "neutral",
};

export const leaveStatusLabel: Record<LeaveStatus, string> = {
  pending: "Ausstehend",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  withdrawn: "Zurückgezogen",
};
