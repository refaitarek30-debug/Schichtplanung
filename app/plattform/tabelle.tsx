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
  /** Konten mit Betrieb und Privatbereich (ab 0217). */
  beide?: number;
  angemeldet_24h: number;
  angemeldet_7: number;
  neu: {
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    bestaetigt: boolean;
    art: "privat" | "firma" | "beide" | "ohne";
    firma: string | null;
  }[];
  summen: Record<string, number>;
}

export interface Umfrage {
  antworten: number;
  uebersprungen: number;
  durchschnitt: number | null;
  zufriedenheit: Record<string, number>;
  quellen: Record<string, number>;
  texte: { text: string; zufriedenheit: number | null; tag: string }[];
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

export function datumZeit(wert: string): string {
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

/** Woher die Leute kommen – gleiche Reihenfolge wie im Popup. */
const QUELLEN: { id: string; text: string }[] = [
  { id: "tiktok", text: "TikTok" },
  { id: "instagram", text: "Instagram" },
  { id: "suche", text: "Google / Suche" },
  { id: "freunde", text: "Freunde / Kollegen" },
  { id: "arbeit", text: "Über die Arbeit" },
  { id: "sonstiges", text: "Anderes" },
];
const NOTEN = [
  { wert: 5, text: "😍 Super" },
  { wert: 4, text: "🙂 Gut" },
  { wert: 3, text: "😐 Geht so" },
  { wert: 2, text: "🙁 Eher nicht" },
  { wert: 1, text: "😞 Schlecht" },
];

/** Kopf einer Konsolen-Seite. */
export function Seitenkopf({ titel, text }: { titel: string; text?: string }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[26px]">{titel}</h1>
      {text ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{text}</p> : null}
    </header>
  );
}

/** Vier Kennzahlen oben in der Übersicht. */
export function KennzahlenReihe({ dashboard, umfrage }: { dashboard: Dashboard; umfrage: Umfrage | null }) {
  const beide = dashboard.beide ?? 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kennzahl label="Konten" wert={dashboard.konten} zusatz={`${dashboard.firma - beide} Betrieb · ${dashboard.privat - beide} privat · ${beide} beides`} />
      <Kennzahl label="Neu in 7 Tagen" wert={dashboard.neu_7} zusatz={`${dashboard.neu_heute} heute · ${dashboard.neu_30} in 30 Tagen`} />
      <Kennzahl label="Aktiv in 7 Tagen" wert={dashboard.angemeldet_7} zusatz={`${dashboard.angemeldet_24h} in 24 Std.`} />
      <Kennzahl
        label="Zufriedenheit"
        wert={umfrage?.durchschnitt != null ? umfrage.durchschnitt.toLocaleString("de-DE") : "–"}
        zusatz={umfrage ? `von 5 · ${umfrage.antworten} Antworten` : "noch keine Umfrage"}
      />
    </div>
  );
}

