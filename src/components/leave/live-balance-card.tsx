import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDays } from "@/lib/dates";
import type { LiveLeaveBalance } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LiveBalanceCard({ balance }: { balance: LiveLeaveBalance | null }) {
  if (!balance) {
    return (
      <Card>
        <CardHeader title="Urlaubskonto" />
        <CardBody className="space-y-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </CardBody>
      </Card>
    );
  }

  const total = balance.entitlement + balance.carriedOver;
  const segments = [
    { label: "Verbraucht", value: balance.usedDays, className: "bg-ink" },
    { label: "Geplant", value: balance.plannedDays, className: "bg-plan-dot" },
    { label: "Beantragt", value: balance.pendingDays, className: "bg-info-dot" },
  ];

  return (
    <Card>
      <CardHeader
        title="Urlaubskonto"
        hint={
          balance.carriedOver > 0
            ? `${formatDays(balance.entitlement)} Tage Anspruch + ${formatDays(balance.carriedOver)} Tage Übertrag · ${balance.year}`
            : `${formatDays(balance.entitlement)} Tage Jahresanspruch · ${balance.year}`
        }
      />
      <CardBody className="space-y-4">
        <p className="flex items-baseline gap-2">
          <span className="tnum text-4xl font-semibold tracking-tight">
            {formatDays(Math.max(balance.remainingDays, 0))}
          </span>
          <span className="text-sm text-ink-muted">Tage verfügbar</span>
        </p>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          {segments.map((segment) => (
            <span
              key={segment.label}
              className={cn(segment.className)}
              style={{ width: `${total > 0 ? (segment.value / total) * 100 : 0}%` }}
            />
          ))}
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          {segments.map((segment) => (
            <div key={segment.label} className="rounded-xl bg-surface-muted px-2 py-2.5">
              <dt className="text-[12px] text-ink-muted">{segment.label}</dt>
              <dd className="tnum mt-0.5 text-base font-semibold">
                {formatDays(segment.value)}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
