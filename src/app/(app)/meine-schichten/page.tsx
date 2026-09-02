"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { NextShifts } from "@/components/dashboard/next-shifts";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY, employeesOfShift, holidays, staffingContext } from "@/lib/demo-data";
import { staffingFor, shiftRunsOn } from "@/lib/staffing";
import { addDays, formatDE, isHoliday, WEEKDAY_SHORT, fromISO } from "@/lib/dates";
import { fetchHolidays } from "@/lib/data/holidays";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { fetchMyLeaveRequests } from "@/lib/data/leave";
import { fetchMyShiftPlan } from "@/lib/data/rotation";
import { ShiftLeaveList } from "@/components/leave/shift-leave-list";
import { fetchAbsences } from "@/lib/data/absences";
import { DataError, fetchShiftStaffing } from "@/lib/data/staffing";
import { fetchEmployees } from "@/lib/data/employees";
import type {
  EmployeeRecord,
  Holiday,
  LiveLeaveRequest,
  LiveShiftPlanDay,
  LiveStaffingSnapshot,
} from "@/lib/types";

export default function MyShiftsPage() {
  const { mode, role, user, shift, profile } = useSession();

  if (mode !== "live") {
    return <DemoView user={user} shift={shift} />;
  }
  return <LiveView role={role} profileShiftName={profile.shiftName} />;
}

