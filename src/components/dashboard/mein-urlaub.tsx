"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Palmtree } from "lucide-react";
import { LiveBalanceCard } from "@/components/leave/live-balance-card";
import { LiveRequestList } from "@/components/leave/live-request-list";
import { fetchAfGenommenJahr, fetchMyAfKonto, fetchMyLeaveKindQuotas } from "@/lib/data/leave";
import type { LiveAfKonto, LiveLeaveBalance, LiveLeaveKindQuota, LiveLeaveRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Startseite „Kompakt“: der Urlaub in einer Karte unten – die eigenen Anträge
 * nach Unterkategorien (zugeklappt), darunter das Urlaubskonto zum Aufklappen.
 * Die Urlaubsseite bleibt; „Alles“ führt dorthin.
 */
export function MeinUrlaub({
  balance,
  requests,
  loading,
  onChanged,
  employeeId,
}: {
  balance: LiveLeaveBalance | null;
  requests: LiveLeaveRequest[] | null;
  loading: boolean;
  onChanged: () => void;
  employeeId: string | null;
}) {
  const [kontoOffen, setKontoOffen] = useState(false);
  const [extras, setExtras] = useState<{
    quoten: LiveLeaveKindQuota[] | null;
    afKonto: LiveAfKonto | null;
    afGenommen: number | null;
  } | null>(null);

  // Sonderurlaub und AF erst laden, wenn das Konto aufgeklappt wird.
  useEffect(() => {
    if (!kontoOffen || extras) return;
    const jahr = new Date().getFullYear();
    let aktiv = true;
    void Promise.allSettled([fetchMyLeaveKindQuotas(jahr), fetchMyAfKonto(), fetchAfGenommenJahr(jahr)]).then(
      ([q, af, genommen]) => {
        if (!aktiv) return;
        setExtras({
          quoten: q.status === "fulfilled" ? q.value : null,
          afKonto: af.status === "fulfilled" ? af.value : null,
          afGenommen: genommen.status === "fulfilled" ? (genommen.value.get(employeeId ?? "") ?? null) : null,
        });
      },
    );
    return () => {
      aktiv = false;
    };
  }, [kontoOffen, extras, employeeId]);

  return (
    <section data-mein-urlaub className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 pb-2.5 pt-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ok-bg text-ok-fg">
          <Palmtree className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1 text-[16px] font-semibold leading-tight">Mein Urlaub</span>
        <Link
          href="/urlaub"
          className="flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-500/10"
        >
          Alles <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
        </Link>
      </div>

      <div className="px-3 pb-3">
        <LiveRequestList requests={requests} loading={loading} onChanged={onChanged} rahmenlos />
      </div>

      <button
        type="button"
        onClick={() => setKontoOffen((v) => !v)}
        aria-expanded={kontoOffen}
        className="glas-linie flex w-full items-center gap-2.5 border-t px-4 py-3 text-left text-[14.5px] font-medium hover:bg-ink/[0.03]"
      >
        {/* Ohne Zahl hier – die steht schon in der Kachel oben. */}
        <span className="flex-1">Urlaubskonto</span>
        <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform", kontoOffen && "rotate-180")} strokeWidth={2} />
      </button>
      {kontoOffen ? (
        // Die Kontokarte ohne eigenen Rahmen – sie steht schon in dieser Karte.
        <div className="border-t border-line [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none">
          <LiveBalanceCard
            balance={balance}
            quoten={extras?.quoten}
            afKonto={extras?.afKonto}
            afGenommenJahr={extras?.afGenommen}
          />
        </div>
      ) : null}
    </section>
  );
}
