"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, ClipboardList, Palmtree, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { CoverageStrip } from "@/components/dashboard/coverage-strip";
import { NextShifts } from "@/components/dashboard/next-shifts";
import { RequestList } from "@/components/dashboard/request-list";
import { LiveRequestList } from "@/components/leave/live-request-list";
import {
  fetchMyLeaveBalance,
  fetchMyLeaveRequests,
  fetchReviewLeaveRequests,
} from "@/lib/data/leave";
import type { LiveLeaveBalance, LiveLeaveRequest } from "@/lib/types";
import { useSession } from "@/context/session";
import {
  TODAY,
  announcements,
  allPendingRequests,
  employeesOfShift,
  holidays,
  pendingRequestsForShift,
  requestsOfEmployee,
  shifts,
  staffingContext,
} from "@/lib/demo-data";
import {
  absentOn,
  dayStatus,
  leaveBalance,
  shiftRunsOn,
  staffingFor,
} from "@/lib/staffing";
import { addDays, formatDE, formatDays, fromISO, weekdayLong } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Nächster Tag, an dem überhaupt produziert wird – für Wochenenden und Feiertage. */
function nextProductionDay(from: string): string {
  let cursor = from;
  for (let i = 0; i < 10; i += 1) {
    if (shifts.some((s) => s.code !== "FREI" && shiftRunsOn(s, cursor, holidays))) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return from;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export default function DashboardPage() {
  const { mode, role, profile, user, shift } = useSession();
  const reference = nextProductionDay(TODAY);
  const isToday = reference === TODAY;

  const [liveBalance, setLiveBalance] = useState<LiveLeaveBalance | null>(null);
  const [liveMyRequests, setLiveMyRequests] = useState<LiveLeaveRequest[] | null>(null);
  const [livePendingCount, setLivePendingCount] = useState<number | null>(null);

  const loadLive = useCallback(async () => {
    if (mode !== "live") return;
    const [balanceResult, myRequests] = await Promise.all([
      fetchMyLeaveBalance(),
      fetchMyLeaveRequests(),
    ]);
    setLiveBalance(balanceResult);
    setLiveMyRequests(myRequests);
    if (role !== "employee") {
      const review = await fetchReviewLeaveRequests();
      setLivePendingCount(review.filter((r) => r.status === "pending").length);
    }
  }, [mode, role]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  const demoBalance = leaveBalance(user, staffingContext.leaveRequests, TODAY);
  const balance =
    mode === "live"
      ? {
          available: liveBalance?.remainingDays ?? 0,
          planned: liveBalance?.plannedDays ?? 0,
        }
      : { available: demoBalance.available, planned: demoBalance.planned };

  const ownRequests = requestsOfEmployee(user.id);
  const ownPending =
    mode === "live"
      ? (liveMyRequests ?? []).filter((r) => r.status === "pending")
      : ownRequests.filter((r) => r.status === "pending");

  const ownStaffing =
    shift && shift.code !== "FREI" && shiftRunsOn(shift, reference, holidays)
      ? staffingFor(reference, shift, staffingContext)
      : null;

  const demoPending =
    role === "admin" ? allPendingRequests() : pendingRequestsForShift(user.shiftId);
  const pendingCount = mode === "live" ? (livePendingCount ?? 0) : demoPending.length;

  const weekShiftCount = (() => {
    if (!shift || shift.code === "FREI") return 0;
    const weekday = (fromISO(TODAY).getDay() + 6) % 7;
    const monday = addDays(TODAY, -weekday);
    let count = 0;
    for (let i = 0; i < 7; i += 1) {
      const iso = addDays(monday, i);
      if (!shiftRunsOn(shift, iso, holidays)) continue;
      const absent = absentOn(iso, staffingContext).includes(user.id);
      if (!absent) count += 1;
    }
    return count;
  })();

  const criticalDays = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).filter(
    (iso) => dayStatus(iso, staffingContext) === "critical",
  );

  const absentToday = absentOn(reference, staffingContext).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {greeting()}, {user.firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isToday
            ? "Hier ist dein Überblick für heute."
            : `Heute wird nicht produziert. Der Überblick zeigt den nächsten Produktionstag, ${weekdayLong(reference)}, den ${formatDE(reference)}.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Urlaubstage verfügbar"
          value={formatDays(balance.available)}
          unit="Tage"
          hint={`${formatDays(balance.planned)} bereits verplant`}
          accent="plan"
          icon={<Palmtree className="h-4 w-4" strokeWidth={1.8} />}
        />
        <KpiCard
          label={role === "employee" ? "Meine offenen Anträge" : "Offene Anträge"}
          value={role === "employee" ? ownPending.length : pendingCount}
          hint={
            role === "employee"
              ? ownPending.length > 0
                ? "warten auf Entscheidung"
                : "alles entschieden"
              : "warten auf deine Entscheidung"
          }
          accent="neutral"
          icon={<ClipboardList className="h-4 w-4" strokeWidth={1.8} />}
        />
        <KpiCard
          label={isToday ? "Besetzung heute" : "Besetzung nächster Tag"}
          value={ownStaffing ? `${ownStaffing.present} / ${ownStaffing.target}` : "–"}
          hint={
            ownStaffing
              ? `${shift?.name}, Mindestbesetzung ${ownStaffing.min}`
              : "keine Schicht zugeordnet"
          }
          accent={ownStaffing ? ownStaffing.status : "neutral"}
          icon={<Users className="h-4 w-4" strokeWidth={1.8} />}
        />
        <KpiCard
          label={role === "employee" ? "Schichten diese Woche" : "Kritische Tage (14 T.)"}
          value={role === "employee" ? weekShiftCount : criticalDays.length}
          hint={
            role === "employee"
              ? shift?.name ?? "–"
              : criticalDays.length > 0
                ? `nächster: ${formatDE(criticalDays[0])}`
                : "keine Engpässe erkannt"
          }
          accent={
            role === "employee" ? "neutral" : criticalDays.length > 0 ? "critical" : "ok"
          }
          icon={<CalendarCheck className="h-4 w-4" strokeWidth={1.8} />}
        />
      </div>

      {role === "employee" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <NextShifts employee={user} from={TODAY} />
          {mode === "live" ? (
            <LiveRequestList
              requests={liveMyRequests}
              loading={liveMyRequests === null}
              onChanged={loadLive}
            />
          ) : (
            <RequestList
              title="Meine Urlaubsanträge"
              hint="Anträge der letzten und kommenden Monate"
              requests={ownRequests.slice(0, 5)}
              emptyMessage="Noch keine Anträge gestellt."
              href="/urlaub"
            />
          )}
        </div>
      ) : (
        <>
          <CoverageStrip from={TODAY} />
          <div className="grid gap-4 lg:grid-cols-2">
            {mode === "live" ? (
              <Card>
                <CardHeader
                  title="Anträge zur Entscheidung"
                  hint={
                    pendingCount > 0
                      ? `${pendingCount} warten auf deine Entscheidung`
                      : "keine offenen Anträge"
                  }
                />
                <CardBody>
                  <a
                    href="/urlaubsantraege"
                    className="text-[13px] font-medium text-brand-600 hover:underline"
                  >
                    Zu den Urlaubsanträgen →
                  </a>
                </CardBody>
              </Card>
            ) : (
              <RequestList
                title="Anträge zur Entscheidung"
                hint="mit automatischer Besetzungsprüfung"
                requests={demoPending.slice(0, 5)}
                showEmployee
                showImpact
                emptyMessage="Keine offenen Anträge."
                href="/urlaubsantraege"
              />
            )}
            <TodayShifts reference={reference} isToday={isToday} absentToday={absentToday} />
          </div>
        </>
      )}

      <Card>
        <CardHeader title="Mitteilungen" hint="aus der Betriebsleitung" />
        <CardBody className="space-y-3">
          {announcements.map((item) => (
            <article key={item.id} className="flex gap-3">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  item.level === "warn" ? "bg-warn-dot" : "bg-info-dot",
                )}
              />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-[13px] leading-snug text-ink-muted">{item.body}</p>
              </div>
            </article>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function TodayShifts({
  reference,
  isToday,
  absentToday,
}: {
  reference: string;
  isToday: boolean;
  absentToday: number;
}) {
  const rows = shifts
    .filter((s) => s.code !== "FREI" && shiftRunsOn(s, reference, holidays))
    .map((s) => ({
      shift: s,
      snapshot: staffingFor(reference, s, staffingContext),
      headcount: employeesOfShift(s.id).length,
    }));

  return (
    <Card>
      <CardHeader
        title={isToday ? "Besetzung heute" : `Besetzung am ${formatDE(reference)}`}
        hint={`${absentToday} Personen abwesend`}
      />
      <CardBody className="space-y-2">
        {rows.map(({ shift, snapshot, headcount }) => (
          <div
            key={shift.id}
            className="flex items-center justify-between rounded-xl border border-line px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium">{shift.name}</p>
              <p className="tnum text-[12px] text-ink-muted">
                {shift.startTime}–{shift.endTime} · {headcount} zugeordnet
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-sm font-semibold">
                {snapshot.present} / {snapshot.target}
              </span>
              <Badge
                tone={
                  snapshot.status === "ok"
                    ? "ok"
                    : snapshot.status === "warn"
                      ? "warn"
                      : "critical"
                }
              >
                {snapshot.status === "ok"
                  ? "OK"
                  : snapshot.status === "warn"
                    ? "knapp"
                    : "kritisch"}
              </Badge>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
