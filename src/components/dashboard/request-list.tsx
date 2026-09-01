import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
  staffingTone,
} from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDays, formatRange } from "@/lib/dates";
import { getEmployee, staffingContext } from "@/lib/demo-data";
import { checkLeaveImpact } from "@/lib/staffing";
import type { LeaveRequest } from "@/lib/types";

export function RequestList({
  title,
  hint,
  requests,
  showEmployee = false,
  showImpact = false,
  emptyMessage,
  href,
}: {
  title: string;
  hint?: string;
  requests: LeaveRequest[];
  showEmployee?: boolean;
  showImpact?: boolean;
  emptyMessage: string;
  href?: string;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        hint={hint}
        action={
          href ? (
            <Link href={href} className="text-[13px] font-medium text-brand-600">
              Alle ansehen
            </Link>
          ) : null
        }
      />
      <CardBody className="space-y-2 px-3 py-3">
        {requests.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-muted">{emptyMessage}</p>
        ) : (
          requests.map((request) => {
            const employee = getEmployee(request.employeeId);
            const impact =
              showImpact && employee
                ? checkLeaveImpact(
                    employee,
                    request.startDate,
                    request.endDate,
                    staffingContext,
                  )
                : null;

            return (
              <div
                key={request.id}
                className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-muted"
              >
                {showEmployee && employee ? <Avatar employee={employee} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {showEmployee && employee
                      ? `${employee.firstName} ${employee.lastName}`
                      : formatRange(request.startDate, request.endDate)}
                  </p>
                  <p className="tnum text-[12px] text-ink-muted">
                    {showEmployee
                      ? `${formatRange(request.startDate, request.endDate)} · ${formatDays(request.days)} Tage`
                      : `${formatDays(request.days)} Urlaubstage`}
                  </p>
                  {impact ? (
                    <p className="mt-1.5">
                      <Badge tone={staffingTone[impact.status]}>{impact.headline}</Badge>
                    </p>
                  ) : null}
                </div>
                <Badge tone={leaveStatusTone[request.status]}>
                  {leaveStatusLabel[request.status]}
                </Badge>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
