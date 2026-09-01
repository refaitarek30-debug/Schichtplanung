"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
  staffingTone,
} from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewPanel } from "@/components/leave/review-panel";
import { useSession } from "@/context/session";
import {
  allPendingRequests,
  getEmployee,
  getShift,
  leaveRequests,
  pendingRequestsForShift,
  staffingContext,
} from "@/lib/demo-data";
import { formatDays, formatRange } from "@/lib/dates";
import { checkLeaveImpact } from "@/lib/staffing";
import { DataError, fetchReviewLeaveRequests } from "@/lib/data/leave";
import type { LeaveStatus, LiveLeaveRequest } from "@/lib/types";

export default function RequestsPage() {
  const { mode, role, user } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Führung"
        title="Urlaubsanträge"
        description="Jeder Antrag wird gegen die Mindestbesetzung der betroffenen Schicht geprüft, bevor du entscheidest."
      />
      {mode === "live" ? (
        <LiveReviewSection />
      ) : (
        <DemoReviewSection role={role} userId={user.id} />
      )}
    </div>
  );
}

function LiveReviewSection() {
  const [requests, setRequests] = useState<LiveLeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRequests(await fetchReviewLeaveRequests());
    } catch (caught) {
      setRequests([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ReviewPanel requests={requests} loading={requests === null} onChanged={load} />
    </>
  );
}

function DemoReviewSection({ role, userId }: { role: string; userId: string }) {
  const [decisions, setDecisions] = useState<Record<string, LeaveStatus>>({});

  const pending =
    role === "admin" ? allPendingRequests() : pendingRequestsForShift(getEmployee(userId)!.shiftId);
  const decided = leaveRequests
    .filter((r) => r.status !== "pending")
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 6);

  return (
    <>
      <Card>
        <CardHeader
          title="Offene Anträge"
          hint={`${pending.length} warten auf eine Entscheidung`}
        />
        <CardBody className="space-y-3">
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              Keine offenen Anträge.
            </p>
          ) : (
            pending.map((request) => {
              const employee = getEmployee(request.employeeId);
              if (!employee) return null;
              const shift = getShift(employee.shiftId);
              const impact = checkLeaveImpact(
                employee,
                request.startDate,
                request.endDate,
                staffingContext,
              );
              const decision = decisions[request.id];

              return (
                <article
                  key={request.id}
                  className="rounded-xl border border-line px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar employee={employee} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {employee.firstName} {employee.lastName}
                        <span className="font-normal text-ink-faint">
                          {" "}
                          · {shift?.name}
                        </span>
                      </p>
                      <p className="tnum text-[13px] text-ink-muted">
                        {formatRange(request.startDate, request.endDate)} ·{" "}
                        {formatDays(request.days)} Urlaubstage
                      </p>
                      {request.comment ? (
                        <p className="mt-1 text-[13px] italic text-ink-muted">
                          „{request.comment}“
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={staffingTone[impact.status]}>{impact.headline}</Badge>
                  </div>

                  <ul className="mt-3 space-y-1 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] leading-snug text-ink-muted">
                    {impact.hints.map((hint) => (
                      <li key={hint}>{hint}</li>
                    ))}
                  </ul>

                  <div className="mt-3 flex items-center gap-2">
                    {decision ? (
                      <Badge tone={leaveStatusTone[decision]}>
                        {leaveStatusLabel[decision]}
                      </Badge>
                    ) : (
                      <>
                        <Button
                          onClick={() =>
                            setDecisions((d) => ({ ...d, [request.id]: "approved" }))
                          }
                        >
                          <Check className="h-4 w-4" /> Genehmigen
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            setDecisions((d) => ({ ...d, [request.id]: "rejected" }))
                          }
                        >
                          <X className="h-4 w-4" /> Ablehnen
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Zuletzt entschieden" />
        <CardBody className="space-y-2">
          {decided.map((request) => {
            const employee = getEmployee(request.employeeId);
            return (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-lg px-2 py-2"
              >
                <div>
                  <p className="text-sm">
                    {employee?.firstName} {employee?.lastName}
                  </p>
                  <p className="tnum text-[12px] text-ink-muted">
                    {formatRange(request.startDate, request.endDate)}
                    {request.decisionNote ? ` · ${request.decisionNote}` : ""}
                  </p>
                </div>
                <Badge tone={leaveStatusTone[request.status]}>
                  {leaveStatusLabel[request.status]}
                </Badge>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
