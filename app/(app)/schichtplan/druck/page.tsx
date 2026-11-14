"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlanDruck } from "@/components/calendar/plan-druck";
import { useSession } from "@/context/session";

/** Schichtplan zum Ausdrucken (A4/A3 quer) – siehe PlanDruck. */
export default function PlanDruckSeite() {
  return (
    <Suspense fallback={null}>
      <Inhalt />
    </Suspense>
  );
}

function Inhalt() {
  const { company, mode } = useSession();
  const q = useSearchParams();
  const heute = new Date();
  const jahr = Number(q.get("jahr")) || heute.getFullYear();
  const m = q.get("monat");
  const monat = m === "jahr" ? null : m !== null && /^\d{1,2}$/.test(m) && Number(m) < 12 ? Number(m) : heute.getMonth();
  const team = q.get("team") ?? "all";
  const format = q.get("format") === "A3" ? "A3" : "A4";
  if (mode !== "live") return <p className="p-6 text-[15px] text-ink-muted">Die Druckansicht gibt es nur mit echten Daten.</p>;
  return <PlanDruck companyId={company.id} start={{ jahr, monat, team, format }} />;
}
