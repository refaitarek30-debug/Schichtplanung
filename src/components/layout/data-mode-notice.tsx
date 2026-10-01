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
  const { mode, company } = useSession();
  const pathname = usePathname();

  // Live-Demo: ein eigener, befristeter Mandant mit Beispieldaten.
  if (mode === "live" && company.isDemo) {
    const bis = company.demoExpiresAt
      ? new Date(company.demoExpiresAt).toLocaleString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
    return (
      <Alert tone="info" className="mb-5">
        <strong>Live-Demo</strong> – alle Personen und Termine sind Beispieldaten. Sie können
        alles ausprobieren; nur Einladungen und E-Mails sind abgeschaltet. Dieser Demo-Bereich
        wird {bis ? `am ${bis} Uhr` : "nach 24 Stunden"} automatisch gelöscht. Bitte keine echten
        Personendaten eingeben. Für Ihr eigenes Unternehmen melden Sie sich ab und registrieren
        sich kostenlos.
      </Alert>
    );
  }

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
