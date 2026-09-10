"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ShiftPlanGrid } from "@/components/calendar/shift-plan-grid";
import { ShiftPlanExport } from "@/components/calendar/shift-plan-export";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { fetchEmployees } from "@/lib/data/employees";

export default function ShiftPlanPage() {
  const { mode, role, company, profile } = useSession();
  const canEdit = role === "admin" || role === "shift_leader";

  // Eigene Schichtgruppe für die Vorauswahl im Export. Kommt aus dem
  // Mitarbeiterdatensatz, nicht aus dem Profil – dort steht sie nicht.
  const [ownTeam, setOwnTeam] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "live" || !canEdit || !profile.employeeId) return;
    fetchEmployees()
      .then((list) => {
        setOwnTeam(list.find((e) => e.id === profile.employeeId)?.rotationTeam ?? null);
      })
      .catch(() => setOwnTeam(null));
  }, [mode, canEdit, profile.employeeId]);

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
        <>
          <ShiftPlanGrid companyId={company.id} from={TODAY} days={28} canEdit={canEdit} />
          {canEdit ? (
            <ShiftPlanExport
              companyId={company.id}
              ownTeam={ownTeam}
              canExportAllTeams={role === "admin"}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
