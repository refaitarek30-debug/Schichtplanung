import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FirmaKennzahlen {
  companyId: string;
  name: string;
  angelegtAm: string | null;
  aktiv: boolean;
  avvAkzeptiertAm: string | null;
  einrichtungFertigAm: string | null;
  mitarbeiterAktiv: number;
  zugaenge: number;
  letzteAktivitaet: string | null;
  urlaubsantraege: number;
  offeneAntraege: number;
}

export interface Dashboard {
  konten: number;
  neu_heute: number;
  neu_7: number;
  neu_30: number;
  privat: number;
  firma: number;
  angemeldet_24h: number;
  angemeldet_7: number;
  neu: {
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    bestaetigt: boolean;
    art: "privat" | "firma" | "ohne";
    firma: string | null;
  }[];
  summen: Record<string, number>;
}

const SUMMEN: { schluessel: string; label: string }[] = [
  { schluessel: "firmen", label: "Firmen" },
  { schluessel: "mitarbeiter", label: "Mitarbeiter (aktiv)" },
  { schluessel: "plan_eintraege", label: "Schichtplan-Einträge" },
  { schluessel: "urlaubsantraege", label: "Urlaubsanträge" },
  { schluessel: "offene_antraege", label: "davon offen" },
  { schluessel: "privat_tage", label: "Privatkalender: Tage" },
  { schluessel: "eigene_tage", label: "Eigene Einträge (Firma)" },
  { schluessel: "termine", label: "Termine" },
  { schluessel: "todos", label: "To-dos" },
  { schluessel: "personen", label: "Eingeladene Personen" },
  { schluessel: "verbindungen", label: "Verbindungen" },
  { schluessel: "gruppen", label: "Gruppen" },
];

