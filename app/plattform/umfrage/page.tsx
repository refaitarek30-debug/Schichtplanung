import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf, UmfrageKarte } from "../tabelle";
import { ladeUmfrage } from "../daten";

export const metadata = { title: "Umfrage · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

export default async function KonsoleUmfrage() {
  const k = await konsoleZugang();
  const umfrage = await ladeUmfrage(k);
  return (
    <>
      <Seitenkopf titel="Umfrage" text="Antworten aus dem Privatbereich – nur Summen und Texte, ohne Namen." />
      {umfrage ? <UmfrageKarte umfrage={umfrage} /> : <p className="text-sm text-ink-muted">Noch keine Antworten.</p>}
    </>
  );
}
