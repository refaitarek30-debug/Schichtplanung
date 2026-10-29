"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { MitteilungenZentrale } from "@/components/mitteilungen/mitteilungen-zentrale";
import { useSession } from "@/context/session";

/**
 * Mitteilungen – Hinweise an einzelne Personen, Mitteilungen an alle und
 * Urlaubssperren in einer Liste. Beides geht an die Belegschaft und gehört
 * ins Tagesgeschäft, nicht zu den Einstellungen, die man einmal setzt.
 *
 * Schreiben darf die Schichtleitung mit – Urlaubssperren bleiben der
 * Administration vorbehalten, wie vorher auch. Die Absicherung liegt in den
 * Server-Aktionen und in Row Level Security, nicht in diesen Schaltern.
 */
export default function MitteilungenPage() {
  return (
    <Suspense fallback={null}>
      <MitteilungenInhalt />
    </Suspense>
  );
}

function MitteilungenInhalt() {
  const { mode } = useSession();
  // Aus „Mehr“ → Urlaubssperre: gleich nur die Sperren.
  const nurSperren = useSearchParams().get("bereich") === "sperren";

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Führung" title="Mitteilungen" />

      {mode === "live" ? (
        <MitteilungenZentrale startFilter={nurSperren ? "sperren" : "alle"} />
      ) : (
        <Alert tone="info">
          Mitteilungen und Urlaubssperren gibt es nur im Live-Modus – im Demo-Modus stehen
          feste Beispieleinträge auf dem Dashboard.
        </Alert>
      )}
    </div>
  );
}
