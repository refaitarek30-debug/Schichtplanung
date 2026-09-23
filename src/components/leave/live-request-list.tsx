"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Badge,
  leaveStatusLabel,
  leaveStatusTone,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { formatDays, formatRange } from "@/lib/dates";
import { withdrawMyLeaveRequest } from "@/lib/auth/leave-actions";
import { cn } from "@/lib/utils";
import type { LiveLeaveRequest } from "@/lib/types";
import { artenText, gruppiereAntraege, type LeaveRequestGroup } from "@/lib/leave-groups";

/** Abschnitte in fester Reihenfolge: Offenes zuerst, Erledigtes danach. */
const ABSCHNITTE: {
  key: string;
  titel: string;
  status: LeaveRequestGroup["status"][];
  rand: string;
}[] = [
  { key: "offen", titel: "Offen", status: ["pending"], rand: "border-l-warn-dot" },
  { key: "genehmigt", titel: "Genehmigt", status: ["approved"], rand: "border-l-ok-dot" },
  {
    key: "erledigt",
    titel: "Abgelehnt oder zurückgezogen",
    status: ["rejected", "withdrawn"],
    rand: "border-l-crit-dot",
  },
];

function zeitpunkt(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
}

/**
 * Die eigenen Anträge, je Einreichung eine Zeile, nach Stand gegliedert.
 *
 * Ein Zeitraum steht hier als ein Antrag, auch wenn er in der Datenbank
 * aus mehreren Zeilen besteht (Urlaubstage und V-Tage gehen auf getrennte
 * Konten). Zurückgezogen wird er im Ganzen – das erledigt die Datenbank,
 * welche Zeile man übergibt, spielt keine Rolle.
 *
 * Bei jedem bearbeiteten Antrag steht, wer ihn wann entschieden hat.
 */
export function LiveRequestList({
  requests,
  loading,
  onChanged,
  einklappbar = false,
  standardOffen = true,
}: {
  requests: LiveLeaveRequest[] | null;
  loading: boolean;
  onChanged: () => void;
  /**
   * Auf der Startseite sind die eigenen Anträge Beiwerk – dort kann die
   * Karte zugeklappt werden. Im Urlaubsbereich sind sie der Inhalt und
   * bleiben offen.
   */
  einklappbar?: boolean;
  standardOffen?: boolean;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const gruppen = useMemo(() => (requests ? gruppiereAntraege(requests) : null), [requests]);
  const [offen, setOffen] = useState(standardOffen);
  const offeneAntraege = (gruppen ?? []).filter((g) => g.status === "pending").length;

  const abschnitte = useMemo(
    () =>
      ABSCHNITTE.map((a) => ({
        ...a,
        eintraege: (gruppen ?? [])
          .filter((g) => a.status.includes(g.status))
          // Offenes nach Beginn aufsteigend, Erledigtes neueste zuerst.
          .sort((x, y) =>
            a.key === "offen"
              ? x.startDate.localeCompare(y.startDate)
              : y.startDate.localeCompare(x.startDate),
          ),
      })).filter((a) => a.eintraege.length > 0),
    [gruppen],
  );

  function withdraw(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await withdrawMyLeaveRequest(id);
      if (result.error) setError(result.error);
      setConfirmId(null);
      onChanged();
    });
  }

  return (
    <Card>
      {einklappbar ? (
        <button
          type="button"
          onClick={() => setOffen((v) => !v)}
          aria-expanded={offen}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-muted"
        >
          <span>
            <span className="block text-[15px] font-semibold tracking-tight">Meine Anträge</span>
            <span className="block text-[12px] text-ink-muted">
              {loading
                ? "wird geladen …"
                : offeneAntraege > 0
                  ? `${offeneAntraege} offen · ${gruppen?.length ?? 0} insgesamt`
                  : `${gruppen?.length ?? 0} insgesamt`}
            </span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", offen && "rotate-180")}
            strokeWidth={2}
          />
        </button>
      ) : (
        <CardHeader
          title="Meine Anträge"
          hint={
            gruppen && gruppen.length > 0
              ? offeneAntraege > 0
                ? `${offeneAntraege} offen · ${gruppen.length} insgesamt`
                : `${gruppen.length} insgesamt`
              : undefined
          }
        />
      )}
      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {einklappbar && !offen ? null : (
        <CardBody className="space-y-4 px-3 py-3">
          {loading ? (
            <RowSkeleton rows={3} />
          ) : !gruppen || gruppen.length === 0 ? (
            <EmptyState
              title="Noch keine Anträge gestellt."
              description="Ein neuer Antrag erscheint hier sofort nach dem Absenden."
            />
          ) : (
            abschnitte.map((abschnitt) => (
              <section key={abschnitt.key} className="space-y-1.5">
                <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                  {abschnitt.titel} · {abschnitt.eintraege.length}
                </h3>
                {abschnitt.eintraege.map((request) => (
                  <div
                    key={request.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-l-4 border-line bg-surface px-3 py-2.5",
                      abschnitt.rand,
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {formatRange(request.startDate, request.endDate)}
                      </p>
                      <p className="tnum text-[12px] text-ink-muted">
                        {formatDays(request.requestedDays)}{" "}
                        {request.requestedDays === 1 ? "Tag" : "Tage"} · {artenText(request.kinds)}
                        {request.halfDayPeriod
                          ? ` · ${request.halfDayPeriod === "vormittag" ? "vormittags" : "nachmittags"}`
                          : ""}
                      </p>
                      {request.reason ? (
                        <p className="mt-1 text-[12px] italic text-ink-muted">„{request.reason}“</p>
                      ) : null}
                      {request.status === "rejected" && request.rejectionReason ? (
                        <p className="mt-1 text-[12px] text-crit-fg">
                          Grund: {request.rejectionReason}
                        </p>
                      ) : null}
                      <p className="tnum mt-1 text-[11px] text-ink-faint">
                        Gestellt am {zeitpunkt(request.createdAt)}
                      </p>
                      {request.reviewedAt && request.status !== "pending" ? (
                        <p className="tnum text-[11px] text-ink-muted">
                          {request.status === "approved"
                            ? "Genehmigt"
                            : request.status === "rejected"
                              ? "Abgelehnt"
                              : "Bearbeitet"}{" "}
                          von{" "}
                          <span className="font-medium text-ink">
                            {request.reviewerName ?? "der Schichtleitung"}
                          </span>{" "}
                          am {zeitpunkt(request.reviewedAt)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={leaveStatusTone[request.status]}>
                        {leaveStatusLabel[request.status]}
                      </Badge>
                      {request.status === "pending" ? (
                        confirmId === request.id ? (
                          <div className="flex gap-1.5">
                            <Button
                              variant="danger"
                              disabled={pending}
                              onClick={() => withdraw(request.actionId)}
                            >
                              Bestätigen
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={pending}
                              onClick={() => setConfirmId(null)}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(request.id)}
                            className="text-[12px] font-medium text-ink-faint hover:text-crit-fg"
                          >
                            Zurückziehen
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </CardBody>
      )}
    </Card>
  );
}
