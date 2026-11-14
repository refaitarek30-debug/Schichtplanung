import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { konsoleZugang } from "@/lib/auth/konsole";
import { KennzahlenReihe, Seitenkopf } from "./tabelle";
import { ladeDashboard, ladeFirmen, ladeUmfrage } from "./daten";
import type { LoeschListe } from "./loeschen";

export const metadata = { title: "Übersicht · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

/**
 * Übersicht der Betreiber-Konsole: Kennzahlen und eine Liste „Zu tun“ –
 * jede Zeile führt in den Bereich, in dem man es erledigt.
 *
 * Grenze wie bisher: nur Zählwerte und Zeitstempel aus der Datenbank
 * (platform_overview, platform_dashboard) – keine Urlaubsinhalte, keine
 * Abwesenheitsgründe, keine Termine oder To-dos.
 */
export default async function KonsoleUebersicht() {
  const k = await konsoleZugang();
  const [firmen, dashboard, umfrage, sperrenRoh, loeschRoh, notfallRoh] = await Promise.all([
    ladeFirmen(k),
    ladeDashboard(k),
    ladeUmfrage(k),
    k.admin.rpc("platform_sperren").then((r) => r.data),
    k.admin.rpc("plattform_loeschliste").then((r) => r.data),
    k.nurLesen ? Promise.resolve(null) : k.admin.rpc("platform_notfall_zugriffe").then((r) => r.data),
  ]);
  const sperren = ((sperrenRoh as unknown[] | null) ?? []).length;
  const papierkorb = ((loeschRoh as LoeschListe | null)?.firmen ?? []).filter((f) => f.geloescht_am).length;
  const notfall = (notfallRoh as string[] | null) ?? [];
  const ohneAvv = firmen.filter((f) => f.aktiv && !f.avvAkzeptiertAm).length;
  const ohneEinrichtung = firmen.filter((f) => f.aktiv && !f.einrichtungFertigAm).length;
  const offen = firmen.reduce((s, f) => s + f.offeneAntraege, 0);

  const aufgaben: { text: string; zusatz: string; pfad: string }[] = [];
  if (sperren) aufgaben.push({ text: `${sperren} ${sperren === 1 ? "Konto ist" : "Konten sind"} gesperrt`, zusatz: "nach 5 Fehlversuchen", pfad: "/plattform/zugang" });
  if (ohneAvv) aufgaben.push({ text: `${ohneAvv} ${ohneAvv === 1 ? "Firma" : "Firmen"} ohne AVV-Zustimmung`, zusatz: "vor dem echten Einsatz nachholen", pfad: "/plattform/firmen" });
  if (ohneEinrichtung) aufgaben.push({ text: `${ohneEinrichtung} ${ohneEinrichtung === 1 ? "Firma" : "Firmen"} mit offener Einrichtung`, zusatz: "evtl. Hilfe anbieten", pfad: "/plattform/firmen" });
  if (papierkorb) aufgaben.push({ text: `${papierkorb} ${papierkorb === 1 ? "Firma" : "Firmen"} im Papierkorb`, zusatz: "werden nach 14 Tagen endgültig gelöscht", pfad: "/plattform/loeschen" });
  if (notfall.length) aufgaben.push({ text: "Notfallzugang wurde benutzt", zusatz: new Date(notfall[0]).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }), pfad: "/plattform/protokoll" });

  return (
    <>
      <Seitenkopf titel="Übersicht" text="Was gerade los ist – nur Zahlen, keine Inhalte aus den Betrieben." />
      {dashboard ? <KennzahlenReihe dashboard={dashboard} umfrage={umfrage} /> : null}

      <section className="rounded-card border border-line bg-surface shadow-card" data-zu-tun>
        <h2 className="px-5 pb-1 pt-4 text-[15px] font-semibold">Zu tun</h2>
        {aufgaben.length === 0 ? (
          <p className="px-5 pb-4 pt-1 text-sm text-ink-muted">Alles erledigt – gerade gibt es nichts zu tun.</p>
        ) : (
          <ul className="divide-y divide-line">
            {aufgaben.map((a) => (
              <li key={a.text}>
                <Link href={a.pfad} className="flex items-center gap-3 px-5 py-3 hover:bg-ink/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.text}</span>
                    <span className="block text-[12.5px] text-ink-muted">{a.zusatz}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Kurz titel="Firmen" wert={`${firmen.filter((f) => f.aktiv).length} aktiv`} zusatz={offen ? `${offen} Anträge offen` : "keine offenen Anträge"} pfad="/plattform/firmen" />
        <Kurz titel="Zugänge" wert={sperren ? `${sperren} gesperrt` : "keine Sperre"} zusatz="Freischalten, Zwei-Faktor, Passwort-Code" pfad="/plattform/zugang" />
        <Kurz titel="Umfrage" wert={umfrage ? `${umfrage.antworten} Antworten` : "–"} zusatz="Privatbereich, ohne Namen" pfad="/plattform/umfrage" />
      </section>
    </>
  );
}

function Kurz({ titel, wert, zusatz, pfad }: { titel: string; wert: string; zusatz: string; pfad: string }) {
  return (
    <Link href={pfad} className="rounded-card border border-line bg-surface px-4 py-3 shadow-card hover:bg-ink/[0.02]">
      <p className="text-[12px] text-ink-muted">{titel}</p>
      <p className="mt-0.5 text-[17px] font-semibold">{wert}</p>
      <p className="mt-0.5 text-[12px] text-ink-faint">{zusatz}</p>
    </Link>
  );
}
