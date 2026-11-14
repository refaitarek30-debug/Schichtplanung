import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf } from "../tabelle";
import { LoeschBereich, type LoeschListe } from "../loeschen";

export const metadata = { title: "Löschen · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

export default async function KonsoleLoeschen() {
  const k = await konsoleZugang();
  if (k.nurLesen) {
    return (
      <>
        <Seitenkopf titel="Löschen" />
        <p className="text-sm text-ink-muted">Der Notfallzugang darf nichts löschen.</p>
      </>
    );
  }
  const { data } = await k.admin.rpc("plattform_loeschliste");
  return data ? <LoeschBereich liste={data as LoeschListe} /> : <p className="text-sm text-ink-muted">Die Löschliste ließ sich nicht laden.</p>;
}
