"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Palmtree,
  Thermometer,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ShiftPlanGrid } from "@/components/calendar/shift-plan-grid";
import { RequestList } from "@/components/dashboard/request-list";
import { LiveRequestList } from "@/components/leave/live-request-list";
import {
  fetchMyLeaveBalance,
  fetchMyLeaveRequests,
  fetchReviewLeaveRequests,
} from "@/lib/data/leave";
import { fetchMyShiftPlan } from "@/lib/data/rotation";
import { fetchMySickDays } from "@/lib/data/absences";
import { fetchAnnouncements } from "@/lib/data/announcements";
import { fetchLeaveBlocks } from "@/lib/data/staffing-rules";
import { fetchShiftOptions } from "@/lib/data/shifts";
import { fetchStaffingRange } from "@/lib/data/staffing";
import type {
  LiveAnnouncement,
  LiveLeaveBalance,
  LiveLeaveBlock,
  LiveLeaveRequest,
  LiveShiftPlanDay,
} from "@/lib/types";
import { useSession } from "@/context/session";
import {
  TODAY,
  absences as demoAbsences,
  announcements as demoAnnouncements,
  allPendingRequests,
  holidays,
  pendingRequestsForShift,
  requestsOfEmployee,
  shifts,
  staffingContext,
} from "@/lib/demo-data";
import { absentOn, dayStatus, leaveBalance, shiftRunsOn } from "@/lib/staffing";
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
  const { mode, role, profile, user, shift, company } = useSession();
  const reference = nextProductionDay(TODAY);
  const isToday = reference === TODAY;

  const [liveBalance, setLiveBalance] = useState<LiveLeaveBalance | null>(null);
  const [liveMyRequests, setLiveMyRequests] = useState<LiveLeaveRequest[] | null>(null);
  const [livePendingCount, setLivePendingCount] = useState<number | null>(null);
  // Echte Besetzung statt Demo-Zahlen: der eigene Plan (für "Schichten diese
  // Woche") und – für Führungskräfte – die Besetzung des Referenztages sowie
  // die kritischen Tage der nächsten zwei Wochen.
  const [livePlan, setLivePlan] = useState<LiveShiftPlanDay[] | null>(null);
  const [liveCriticalDays, setLiveCriticalDays] = useState<string[] | null>(null);
  /** Eigene Kranktage im laufenden Jahr – für die Kachel "Krank gesamt". */
  const [liveSickDays, setLiveSickDays] = useState<number | null>(null);
  // Mitteilungen der Betriebsleitung und aktive Urlaubssperren. Beides wird
  // auf der Regeln-Seite gepflegt und erscheint hier zusammen.
  const [liveAnnouncements, setLiveAnnouncements] = useState<LiveAnnouncement[] | null>(null);
  const [liveBlocks, setLiveBlocks] = useState<LiveLeaveBlock[]>([]);
  const [shiftNames, setShiftNames] = useState<Map<string, string>>(new Map());

  const loadLive = useCallback(async () => {
    if (mode !== "live") return;

    /**
     * Jede Abfrage einzeln auswerten. Vorher hingen alle in einem
     * Promise.all: eine einzige fehlgeschlagene Abfrage hat dann sämtliche
     * Kacheln auf null gelassen – die Urlaubstage standen auf 0, obwohl das
     * Konto voll war.
     */
    const [balance, requests, plan, sick, notices, blocks, shifts] = await Promise.allSettled([
      fetchMyLeaveBalance(),
      fetchMyLeaveRequests(),
      fetchMyShiftPlan(TODAY, 14),
      fetchMySickDays(),
      fetchAnnouncements(10),
      fetchLeaveBlocks(),
      fetchShiftOptions(),
    ]);

    if (balance.status === "fulfilled") setLiveBalance(balance.value);
    if (requests.status === "fulfilled") setLiveMyRequests(requests.value);
    if (plan.status === "fulfilled") setLivePlan(plan.value);
    if (sick.status === "fulfilled") setLiveSickDays(sick.value);
    setLiveAnnouncements(notices.status === "fulfilled" ? notices.value : []);
    if (blocks.status === "fulfilled") setLiveBlocks(blocks.value);
    if (shifts.status === "fulfilled") {
      setShiftNames(new Map(shifts.value.map((o) => [o.id, o.name])));
    }

    if (role !== "employee") {
      const [review, range] = await Promise.allSettled([
        fetchReviewLeaveRequests(),
        fetchStaffingRange(company.id, TODAY, 14),
      ]);
      if (review.status === "fulfilled") {
        setLivePendingCount(review.value.filter((r) => r.status === "pending").length);
      }
      if (range.status === "fulfilled") {
        setLiveCriticalDays(
          [
            ...new Set(range.value.filter((s) => s.status === "critical").map((s) => s.date)),
          ].sort(),
        );
      }
    }
  }, [mode, role, company.id]);

  useEffect(() => {
    void loadLive();
  }, [loadLive]);

  const demoBalance = leaveBalance(user, staffingContext.leaveRequests, TODAY);
  const availableLeave =
    mode === "live" ? (liveBalance?.remainingDays ?? 0) : demoBalance.available;

  const ownRequests = requestsOfEmployee(user.id);
  const ownPending =
    mode === "live"
      ? (liveMyRequests ?? []).filter((r) => r.status === "pending")
      : ownRequests.filter((r) => r.status === "pending");

  const demoPending =
    role === "admin" ? allPendingRequests() : pendingRequestsForShift(user.shiftId);
  const pendingCount = mode === "live" ? (livePendingCount ?? 0) : demoPending.length;

  const demoWeekShiftCount = (() => {
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

  // Live: eigene Arbeitstage der nächsten 7 Tage aus dem echten Schichtplan.
  const weekShiftCount =
    mode === "live"
      ? (livePlan ?? []).slice(0, 7).filter((d) => !d.isFree && d.shiftId).length
      : demoWeekShiftCount;

  const demoCriticalDays = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i)).filter(
    (iso) => dayStatus(iso, staffingContext) === "critical",
  );
  const criticalDays = mode === "live" ? (liveCriticalDays ?? []) : demoCriticalDays;

  // Eigene Kranktage im laufenden Jahr. Im Demo-Modus aus dem Beispieldatensatz,
  // im Live-Modus aus `absences` – in beiden Fällen nur die eigene Person.
  const year = fromISO(TODAY).getFullYear();
  const demoSickDays = demoAbsences.filter(
    (a) => a.employeeId === user.id && a.type === "krank" && a.date.startsWith(`${year}`),
  ).length;
  const sickDays = mode === "live" ? (liveSickDays ?? 0) : demoSickDays;

  // Zweites Konto neben dem Urlaub: V-Tage (Freischichten). Der Demo-Datensatz
  // aus Phase 1 kennt noch keine V-Tage – dort steht der Regelanspruch.
  const DEMO_V_DAYS = 27;
  const vRemaining = mode === "live" ? (liveBalance?.vRemainingDays ?? 0) : DEMO_V_DAYS;
  const vEntitlement = mode === "live" ? (liveBalance?.vEntitlement ?? 0) : DEMO_V_DAYS;

  // Mitteilungen: im Live-Modus das, was die Führung auf der Regeln-Seite
  // geschrieben hat, plus jede aktive Urlaubssperre als eigener Eintrag.
  // Gesperrte Zeiträume, die schon vorbei sind, fallen raus.
  const notices = useMemo(() => {
    if (mode !== "live") {
      return demoAnnouncements.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        level: item.level === "warn" ? ("warn" as const) : ("info" as const),
      }));
    }
    const fromBlocks = liveBlocks
      .filter((block) => block.endDate >= TODAY)
      .map((block) => ({
        id: `block-${block.id}`,
        title: `Urlaubssperre: ${block.reason}`,
        body: `${formatDE(block.startDate)} – ${formatDE(block.endDate)} · ${
          block.shiftId ? (shiftNames.get(block.shiftId) ?? "eine Schicht") : "alle Schichten"
        }`,
        level: "warn" as const,
      }));
    const fromNotices = (liveAnnouncements ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      level: item.level,
    }));
    return [...fromBlocks, ...fromNotices];
  }, [mode, liveAnnouncements, liveBlocks, shiftNames]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {greeting()}, {profile.firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isToday
            ? "Hier ist dein Überblick für heute."
            : `Heute wird nicht produziert. Der Überblick zeigt den nächsten Produktionstag, ${weekdayLong(reference)}, den ${formatDE(reference)}.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Urlaubstage verfügbar"
          value={formatDays(availableLeave)}
          unit="Tage"
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
        <KpiCard
          label="Krank gesamt"
          value={sickDays}
          unit={sickDays === 1 ? "Tag" : "Tage"}
          hint={`im Jahr ${year}`}
          accent={sickDays > 0 ? "warn" : "ok"}
          icon={<Thermometer className="h-4 w-4" strokeWidth={1.8} />}
        />
        <KpiCard
          label="V-Tage gesamt"
          value={formatDays(vRemaining)}
          unit="Tage"
          hint={`von ${formatDays(vEntitlement)} übrig`}
          accent="plan"
          icon={<CalendarClock className="h-4 w-4" strokeWidth={1.8} />}
        />
      </div>

      {/* Der Schichtplan steht für alle auf dem Dashboard – ändern darf ihn
          nur die Führung, gelesen wird er von allen. */}
      {mode === "live" ? (
        <ShiftPlanGrid
          companyId={company.id}
          from={TODAY}
          days={14}
          canEdit={role === "admin" || role === "shift_leader"}
        />
      ) : null}

      {role === "employee" ? (
        <div className="grid gap-4">
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
          <div className="grid gap-4">
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
          </div>
        </>
      )}

      <Card>
        <CardHeader
          title="Mitteilungen"
          hint="aus der Betriebsleitung · inklusive aktiver Urlaubssperren"
        />
        <CardBody className="space-y-3">
          {mode === "live" && liveAnnouncements === null ? (
            <p className="py-2 text-sm text-ink-muted">wird geladen …</p>
          ) : notices.length === 0 ? (
            <p className="py-2 text-sm text-ink-muted">
              Zurzeit gibt es keine Mitteilungen und keine Urlaubssperren.
            </p>
          ) : (
            notices.map((item) => (
              <article key={item.id} className="flex gap-3">
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.level === "warn" ? "bg-warn-dot" : "bg-info-dot",
                  )}
                />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.body ? (
                    <p className="text-[13px] leading-snug text-ink-muted">{item.body}</p>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
