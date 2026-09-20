import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffingStatus } from "@/lib/types";

const accents: Record<StaffingStatus | "neutral" | "plan", string> = {
  ok: "bg-ok-dot",
  warn: "bg-warn-dot",
  critical: "bg-crit-dot",
  plan: "bg-plan-dot",
  neutral: "bg-info-dot",
};

/**
 * Eine Kennzahl auf dem Dashboard.
 *
 * Mit `href` wird die ganze Kachel zum Verweis: eine Zahl weckt immer die
 * Frage „und welche?", und der Weg dorthin soll nicht über das Menü führen.
 * Ohne `href` bleibt es ein reiner Anzeigekasten – nichts wird klickbar,
 * hinter dem nichts steht.
 */
export function KpiCard({
  label,
  value,
  unit,
  hint,
  accent = "neutral",
  icon,
  href,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: keyof typeof accents;
  icon?: ReactNode;
  /** Ziel beim Antippen. Fehlt es, ist die Kachel nicht anklickbar. */
  href?: string;
}) {
  const inhalt = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span className="flex items-center gap-1 text-ink-faint">
          {icon}
          {href ? (
            <ChevronRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.8}
              aria-hidden
            />
          ) : null}
        </span>
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
    </>
  );

  const rahmen = "rounded-card border border-line bg-surface p-4 shadow-card";

  if (!href) return <div className={rahmen}>{inhalt}</div>;

  return (
    <Link
      href={href}
      className={cn(
        rahmen,
        "group block text-left transition-colors hover:bg-surface-muted",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
      )}
    >
      {inhalt}
    </Link>
  );
}
