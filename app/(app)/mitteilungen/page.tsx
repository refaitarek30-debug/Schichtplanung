"use client";

import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { AnnouncementsCard } from "@/components/settings/announcements-card";
import { LeaveBlocksCard } from "@/components/leave/leave-blocks-card";
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
  const { mode, role } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Führung"
        title="Mitteilungen"
        description="Was hier steht, sieht jeder auf seinem Dashboard – Mitteilungen aus der Betriebsleitung und gesperrte Urlaubszeiträume."
      />

      {mode === "live" ? (
        <>
          <AnnouncementsCard canManage={role !== "employee"} />
          <LeaveBlocksCard canManage={role === "admin"} />
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
