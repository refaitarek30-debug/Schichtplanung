"use client";

import { useCallback, useEffect, useState } from "react";
import { BalanceCard } from "@/components/leave/balance-card";
import { LeaveRequestForm } from "@/components/leave/leave-request-form";
import { LiveBalanceCard } from "@/components/leave/live-balance-card";
import { LiveLeaveRequestForm } from "@/components/leave/live-leave-request-form";
import { LiveRequestList } from "@/components/leave/live-request-list";
import { RequestList } from "@/components/dashboard/request-list";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/context/session";
import { TODAY, requestsOfEmployee, staffingContext } from "@/lib/demo-data";
import { leaveBalance } from "@/lib/staffing";
import {
  DataError,
  fetchMyLeaveBalance,
  fetchMyLeaveRequests,
} from "@/lib/data/leave";
import type { LiveLeaveBalance, LiveLeaveRequest } from "@/lib/types";

export default function LeavePage() {
  const { mode, user, profile } = useSession();

  const [balance, setBalance] = useState<LiveLeaveBalance | null>(null);
  const [requests, setRequests] = useState<LiveLeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (mode !== "live") return;
    setError(null);
    try {
      const [balanceResult, requestsResult] = await Promise.all([
        fetchMyLeaveBalance(),
        fetchMyLeaveRequests(),
      ]);
      setBalance(balanceResult);
      setRequests(requestsResult);
    } catch (caught) {
      setRequests([]);
      setError(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const demoBalance = leaveBalance(user, staffingContext.leaveRequests, TODAY);
  const demoRequests = requestsOfEmployee(user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mein Urlaub"
        title="Urlaub"
        description="Urlaubskonto, laufende Anträge und ein neuer Antrag mit direkter Prüfung gegen dein Kontingent."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {mode === "live" ? (
          <LiveLeaveRequestForm
            employeeId={profile.employeeId}
            balance={balance}
            today={TODAY}
            onSubmitted={load}
          />
        ) : (
          <LeaveRequestForm employee={user} today={TODAY} />
        )}

        <div className="space-y-4">
          {mode === "live" ? (
            <LiveBalanceCard balance={balance} />
          ) : (
            <BalanceCard balance={demoBalance} />
          )}

          {mode === "live" ? (
            <LiveRequestList requests={requests} loading={requests === null} onChanged={load} />
          ) : (
            <RequestList
              title="Meine Anträge"
              requests={demoRequests}
              emptyMessage="Noch keine Anträge gestellt."
            />
          )}
        </div>
      </div>
    </div>
  );
}
