import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StaffingStatus } from "@/lib/types";

const accents: Record<StaffingStatus | "neutral" | "plan", string> = {
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  critical: "bg-crit-dot",
  plan: "bg-plan-dot",
  neutral: "bg-info-dot",
};

export function KpiCard({
  label,
  value,
  unit,
  hint,
  accent = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: keyof typeof accents;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span className="text-ink-faint">{icon}</span>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="tnum text-[28px] font-semibold leading-none tracking-tight">
          {value}
        </span>
        {unit ? <span className="text-sm text-ink-muted">{unit}</span> : null}
      </p>
      {hint ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", accents[accent])} />
          {hint}
        </p>
      ) : null}
    </div>
  );
}