function datumZeit(wert: string): string {
  return new Date(wert).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function datum(wert: string | null): string {
  if (!wert) return "–";
  return new Date(wert).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** „vor 3 Tagen" sagt mehr über Nutzung aus als ein Datum. */
function seitdem(wert: string | null): string {
  if (!wert) return "noch nie angemeldet";
  const tage = Math.floor((Date.now() - new Date(wert).getTime()) / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 30) return `vor ${tage} Tagen`;
  const monate = Math.floor(tage / 30);
  return monate === 1 ? "vor einem Monat" : `vor ${monate} Monaten`;
}

/**
 * Reine Darstellung – bekommt fertige Kennzahlen und holt selbst nichts
 * nach. Die Seite ist absichtlich schlicht gehalten: sie ist ein
 * Betriebsmittel, kein Produkt.
 */
export function PlattformTabelle({ firmen, dashboard }: { firmen: FirmaKennzahlen[]; dashboard: Dashboard | null }) {
  const gesamt = {
    firmen: firmen.length,
    aktiv: firmen.filter((f) => f.aktiv).length,
    mitarbeiter: firmen.reduce((s, f) => s + f.mitarbeiterAktiv, 0),
    zugaenge: firmen.reduce((s, f) => s + f.zugaenge, 0),
    offen: firmen.reduce((s, f) => s + f.offeneAntraege, 0),
    ohneAvv: firmen.filter((f) => !f.avvAkzeptiertAm).length,
    ohneEinrichtung: firmen.filter((f) => !f.einrichtungFertigAm).length,
  };

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Betrieb der Plattform
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            Firmen auf dieser Instanz
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Zahlen zum Betrieb und die E-Mail-Adressen neuer Konten – keine
            Urlaubsinhalte, keine Abwesenheitsgründe, keine Termine oder To-dos.
            Diese Seite taucht in keiner Navigation auf.
          </p>
        </header>

        {dashboard ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kennzahl label="Konten gesamt" wert={dashboard.konten} zusatz={`${dashboard.firma} Firma · ${dashboard.privat} privat`} />
              <Kennzahl label="Neu heute" wert={dashboard.neu_heute} zusatz="Registrierungen" />
              <Kennzahl label="Neu in 7 Tagen" wert={dashboard.neu_7} zusatz={`${dashboard.neu_30} in 30 Tagen`} />
              <Kennzahl label="Angemeldet 24 Std." wert={dashboard.angemeldet_24h} zusatz={`${dashboard.angemeldet_7} in 7 Tagen`} />
            </div>

            <Card>
              <CardHeader title="Neue Registrierungen" hint="neueste oben" />
              <CardBody className="overflow-x-auto px-0 py-0">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                      <Th className="pl-5">E-Mail · registriert</Th>
                      <Th className="pr-5">Art</Th>
                      <Th className="hidden pr-5 sm:table-cell">Zuletzt angemeldet</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.neu.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-ink-muted">
                          Noch keine Registrierung.
                        </td>
                      </tr>
                    ) : (
                      dashboard.neu.map((n, i) => (
                        <tr key={`${n.email}-${i}`}>
                          <td className="border-t border-line px-3 py-2.5 pl-5">
                            <span className="block break-all font-medium">{n.email ?? "–"}</span>
                            <span className="tnum block text-[12.5px] text-ink-muted">{datumZeit(n.created_at)}</span>
                            {!n.bestaetigt ? <span className="text-[12px] text-warn-fg">E-Mail noch nicht bestätigt</span> : null}
                          </td>
                          <td className="border-t border-line px-3 py-2.5 pr-5">
                            <Badge tone={n.art === "privat" ? "ok" : "neutral"}>
                              {n.art === "privat" ? "privat" : n.art === "firma" ? (n.firma ?? "Firma") : "ohne Konto"}
                            </Badge>
                          </td>
                          <td className="hidden border-t border-line px-3 py-2.5 pr-5 text-ink-muted sm:table-cell">{seitdem(n.last_sign_in_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Gesamtzahlen" hint="Kalender und Schichtplan, nur Summen" />
              <CardBody>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3 [&_dt]:min-w-0">
                  {SUMMEN.map((s) => (
                    <div key={s.schluessel} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                      <dt className="text-ink-muted">{s.label}</dt>
                      <dd className="tnum font-semibold">{(dashboard.summen[s.schluessel] ?? 0).toLocaleString("de-DE")}</dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kennzahl label="Firmen" wert={gesamt.firmen} zusatz={`${gesamt.aktiv} aktiv`} />
          <Kennzahl label="Mitarbeiter" wert={gesamt.mitarbeiter} zusatz="aktiv, alle Firmen" />
          <Kennzahl label="Zugänge" wert={gesamt.zugaenge} zusatz="mit Login" />
          <Kennzahl
            label="Offene Anträge"
            wert={gesamt.offen}
            zusatz="warten auf Entscheidung"
          />
        </div>

        {gesamt.ohneAvv > 0 || gesamt.ohneEinrichtung > 0 ? (
          <Card>
            <CardBody className="space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
              {gesamt.ohneAvv > 0 ? (
                <p>
                  <strong className="text-ink">{gesamt.ohneAvv}</strong>{" "}
                  {gesamt.ohneAvv === 1 ? "Firma hat" : "Firmen haben"} der
                  Datenschutzerklärung und dem AVV nicht zugestimmt – Altbestand von vor
                  der Einführung der Pflichtangabe. Vor dem produktiven Einsatz
                  nachholen.
                </p>
              ) : null}
              {gesamt.ohneEinrichtung > 0 ? (
                <p>
                  <strong className="text-ink">{gesamt.ohneEinrichtung}</strong>{" "}
                  {gesamt.ohneEinrichtung === 1 ? "Firma hat" : "Firmen haben"} die
                  Einrichtung nicht abgeschlossen.
                </p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Je Firma" hint="neueste zuletzt" />
          <CardBody className="overflow-x-auto px-0 py-0">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                  <Th className="pl-5">Firma</Th>
                  <Th>Angelegt</Th>
                  <Th className="text-right">Mitarbeiter</Th>
                  <Th className="text-right">Zugänge</Th>
                  <Th className="text-right">Anträge</Th>
                  <Th>Letzte Anmeldung</Th>
                  <Th className="pr-5">Stand</Th>
                </tr>
              </thead>
              <tbody>
                {firmen.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-ink-muted">
                      Noch keine Firma registriert.
                    </td>
                  </tr>
                ) : (
                  firmen.map((f) => (
                    <tr key={f.companyId} className="border-t border-line">
                      <td className="border-t border-line px-3 py-3 pl-5">
                        <span className="block font-medium">{f.name}</span>
                        {!f.aktiv ? (
                          <span className="text-[12px] text-crit-fg">deaktiviert</span>
                        ) : null}
                      </td>
                      <td className="tnum border-t border-line px-3 py-3 text-ink-muted">
                        {datum(f.angelegtAm)}
                      </td>
                      <td className="tnum border-t border-line px-3 py-3 text-right">
                        {f.mitarbeiterAktiv}
                      </td>
                      <td className="tnum border-t border-line px-3 py-3 text-right">
                        {f.zugaenge}
                      </td>
                      <td className="tnum border-t border-line px-3 py-3 text-right">
                        {f.urlaubsantraege}
                        {f.offeneAntraege > 0 ? (
                          <span className="text-warn-fg"> ({f.offeneAntraege} offen)</span>
                        ) : null}
                      </td>
                      <td className="border-t border-line px-3 py-3 text-ink-muted">
                        {seitdem(f.letzteAktivitaet)}
                      </td>
                      <td className="border-t border-line px-3 py-3 pr-5">
                        <span className="flex flex-wrap gap-1.5">
                          <Badge tone={f.avvAkzeptiertAm ? "ok" : "warn"}>
                            {f.avvAkzeptiertAm ? "AVV" : "AVV fehlt"}
                          </Badge>
                          <Badge tone={f.einrichtungFertigAm ? "ok" : "neutral"}>
                            {f.einrichtungFertigAm ? "eingerichtet" : "Einrichtung offen"}
                          </Badge>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <p className="text-[12px] leading-relaxed text-ink-faint">
          Betreiber werden ausschließlich per SQL in <code>platform_admins</code>{" "}
          eingetragen. Es gibt bewusst keine Oberfläche dafür – sonst könnte sich
          jemand selbst eintragen.
        </p>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 pb-2 pt-3 font-semibold", className)}>{children}</th>;
}

function Kennzahl({
  label,
  wert,
  zusatz,
}: {
  label: string;
  wert: number;
  zusatz: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-[12px] text-ink-muted">{label}</p>
      <p className="tnum mt-0.5 text-2xl font-semibold">{wert}</p>
      <p className="mt-0.5 text-[12px] text-ink-faint">{zusatz}</p>
    </div>
  );
}
