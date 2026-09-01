"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Search, TriangleAlert, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
  staffingTone,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { RowSkeleton } from "@/components/ui/skeleton";
import { formatDays, formatRange } from "@/lib/dates";
import { decideLeaveRequestAction } from "@/lib/auth/leave-actions";
import { fetchLeaveImpact } from "@/lib/data/staffing";
import type { LiveLeaveImpact, LiveLeaveRequest } from "@/lib/types";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export function ReviewPanel({
  requests,
  loading,
  onChanged,
}: {
  requests: LiveLeaveRequest[] | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [impacts, setImpacts] = useState<Record<string, LiveLeaveImpact | null>>({});

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (requests ?? [])
      .filter((r) => (statusFilter === "all" ? r.status !== "withdrawn" : r.status === statusFilter))
      .filter(
        (r) => term.length === 0 || (r.employeeName ?? "").toLowerCase().includes(term),
      );
  }, [requests, statusFilter, search]);

  // Besetzungsprüfung für offene Anträge nachladen (Spezifikationspunkt 15:
  // "vor der Genehmigung erneut prüfen"). Nur für pending, nur einmal je Antrag.
  useEffect(() => {
    const openOnes = visible.filter((r) => r.status === "pending" && !(r.id in impacts));
    if (openOnes.length === 0) return;
    let cancelled = false;
    openOnes.forEach((request) => {
      fetchLeaveImpact(request.employeeId, request.startDate, request.endDate)
        .then((result) => {
          if (!cancelled) setImpacts((current) => ({ ...current, [request.id]: result }));
        })
        .catch(() => {
          if (!cancelled) setImpacts((current) => ({ ...current, [request.id]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function approve(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await decideLeaveRequestAction(id, "approved");
      if (result.error) setError(result.error);
      setBusyId(null);
      onChanged();
    });
  }

  function reject(id: string) {
    if (!rejectionReason.trim()) {
      setError("Für eine Ablehnung ist eine Begründung erforderlich.");
      return;
    }
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await decideLeaveRequestAction(id, "rejected", rejectionReason);
      if (result.error) setError(result.error);
      setBusyId(null);
      setRejecting(null);
      setRejectionReason("");
      onChanged();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Urlaubsanträge"
        hint={requests ? `${visible.length} Anträge` : "wird geladen …"}
      />

      <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mitarbeiter suchen"
            className="pl-9"
            aria-label="Mitarbeiter suchen"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Nach Status filtern"
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="pending">Offen</option>
          <option value="approved">Genehmigt</option>
          <option value="rejected">Abgelehnt</option>
          <option value="all">Alle</option>
        </select>
      </div>

      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <CardBody className="space-y-3 px-3 py-3">
        {loading ? (
          <RowSkeleton rows={4} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              statusFilter === "pending"
                ? "Keine offenen Anträge."
                : "Keine Anträge für diesen Filter."
            }
          />
        ) : (
          visible.map((request) => (
            <article key={request.id} className="rounded-xl border border-line px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {request.employeeName ?? "Unbekannt"}
                    {request.shiftName ? (
                      <span className="font-normal text-ink-faint"> · {request.shiftName}</span>
                    ) : null}
                  </p>
                  <p className="tnum text-[13px] text-ink-muted">
                    {formatRange(request.startDate, request.endDate)} ·{" "}
                    {formatDays(request.requestedDays)} Urlaubstage
                  </p>
                  {request.reason ? (
                    <p className="mt-1 text-[13px] italic text-ink-muted">„{request.reason}“</p>
                  ) : null}
                  {request.status === "rejected" && request.rejectionReason ? (
                    <p className="mt-1 text-[13px] text-crit-fg">
                      Grund: {request.rejectionReason}
                    </p>
                  ) : null}
                </div>
                <Badge tone={leaveStatusTone[request.status]}>
                  {leaveStatusLabel[request.status]}
                </Badge>
              </div>

              {request.status === "pending" && impacts[request.id] ? (
                <ImpactHint impact={impacts[request.id]!} />
              ) : null}

              {request.status === "pending" ? (
                rejecting === request.id ? (
                  <div className="mt-3 space-y-2">
                    <Input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Begründung für die Ablehnung"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        disabled={pending && busyId === request.id}
                        onClick={() => reject(request.id)}
                      >
                        Ablehnung bestätigen
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setRejecting(null);
                          setRejectionReason("");
                          setError(null);
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      disabled={pending && busyId === request.id}
                      onClick={() => approve(request.id)}
                    >
                      <Check className="h-4 w-4" /> Genehmigen
                    </Button>
                    <Button
                      variant="danger"
                      disabled={pending && busyId === request.id}
                      onClick={() => setRejecting(request.id)}
                    >
                      <X className="h-4 w-4" /> Ablehnen
                    </Button>
                  </div>
                )
              ) : null}
            </article>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** Besetzungsprüfung zu einem einzelnen offenen Antrag – vor der Entscheidung sichtbar. */
function ImpactHint({ impact }: { impact: LiveLeaveImpact }) {
  if (impact.worstStatus === "ok" && impact.overlappingEmployees === 0) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px] leading-snug text-ink-muted">
      <TriangleAlert
        className={
          impact.worstStatus === "critical"
            ? "mt-0.5 h-4 w-4 shrink-0 text-crit-fg"
            : "mt-0.5 h-4 w-4 shrink-0 text-warn-fg"
        }
        strokeWidth={2}
      />
      <div className="space-y-0.5">
        <p>
          <Badge tone={staffingTone[impact.worstStatus]}>
            {impact.worstStatus === "critical"
              ? `Mindestbesetzung an ${impact.criticalDays === 1 ? "einem Tag" : `${impact.criticalDays} Tagen`} unterschritten`
              : "Besetzung knapp"}
          </Badge>
        </p>
        {impact.overlappingEmployees > 0 ? (
          <p>
            {impact.overlappingEmployees}{" "}
            {impact.overlappingEmployees === 1 ? "weitere Person" : "weitere Personen"} derselben
            Schicht in diesem Zeitraum bereits abwesend oder mit offenem Antrag.
          </p>
        ) : null}
      </div>
    </div>
  );
}
