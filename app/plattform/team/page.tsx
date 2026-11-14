import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf } from "../tabelle";
import { TeamListe, type Mitglied } from "./team-liste";

export const metadata = { title: "Team · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/** Wer hat Zugang zur Konsole – mit welchem Recht. */
export default async function KonsoleTeam() {
  const k = await konsoleZugang();
  const { data, error } = await k.admin.rpc("platform_team");
  return (
    <>
      <Seitenkopf
        titel="Team"
        text="Wer die Konsole öffnen darf. „Nur lesen“ sieht alles, ändert aber nichts. Jede Aufnahme und Änderung steht im Protokoll."
      />
      {error ? (
        <p className="text-sm text-ink-muted">Die Team-Liste kommt mit der Datenbank-Erweiterung (Migration 0223).</p>
      ) : (
        <TeamListe team={(data as Mitglied[] | null) ?? []} ich={k.userId} nurLesen={k.nurLesen} />
      )}
    </>
  );
}
