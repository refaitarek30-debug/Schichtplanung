"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY, employeesOfShift } from "@/lib/demo-data";
import { formatDE, formatDays } from "@/lib/dates";
import { fetchTeamBalances, fetchTeamSonderKonten } from "@/lib/data/leave";
import { ShiftLeaveList } from "@/components/leave/shift-leave-list";
import { fetchEmployees } from "@/lib/data/employees";
import { fetchTeamBirthDates } from "@/lib/data/age-leave";
import type { EmployeeRecord, LiveTeamBalance, LiveTeamSonderKonto } from "@/lib/types";

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
        description="Wer zu deinem Team gehört und wer aus deiner Schicht schon frei hat."
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

function alterHeute(geburt: string): number {
  const heute = new Date();
  const [j, m, t] = geburt.split("-").map(Number);
  let alter = heute.getFullYear() - j!;
  if (heute.getMonth() + 1 < m! || (heute.getMonth() + 1 === m && heute.getDate() < t!)) alter--;
  return alter;
}

function LiveView({ role }: { role: string }) {
  const [colleagues, setColleagues] = useState<EmployeeRecord[] | null>(null);
  /** Rest-Urlaub und Rest-V-Tage je Mitarbeiter – nur für die Führung. */
  const [balances, setBalances] = useState<Map<string, LiveTeamBalance>>(new Map());
  /** Freiwillig hinterlegte Geburtsdaten. Wer nichts einträgt, fehlt hier. */
  const [geburtstage, setGeburtstage] = useState<Map<string, string>>(new Map());
  /** Sonderurlaub und Altersfreizeit je Person. */
  const [sonder, setSonder] = useState<Map<string, LiveTeamSonderKonto>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (role === "employee") return;
    setError(null);

    const [people, teamBalances, geburtsdaten, sonderKonten] = await Promise.allSettled([
      fetchEmployees(),
      fetchTeamBalances(),
      fetchTeamBirthDates(),
      fetchTeamSonderKonten(),
    ]);
    if (sonderKonten.status === "fulfilled") setSonder(sonderKonten.value);

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
    // Fehlende Geburtsdaten sind kein Grund, die Seite scheitern zu lassen –
    // sie sind eine freiwillige Zusatzangabe, keine Grundlage der Planung.
    if (geburtsdaten.status === "fulfilled") setGeburtstage(geburtsdaten.value);
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
      // Eine Schichtgruppe an jemandem, der keine Schicht fährt, ist
      // folgenlos – die Person gehört zur Tagschicht. Sonst stünde sie
      // hier unter „Schicht C", während ihre Zeile im Schichtplan leer
      // ist und ihr Urlaub nach Montag–Freitag gerechnet wird.
      const key =
        person.shiftWorker && person.rotationTeam
          ? `Schicht ${person.rotationTeam}`
          : "Tagschicht";
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
        description="Wer zu deinem Team gehört und wer aus deiner Schicht schon frei hat."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Das eigene Team steht oben. Wer hier landet, will zuerst wissen,
          wer überhaupt dazugehört; die Abwesenheiten sind der zweite
          Blick. Auf dem Handy entscheidet allein diese Reihenfolge, was
          man ohne Scrollen sieht. */}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
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
          {/* Auf dem Handy kein eigenes Scrollfeld: eine Karte, die in sich
              scrollt, während die Seite darunter auch scrollt, trifft man
              mit dem Daumen nie zuverlässig. Erst ab Tablet-Breite, wo die
              Karte neben der Liste steht, wird die Höhe begrenzt. */}
          <CardBody className="space-y-4 sm:max-h-[640px] sm:overflow-y-auto">
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
                      {/* Freiwillige Angabe: steht nur da, wenn die Person
                          sie im Profil selbst eingetragen hat. */}
                      {/* Freiwillige Angabe: steht nur da, wenn die Person
                          sie im Profil selbst eingetragen hat. */}
                      {geburtstage.get(person.id) ? (
                        <p className="tnum mt-1 text-[11px] text-ink-muted">
                          🎂 {formatDE(geburtstage.get(person.id)!)} ·{" "}
                          {alterHeute(geburtstage.get(person.id)!)} Jahre
                        </p>
                      ) : null}
                      {/* Kontostände: wer plant, muss sehen, wie viel noch
                          offen ist – sonst genehmigt man Urlaub, den es
                          gar nicht mehr gibt. */}
                      {(() => {
                        const konto = balances.get(person.id);
                        const s = sonder.get(person.id);
                        const chips: { label: string; wert: string; klasse: string }[] = [];
                        if (konto) {
                          chips.push({
                            label: "U",
                            wert: `${formatDays(Math.max(konto.remainingDays, 0))}/${formatDays(konto.entitlement)}`,
                            klasse: "bg-shift-urlaub/15 text-ink",
                          });
                          chips.push({
                            label: "V",
                            wert: `${formatDays(konto.vRemainingDays)}/${formatDays(konto.vEntitlement)}`,
                            klasse:
                              konto.vRemainingDays < 0
                                ? "bg-crit-bg text-crit-fg"
                                : "bg-shift-vtag/15 text-ink",
                          });
                        }
                        if (s?.suErlaubt) {
                          chips.push({
                            label: "SU",
                            wert: `${formatDays(Math.max(s.suRest, 0))}/${formatDays(s.suAnspruch)}`,
                            klasse: "bg-shift-sonderurlaub/15 text-ink",
                          });
                        }
                        if (s?.afFreigeschaltet) {
                          chips.push({
                            label: "AF",
                            wert: `${formatDays(s.afVerfuegbar)} · ${s.afRestStunden.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.`,
                            klasse:
                              s.afVerfuegbar < 0
                                ? "bg-crit-bg text-crit-fg"
                                : "bg-shift-altersfrei/15 text-ink",
                          });
                        }
                        if (chips.length === 0) return null;
                        return (
                          <div className="tnum mt-1 flex flex-wrap gap-1 text-[11px]">
                            {chips.map((c) => (
                              <span key={c.label} className={`rounded-md px-1.5 py-0.5 ${c.klasse}`}>
                                <span className="font-semibold">{c.label}</span> {c.wert}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      {person.qualifications.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {person.qualifications.map((q, i) => (
                            <span
                              key={q}
                              className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted"
                            >
                              {person.qualificationLabels[i] ?? q}
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

        <ShiftLeaveList from={TODAY} days={45} />
      </div>
    </div>
  );
}
