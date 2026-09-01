"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { formatDays, formatRange } from "@/lib/dates";
import { withdrawMyLeaveRequest } from "@/lib/auth/leave-actions";
import type { LiveLeaveRequest } from "@/lib/types";

export function LiveRequestList({
  requests,
  loading,
  onChanged,
}: {
  requests: LiveLeaveRequest[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function withdraw(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await withdrawMyLeaveRequest(id);
      if (result.error) setError(result.error);
      setConfirmId(null);
      onChanged();
    });
  }

  return (
    <Card>
      <CardHeader title="Meine Anträge" />
      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <CardBody className="space-y-2 px-3 py-3">
        {loading ? (
          <RowSkeleton rows={3} />
        ) : !requests || requests.length === 0 ? (
          <EmptyState
            title="Noch keine Anträge gestellt."
            description="Ein neuer Antrag erscheint hier sofort nach dem Absenden."
          />
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {formatRange(request.startDate, request.endDate)}
                </p>
                <p className="tnum text-[12px] text-ink-muted">
                  {formatDays(request.requestedDays)} Urlaubstage
                  {request.halfDayPeriod
                    ? ` · ${request.halfDayPeriod === "vormittag" ? "vormittags" : "nachmittags"}`
                    : ""}
                </p>
                {request.reason ? (
                  <p className="mt-1 text-[13px] italic text-ink-muted">
                    „{request.reason}“
                  </p>
                ) : null}
                {request.status === "rejected" && request.rejectionReason ? (
                  <p className="mt-1 text-[13px] text-crit-fg">
                    Grund: {request.rejectionReason}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge tone={leaveStatusTone[request.status]}>
                  {leaveStatusLabel[request.status]}
                </Badge>
                {request.status === "pending" ? (
                  confirmId === request.id ? (
                    <div className="flex gap-1.5">
                      <Button
                        variant="danger"
                        disabled={pending}
                        onClick={() => withdraw(request.id)}
                      >
                        Bestätigen
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setConfirmId(null)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(request.id)}
                      className="text-[12px] font-medium text-ink-faint hover:text-crit-fg"
                    >
                      Zurückziehen
                    </button>
                  )
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
