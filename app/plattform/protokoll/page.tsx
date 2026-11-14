import { konsoleZugang } from "@/lib/auth/konsole";
import { Seitenkopf, datumZeit } from "../tabelle";

export const metadata = { title: "Protokoll · Betreiber-Konsole" };
export const dynamic = "force-dynamic";

const TEXTE: Record<string, string> = {
  "papierkorb/firma": "Firma in den Papierkorb gelegt",
  "zurueckgeholt/firma": "Firma aus dem Papierkorb geholt",
  "endgueltig/firma": "Firma endgültig gelöscht",
  "endgueltig/privat": "Privatkonto gelöscht",
  "notfallzugang/geoeffnet": "Notfallzugang geöffnet",
  "entsperrt/konto": "Konto entsperrt",
  "zwei_faktor_zurueck/konto": "Zwei-Faktor zurückgesetzt",
  "passwort_code/konto": "Passwort-Code erzeugt",
  "aufgenommen/team": "Person ins Betreiber-Team aufgenommen",
  "entfernt/team": "Person aus dem Betreiber-Team entfernt",
  "recht_geaendert/team": "Recht im Betreiber-Team geändert",
};

type Eintrag = { am: string; aktion: string; art: string; wer: string | null };

/**
 * Was das Betreiber-Team getan hat – ohne Inhalte und ohne betroffene
 * Personen. Vor Migration 0223 gibt es nur die Öffnungen des Notfallzugangs.
 */
export default async function KonsoleProtokoll() {
  const k = await konsoleZugang();
  const { data, error } = await k.admin.rpc("platform_protokoll_liste", { p_limit: 200 });
  let liste = (data as Eintrag[] | null) ?? [];
  if (error) {
    const { data: notfall } = await k.admin.rpc("platform_notfall_zugriffe");
    liste = ((notfall as string[] | null) ?? []).map((am) => ({ am, aktion: "notfallzugang", art: "geoeffnet", wer: null }));
  }
  return (
    <>
      <Seitenkopf titel="Protokoll" text="Jede Aktion aus der Konsole mit Zeitpunkt und wer sie ausgeführt hat – ohne Inhalte und ohne betroffene Personen." />
      <section className="rounded-card border border-line bg-surface shadow-card" data-protokoll>
        {liste.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">Noch keine Einträge.</p>
        ) : (
          <ul className="divide-y divide-line">
            {liste.map((e, i) => (
              <li key={`${e.am}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2.5 text-sm">
                <span className="font-medium">{TEXTE[`${e.aktion}/${e.art}`] ?? `${e.aktion} (${e.art})`}</span>
                <span className="text-[12.5px] text-ink-muted">
                  {datumZeit(e.am)}
                  {e.wer ? ` · ${e.wer}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {error ? <p className="text-[12.5px] text-ink-faint">Volles Protokoll erst nach Migration 0223.</p> : null}
    </>
  );
}
