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
import { artenText, gruppiereAntraege } from "@/lib/leave-groups";

/**
 * Die eigenen Anträge, je Einreichung eine Zeile.
 *
 * Ein Zeitraum steht hier als ein Antrag, auch wenn er in der Datenbank
 * aus mehreren Zeilen besteht (Urlaubstage und V-Tage gehen auf getrennte
 * Konten). Zurückgezogen wird er im Ganzen – das erledigt die Datenbank,
 * welche Zeile man übergibt, spielt keine Rolle.
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
        <CardHeader title="Meine Anträge" />
      )}
      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {einklappbar && !offen ? null : (
      <CardBody className="space-y-2 px-3 py-3">
        {loading ? (
          <RowSkeleton rows={3} />
        ) : !gruppen || gruppen.length === 0 ? (
          <EmptyState
            title="Noch keine Anträge gestellt."
            description="Ein neuer Antrag erscheint hier sofort nach dem Absenden."
          />
        ) : (
          gruppen.map((request) => (
            <div
              key={request.id}
              className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {formatRange(request.startDate, request.endDate)}
                </p>
                <p className="tnum text-[12px] text-ink-muted">
                  {formatDays(request.requestedDays)} Tage · {artenText(request.kinds)}
                  {request.halfDayPeriod
                    ? ` · ${request.halfDayPeriod === "vormittag" ? "vormittags" : "nachmittags"}`
                    : ""}
                </p>
                {request.reason ? (
                  <p className="mt-1 text-[13px] italic text-ink-muted">
                    „{request.reason}“
                  </p>
                ) : null}
                {request.status === "rejected" && request.rejectionReason ? (
                  <p className="mt-1 text-[13px] text-crit-fg">
                    Grund: {request.rejectionReason}
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
          ))
        )}
      </CardBody>
      )}
    </Card>
  );
}
