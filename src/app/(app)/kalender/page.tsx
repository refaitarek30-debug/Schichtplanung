"use client";

import { useCallback, useEffect, useState } from "react";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { LiveMonthCalendar } from "@/components/calendar/live-month-calendar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { formatDays, formatRange } from "@/lib/dates";
import {
  DataError,
  fetchMyLeaveRequests,
  fetchReviewLeaveRequests,
} from "@/lib/data/leave";
import type { LiveLeaveRequest } from "@/lib/types";

export default function CalendarPage() {
  const { mode, role, company } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Übersicht"
        title="Kalender"
        description={
          role === "employee"
            ? "Deine Urlaubstage. Tippe auf einen Tag, um Details zu sehen."
            : "Besetzung je Tag, aus echten Anträgen und Abwesenheiten berechnet. Die Farbe zeigt den kritischsten Wert aller Schichten."
        }
      />
      {mode === "live" ? (
        <>
          <LiveMonthCalendar today={TODAY} role={role} companyId={company.id} />
          <LiveLeaveOverview role={role} />
        </>
      ) : (
        <MonthCalendar today={TODAY} role={role} />
      )}
    </div>
  );
}

/**
 * Zusätzliche Liste unterhalb des Kalenders: die eigenen bzw.
 * unternehmensweiten Urlaubsanträge, unabhängig vom aktuell gezeigten Monat.
 */
function LiveLeaveOverview({ role }: { role: string }) {
  const [requests, setRequests] = useState<LiveLeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRequests(
        role === "employee" ? await fetchMyLeaveRequests() : await fetchReviewLeaveRequests(),
      );
    } catch (caught) {
      setRequests([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = (requests ?? []).filter((r) => r.status !== "withdrawn");

  return (
    <Card>
      <CardHeader
        title={role === "employee" ? "Mein Urlaub" : "Urlaub im Unternehmen"}
        hint="alle Anträge, unabhängig vom angezeigten Monat"
      />
      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <CardBody className="space-y-2 px-3 py-3">
        {requests === null ? (
          <RowSkeleton rows={3} />
        ) : visible.length === 0 ? (
          <EmptyState title="Keine Urlaubseinträge gefunden." />
        ) : (
          visible.slice(0, 8).map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {request.employeeName ? `${request.employeeName} · ` : ""}
                {formatRange(request.startDate, request.endDate)}
                <span className="tnum text-ink-faint">
                  {" "}
                  · {formatDays(request.requestedDays)} Tage
                </span>
              </span>
              <Badge tone={leaveStatusTone[request.status]}>
                {leaveStatusLabel[request.status]}
              </Badge>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
