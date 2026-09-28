import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { afTageAusStand } from "@/lib/af";
import { formatDays } from "@/lib/dates";
import type { LiveAfKonto, LiveLeaveBalance, LiveLeaveKindQuota } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Das Urlaubskonto: Urlaub, V-Tage, Sonderurlaub und Altersfreizeit.
 *
 * Jedes Konto hat die Farbe, mit der die Art auch im Schichtplan steht –
 * so erkennt man auf einen Blick, welcher Block zu welchem Kürzel gehört.
 *
 * Sonderurlaub und Altersfreizeit erscheinen nur bei denen, die dafür
 * freigeschaltet sind. Vergangene Jahre stehen nicht mehr zur Auswahl.
 *
 * Alle Zahlen kommen aus der Datenbank; hier wird nichts nachgerechnet.
 */
export function LiveBalanceCard({
  balance,
  year,
  onYearChange,
  quoten,
  afKonto,
  afGenommenJahr,
}: {
  balance: LiveLeaveBalance | null;
  /** Angezeigtes Urlaubsjahr – für die Planung des kommenden Jahres. */
  year?: number;
  onYearChange?: (year: number) => void;
  /** Jahreskontingente der Sonderarten (für den Sonderurlaub). */
  quoten?: LiveLeaveKindQuota[] | null;
  /** Altersfreizeit als Stundenkonto; null = nicht freigeschaltet. */
  afKonto?: LiveAfKonto | null;
  /** Im laufenden Jahr schon genommene AF-Tage; null = unbekannt. */
  afGenommenJahr?: number | null;
}) {
  const jetzt = new Date().getFullYear();
  const jahre = [jetzt, jetzt + 1];

  if (!balance) {
    return (
      <Card>
        <CardHeader title="Urlaubskonto" />
        <CardBody className="space-y-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardBody>
      </Card>
    );
  }

  const sonderurlaub = quoten?.find((q) => q.kind === "sonderurlaub" && q.erlaubt) ?? null;
  const afFrei = afKonto && afKonto.freigeschaltetAb ? afKonto : null;

  return (
    <Card>
      <CardHeader
        title="Urlaubskonto"
        hint={`Jahr ${balance.year}`}
        action={
          onYearChange ? (
            <select
              value={year ?? balance.year}
              onChange={(e) => onYearChange(Number(e.target.value))}
              aria-label="Urlaubsjahr"
              className="tnum rounded-lg border border-line bg-surface px-2 py-1 text-[13px]"
            >
              {jahre.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />
      <CardBody className="space-y-2">
        <Kontoblock
          farbe="urlaub"
          titel="Urlaub"
          kopf={`${formatDays(balance.entitlement)} Tage Jahresanspruch${
            balance.carriedOver > 0 ? ` + ${formatDays(balance.carriedOver)} Übertrag` : ""
          }`}
          wert={formatDays(Math.max(balance.remainingDays, 0))}
          einheit="Tage verfügbar"
          felder={[
            { label: "Verbraucht", wert: formatDays(balance.usedDays) },
            { label: "Geplant", wert: formatDays(balance.plannedDays) },
            { label: "Beantragt", wert: formatDays(balance.pendingDays) },
          ]}
        />

        {/* V-Tage in Tagen. Sie dürfen ins Minus – deshalb steht hier auch
            ein negativer Stand, nicht 0. */}
        <Kontoblock
          farbe="vtag"
          titel="V-Tage"
          untertitel="Freischichten"
          kopf={`${formatDays(balance.vEntitlement)} Tage Jahresanspruch${
            balance.vCarriedOver > 0 ? ` + ${formatDays(balance.vCarriedOver)} Übertrag` : ""
          }`}
          wert={formatDays(balance.vRemainingDays)}
          einheit={balance.vRemainingDays < 0 ? "Tage im Minus" : "Tage verfügbar"}
          minus={balance.vRemainingDays < 0}
          felder={[
            ...(balance.vKorrektur !== 0
              ? [
                  {
                    label: balance.vKorrektur > 0 ? "Hinzugefügt" : "Abgezogen",
                    wert: `${balance.vKorrektur > 0 ? "+" : "−"}${formatDays(Math.abs(balance.vKorrektur))}`,
                  },
                ]
              : []),
            { label: "Verbraucht", wert: formatDays(balance.vUsedDays) },
            { label: "Beantragt", wert: formatDays(balance.vPendingDays) },
          ]}
        />

        {sonderurlaub ? (
          <Kontoblock
            farbe="sonderurlaub"
            titel="Sonderurlaub"
            kopf={`${formatDays(sonderurlaub.anspruch)} Tage im Jahr`}
            wert={formatDays(Math.max(sonderurlaub.rest, 0))}
            einheit="Tage verfügbar"
            felder={[
              { label: "Genommen/beantragt", wert: formatDays(sonderurlaub.verbraucht) },
            ]}
          />
        ) : null}

        {afFrei ? (
          <Kontoblock
            farbe="altersfrei"
            titel="Altersfreizeit"
            untertitel="AF"
            kopf={`${formatStunden(afFrei.standStunden)} Std. angespart`}
            wert={formatDays(afTageAusStand(afFrei.standStunden))}
            einheit="Tage verfügbar"
            felder={[
              {
                label: `Genommen ${jetzt}`,
                wert: afGenommenJahr === null || afGenommenJahr === undefined ? "–" : formatDays(afGenommenJahr),
              },
            ]}
          />
        ) : null}

        {balance.carriedOver > 0 || balance.vCarriedOver > 0 ? (
          <p className="text-[12px] text-ink-muted">
            Übertragene Tage verfallen am 31.03.{balance.year}.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function formatStunden(wert: number): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const farben = {
  urlaub: { rand: "border-l-shift-urlaub", grund: "bg-shift-urlaub/10", punkt: "bg-shift-urlaub" },
  vtag: { rand: "border-l-shift-vtag", grund: "bg-shift-vtag/10", punkt: "bg-shift-vtag" },
  sonderurlaub: {
    rand: "border-l-shift-sonderurlaub",
    grund: "bg-shift-sonderurlaub/10",
    punkt: "bg-shift-sonderurlaub",
  },
  altersfrei: {
    rand: "border-l-shift-altersfrei",
    grund: "bg-shift-altersfrei/10",
    punkt: "bg-shift-altersfrei",
  },
} as const;

function Kontoblock({
  farbe,
  titel,
  untertitel,
  kopf,
  wert,
  einheit,
  minus = false,
  felder,
  fuss,
}: {
  farbe: keyof typeof farben;
  titel: string;
  untertitel?: string;
  kopf: string;
  wert: string;
  einheit: string;
  minus?: boolean;
  felder: { label: string; wert: string }[];
  fuss?: React.ReactNode;
}) {
  const f = farben[farbe];
  // Kompakt: links Art und Anspruch, rechts der Stand groß, darunter die
  // Einzelwerte als eine Zeile statt als Kästchenraster.
  return (
    <div className={cn("rounded-xl border border-l-4 border-line px-3 py-2", f.rand, f.grund)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold tracking-tight">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", f.punkt)} aria-hidden />
            {titel}
            {untertitel ? (
              <span className="text-[11px] font-normal text-ink-faint">({untertitel})</span>
            ) : null}
          </p>
          <p className="tnum truncate text-[11px] text-ink-muted">{kopf}</p>
        </div>
        <p className="shrink-0 text-right leading-none">
          <span
            className={cn("tnum text-2xl font-semibold tracking-tight", minus && "text-crit-fg")}
          >
            {wert}
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-muted">{einheit}</span>
        </p>
      </div>

      <dl className="tnum mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-muted">
        {felder.map((feld) => (
          <div key={feld.label} className="flex gap-1">
            <dt>{feld.label}</dt>
            <dd className="font-semibold text-ink">{feld.wert}</dd>
          </div>
        ))}
      </dl>
      {fuss ? <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{fuss}</p> : null}
    </div>
  );
}
