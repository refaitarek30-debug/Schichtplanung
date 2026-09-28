"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { cn } from "@/lib/utils";
import { employeesOfShift } from "@/lib/demo-data";
import { formatDE, formatDays } from "@/lib/dates";
import { afTageAusStand } from "@/lib/af";
import { fetchTeamBalances, fetchTeamSonderKonten } from "@/lib/data/leave";
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
  const { profile } = useSession();
  /** Filter der übrigen Schichtgruppen: alle oder eine bestimmte. */
  const [filter, setFilter] = useState<string>("alle");
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
    // A, B, C, D der Reihe nach, die Tagschicht zum Schluss.
    return [...groups.entries()].sort((a, b) =>
      a[0] === "Tagschicht" ? 1 : b[0] === "Tagschicht" ? -1 : a[0].localeCompare(b[0]),
    );
  }, [colleagues]);

  /** Die eigene Schichtgruppe – steht oben als „Mein Team“. */
  const eigeneGruppe = useMemo(() => {
    const ich = (colleagues ?? []).find((p) => p.id === profile.employeeId);
    if (!ich) return null;
    return ich.shiftWorker && ich.rotationTeam ? `Schicht ${ich.rotationTeam}` : "Tagschicht";
  }, [colleagues, profile.employeeId]);

  /** Eine Person mit Konten, Geburtstag und Qualifikationen. */
  const personenKarte = (person: EmployeeRecord) => (
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
              // Nur der aktuelle Stand – eingeplante Tage zählen hier nicht.
              wert: `${formatDays(afTageAusStand(s.afStand))} Tage`,
              klasse:
                s.afStand < 0
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
  );


  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Plan"
        title="Meine Schichten"
        description="Dein Team und die übrigen Schichtgruppen mit Konten und Qualifikationen."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Oben das eigene Team, darunter die übrigen Schichtgruppen der
          Reihe nach (A–D, Tagschicht) – mit Filter. Eine Liste, wer in
          welcher Schicht wann fehlt, steht hier nicht mehr: das zeigt der
          Schichtplan. */}
      {role === "employee" ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink-muted">
              Die Teamübersicht mit allen Kolleginnen und Kollegen ist der Schichtleitung und
              Administration vorbehalten.
            </p>
          </CardBody>
        </Card>
      ) : colleagues === null ? (
        <p className="text-sm text-ink-muted">wird geladen …</p>
      ) : colleagues.length === 0 ? (
        <p className="text-sm text-ink-muted">Keine Mitarbeiter gefunden.</p>
      ) : (
        <>
          {/* Das Geburtsdatum trägt jede Person nur selbst ein – solange
              das niemand getan hat, bleibt die Liste ohne Geburtstage. */}
          {geburtstage.size === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-[12px] leading-snug text-ink-muted">
              🎂 Geburtstage erscheinen hier, sobald jemand sein Geburtsdatum unter{" "}
              <span className="font-medium text-ink">Profil → Persönliche Angaben</span>{" "}
              einträgt.
            </p>
          ) : null}

          {teamGroups
            .filter(([name]) => name === eigeneGruppe)
            .map(([name, members]) => (
              <Card key={name}>
                <CardHeader title="Mein Team" hint={`${name} · ${members.length} Personen`} />
                <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {members.map(personenKarte)}
                </CardBody>
              </Card>
            ))}

          <Card>
            <CardHeader
              title={eigeneGruppe ? "Weitere Schichten" : "Schichten"}
              action={
                <div className="flex flex-wrap gap-1" role="group" aria-label="Schicht filtern">
                  {["alle", ...teamGroups.map(([name]) => name).filter((n) => n !== eigeneGruppe)].map(
                    (name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setFilter(name)}
                        aria-pressed={filter === name}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
                          filter === name
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-line text-ink-muted hover:bg-surface-muted",
                        )}
                      >
                        {name === "alle" ? "Alle" : name.replace("Schicht ", "")}
                      </button>
                    ),
                  )}
                </div>
              }
            />
            <CardBody className="space-y-5">
              {teamGroups
                .filter(([name]) => name !== eigeneGruppe && (filter === "alle" || filter === name))
                .map(([name, members]) => (
                  <section key={name} className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                      {name} · {members.length}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {members.map(personenKarte)}
                    </div>
                  </section>
                ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
