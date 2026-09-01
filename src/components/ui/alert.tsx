import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { box: "border-info-bg bg-info-bg/60 text-info-fg", Icon: Info },
  success: { box: "border-ok-bg bg-ok-bg/60 text-ok-fg", Icon: CheckCircle2 },
  error: { box: "border-crit-bg bg-crit-bg/60 text-crit-fg", Icon: AlertTriangle },
  warning: { box: "border-warn-bg bg-warn-bg/60 text-warn-fg", Icon: AlertTriangle },
} as const;

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = tones[tone];
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] leading-snug",
        box,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}
