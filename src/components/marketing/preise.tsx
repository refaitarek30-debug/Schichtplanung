import { Check, Minus } from "lucide-react";
import { CtaLink, ZIELE } from "./cta";
import { cn } from "@/lib/utils";

/**
 * Preise für Betriebe (Pilotpreise). Beträge sind Bruttopreise inkl. 19 % USt,
 * der Nettobetrag steht klein darunter. Preise und Umfang stehen hier an
 * einer Stelle: PREISE, STUFEN und GRUPPEN.
 */
const UST = 1.19;
const EINRICHTUNG = 99;
/** Bei Jahreszahlung: 2 Monate geschenkt – 10 statt 12 Monate. */
const JAHRES_MONATE = 10;
const KOSTENLOS_BIS = 15;
const BEISPIEL = 40;

const PREISE = { start: 0, team: 2.49, komplett: 3.49 } as const;
type Stufe = keyof typeof PREISE;

const euro = (n: number) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const netto = (brutto: number) => Math.round((brutto / UST) * 100) / 100;

const STUFEN: { id: Stufe; name: string; fuer: string }[] = [
  { id: "start", name: "Start", fuer: `bis ${KOSTENLOS_BIS} Personen` },
  { id: "team", name: "Team", fuer: "jede Größe" },
  { id: "komplett", name: "Komplett", fuer: "jede Größe" },
];

type Wert = boolean | string;
const GRUPPEN: { titel: string; zeilen: { text: string; w: [Wert, Wert, Wert] }[] }[] = [
  {
    titel: "Planen",
    zeilen: [
      { text: "Schichtplan für Woche und Monat", w: [true, true, true] },
      { text: "Rotation für Schichtgruppen A bis E", w: [true, true, true] },
      { text: "Urlaub beantragen und genehmigen", w: [true, true, true] },
      { text: "Mein Kalender für jeden im Team", w: [true, true, true] },
      { text: "Mitteilungen", w: [true, true, true] },
    ],
  },
  {
    titel: "Besetzung",
    zeilen: [
      { text: "Mindest- und Sollbesetzung mit Ampel", w: [false, true, true] },
      { text: "Qualifikationen je Schicht", w: [false, true, true] },
      { text: "Anträge gegen die Besetzung prüfen", w: [false, true, true] },
    ],
  },
  {
    titel: "Mehr",
    zeilen: [
      { text: "Push-Erinnerungen und Kalender-Abo", w: [false, true, true] },
      { text: "Export des Plans", w: [false, true, true] },
      { text: "V-Tage und Altersfreizeit", w: [false, false, true] },
      { text: "Auswertung: Ausfall und Anwesenheit", w: [false, false, true] },
      { text: "Ausbildung", w: [false, false, true] },
      { text: "Änderungsprotokoll", w: [false, false, true] },
      { text: "Hilfe", w: ["E-Mail", "E-Mail", "bevorzugt"] },
    ],
  },
];

function Zelle({ w }: { w: Wert }) {
  if (typeof w === "string") return <span className="text-[13px] font-medium">{w}</span>;
  return w ? (
    <>
      <Check className="h-[18px] w-[18px] text-brand-600" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">enthalten</span>
    </>
  ) : (
    <>
      <Minus className="h-4 w-4 text-ink-faint/60" aria-hidden />
      <span className="sr-only">nicht enthalten</span>
    </>
  );
}

/* Spalten: auf dem Handy steht der Text über den drei Werten, breit links daneben. */
const RASTER = "grid grid-cols-3 md:grid-cols-[minmax(0,1fr)_repeat(3,10rem)]";

