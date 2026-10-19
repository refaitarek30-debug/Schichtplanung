import { Check, Minus } from "lucide-react";
import { CtaLink, ZIELE } from "./cta";

/**
 * Pilotpreise für Betriebe. Alle Beträge sind Bruttopreise (inkl. 19 % USt),
 * der Nettobetrag steht daneben. Hier steht der Satz an einer Stelle –
 * Preise und Umfang je Stufe lassen sich unten in PREISE und ZEILEN ändern.
 */
const UST = 1.19;
const EINRICHTUNG = 99;
/** Bei Jahreszahlung werden 1,5 Monate geschenkt. */
const JAHRES_MONATE = 10.5;

const PREISE = { team: 1, komplett: 1.5 } as const;

const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const netto = (brutto: number) => Math.round((brutto / UST) * 100) / 100;

const STUFEN = [
  {
    id: "start",
    name: "Start",
    wer: "Bis 15 Personen",
    preis: "kostenlos",
    hinweis: "Dauerhaft, du richtest alles selbst ein",
  },
  {
    id: "team",
    name: "Team",
    wer: "Ab 16 Personen",
    preis: `${euro(PREISE.team)}`,
    hinweis: `pro Person und Monat · netto ${euro(netto(PREISE.team))}`,
  },
  {
    id: "komplett",
    name: "Komplett",
    wer: "Ab 16 Personen",
    preis: `${euro(PREISE.komplett)}`,
    hinweis: `pro Person und Monat · netto ${euro(netto(PREISE.komplett))}`,
    hervorgehoben: true,
  },
] as const;

/** ja = enthalten, sonst nicht */
const ZEILEN: { text: string; start: boolean; team: boolean; komplett: boolean }[] = [
  { text: "Schichtplan, Mein Kalender, Urlaub beantragen und genehmigen", start: true, team: true, komplett: true },
  { text: "Mitteilungen", start: true, team: true, komplett: true },
  { text: "Besetzungsprüfung (Mindest- und Sollbesetzung, Qualifikationen)", start: false, team: true, komplett: true },
  { text: "Export des Plans, Push-Erinnerungen, Kalender-Abo", start: false, team: true, komplett: true },
  { text: "Auswertung (Ausfall, Anwesenheit), Altersfreizeit und V-Tage, Ausbildung", start: false, team: false, komplett: true },
  { text: "Änderungsprotokoll, bevorzugter Support", start: false, team: false, komplett: true },
];

const BEISPIELE = [20, 40, 100];

function Haken({ an }: { an: boolean }) {
  return an ? (
    <>
      <Check className="mx-auto h-4 w-4 text-ok-fg" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">enthalten</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto h-4 w-4 text-ink-faint" aria-hidden />
      <span className="sr-only">nicht enthalten</span>
    </>
  );
}

export function Preise() {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
        {STUFEN.map((s) => (
          <div
            key={s.id}
            className={
              "rounded-[24px] border p-6 " +
              ("hervorgehoben" in s && s.hervorgehoben ? "border-brand-500 bg-surface shadow-sm" : "border-line bg-surface")
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">{s.wer}</p>
            <h3 className="mt-2 text-[22px] font-semibold tracking-tight">{s.name}</h3>
            <p className="tnum mt-3 text-[34px] font-semibold leading-none tracking-tight">{s.preis}</p>
            <p className="mt-2 text-[13px] text-ink-muted">{s.hinweis}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 relative min-w-0 overflow-x-auto rounded-[24px] border border-line bg-surface">
        <table className="w-full text-left text-[14px]">
          <caption className="sr-only">Was in welcher Stufe enthalten ist</caption>
          <thead>
            <tr className="border-b border-line text-[12.5px] uppercase tracking-wider text-ink-muted">
              <th scope="col" className="px-4 py-3 font-semibold sm:px-5">
                Funktion
              </th>
              {STUFEN.map((s) => (
                <th key={s.id} scope="col" className="w-[3.6rem] px-1 py-3 text-center text-[11px] font-semibold sm:w-24 sm:px-3 sm:text-[12.5px]">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ZEILEN.map((z) => (
              <tr key={z.text}>
                <th scope="row" className="px-4 py-3 text-[13.5px] font-medium sm:px-5 sm:text-[14px]">
                  {z.text}
                </th>
                <td className="px-1 py-3 text-center sm:px-3">
                  <Haken an={z.start} />
                </td>
                <td className="px-1 py-3 text-center sm:px-3">
                  <Haken an={z.team} />
                </td>
                <td className="px-1 py-3 text-center sm:px-3">
                  <Haken an={z.komplett} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-[13px] font-semibold text-ink-muted">Beispiele (inkl. USt, netto in Klammern)</h3>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        {BEISPIELE.map((n) => {
          const team = n * PREISE.team;
          const komplett = n * PREISE.komplett;
          const jahr = komplett * JAHRES_MONATE;
          const zeilen: [string, number][] = [
            ["Team, pro Monat", team],
            ["Komplett, pro Monat", komplett],
            ["Komplett, pro Jahr", jahr],
          ];
          return (
            <div key={n} className="rounded-[20px] border border-line bg-surface p-5">
              <p className="text-[17px] font-semibold tracking-tight">{n} Personen</p>
              <dl className="tnum mt-3 space-y-2.5 text-[14px]">
                {zeilen.map(([name, wert]) => (
                  <div key={name}>
                    <dt className="text-[12.5px] text-ink-muted">{name}</dt>
                    <dd className="font-medium">
                      {euro(wert)} <span className="font-normal text-ink-muted">({euro(netto(wert))})</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-[24px] border border-line bg-surface-muted p-6 text-[14px] leading-relaxed">
        <p className="font-semibold">Dazu</p>
        <ul className="mt-2 space-y-2 text-ink-muted">
          <li>
            <strong className="text-ink">Einrichtung einmalig {euro(EINRICHTUNG)}</strong> (netto {euro(netto(EINRICHTUNG))}): Mitarbeiter anlegen, Plan übernehmen,
            Einweisung.
          </li>
          <li>
            <strong className="text-ink">Jahreszahlung:</strong> bei Zahlung im Voraus schenken wir 1,5 Monate. Du zahlst also {JAHRES_MONATE.toString().replace(".", ",")} statt 12
            Monate.
          </li>
          <li>Privatkonten mit dem eigenen Schichtkalender bleiben kostenlos.</li>
        </ul>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-ink-muted">
        Pilotpreise, Änderungen vorbehalten. Alle Preise sind Bruttopreise inklusive 19 % Umsatzsteuer, der Nettobetrag steht daneben. Pilotbetriebe
        bekommen bis zum Start der Stufen den vollen Umfang.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <CtaLink href={ZIELE.demo} size="lg">
          Live-Demo starten
        </CtaLink>
        <CtaLink href={ZIELE.testen} size="lg" variant="secondary">
          Kostenlos testen
        </CtaLink>
      </div>
    </div>
  );
}
