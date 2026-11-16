import { Building2, Check } from "lucide-react";
import { CtaLink, ZIELE } from "./cta";
import { cn } from "@/lib/utils";

/**
 * Preise für Betriebe: alle Funktionen für alle, der Preis richtet sich nur nach
 * der Größe des Teams. Beträge sind Nettopreise pro Monat zzgl. 19 % USt (der
 * Bruttobetrag steht klein darunter). Preise und Umfang stehen hier an einer
 * Stelle: PAKETE und ENTHALTEN.
 */
const UST = 1.19;
const EINRICHTUNG = 199;
/** Bei Jahreszahlung so viel Prozent günstiger – weiter monatlich kündbar. */
export const JAHRES_RABATT = 5;
const HAEUFIG_BIS = 30;
/** Anmeldung mit dem Firmen-Konto (SSO, SAML) – Zusatz für große Betriebe, netto. */
export const SSO = { ab: 50, einrichtung: 490, monat: 49 };

/** Bis zu so vielen Personen im Monat – Preis netto pro Monat. */
export const PAKETE: { bis: number; preis: number }[] = [
  // Je Stufe wird die Person etwa 5–7 % günstiger.
  { bis: 15, preis: 59 },
  { bis: 30, preis: 109 },
  { bis: 50, preis: 169 },
  { bis: 75, preis: 239 },
  { bis: 100, preis: 299 },
  { bis: 150, preis: 419 },
  { bis: 200, preis: 519 },
  { bis: 300, preis: 729 },
  { bis: 500, preis: 1149 },
];

const euro = (n: number, nachkomma = 2) =>
  `${n.toLocaleString("de-DE", { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma })} €`;
const jahresPreis = (preis: number) => Math.round(preis * 12 * (1 - JAHRES_RABATT / 100) * 100) / 100;

const ENTHALTEN: { titel: string; punkte: string[] }[] = [
  {
    titel: "Planen",
    punkte: [
      "Schichtplan für Woche und Monat",
      "Rotation für Schichtgruppen A bis E",
      "Urlaub beantragen und genehmigen",
      "Mein Kalender für jeden im Team",
      "Mitteilungen",
    ],
  },
  {
    titel: "Besetzung",
    punkte: ["Mindest- und Sollbesetzung mit Ampel", "Qualifikationen je Schicht", "Anträge gegen die Besetzung prüfen"],
  },
  {
    titel: "Mehr",
    punkte: [
      "Push-Erinnerungen und Kalender-Abo",
      "Export des Plans",
      "V-Tage und Altersfreizeit",
      "Auswertung: Ausfall und Anwesenheit",
      "Ausbildung",
      "Änderungsprotokoll",
      "Hilfe per E-Mail",
    ],
  },
];

export function Preise() {
  const beispiel = PAKETE.find((p) => p.bis === HAEUFIG_BIS) ?? PAKETE[0]!;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {/* Pakete nach Teamgröße */}
        <section aria-label="Pakete nach Teamgröße" className="glas overflow-hidden rounded-[28px]">
          <ul>
            {PAKETE.map((p, i) => {
              const haeufig = p.bis === HAEUFIG_BIS;
              return (
                <li
                  key={p.bis}
                  className={cn(
                    "flex items-center justify-between gap-3 px-5 py-3.5 md:px-6",
                    i > 0 && "border-t border-[var(--glas-linie)]",
                    haeufig && "bg-brand-500/[0.07]",
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
                      bis {p.bis} Personen
                      {haeufig ? (
                        <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white">Häufig</span>
                      ) : null}
                    </p>
                    <p className="tnum text-[13px] text-ink-muted">{euro(p.preis / p.bis)} pro Person</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-[22px] font-semibold leading-tight tracking-tight">{euro(p.preis, 0)}</p>
                    <p className="text-[12px] text-ink-muted">pro Monat, netto</p>
                    <p className="tnum text-[11px] text-ink-faint">brutto {euro(p.preis * UST)}</p>
                  </div>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 border-t border-[var(--glas-linie)] px-5 py-3.5 text-[14.5px] md:px-6">
              <span className="font-semibold">Mehr als {PAKETE[PAKETE.length - 1]!.bis} Personen</span>
              <span className="font-semibold text-brand-600">Preis auf Anfrage</span>
            </li>
          </ul>
        </section>

        {/* Was dabei ist */}
        <section aria-label="Das ist immer dabei" className="glas rounded-[28px] p-5 md:p-6">
          <p className="text-[16px] font-semibold tracking-tight">Immer dabei – bei jedem Paket</p>
          <div className="mt-3 space-y-4">
            {ENTHALTEN.map((g) => (
              <div key={g.titel}>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{g.titel}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {g.punkte.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[14.5px] leading-snug">
                      <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            titel: "Pilotphase",
            text: "Drei Monate kostenlos und unverbindlich. Danach monatlich kündbar – ohne Mindestlaufzeit.",
          },
          {
            titel: "Wächst euer Team?",
            text: "Gezählt wird der Monat mit den meisten Personen. Wird es mehr, gilt automatisch das nächste Paket.",
          },
          {
            titel: "Einrichtung",
            text: `Selbst einrichten ist kostenlos. Auf Wunsch übernehmen wir das für einmalig ${euro(EINRICHTUNG, 0)} netto – für Pilotbetriebe, die weitermachen, kostenlos.`,
          },
          {
            titel: "Jahreszahlung",
            text: `${JAHRES_RABATT} % günstiger, trotzdem monatlich kündbar – der Rest wird anteilig erstattet. Beispiel bis ${beispiel.bis} Personen: ${euro(jahresPreis(beispiel.preis))} statt ${euro(beispiel.preis * 12, 0)} im Jahr.`,
          },
        ].map((x) => (
          <div key={x.titel} className="glas rounded-[22px] p-5">
            <p className="text-[15px] font-semibold">{x.titel}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{x.text}</p>
          </div>
        ))}
      </div>

      <div className="glas mt-3 flex flex-col gap-3 rounded-[22px] p-5 sm:flex-row sm:items-center sm:gap-4" data-sso>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-500/10 text-brand-600" aria-hidden>
          <Building2 className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Zusatz ab {SSO.ab} Personen: Anmeldung mit dem Firmen-Konto (SSO)</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
            Euer Team meldet sich mit dem vorhandenen Firmen-Konto an (Microsoft Entra ID, Google Workspace, Okta). Eure IT verwaltet die Zugänge;
            wer geht, kommt nicht mehr hinein. Einrichtung gemeinsam mit eurer IT.
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="tnum text-[15px] font-semibold">{euro(SSO.einrichtung, 0)} einmalig</p>
          <p className="tnum text-[13px] text-ink-muted">+ {euro(SSO.monat, 0)} pro Monat, netto</p>
        </div>
      </div>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-muted">
        Alle Preise netto pro Monat, zzgl. 19 % USt. Änderungen vorbehalten. Der Schichtkalender für Privatpersonen bleibt kostenlos, ohne
        Abo und ohne Werbung.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <CtaLink href={ZIELE.demo} size="lg">
          Live-Demo starten
        </CtaLink>
        <CtaLink href={ZIELE.testen} size="lg" variant="secondary">
          Betrieb registrieren
        </CtaLink>
      </div>
    </div>
  );
}