function DemoView({ user, shift }: { user: (typeof staffingContext)["employees"][number]; shift: ReturnType<typeof useSession>["shift"] }) {
  const colleagues = shift ? employeesOfShift(shift.id) : [];
  const nextTwoWeeks = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).filter(
    (iso) => shift && shiftRunsOn(shift, iso, holidays),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Plan"
        title="Meine Schichten"
        description={
          shift
            ? `${shift.name}, ${shift.startTime}–${shift.endTime} Uhr. Soll-Besetzung ${shift.targetHeadcount}, Mindestbesetzung ${shift.minHeadcount}.`
            : "Dir ist aktuell keine Schicht zugeordnet."
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <NextShifts employee={user} from={TODAY} />

          <Card>
            <CardHeader title="Zwei Wochen im Überblick" hint="Besetzung meiner Schicht" />
            <CardBody className="space-y-1.5">
              {nextTwoWeeks.map((iso) => {
                if (!shift) return null;
                const snapshot = staffingFor(iso, shift, staffingContext);
                return (
                  <div
                    key={iso}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-surface-muted"
                  >
                    <span className="tnum text-ink-muted">
                      {WEEKDAY_SHORT[(fromISO(iso).getDay() + 6) % 7]} · {formatDE(iso)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tnum font-medium">
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
                    </span>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Mein Team" hint={`${colleagues.length} Personen`} />
          <CardBody className="space-y-2">
            {colleagues.map((person) => (
              <div key={person.id} className="flex items-center justify-between">
                <span className="text-sm">
                  {person.firstName} {person.lastName}
                  {person.id === user.id ? <span className="text-ink-faint"> (du)</span> : null}
                </span>
                <span className="text-[12px] text-ink-faint">{person.jobTitle}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function LiveView({
  role,
  profileShiftName,
}: {
  role: string;
  profileShiftName?: string | null;
}) {
  const [shifts, setShifts] = useState<ShiftDetail[] | null>(null);
  const [holidaysReal, setHolidaysReal] = useState<Holiday[]>([]);
  const [myRequests, setMyRequests] = useState<LiveLeaveRequest[]>([]);
  const [myAbsenceDates, setMyAbsenceDates] = useState<Set<string>>(new Set());
  const [twoWeeks, setTwoWeeks] = useState<LiveStaffingSnapshot[] | null>(null);
  const [plan, setPlan] = useState<LiveShiftPlanDay[] | null>(null);
  const [colleagues, setColleagues] = useState<EmployeeRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myShift = useMemo(
    () => (shifts ?? []).find((s) => s.name === profileShiftName) ?? null,
    [shifts, profileShiftName],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [shiftResult, holidayResult, requestResult, absenceResult, planResult] =
        await Promise.all([
          fetchShiftDetails(),
          fetchHolidays(),
          fetchMyLeaveRequests(),
          fetchAbsences(TODAY, addDays(TODAY, 60)),
          fetchMyShiftPlan(TODAY, 28),
        ]);
      setShifts(shiftResult);
      setPlan(planResult);
      setHolidaysReal(holidayResult);
      setMyRequests(requestResult);
      setMyAbsenceDates(new Set(absenceResult.map((a) => a.date)));

      if (role !== "employee") {
        setColleagues((await fetchEmployees()).filter((e) => e.active));
      }
    } catch (caught) {
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!myShift) {
      setTwoWeeks(null);
      return;
    }
    let cancelled = false;
    const days = Array.from({ length: 21 }, (_, i) => addDays(TODAY, i)).filter(
      (iso) =>
        myShift.weekdays.includes(fromISO(iso).getDay()) && !isHoliday(iso, holidaysReal),
    );
    Promise.all(days.map((iso) => fetchShiftStaffing(myShift.id, iso)))
      .then((results) => {
        if (!cancelled) {
          setTwoWeeks(results.filter((r): r is LiveStaffingSnapshot => r !== null).slice(0, 14));
        }
      })
      .catch(() => {
        if (!cancelled) setTwoWeeks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [myShift, holidaysReal]);

  // Nächste Arbeitstage aus dem echten Plan (Ausnahme > Rotationsmuster >
  // feste Zuordnung, serverseitig aufgelöst). Freitage werden übersprungen,
  // Urlaub und Abwesenheiten als Label überlagert.
  const upcomingOwnDays = useMemo(() => {
    if (!plan) return [];
    const approvedLeave = myRequests.filter((r) => r.status === "approved");
    const pendingLeave = myRequests.filter((r) => r.status === "pending");

    return plan
      .filter((day) => !day.isFree && !isHoliday(day.date, holidaysReal))
      .slice(0, 5)
      .map((day) => {
        const onLeave = approvedLeave.find(
          (r) => day.date >= r.startDate && day.date <= r.endDate,
        );
        const pending = pendingLeave.find(
          (r) => day.date >= r.startDate && day.date <= r.endDate,
        );
        return {
          date: day.date,
          shiftName: day.shiftName,
          startTime: day.startTime,
          endTime: day.endTime,
          label: onLeave
            ? "Urlaub"
            : pending
              ? "Urlaub beantragt"
              : myAbsenceDates.has(day.date)
                ? "Abwesend"
                : undefined,
        };
      });
  }, [plan, myRequests, myAbsenceDates, holidaysReal]);

  // Nächste Freitage – bei rollierenden Mustern die eigentlich
  // interessante Information ("wann habe ich frei?").
  const upcomingFreeDays = useMemo(
    () => (plan ?? []).filter((d) => d.isFree).slice(0, 6),
    [plan],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Plan"
        title="Meine Schichten"
        description={
          plan === null
            ? "wird geladen …"
            : upcomingFreeDays.length > 0 || new Set(plan.map((d) => d.shiftName)).size > 2
              ? "Dein Plan läuft nach einem rollierenden Schichtmuster. Angezeigt wird, was tatsächlich für dich eingeplant ist."
              : myShift
                ? `${myShift.name}, ${myShift.startTime}–${myShift.endTime} Uhr. Soll-Besetzung ${myShift.targetStaff}, Mindestbesetzung ${myShift.minimumStaff}.`
                : "Dir ist aktuell keine Schicht zugeordnet."
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Nächste Schichten" hint="aus deinem tatsächlichen Plan" />
            <CardBody className="space-y-2 px-3 py-3">
              {plan === null ? (
                <p className="px-2 py-4 text-sm text-ink-muted">wird geladen …</p>
              ) : upcomingOwnDays.length === 0 ? (
                <p className="px-2 py-4 text-sm text-ink-muted">
                  Keine kommenden Schichttage gefunden.
                </p>
              ) : (
                upcomingOwnDays.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-muted"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                        {WEEKDAY_SHORT[(fromISO(day.date).getDay() + 6) % 7]}
                      </p>
                      <p className="tnum text-lg font-semibold leading-tight">
                        {day.date.slice(8, 10)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{day.shiftName ?? "Keine Schicht"}</p>
                      <p className="tnum text-[12px] text-ink-muted">
                        {day.startTime && day.endTime
                          ? `${day.startTime}–${day.endTime} · ${formatDE(day.date)}`
                          : formatDE(day.date)}
                      </p>
                    </div>
                    {day.label ? (
                      <Badge tone={day.label === "Urlaub" ? "plan" : "warn"}>{day.label}</Badge>
                    ) : null}
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {upcomingFreeDays.length > 0 ? (
            <Card>
              <CardHeader title="Nächste freie Tage" hint="laut deinem Schichtmuster" />
              <CardBody className="flex flex-wrap gap-2">
                {upcomingFreeDays.map((day) => (
                  <span
                    key={day.date}
                    className="tnum rounded-xl bg-surface-muted px-3 py-2 text-[13px]"
                  >
                    {WEEKDAY_SHORT[(fromISO(day.date).getDay() + 6) % 7]} · {formatDE(day.date)}
                  </span>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Drei Wochen im Überblick" hint="Besetzung meiner Schicht" />
            <CardBody className="space-y-1.5">
              {twoWeeks === null ? (
                <p className="px-2 py-4 text-sm text-ink-muted">wird geladen …</p>
              ) : twoWeeks.length === 0 ? (
                <p className="px-2 py-4 text-sm text-ink-muted">Keine Daten gefunden.</p>
              ) : (
                twoWeeks.map((snap) => (
                  <div
                    key={snap.date}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-surface-muted"
                  >
                    <span className="tnum text-ink-muted">
                      {WEEKDAY_SHORT[(fromISO(snap.date).getDay() + 6) % 7]} · {formatDE(snap.date)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tnum font-medium">
                        {snap.present} / {snap.target}
                      </span>
                      <Badge tone={snap.status === "ok" ? "ok" : snap.status === "warn" ? "warn" : "critical"}>
                        {snap.status === "ok" ? "OK" : snap.status === "warn" ? "knapp" : "kritisch"}
                      </Badge>
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <ShiftLeaveList from={TODAY} days={45} />
        </div>

        <Card className="h-fit">
          <CardHeader title="Mein Team" />
          <CardBody className="space-y-2">
            {role === "employee" ? (
              <p className="text-sm text-ink-muted">
                Die Teamübersicht mit allen Kolleginnen und Kollegen ist der Schichtleitung und
                Administration vorbehalten.
              </p>
            ) : colleagues === null ? (
              <p className="text-sm text-ink-muted">wird geladen …</p>
            ) : (
              colleagues
                .filter((c) => c.shiftName === profileShiftName)
                .map((person) => (
                  <div key={person.id} className="flex items-center justify-between">
                    <span className="text-sm">
                      {person.firstName} {person.lastName}
                    </span>
                    <span className="text-[12px] text-ink-faint">{person.department}</span>
                  </div>
                ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
