"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/context/session";
import { DataError, fetchEmployees, setEmployeeActive } from "@/lib/data/employees";
import { inviteEmployee } from "@/lib/auth/actions";
import { roleLabels } from "@/lib/nav";
import type { EmployeeRecord } from "@/lib/types";
import { CreateEmployeePanel } from "./create-employee-panel";
import { EditEmployeePanel } from "./edit-employee-panel";
import { EntitlementEditor } from "./entitlement-editor";

type StatusFilter = "all" | "active" | "inactive";

export default function EmployeesPage() {
  const { role, mode } = useSession();
  const [rows, setRows] = useState<EmployeeRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [invited, setInvited] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const canEditEntitlement = role === "admin" || role === "shift_leader";

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

  const shiftNames = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.shiftName).filter(Boolean))] as string[],
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
      const matchesShift = shiftFilter === "all" || row.shiftName === shiftFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? row.active : !row.active);
      return matchesTerm && matchesShift && matchesStatus;
    });
  }, [rows, search, shiftFilter, statusFilter]);

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
    const formData = new FormData();
    formData.set("employee_id", row.id);
    startTransition(async () => {
      const result = await inviteEmployee({}, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setInvited((current) => ({ ...current, [row.id]: result.success! }));
      }
      setBusyId(null);
    });
  }

  function updateEntitlementLocally(employeeId: string, next: number) {
    setRows((current) =>
      (current ?? []).map((r) => (r.id === employeeId ? { ...r, currentEntitlement: next } : r)),
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={role === "admin" ? "Verwaltung" : "Führung"}
        title="Mitarbeiter"
        description="Personalstammdaten des eigenen Unternehmens. Andere Unternehmen sind auf Datenbankebene ausgeschlossen."
        action={
          role === "admin" ? (
            <Button
              variant="secondary"
              disabled={mode === "demo"}
              onClick={() => {
                setEditingEmployee(null);
                setShowCreate((v) => !v);
              }}
            >
              {showCreate ? "Abbrechen" : "Mitarbeiter anlegen"}
            </Button>
          ) : null
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {showCreate && role === "admin" ? (
        <CreateEmployeePanel
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      {editingEmployee && role === "admin" ? (
        <EditEmployeePanel
          employee={editingEmployee}
          onSaved={() => {
            setEditingEmployee(null);
            void load();
          }}
          onCancel={() => setEditingEmployee(null)}
        />
      ) : null}

      <Card>
        <CardHeader
          title="Übersicht"
          hint={rows ? `${visible.length} von ${rows.length} Personen` : "wird geladen …"}
        />

        <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, Personalnummer oder Abteilung"
              className="pl-9"
              aria-label="Mitarbeiter suchen"
            />
          </div>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            aria-label="Nach Schicht filtern"
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="all">Alle Schichten</option>
            {shiftNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Nach Status filtern"
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <option value="all">Alle</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Deaktiviert</option>
          </select>
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
            <ul className="divide-y divide-line">
              {visible.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-muted"
                >
                  <Avatar employee={row} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="tnum truncate text-[12px] text-ink-muted">
                      {row.personnelNumber ?? "ohne Nummer"} ·{" "}
                      {row.department ?? "keine Abteilung"} ·{" "}
                      {row.shiftName ?? "keine Schicht"}
                    </p>
                    {invited[row.id] ? (
                      <p className="mt-0.5 text-[12px] text-ok-fg">{invited[row.id]}</p>
                    ) : null}
                  </div>
                  <Badge tone={row.role === "employee" ? "neutral" : "info"}>
                    {roleLabels[row.role]}
                  </Badge>
                  <Badge tone={row.active ? "ok" : "critical"}>
                    {row.active ? "Aktiv" : "Deaktiviert"}
                  </Badge>
                  {mode === "live" ? (
                    <Badge tone={row.hasAccount ? "ok" : "neutral"}>
                      {row.hasAccount ? "Hat Zugang" : "Ohne Zugang"}
                    </Badge>
                  ) : null}
                  {canEditEntitlement ? (
                    <EntitlementEditor
                      employeeId={row.id}
                      year={row.entitlementYear}
                      value={row.currentEntitlement}
                      disabled={mode === "demo"}
                      onSaved={(next) => updateEntitlementLocally(row.id, next)}
                    />
                  ) : null}
                  {role === "admin" ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={mode === "demo"}
                        onClick={() => {
                          setShowCreate(false);
                          setEditingEmployee(row);
                        }}
                      >
                        Bearbeiten
                      </Button>
                      {mode === "live" && !row.hasAccount ? (
                        <Button
                          variant="secondary"
                          disabled={!row.email || (pending && busyId === row.id)}
                          onClick={() => invite(row)}
                          title={row.email ? undefined : "Keine E-Mail-Adresse hinterlegt"}
                        >
                          Einladen
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        disabled={mode === "demo" || busyId === row.id}
                        onClick={() => toggle(row)}
                      >
                        {busyId === row.id
                          ? "…"
                          : row.active
                            ? "Deaktivieren"
                            : "Aktivieren"}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
