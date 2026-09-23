"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ShiftPlanGrid } from "@/components/calendar/shift-plan-grid";
import { ShiftPlanExport } from "@/components/calendar/shift-plan-export";
import { AddAbsenceForm } from "@/components/leave/add-absence-form";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { fetchEmployees } from "@/lib/data/employees";
import type { EmployeeRecord } from "@/lib/types";

export default function ShiftPlanPage() {
  const { mode, role, company, profile } = useSession();
  const canEdit = role === "admin" || role === "shift_leader";

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  /** Zwingt Plan und Formular nach einer Änderung zum Neuladen. */
  const [stand, setStand] = useState(0);

  // Mitarbeiter für zwei Zwecke: die Vorauswahl der eigenen Gruppe im
  // Export und die Auswahlliste im Abwesenheitsformular.
  const laden = useCallback(() => {
    if (mode !== "live" || !canEdit) return;
    fetchEmployees()
      .then((list) => setEmployees(list.filter((e) => e.active)))
      .catch(() => setEmployees([]));
  }, [mode, canEdit]);

  useEffect(() => {
    laden();
  }, [laden]);

  const ownTeam =
    employees.find((e) => e.id === profile.employeeId)?.rotationTeam ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Übersicht"
        title="Schichtplan"
        description={
          canEdit
            ? "Eine Zeile je Person über vier Wochen. Auf eine Zelle tippen, um Schicht, Frei oder Abwesenheit zu ändern."
            : "Eine Zeile je Person über vier Wochen. In deiner eigenen Zeile tippst du auf den ersten und letzten Tag, um Urlaub zu beantragen."
        }
      />

      {mode === "demo" ? (
        <Alert tone="warning">
          Der Schichtplan zeigt echte Daten aus Supabase und ist im Demo-Modus nicht
          verfügbar.
        </Alert>
      ) : (
        <>
          <ShiftPlanGrid
            key={stand}
            companyId={company.id}
            from={TODAY}
            days={30}
            canEdit={canEdit}
            employeeId={profile.employeeId}
          />

          {canEdit ? (
            <>
              {/* Abwesenheiten gehören dorthin, wo man den Plan sieht: wer
                  eine Krankmeldung einträgt, will sofort erkennen, welches
                  Loch sie reißt. Vorher stand das Formular auf einer
                  eigenen Seite unter Besetzung. */}
              <AddAbsenceForm
                employees={employees}
                onSaved={() => {
                  laden();
                  setStand((n) => n + 1);
                }}
              />

              <ShiftPlanExport
                companyId={company.id}
                ownTeam={ownTeam}
                canExportAllTeams={role === "admin"}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
