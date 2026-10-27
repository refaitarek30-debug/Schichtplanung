"use client";

import { Alert } from "@/components/ui/alert";
import { MeinKalenderGlas } from "@/components/kalender/mein-kalender-glas";
import { useSession } from "@/context/session";

/**
 * Mein Kalender – der eigene Schichtplan als Monat, für alle Rollen.
 *
 * Die Adresse bleibt /meine-schichten, weil Lesezeichen und die
 * Verknüpfung der installierten App dorthin zeigen. Die frühere
 * Teamübersicht (Schichtgruppen mit Konten) liegt für Schichtleitung und
 * Administration jetzt unter Verwaltung → Schichtgruppen.
 */
export function MeinKalenderSeite() {
  const { mode } = useSession();

  if (mode !== "live") {
    return (
      <Alert tone="warning">
        Der Kalender zeigt echte Daten aus Supabase und ist im Demo-Modus nicht verfügbar.
      </Alert>
    );
  }
  return <MeinKalenderGlas />;
}
