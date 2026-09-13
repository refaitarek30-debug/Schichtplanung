import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDays } from "@/lib/dates";
import type { LiveLeaveBalance } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LiveBalanceCard({
  balance,
  year,
  onYearChange,
}: {
  balance: LiveLeaveBalance | null;
  /** Angezeigtes Urlaubsjahr – für die Planung des kommenden Jahres. */
  year?: number;
  onYearChange?: (year: number) => void;
}) {
  const jetzt = new Date().getFullYear();
  const jahre = [jetzt - 1, jetzt, jetzt + 1];

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
            ? `${formatDays(balance.entitlement)} Tage Anspruch + ${formatDays(balance.carriedOver)} Tage Übertrag`
            : `${formatDays(balance.entitlement)} Tage Jahresanspruch`
        }
        action={
          onYearChange ? (
            <select
              value={year ?? balance.year}
              onChange={(e) => onYearChange(Number(e.target.value))}
              aria-label="Urlaubsjahr"
              className="tnum rounded-lg border border-line bg-surface px-2 py-1 text-[13px]"
            >
              {jahre.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : undefined
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

        {/* Zweites Konto: V-Tage (Freischichten), getrennt vom Urlaub. */}
        <div className="rounded-xl border border-line px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-muted">V-Tage (Freischichten)</span>
            <span className="tnum text-xl font-semibold">
              {formatDays(Math.max(balance.vRemainingDays, 0))}
            </span>
          </div>
          <p className="tnum mt-1 text-[12px] text-ink-faint">
            von {formatDays(balance.vEntitlement)}
            {balance.vCarriedOver > 0
              ? ` + ${formatDays(balance.vCarriedOver)} Übertrag`
              : ""}{" "}
            · {formatDays(balance.vUsedDays)} genommen
            {balance.vPendingDays > 0 ? `, ${formatDays(balance.vPendingDays)} beantragt` : ""}
          </p>
          {balance.carriedOver > 0 || balance.vCarriedOver > 0 ? (
            <p className="mt-2 text-[12px] text-ink-muted">
              Übertragene Tage aus {balance.year - 1} verfallen am 31.03.{balance.year}.
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
