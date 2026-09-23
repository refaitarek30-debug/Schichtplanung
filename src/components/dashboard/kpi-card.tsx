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
 * Farbton der ganzen Kachel. Die Werte kommen aus den Statusfarben des
 * Designs – dieselben, die überall für „gut", „Hinweis", „Achtung" stehen –
 * und haben deshalb schon ihre Dunkelmodus-Fassung.
 *
 * Die Farbe ist Orientierung, keine Aussage: sie sagt „das ist die
 * Urlaubskachel", nicht „hier ist etwas gut oder schlecht". Die Bewertung
 * trägt weiterhin der Punkt vor dem Hinweistext.
 */
const toene = {
  neutral: { kachel: "bg-surface", icon: "text-ink-faint" },
  gruen: { kachel: "bg-ok-bg/60 border-ok-bg", icon: "text-ok-fg" },
  blau: { kachel: "bg-info-bg/60 border-info-bg", icon: "text-info-fg" },
  orange: { kachel: "bg-warn-bg/60 border-warn-bg", icon: "text-warn-fg" },
  lila: { kachel: "bg-plan-bg/60 border-plan-bg", icon: "text-plan-fg" },
  rot: { kachel: "bg-crit-bg/60 border-crit-bg", icon: "text-crit-fg" },
} as const;

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
  ton = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent?: keyof typeof accents;
  icon?: ReactNode;
  /** Ziel beim Antippen. Fehlt es, ist die Kachel nicht anklickbar. */
  href?: string;
  /** Hintergrundton der Kachel, zur schnellen Orientierung. */
  ton?: keyof typeof toene;
}) {
  const inhalt = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        <span className={cn("flex items-center gap-1", toene[ton].icon)}>
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

  const rahmen = cn("rounded-card border border-line p-4 shadow-card", toene[ton].kachel);

  if (!href) return <div className={rahmen}>{inhalt}</div>;

  return (
    <Link
      href={href}
      className={cn(
        rahmen,
        "group block text-left transition-[filter] hover:brightness-[0.97]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
      )}
    >
      {inhalt}
    </Link>
  );
}
