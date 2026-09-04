"use client";

import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ShiftPlanGrid } from "@/components/calendar/shift-plan-grid";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";

export default function ShiftPlanPage() {
  const { mode, role, company } = useSession();
  const canEdit = role === "admin" || role === "shift_leader";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Übersicht"
        title="Schichtplan"
        description={
          canEdit
            ? "Alle Schichtgruppen auf einen Blick. Auf eine Zelle tippen, um Schicht, Frei oder Abwesenheit zu ändern."
            : "Alle Schichtgruppen auf einen Blick – wer wann arbeitet, frei hat oder im Urlaub ist."
        }
      />

      {mode === "demo" ? (
        <Alert tone="warning">
          Die Schichtplan-Matrix zeigt echte Daten aus Supabase und ist im Demo-Modus
          nicht verfügbar.
        </Alert>
      ) : (
        <ShiftPlanGrid companyId={company.id} from={TODAY} days={28} canEdit={canEdit} />
      )}
    </div>
  );
}
