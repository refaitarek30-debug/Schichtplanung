import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf } from "../tabelle";
import { Tresor } from "./tresor";

export const metadata = { title: "Unterlagen & Tresor · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/**
 * Wichtige Unterlagen und Zugangsdaten des Betreiber-Teams – Ende-zu-Ende
 * verschlüsselt mit einem eigenen Master-Passwort (Migration 0234).
 * Nur mit vollem Recht; der Notfallzugang (nur lesen) sieht nichts.
 */
export default async function KonsoleUnterlagen() {
  const k = await konsoleZugang();
  return (
    <>
      <Seitenkopf
        titel="Unterlagen & Tresor"
        text="Verträge, Nachweise und Zugangsdaten an einem Ort. Alles wird in deinem Browser mit dem Master-Passwort verschlüsselt – auf dem Server liegt nur Geheimtext. Ohne Master-Passwort kann es niemand lesen, auch wir nicht."
      />
      {k.nurLesen ? (
        <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm">Dieser Bereich ist nur mit vollem Zugriff auf die Konsole sichtbar.</p>
      ) : (
        <Tresor />
      )}
    </>
  );
}
