"use client";

import { usePathname } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/context/session";

/**
 * Seiten, deren Daten noch nicht aus Supabase kommen. Nach Phase 4 sind
 * Urlaubskonto, Anträge, Genehmigung, Besetzung, Kalender und Meine
 * Schichten vollständig live – die Liste bleibt für künftige Phasen stehen,
 * ist aber aktuell leer.
 */
const PLANNING_PATHS: string[] = [];

export function DataModeNotice() {
  const { mode } = useSession();
  const pathname = usePathname();

  if (mode === "demo") {
    return (
      <Alert tone="warning" className="mb-5">
        Supabase ist noch nicht konfiguriert. Die Anwendung läuft im Demo-Modus: alle
        Daten sind Beispieldaten, Anmeldung und Speichern sind deaktiviert.
      </Alert>
    );
  }

  if (PLANNING_PATHS.some((path) => pathname.startsWith(path))) {
    return (
      <Alert tone="info" className="mb-5">
        Schichtzuordnung und automatische Besetzungsprüfung zeigen bis Phase 4 noch
        Beispieldaten. Anmeldung, Rollen, Mitarbeiter, Urlaubskonto und Urlaubsanträge
        sind bereits echt.
      </Alert>
    );
  }

  return null;
}
