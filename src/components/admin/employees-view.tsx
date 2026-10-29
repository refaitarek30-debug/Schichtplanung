"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronRight, KeyRound, Link2, MessageSquare, Pencil, Search, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/context/session";
import { AdminViewHeader } from "./view-header";
import { DataError, fetchEmployees, setEmployeeActive } from "@/lib/data/employees";
import { inviteEmployee } from "@/lib/auth/actions";
import { deleteEmployee } from "@/lib/auth/employee-actions";
import { passwortCodeFuerMitarbeiter } from "@/lib/auth/passwort-code";
import { CodeAnzeige } from "@/components/ui/code-anzeige";
import { roleLabels } from "@/lib/nav";
import type { EmployeeRecord } from "@/lib/types";
import { InviteLinkCard } from "@/components/employees/invite-link-card";
import type { FormState } from "@/lib/auth/form-state";
import { CreateEmployeePanel } from "./create-employee-panel";
import { EditEmployeePanel } from "./edit-employee-panel";
import { HinweisSenden } from "@/components/hinweise/hinweis-senden";
import { Blatt } from "@/components/privat/blatt";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive";

/** Ab hier (Computer, iPad quer) steht die Person rechts neben der Liste statt als Blatt. */
const BREIT = "(min-width: 1024px)";
function useBreit(): boolean {
  return useSyncExternalStore(
    (melden) => {
      const m = window.matchMedia(BREIT);
      m.addEventListener("change", melden);
      return () => m.removeEventListener("change", melden);
    },
    () => window.matchMedia(BREIT).matches,
    () => false,
  );
}

/** Wie bisher: Schichtgruppe, sonst der Name der festen Schicht (z. B. Tagdienst). */
function gruppeVon(row: EmployeeRecord): string {
  return row.rotationTeam ? `Schicht ${row.rotationTeam}` : (row.shiftName ?? "keine Schicht");
}