export function Preise() {
  return (
    <div>
      <div role="table" aria-label="Preise und Umfang der Stufen" className="glas overflow-hidden rounded-[28px]">
        {/* Kopf: Name und Preis */}
        <div role="row" className={cn(RASTER, "border-b border-[var(--glas-linie)]")}>
          <span role="columnheader" className="hidden md:block" />
          {STUFEN.map((s) => (
            <div
              key={s.id}
              role="columnheader"
              className={cn("px-2 pb-5 pt-6 text-center md:px-4", s.id === "komplett" && "bg-brand-500/[0.06]")}
            >
              <p className="text-[15px] font-semibold tracking-tight md:text-[17px]">{s.name}</p>
              <p className="tnum mt-2 text-[24px] font-semibold leading-none tracking-tight md:text-[32px]">
                {PREISE[s.id] === 0 ? "0 €" : euro(PREISE[s.id])}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-tight text-ink-muted md:text-[12.5px]">
                {PREISE[s.id] === 0 ? "kostenlos" : "pro Person und Monat"}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">{PREISE[s.id] === 0 ? s.fuer : `netto ${euro(netto(PREISE[s.id]))}`}</p>
              {PREISE[s.id] !== 0 ? <p className="mt-0.5 text-[11px] text-ink-faint">{s.fuer}</p> : null}
            </div>
          ))}
        </div>

        {GRUPPEN.map((g) => (
          <div key={g.titel} role="rowgroup">
            <div role="row" className="bg-ink/[0.03] px-4 py-2 md:px-6">
              <span role="rowheader" className="text-[12px] font-semibold text-ink-muted">
                {g.titel}
              </span>
            </div>
            {g.zeilen.map((z) => (
              <div key={z.text} role="row" className={cn(RASTER, "border-t border-[var(--glas-linie)] first:border-t-0")}>
                <span role="rowheader" className="col-span-3 px-4 pt-3 text-[14px] md:col-span-1 md:px-6 md:py-3.5 md:text-[15px]">
                  {z.text}
                </span>
                {z.w.map((w, i) => (
                  <span
                    key={i}
                    role="cell"
                    className={cn("flex items-center justify-center pb-3 pt-2 md:py-3.5", i === 2 && "bg-brand-500/[0.06]")}
                  >
                    <Zelle w={w} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* Beispiel */}
        <div role="row" className={cn(RASTER, "border-t border-[var(--glas-linie)] bg-ink/[0.03]")}>
          <span role="rowheader" className="col-span-3 px-4 pt-3.5 text-[14px] font-semibold md:col-span-1 md:px-6 md:py-4 md:text-[15px]">
            Beispiel: {BEISPIEL} Personen im Monat
          </span>
          {STUFEN.map((s) => (
            <span key={s.id} role="cell" className="tnum flex flex-col items-center justify-center pb-3.5 pt-2 text-center md:py-4">
              {s.id === "start" ? (
                <span className="text-[12.5px] text-ink-muted">nur bis {KOSTENLOS_BIS}</span>
              ) : (
                <>
                  <span className="text-[15px] font-semibold">{euro(BEISPIEL * PREISE[s.id])}</span>
                  <span className="text-[11px] text-ink-faint">netto {euro(netto(BEISPIEL * PREISE[s.id]))}</span>
                </>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          {
            titel: "Einrichtung",
            text: `Selbst einrichten ist kostenlos. Auf Wunsch übernehmen wir das für einmalig ${euro(EINRICHTUNG)}: Mitarbeiter anlegen, Plan übernehmen, kurze Einweisung.`,
          },
          {
            titel: "Jahreszahlung",
            text: `Bei Zahlung für ein Jahr im Voraus schenken wir dir 2 Monate. Du zahlst ${JAHRES_MONATE} statt 12.`,
          },
          {
            titel: "Privat kostenlos",
            text: "Der Schichtkalender für Privatpersonen bleibt kostenlos, ohne Abo und ohne Werbung.",
          },
        ].map((x) => (
          <div key={x.titel} className="glas rounded-[22px] p-5">
            <p className="text-[15px] font-semibold">{x.titel}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{x.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-ink-muted">
        Pilotpreise, Änderungen vorbehalten. Bruttopreise inkl. 19 % USt. Während der dreimonatigen Pilotphase nutzen Betriebe den vollen Umfang kostenlos.
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