/** Die neuesten Registrierungen. */
export function NeueKonten({ dashboard }: { dashboard: Dashboard }) {
  return (
    <Card>
      <CardHeader title="Neue Konten" hint="neueste oben" />
      <CardBody className="overflow-x-auto px-0 py-0">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              <Th className="pl-5">Konto · registriert</Th>
              <Th className="pr-5">Bereich</Th>
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
                    <span className="block break-all font-medium">{anzeigeKonto(n.email)}</span>
                    <span className="tnum block text-[12.5px] text-ink-muted">{datumZeit(n.created_at)}</span>
                    {!n.bestaetigt ? <span className="text-[12px] text-warn-fg">E-Mail noch nicht bestätigt</span> : null}
                  </td>
                  <td className="border-t border-line px-3 py-2.5 pr-5">
                    <span className="flex flex-wrap gap-1">
                      {n.art === "firma" || n.art === "beide" ? <Badge tone="neutral">{n.firma ?? "Betrieb"}</Badge> : null}
                      {n.art === "privat" || n.art === "beide" ? <Badge tone="ok">privat</Badge> : null}
                      {n.art === "ohne" ? <Badge tone="warn">ohne Bereich</Badge> : null}
                    </span>
                  </td>
                  <td className="hidden border-t border-line px-3 py-2.5 pr-5 text-ink-muted sm:table-cell">{seitdem(n.last_sign_in_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

/** Alle Firmen mit Kennzahlen – keine Inhalte. */
export function FirmenListe({ firmen }: { firmen: FirmaKennzahlen[] }) {
  const ohneAvv = firmen.filter((f) => !f.avvAkzeptiertAm).length;
  const ohneEinrichtung = firmen.filter((f) => !f.einrichtungFertigAm).length;
  const offen = firmen.reduce((s, f) => s + f.offeneAntraege, 0);
  return (
    <Card>
      <CardHeader title="Firmen" hint={`${firmen.filter((f) => f.aktiv).length} aktiv${offen > 0 ? ` · ${offen} Anträge offen` : ""}`} />
      <CardBody className="overflow-x-auto px-0 py-0">
        {ohneAvv > 0 || ohneEinrichtung > 0 ? (
          <p className="px-5 pb-1 pt-3 text-[13px] leading-relaxed text-warn-fg">
            {ohneAvv > 0 ? `${ohneAvv} ohne AVV-Zustimmung (vor dem produktiven Einsatz nachholen). ` : ""}
            {ohneEinrichtung > 0 ? `${ohneEinrichtung} mit offener Einrichtung.` : ""}
          </p>
        ) : null}
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm" data-firmen-liste>
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
                <tr key={f.companyId}>
                  <td className="border-t border-line px-3 py-3 pl-5">
                    <span className="block font-medium">{f.name}</span>
                    {!f.aktiv ? <span className="text-[12px] text-crit-fg">deaktiviert</span> : null}
                  </td>
                  <td className="tnum border-t border-line px-3 py-3 text-ink-muted">{datum(f.angelegtAm)}</td>
                  <td className="tnum border-t border-line px-3 py-3 text-right">{f.mitarbeiterAktiv}</td>
                  <td className="tnum border-t border-line px-3 py-3 text-right">{f.zugaenge}</td>
                  <td className="tnum border-t border-line px-3 py-3 text-right">
                    {f.urlaubsantraege}
                    {f.offeneAntraege > 0 ? <span className="text-warn-fg"> ({f.offeneAntraege} offen)</span> : null}
                  </td>
                  <td className="border-t border-line px-3 py-3 text-ink-muted">{seitdem(f.letzteAktivitaet)}</td>
                  <td className="border-t border-line px-3 py-3 pr-5">
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={f.avvAkzeptiertAm ? "ok" : "warn"}>{f.avvAkzeptiertAm ? "AVV" : "AVV fehlt"}</Badge>
                      <Badge tone={f.einrichtungFertigAm ? "ok" : "neutral"}>{f.einrichtungFertigAm ? "eingerichtet" : "Einrichtung offen"}</Badge>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

/** Summen über alle Bereiche. */
export function Gesamtzahlen({ dashboard }: { dashboard: Dashboard }) {
  return (
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
  );
}

/** Spitzname-Konten haben keine echte Adresse – dann nur den Spitznamen zeigen. */
function anzeigeKonto(email: string | null): string {
  if (!email) return "–";
  return email.endsWith("@privat.invalid") ? `${email.slice(0, -"@privat.invalid".length)} (Spitzname)` : email;
}

export function UmfrageKarte({ umfrage }: { umfrage: Umfrage }) {
  const notenMax = Math.max(1, ...NOTEN.map((n) => umfrage.zufriedenheit[String(n.wert)] ?? 0));
  const quellen = QUELLEN.map((q) => ({ ...q, n: umfrage.quellen[q.id] ?? 0 })).sort((a, b) => b.n - a.n);
  const quellenMax = Math.max(1, ...quellen.map((q) => q.n));
  return (
    <Card>
      <CardHeader
        title="Umfrage Privatbereich"
        hint={`${umfrage.antworten} Antworten · ${umfrage.uebersprungen} übersprungen · ohne Namen`}
      />
      <CardBody className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Balken titel="Wie zufrieden?" zeilen={NOTEN.map((n) => ({ text: n.text, n: umfrage.zufriedenheit[String(n.wert)] ?? 0 }))} max={notenMax} />
          <Balken titel="Woher?" zeilen={quellen} max={quellenMax} />
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Verbesserungsvorschläge</p>
          {umfrage.texte.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Noch keine.</p>
          ) : (
            <ul className="mt-2 space-y-2" data-umfrage-texte>
              {umfrage.texte.map((t, i) => (
                <li key={i} className="rounded-[12px] border border-line bg-surface px-3.5 py-2.5">
                  <p className="whitespace-pre-line text-sm leading-relaxed">{t.text}</p>
                  <p className="mt-1 text-[12px] text-ink-faint">
                    {datum(t.tag)}
                    {t.zufriedenheit ? ` · ${NOTEN.find((n) => n.wert === t.zufriedenheit)?.text ?? ""}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Balken({ titel, zeilen, max }: { titel: string; zeilen: { text: string; n: number }[]; max: number }) {
  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{titel}</p>
      <ul className="mt-2 space-y-1.5">
        {zeilen.map((z) => (
          <li key={z.text} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="truncate text-ink-muted">{z.text}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-ink/[0.06]">
              <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(z.n / max) * 100}%` }} />
            </span>
            <span className="tnum text-right font-semibold">{z.n}</span>
          </li>
        ))}
      </ul>
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
  wert: number | string;
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
