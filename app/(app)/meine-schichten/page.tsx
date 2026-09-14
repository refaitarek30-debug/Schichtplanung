"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY, employeesOfShift } from "@/lib/demo-data";
import { formatDays } from "@/lib/dates";
import { fetchTeamBalances } from "@/lib/data/leave";
import { ShiftLeaveList } from "@/components/leave/shift-leave-list";
import { fetchEmployees } from "@/lib/data/employees";
import { qualificationLabels, type Qualification } from "@/lib/qualifications";
import type { EmployeeRecord, LiveTeamBalance } from "@/lib/types";

export default function MyShiftsPage() {
  const { mode, role, user, shift } = useSession();

  if (mode !== "live") {
    return <DemoView userId={user.id} shiftId={shift?.id ?? null} />;
  }
  return <LiveView role={role} />;
}

function DemoView({ userId, shiftId }: { userId: string; shiftId: string | null }) {
  const colleagues = shiftId ? employeesOfShift(shiftId) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Plan"
        title="Meine Schichten"
        description="Wer aus deiner Schicht Urlaub hat und wer zu deinem Team gehört."
      />

      <Card className="lg:max-w-[420px]">
        <CardHeader title="Mein Team" hint={`${colleagues.length} Personen`} />
        <CardBody className="space-y-2">
          {colleagues.map((person) => (
            <div key={person.id} className="flex items-center justify-between">
              <span className="text-sm">
                {person.firstName} {person.lastName}
                {person.id === userId ? <span className="text-ink-faint"> (du)</span> : null}
              </span>
              <span className="text-[12px] text-ink-faint">{person.jobTitle}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function LiveView({ role }: { role: string }) {
  const [colleagues, setColleagues] = useState<EmployeeRecord[] | null>(null);
  /** Rest-Urlaub und Rest-V-Tage je Mitarbeiter – nur für die Führung. */
  const [balances, setBalances] = useState<Map<string, LiveTeamBalance>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (role === "employee") return;
    setError(null);

    const [people, teamBalances] = await Promise.allSettled([
      fetchEmployees(),
      fetchTeamBalances(),
    ]);

    if (people.status === "fulfilled") {
      setColleagues(people.value.filter((e) => e.active));
    } else {
      setColleagues([]);
      setError(
        people.reason instanceof Error
          ? people.reason.message
          : "Die Daten konnten nicht geladen werden.",
      );
    }
    if (teamBalances.status === "fulfilled") setBalances(teamBalances.value);
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  // Gesamte Belegschaft nach Schichtgruppe. Eine feste Schicht hat im
  // Rotationsbetrieb niemand – deshalb wird nach A–D gruppiert, nicht danach
  // gefiltert. Die Qualifikationen stehen direkt an der Person, damit die
  // Schichtleitung sieht, wer Messwarte, Labor oder B-Schein abdecken kann.
  const teamGroups = useMemo(() => {
    const groups = new Map<string, EmployeeRecord[]>();
    for (const person of colleagues ?? []) {
      const key = person.rotationTeam ? `Schicht ${person.rotationTeam}` : "Ohne Schichtgruppe";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(person);
    }
    for (const members of groups.values()) {
      members.sort((a, b) => a.lastName.localeCompare(b.lastName));
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [colleagues]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Plan"
        title="Meine Schichten"
        description="Wer aus deiner Schicht Urlaub hat und wer zu deinem Team gehört."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ShiftLeaveList from={TODAY} days={45} />

        <Card className="h-fit">
          <CardHeader
            title="Mein Team"
            hint={
              role === "employee"
                ? undefined
                : colleagues
                  ? `${colleagues.length} Personen, nach Schichtgruppe`
                  : undefined
            }
          />
          <CardBody className="max-h-[640px] space-y-4 overflow-y-auto">
            {role === "employee" ? (
              <p className="text-sm text-ink-muted">
                Die Teamübersicht mit allen Kolleginnen und Kollegen ist der Schichtleitung und
                Administration vorbehalten.
              </p>
            ) : colleagues === null ? (
              <p className="text-sm text-ink-muted">wird geladen …</p>
            ) : colleagues.length === 0 ? (
              <p className="text-sm text-ink-muted">Keine Mitarbeiter gefunden.</p>
            ) : (
              teamGroups.map(([groupName, members]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                    {groupName} · {members.length}
                  </p>
                  {members.map((person) => (
                    <div key={person.id} className="rounded-xl border border-line px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {person.firstName} {person.lastName}
                        </span>
                        {person.personnelNumber ? (
                          <span className="tnum shrink-0 text-[11px] text-ink-faint">
                            {person.personnelNumber}
                          </span>
                        ) : null}
                      </div>
                      {/* Kontostände: wer plant, muss sehen, wie viel noch
                          offen ist – sonst genehmigt man Urlaub, den es
                          gar nicht mehr gibt. */}
                      {(() => {
                        const konto = balances.get(person.id);
                        if (!konto) return null;
                        return (
                          <div className="tnum mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-muted">
                            <span>
                              <span className="font-semibold text-ink">
                                {formatDays(Math.max(konto.remainingDays, 0))}
                              </span>{" "}
                              von {formatDays(konto.entitlement)} Urlaub
                            </span>
                            <span>
                              <span className="font-semibold text-ink">
                                {formatDays(Math.max(konto.vRemainingDays, 0))}
                              </span>{" "}
                              von {formatDays(konto.vEntitlement)} V-Tage
                            </span>
                          </div>
                        );
                      })()}
                      {person.qualifications.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {person.qualifications.map((q) => (
                            <span
                              key={q}
                              className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted"
                            >
                              {qualificationLabels[q as Qualification] ?? q}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-ink-faint">
                          Keine Qualifikation hinterlegt
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
