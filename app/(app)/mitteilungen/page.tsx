"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { AnnouncementsCard } from "@/components/settings/announcements-card";
import { LeaveBlocksCard } from "@/components/leave/leave-blocks-card";
import { HinweiseCard } from "@/components/hinweise/hinweise-card";
import { useSession } from "@/context/session";

/**
 * Mitteilungen und Urlaubssperren – beides geht an die ganze Belegschaft
 * und beides steht auf jedem Dashboard.
 *
 * Vorher lagen die Karten unter Verwaltung → Regeln, zwischen
 * Planungsregeln und Feiertagseinstellungen. Das ist der falsche Ort: die
 * Regeln stellt man einmal beim Einrichten ein, eine Mitteilung schreibt
 * man mitten im Tagesgeschäft. Deshalb ein eigener Punkt unter Führung,
 * zwei Klicks näher.
 *
 * Schreiben darf beides die Schichtleitung mit – Urlaubssperren bleiben
 * der Administration vorbehalten, wie vorher auch. Die Absicherung liegt
 * in den Server-Aktionen und in Row Level Security, nicht in diesen
 * Schaltern.
 */
export default function MitteilungenPage() {
  return (
    <Suspense fallback={null}>
      <MitteilungenInhalt />
    </Suspense>
  );
}

function MitteilungenInhalt() {
  const { mode, role } = useSession();
  // Aus „Mehr“ → Urlaubssperre: die Sperren stehen dann ganz oben.
  const sperrenZuerst = useSearchParams().get("bereich") === "sperren";
  const sperren = <LeaveBlocksCard canManage={role === "admin"} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Führung"
        title="Mitteilungen"
        description="Hinweise an einzelne Personen, Mitteilungen an alle und gesperrte Urlaubszeiträume."
      />

      {mode === "live" ? (
        <>
          {sperrenZuerst ? sperren : null}
          {role !== "employee" ? <HinweiseCard /> : null}
          <AnnouncementsCard canManage={role !== "employee"} />
          {sperrenZuerst ? null : sperren}
        </>
      ) : (
        <Alert tone="info">
          Mitteilungen und Urlaubssperren gibt es nur im Live-Modus – im Demo-Modus stehen
          feste Beispieleinträge auf dem Dashboard.
        </Alert>
      )}
    </div>
  );
}
