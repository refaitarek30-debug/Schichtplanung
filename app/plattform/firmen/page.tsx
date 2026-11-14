import { konsoleZugang } from "@/lib/auth/konsole";
import { FirmenListe, Gesamtzahlen, NeueKonten, Seitenkopf } from "../tabelle";
import { ladeDashboard, ladeFirmen } from "../daten";

export const metadata = { title: "Firmen & Konten · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/** Firmen mit Kennzahlen, neue Konten und Summen – keine Inhalte. */
export default async function KonsoleFirmen() {
  const k = await konsoleZugang();
  const [firmen, dashboard] = await Promise.all([ladeFirmen(k), ladeDashboard(k)]);
  return (
    <>
      <Seitenkopf
        titel="Firmen & Konten"
        text="Nur Kennzahlen und die E-Mail-Adressen neuer Konten. In Pläne, Urlaube oder Termine eines Betriebs schaut die Konsole nicht."
      />
      <FirmenListe firmen={firmen} />
      {dashboard ? <NeueKonten dashboard={dashboard} /> : null}
      {dashboard ? <Gesamtzahlen dashboard={dashboard} /> : null}
    </>
  );
}