export function EmployeesView() {
  const { role, mode, profile } = useSession();
  const [rows, setRows] = useState<EmployeeRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Hinweis an diese Person – Fenster zum Senden. */
  const [hinweisAn, setHinweisAn] = useState<string | null>(null);
  const [hinweisMeldung, setHinweisMeldung] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Ergebnis der letzten Einladung – bleibt oben stehen, bis es
  // weggeklickt wird. Ein Link, der beim nächsten Klick verschwindet, ist
  // wertlos: bis man ihn kopiert hat, ist er weg.
  const [access, setAccess] = useState<FormState | null>(null);
  // Passwort-Code: erst fragen, dann den Code zeigen, bis er weggeklickt wird.
  const [codeFrage, setCodeFrage] = useState<EmployeeRecord | null>(null);
  const [codeErgebnis, setCodeErgebnis] = useState<{ name: string; code?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  /** Die angetippte Person – Blatt (Handy) bzw. rechte Spalte (Computer). */
  const [offenId, setOffenId] = useState<string | null>(null);
  const breit = useBreit();

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchEmployees());
    } catch (caught) {
      setRows([]);
      setError(
        caught instanceof DataError
          ? caught.message
          : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Nach Schichtgruppe filtern; wer keine Rotation hat, faellt unter den
  // Namen seiner festen Schicht (z. B. Tagdienst).
  const shiftNames = useMemo(
    () =>
      [
        ...new Set(
          (rows ?? [])
            .map((r) => (r.rotationTeam ? `Schicht ${r.rotationTeam}` : r.shiftName))
            .filter(Boolean),
        ),
      ].sort() as string[],
    [rows],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      const matchesTerm =
        term.length === 0 ||
        `${row.firstName} ${row.lastName}`.toLowerCase().includes(term) ||
        (row.personnelNumber ?? "").toLowerCase().includes(term) ||
        (row.department ?? "").toLowerCase().includes(term);
      const rowShiftLabel = row.rotationTeam ? `Schicht ${row.rotationTeam}` : row.shiftName;
      const matchesShift = shiftFilter === "all" || rowShiftLabel === shiftFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? row.active : !row.active);
      return matchesTerm && matchesShift && matchesStatus;
    })
      // Deaktivierte ans Ende, sonst bleibt die Reihenfolge wie geladen.
      .sort((a, b) => Number(b.active) - Number(a.active));
  }, [rows, search, shiftFilter, statusFilter]);

  const offen = (rows ?? []).find((r) => r.id === offenId) ?? null;
  const inaktivZahl = (rows ?? []).filter((r) => !r.active).length;

  async function toggle(row: EmployeeRecord) {
    setBusyId(row.id);
    setError(null);
    try {
      await setEmployeeActive(row.id, !row.active);
      setRows((current) =>
        (current ?? []).map((r) => (r.id === row.id ? { ...r, active: !r.active } : r)),
      );
    } catch (caught) {
      setError(
        caught instanceof DataError ? caught.message : "Änderung fehlgeschlagen.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function invite(row: EmployeeRecord) {
    setBusyId(row.id);
    setError(null);
    setAccess(null);
    const formData = new FormData();
    formData.set("employee_id", row.id);
    startTransition(async () => {
      const result = await inviteEmployee({}, formData);
      setAccess(result);
      setBusyId(null);
      if (result.success) void load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function passwortCode(row: EmployeeRecord) {
    setBusyId(row.id);
    setCodeErgebnis(null);
    startTransition(async () => {
      const result = await passwortCodeFuerMitarbeiter(row.id);
      setCodeErgebnis({ name: `${row.firstName} ${row.lastName}`, ...result });
      setCodeFrage(null);
      setBusyId(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /** Administration für alle außer sich selbst, Schichtleitung nur für Mitarbeiter. */
  function darfCode(row: EmployeeRecord) {
    if (mode !== "live" || !row.hasAccount || !row.active || row.id === profile.employeeId) return false;
    return role === "admin" || (role === "shift_leader" && row.role === "employee");
  }

  function remove(row: EmployeeRecord) {
    setBusyId(row.id);
    setError(null);
    startTransition(async () => {
      const result = await deleteEmployee(row.id);
      if (result.error) {
        setError(result.error);
      } else {
        setRows((current) => (current ?? []).filter((r) => r.id !== row.id));
      }
      setBusyId(null);
      setConfirmDeleteId(null);
    });
  }

  /**
   * Aktion aus der Person heraus. Auf dem Handy schließt das Blatt erst –
   * Bearbeiten, Code und Link erscheinen oben auf der Seite.
   */
  function ausPerson(f: () => void) {
    if (!breit) setOffenId(null);
    f();
  }

  /** Alles zu einer Person: Angaben und die erlaubten Aktionen (dieselben Regeln wie vorher in der Zeile). */
  function personInhalt(row: EmployeeRecord, kopf: boolean) {
    const fuehrung = role === "admin" || role === "shift_leader";
    const darfHinweis = fuehrung && mode === "live" && row.active;
    // Einladen: Administration immer, Schichtleitung für normale Mitarbeiter.
    // Die Datenbank-seitige Prüfung steckt in inviteEmployee().
    const darfLink = mode === "live" && (role === "admin" || (role === "shift_leader" && row.role === "employee"));
    const aktionen = [
      fuehrung
        ? {
            name: "Bearbeiten",
            icon: Pencil,
            disabled: mode === "demo",
            los: () =>
              ausPerson(() => {
                setEditing(row);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }),
          }
        : null,
      darfHinweis
        ? {
            name: "Hinweis",
            icon: MessageSquare,
            disabled: false,
            los: () =>
              ausPerson(() => {
                setHinweisMeldung(null);
                setHinweisAn(row.id);
              }),
          }
        : null,
      darfCode(row)
        ? {
            name: "Passwort-Code",
            icon: KeyRound,
            disabled: pending && busyId === row.id,
            los: () =>
              ausPerson(() => {
                setCodeErgebnis(null);
                setCodeFrage(row);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }),
          }
        : null,
      darfLink
        ? {
            name: row.hasAccount ? "Zugangslink" : "Einladen",
            icon: Link2,
            disabled: !row.email || (pending && busyId === row.id),
            los: () => ausPerson(() => invite(row)),
          }
        : null,
    ].filter((a) => a !== null);

    return (
      <div className="space-y-4" data-person={`${row.firstName} ${row.lastName}`}>
        {kopf ? (
          <div className="flex items-center gap-3">
            <Avatar employee={row} className="h-12 w-12 text-[15px]" />
            <div className="min-w-0">
              <p className="text-[18px] font-semibold leading-tight">
                {row.firstName} {row.lastName}
              </p>
              <p className="tnum mt-0.5 text-[13px] text-ink-muted">
                {gruppeVon(row)} · {row.personnelNumber ? `Personalnr. ${row.personnelNumber}` : "ohne Personalnummer"}
              </p>
            </div>
          </div>
        ) : (
          <p className="tnum -mt-1 text-[13px] text-ink-muted">
            {gruppeVon(row)} · {row.personnelNumber ? `Personalnr. ${row.personnelNumber}` : "ohne Personalnummer"}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge tone={row.role === "employee" ? "neutral" : "info"}>{roleLabels[row.role]}</Badge>
          <Badge tone={row.active ? "ok" : "critical"}>{row.active ? "Aktiv" : "Deaktiviert"}</Badge>
          {mode === "live" ? (
            <Badge tone={row.hasAccount ? "ok" : "neutral"}>{row.hasAccount ? "Hat Zugang" : "Ohne Zugang"}</Badge>
          ) : null}
        </div>

        {aktionen.length ? (
          <div className={cn("grid gap-2", breit ? "grid-cols-2" : "grid-cols-4")}>
            {aktionen.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.name}
                  type="button"
                  onClick={a.los}
                  disabled={a.disabled}
                  className="flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-muted px-1 py-2.5 text-center text-[12px] font-semibold leading-tight hover:bg-surface-sunken disabled:opacity-50"
                >
                  <Icon className="h-5 w-5 text-brand-600" strokeWidth={1.9} />
                  {pending && busyId === row.id && a.name !== "Bearbeiten" && a.name !== "Hinweis" ? "…" : a.name}
                </button>
              );
            })}
          </div>
        ) : null}

        <dl className="divide-y divide-line rounded-2xl border border-line text-[14px]">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt>E-Mail</dt>
            <dd className="min-w-0 truncate text-ink-muted">{row.email ?? "keine"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt>Abteilung</dt>
            <dd className="min-w-0 truncate text-ink-muted">{row.department ?? "keine"}</dd>
          </div>
          {row.qualifications.length > 0 ? (
            <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <dt>Qualifikationen</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                {row.qualifications.map((q, i) => (
                  <span key={q} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11.5px] text-ink-muted">
                    {row.qualificationLabels[i] ?? q}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>

        {!row.active ? (
          <p className="rounded-2xl bg-crit-bg px-3.5 py-2.5 text-[13.5px] leading-snug text-crit-fg">
            Deaktiviert – kein Zugang mehr zur App.
          </p>
        ) : null}

        {/* Aktivieren/Deaktivieren und Löschen nur Administration – getrennt und
            farbig, damit man es nicht aus Versehen drückt. */}
        {role === "admin" ? (
          <div className="space-y-2">
            <Button
              variant={row.active ? "danger" : "primary"}
              className="w-full justify-center py-2.5"
              disabled={mode === "demo" || busyId === row.id}
              onClick={() => toggle(row)}
            >
              {busyId === row.id ? "…" : row.active ? "Deaktivieren" : "Aktivieren"}
            </Button>
            {/* Endgültig löschen erst nach dem Deaktivieren – dann aber
                vollständig: Stammdaten, Profil, Zugang, alle Einträge. */}
            {row.active ? null : confirmDeleteId === row.id ? (
              <div className="space-y-2 rounded-2xl border border-crit-bg bg-crit-bg/40 p-3">
                <p className="text-[13px] leading-snug text-crit-fg">
                  {row.firstName} {row.lastName} wird mit Zugang, Profil und allen Einträgen endgültig gelöscht. Das
                  lässt sich nicht rückgängig machen – wird die Person wieder gebraucht, muss sie neu angelegt werden.
                </p>
                <div className="flex items-center gap-1.5">
                  <Button variant="danger" disabled={busyId === row.id} onClick={() => remove(row)}>
                    Endgültig löschen
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(row.id)}
                disabled={mode === "demo"}
                className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-crit-fg hover:bg-crit-bg disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Endgültig löschen …
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminViewHeader
        description="Personalstammdaten des eigenen Unternehmens. Die Daten anderer Unternehmen sind durch Zugriffsregeln in der Datenbank getrennt."
        action={
          role === "admin" ? (
            <Button
              variant="secondary"
              disabled={mode === "demo"}
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? "Abbrechen" : "Mitarbeiter anlegen"}
            </Button>
          ) : null
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {hinweisMeldung ? <Alert tone="success">{hinweisMeldung}</Alert> : null}
      {hinweisAn ? (
        <HinweisSenden
          vorauswahl={[hinweisAn]}
          onClose={() => setHinweisAn(null)}
          onGesendet={() => setHinweisMeldung("Hinweis gesendet. Ob er gelesen wurde, siehst du unter Mitteilungen.")}
        />
      ) : null}

      {access ? (
        <InviteLinkCard
          message={access.error ?? access.success ?? ""}
          link={access.link}
          code={access.code}
          beitritt={access.beitritt}
          tone={access.error ? "error" : "ok"}
          onClose={() => setAccess(null)}
        />
      ) : null}

      {codeFrage ? (
        <Card className="border-brand-500/40">
          <CardBody className="space-y-3">
            <p className="text-sm">
              Passwort-Code für <span className="font-semibold">{codeFrage.firstName} {codeFrage.lastName}</span> erzeugen?
            </p>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              Mit dem Code setzt die Person unter „Passwort vergessen“ ein neues Passwort. Er gilt 24 Stunden und nur einmal. Das
              alte Passwort gilt weiter, bis der Code eingelöst wird.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} onClick={() => passwortCode(codeFrage)}>
                {pending ? "…" : "Ja, Code erzeugen"}
              </Button>
              <Button variant="secondary" onClick={() => setCodeFrage(null)}>
                Abbrechen
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {codeErgebnis ? (
        <Card className={codeErgebnis.error ? "border-crit-dot/40" : "border-ok-dot/40"}>
          <CardBody className="space-y-3">
            {codeErgebnis.error ? (
              <p className="text-sm text-crit-fg">{codeErgebnis.error}</p>
            ) : (
              <>
                <p className="text-sm">
                  Code für <span className="font-semibold">{codeErgebnis.name}</span> – persönlich weitergeben, zum Beispiel
                  mündlich oder per Nachricht:
                </p>
                <CodeAnzeige code={codeErgebnis.code ?? ""} />
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  So geht es weiter: Anmeldeseite → „Passwort vergessen?“ → E-Mail und Code eingeben → neues Passwort zweimal
                  eingeben. Der Code gilt 24 Stunden und wird nur jetzt angezeigt.
                </p>
              </>
            )}
            <Button variant="secondary" onClick={() => setCodeErgebnis(null)}>
              Schließen
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {showCreate && role === "admin" ? (
        <CreateEmployeePanel
          onCreated={(result) => {
            setShowCreate(false);
            setAccess(result);
            void load();
          }}
        />
      ) : null}

      {editing ? (
        <EditEmployeePanel
          employee={editing}
          canEditRole={role === "admin"}
          onSaved={(ergebnis) => {
            setEditing(null);
            // Nur anzeigen, wenn wirklich etwas mitkommt – nach einer
            // Änderung ohne neue Adresse gibt es keinen Link, und eine
            // leere Karte wäre nur Lärm.
            if (ergebnis.link || ergebnis.error) setAccess(ergebnis);
            void load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
        <Card>
          <CardHeader
            title="Übersicht"
            hint={rows ? `${visible.length} von ${rows.length} Personen` : "wird geladen …"}
          />

          <div className="space-y-2.5 border-b border-line px-4 py-3 sm:px-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, Personalnummer oder Abteilung"
                className="pl-9"
                aria-label="Mitarbeiter suchen"
              />
            </div>
            {/* Filter als Knöpfe statt zweier Auswahllisten. */}
            <div role="group" aria-label="Filter" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              <FilterKnopf
                an={shiftFilter === "all" && statusFilter === "all"}
                onClick={() => {
                  setShiftFilter("all");
                  setStatusFilter("all");
                }}
              >
                Alle {rows ? rows.length : ""}
              </FilterKnopf>
              {shiftNames.map((name) => (
                <FilterKnopf
                  key={name}
                  an={shiftFilter === name}
                  onClick={() => setShiftFilter(shiftFilter === name ? "all" : name)}
                >
                  {name.replace(/^Schicht /, "")}
                </FilterKnopf>
              ))}
              {inaktivZahl > 0 ? (
                <FilterKnopf
                  an={statusFilter === "inactive"}
                  rot
                  onClick={() => setStatusFilter(statusFilter === "inactive" ? "all" : "inactive")}
                >
                  Deaktiviert {inaktivZahl}
                </FilterKnopf>
              ) : null}
            </div>
          </div>

          <CardBody className="px-0 py-0">
            {rows === null ? (
              <RowSkeleton rows={6} />
            ) : visible.length === 0 ? (
              <EmptyState
                title={
                  rows.length === 0
                    ? "Noch keine Mitarbeiter vorhanden."
                    : "Keine Treffer für diese Filter."
                }
                description={
                  rows.length === 0
                    ? "Sobald die Administration Mitarbeiter anlegt, erscheinen sie hier."
                    : "Suche zurücksetzen oder einen anderen Filter wählen."
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-line" data-mitarbeiter-liste>
                  {visible.map((row) => (
                    <li key={row.id}>
                      {/* Keine Knöpfe mehr in der Zeile – antippen öffnet die Person. */}
                      <button
                        type="button"
                        onClick={() => setOffenId(row.id)}
                        aria-current={offen?.id === row.id ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted sm:px-5",
                          offen?.id === row.id && "lg:bg-brand-50",
                          !row.active && "opacity-60",
                        )}
                      >
                        <Avatar employee={row} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-snug">
                            {row.firstName} {row.lastName}
                          </span>
                          <span className="tnum mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                            <StandPunkt row={row} live={mode === "live"} />
                            <span className="truncate">
                              {gruppeVon(row)} · {row.personnelNumber ?? "ohne Nr."}
                            </span>
                          </span>
                        </span>
                        {row.role !== "employee" ? <Badge tone="info">{roleLabels[row.role]}</Badge> : null}
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-ink-muted">
                  {mode === "live" ? (
                    <>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok-dot" />hat Zugang</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-faint/50" />kein Zugang</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok-dot" />aktiv</span>
                  )}
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-crit-dot" />deaktiviert</span>
                </p>
              </>
            )}
          </CardBody>
        </Card>

        {/* Computer: die gewählte Person rechts daneben. */}
        <aside className="hidden lg:sticky lg:top-4 lg:block" data-person-spalte>
          {offen && breit ? (
            <Card>
              <CardBody>{personInhalt(offen, true)}</CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <p className="py-8 text-center text-[13.5px] text-ink-muted">
                  Person in der Liste anklicken – hier stehen dann alle Angaben und Aktionen.
                </p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      {/* Handy und iPad hochkant: die Person als Blatt von unten. */}
      {offen && !breit ? (
        <Blatt titel={`${offen.firstName} ${offen.lastName}`} onClose={() => setOffenId(null)}>
          {personInhalt(offen, false)}
        </Blatt>
      ) : null}
    </div>
  );
}

function FilterKnopf({
  an,
  rot,
  onClick,
  children,
}: {
  an: boolean;
  rot?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={an}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold",
        an ? "border-ink bg-ink text-surface" : rot ? "border-line bg-surface text-crit-fg" : "border-line bg-surface text-ink-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Grün = hat Zugang, grau = kein Zugang, rot = deaktiviert. */
function StandPunkt({ row, live }: { row: EmployeeRecord; live: boolean }) {
  const farbe = !row.active ? "bg-crit-dot" : !live || row.hasAccount ? "bg-ok-dot" : "bg-ink-faint/50";
  const text = !row.active ? "deaktiviert" : !live ? "aktiv" : row.hasAccount ? "hat Zugang" : "kein Zugang";
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", farbe)} title={text} aria-label={text} />;
}
