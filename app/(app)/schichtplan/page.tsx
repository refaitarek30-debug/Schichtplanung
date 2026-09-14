"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Table2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { LiveMonthCalendar } from "@/components/calendar/live-month-calendar";
import { ShiftPlanGrid } from "@/components/calendar/shift-plan-grid";
import { ShiftPlanExport } from "@/components/calendar/shift-plan-export";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/context/session";
import { TODAY } from "@/lib/demo-data";
import { fetchEmployees } from "@/lib/data/employees";
import { cn } from "@/lib/utils";

type Ansicht = "plan" | "monat";

/**
 * Schichtplan und Kalender waren zwei Seiten für im Kern verwandte
 * Information. Sie zeigen dieselben Daten aus zwei Richtungen:
 *
 * - **Plan** – eine Zeile je Person über 28 Tage. Beantwortet „wer arbeitet
 *   wann" und ist für die Führung der Ort zum Ändern.
 * - **Monat** – ein Feld je Tag über einen Monat. Beantwortet „wie sieht
 *   der Monat aus" und zeigt je Tag die kritischste Besetzung aller
 *   Schichten.
 *
 * Keine der beiden lässt sich durch die andere ersetzen, zwei Einträge in
 * der Navigation braucht es dafür aber nicht.
 */
export default function ShiftPlanPage() {
  const { mode, role, company, profile } = useSession();
  const canEdit = role === "admin" || role === "shift_leader";

  // Im Demo-Modus gibt es die Matrix nicht (sie liest echte Daten), den
  // Monat aber schon – dann ist er die sinnvolle Startansicht.
  const [ansicht, setAnsicht] = useState<Ansicht>(mode === "live" ? "plan" : "monat");

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

  const beschreibung =
    ansicht === "plan"
      ? canEdit
        ? "Eine Zeile je Person über vier Wochen. Auf eine Zelle tippen, um Schicht, Frei oder Abwesenheit zu ändern."
        : "Eine Zeile je Person über vier Wochen – wer wann arbeitet, frei hat oder im Urlaub ist."
      : role === "employee"
        ? "Dein Monat auf einen Blick. Auf einen Tag tippen, um Details zu sehen."
        : "Besetzung je Tag, aus echten Anträgen und Abwesenheiten berechnet. Die Farbe zeigt den kritischsten Wert aller Schichten.";

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Übersicht" title="Schichtplan" description={beschreibung} />

      <AnsichtWechsel aktiv={ansicht} onWechsel={setAnsicht} />

      {ansicht === "monat" ? (
        mode === "live" ? (
          <LiveMonthCalendar today={TODAY} role={role} companyId={company.id} />
        ) : (
          <MonthCalendar today={TODAY} role={role} />
        )
      ) : mode === "demo" ? (
        <Alert tone="warning">
          Der Plan je Person zeigt echte Daten aus Supabase und ist im Demo-Modus nicht
          verfügbar. Die Monatsansicht funktioniert auch hier.
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

function AnsichtWechsel({
  aktiv,
  onWechsel,
}: {
  aktiv: Ansicht;
  onWechsel: (a: Ansicht) => void;
}) {
  const knoepfe: { wert: Ansicht; label: string; Icon: typeof Table2 }[] = [
    { wert: "plan", label: "Plan je Person", Icon: Table2 },
    { wert: "monat", label: "Monat", Icon: CalendarDays },
  ];

  return (
    <div
      role="tablist"
      aria-label="Ansicht"
      className="inline-flex rounded-xl border border-line bg-surface p-1"
    >
      {knoepfe.map(({ wert, label, Icon }) => (
        <button
          key={wert}
          role="tab"
          aria-selected={aktiv === wert}
          onClick={() => onWechsel(wert)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
            aktiv === wert
              ? "bg-brand-500 text-white"
              : "text-ink-muted hover:bg-surface-muted hover:text-ink",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
          {label}
        </button>
      ))}
    </div>
  );
}
