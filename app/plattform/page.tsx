import { notFound } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PlattformTabelle, type Dashboard, type FirmaKennzahlen } from "./tabelle";
import { SupportCode } from "./support-code";
import { LoeschBereich, type LoeschListe } from "./loeschen";

export const metadata = { title: "Plattform" };

/**
 * Die Seite hängt an der angemeldeten Person und darf nie im Cache
 * landen – sonst könnte eine einmal gerenderte Fassung bei jemandem
 * ankommen, der sie nicht sehen darf.
 */
export const dynamic = "force-dynamic";

/**
 * Betreiber-Übersicht über alle Firmen hinweg.
 *
 * Drei Dinge, die hier bewusst so und nicht anders sind:
 *
 * 1. **Server Component, kein Client-Code.** Die Daten kommen mit dem
 *    Service-Role-Schlüssel, der RLS umgeht. Der darf den Server nie
 *    verlassen. Eine client-seitige Abfrage gegen die normalen Tabellen
 *    wäre durch RLS ohnehin auf die eigene Firma beschränkt – sie könnte
 *    diese Seite gar nicht füllen.
 *
 * 2. **404 statt 403.** Wer nicht Betreiber ist, soll nicht einmal
 *    erfahren, dass es diese Seite gibt. Ein 403 wäre eine Bestätigung.
 *
 * 3. **Nur Kennzahlen – und die E-Mail-Adressen neuer Konten.**
 *    `platform_overview()` und `platform_dashboard()` geben Zählwerte und
 *    Zeitstempel zurück, keine Urlaubsinhalte, keine Abwesenheitsgründe,
 *    keine Termine oder To-dos. Dazu kommen die E-Mail-Adressen der
 *    neuesten Registrierungen. Die Grenze steht in der Datenbank, nicht
 *    erst hier – was die Funktionen nicht herausgeben, kann diese Seite
 *    auch nicht anzeigen.
 */
export default async function PlattformPage() {
  if (!isSupabaseConfigured) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Fehlt der Service-Role-Schlüssel, lässt sich die Berechtigung gar
  // nicht prüfen. Dann gilt dasselbe wie für jeden Unbefugten: die Seite
  // gibt es nicht. Lieber eine falsche 404 für den Betreiber als eine
  // Fehlermeldung, die Fremden die Existenz der Seite verrät.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    notFound();
  }

  const { data: istBetreiber, error: pruefFehler } = await admin.rpc("is_platform_admin", {
    p_user_id: user.id,
  });
  if (pruefFehler || istBetreiber !== true) notFound();

  const { data, error } = await admin.rpc("platform_overview");
  if (error) {
    throw new Error(`Die Betreiber-Übersicht konnte nicht geladen werden: ${error.message}`);
  }

  const firmen = ((data ?? []) as Record<string, unknown>[]).map(
    (row): FirmaKennzahlen => ({
      companyId: String(row.company_id),
      name: String(row.name ?? ""),
      angelegtAm: (row.angelegt_am as string | null) ?? null,
      aktiv: Boolean(row.aktiv),
      avvAkzeptiertAm: (row.avv_akzeptiert_am as string | null) ?? null,
      einrichtungFertigAm: (row.einrichtung_fertig_am as string | null) ?? null,
      mitarbeiterAktiv: Number(row.mitarbeiter_aktiv ?? 0),
      zugaenge: Number(row.zugaenge ?? 0),
      letzteAktivitaet: (row.letzte_aktivitaet as string | null) ?? null,
      urlaubsantraege: Number(row.urlaubsantraege ?? 0),
      offeneAntraege: Number(row.offene_antraege ?? 0),
    }),
  );

  // Das Dashboard ist eine Zugabe: schlägt es fehl, bleibt die Firmenliste da.
  const { data: dash } = await admin.rpc("platform_dashboard", { p_limit: 30 });
  // Auch die Löschliste ist eine Zugabe: ohne sie bleibt der Rest der Seite stehen.
  const { data: loeschliste } = await admin.rpc("plattform_loeschliste");

  return (
    <>
      <PlattformTabelle firmen={firmen} dashboard={(dash as Dashboard | null) ?? null} />
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <SupportCode />
      </div>
      {loeschliste ? (
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <LoeschBereich liste={loeschliste as LoeschListe} />
        </div>
      ) : null}
    </>
  );
}
