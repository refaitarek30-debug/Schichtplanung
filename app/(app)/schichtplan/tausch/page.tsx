"use client";

import { PageHeader } from "@/components/ui/page-header";
import { PlanReiter } from "@/components/layout/plan-reiter";
import { TauschSeite } from "@/components/tausch/tausch-seite";

/** Schichttausch unter Kollegen – ein Reiter neben dem Schichtplan. */
export default function TauschPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageHeader eyebrow="Übersicht" title="Schichtplan" />
      <PlanReiter />
      <TauschSeite />
    </div>
  );
}
