import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDays } from "@/lib/dates";
import type { LiveLeaveBalance } from "@/lib/types";

/**
 * Urlaubskonto und V-Tage-Konto – beide gleich aufgebaut.
 *
 * Vorher standen die V-Tage als Fließtext daneben („4 von 33 · 29
 * genommen"), der Urlaub dagegen als Kästchenreihe. Zwei Darstellungen für
 * dieselbe Sache zwingen zum Umdenken; jetzt liest man beide gleich.
 *
 * Die Fortschrittsleiste ist raus: sie zeigte dieselben drei Zahlen noch
 * einmal, nur ungenauer – bei kleinen Werten waren die Segmente ohnehin
 * kaum zu unterscheiden.
 *
 * Alle Zahlen kommen unverändert aus `leave_balances_view`; hier wird
 * nichts nachgerechnet.
 */
export function LiveBalanceCard({
  balance,
  year,
  onYearChange,
}: {
  balance: LiveLeaveBalance | null;
  /** Angezeigtes Urlaubsjahr – für die Planung des kommenden Jahres. */
  year?: number;
  onYearChange?: (year: number) => void;
}) {
  const jetzt = new Date().getFullYear();
  const jahre = [jetzt - 1, jetzt, jetzt + 1];

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

  // Dieselbe Regel wie auf dem Dashboard: ohne V-Konto kein V-Block –
  // aber ein Konto, auf dem schon etwas gebucht wurde, bleibt sichtbar,
  // auch wenn der Anspruch nachträglich auf 0 gesetzt wurde.
  const hatVKonto =
    balance.vEntitlement > 0 ||
    balance.vCarriedOver > 0 ||
    balance.vUsedDays > 0 ||
    balance.vPendingDays > 0 ||
    balance.vRemainingDays !== 0;

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
      <CardBody className="space-y-4">
        <Kontoblock
          titel="Urlaub"
          anspruch={balance.entitlement}
          uebertrag={balance.carriedOver}
          rest={balance.remainingDays}
          verbraucht={balance.usedDays}
          geplant={balance.plannedDays}
          beantragt={balance.pendingDays}
        />

        {hatVKonto ? (
          <Kontoblock
            titel="V-Tage"
            untertitel="Freischichten"
            anspruch={balance.vEntitlement}
            uebertrag={balance.vCarriedOver}
            rest={balance.vRemainingDays}
            verbraucht={balance.vUsedDays}
            // Das V-Konto führt „verbraucht" und „geplant" nicht getrennt:
            // die Sicht zählt genommene V-Tage in einer Zahl. Sie hier
            // künstlich aufzuteilen wäre eine erfundene Genauigkeit.
            geplant={null}
            beantragt={balance.vPendingDays}
          />
        ) : null}

        {balance.carriedOver > 0 || balance.vCarriedOver > 0 ? (
          <p className="text-[12px] text-ink-muted">
            Übertragene Tage aus {balance.year - 1} verfallen am 31.03.{balance.year}.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Kontoblock({
  titel,
  untertitel,
  anspruch,
  uebertrag,
  rest,
  verbraucht,
  geplant,
  beantragt,
}: {
  titel: string;
  untertitel?: string;
  anspruch: number;
  uebertrag: number;
  rest: number;
  verbraucht: number;
  /** null, wenn das Konto geplant und verbraucht nicht trennt. */
  geplant: number | null;
  beantragt: number;
}) {
  const felder: { label: string; wert: number }[] = [
    { label: "Verbraucht", wert: verbraucht },
    ...(geplant !== null ? [{ label: "Geplant", wert: geplant }] : []),
    { label: "Beantragt", wert: beantragt },
  ];

  return (
    <div className="rounded-xl border border-line px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[15px] font-semibold tracking-tight">
          {titel}
          {untertitel ? (
            <span className="ml-1.5 text-[12px] font-normal text-ink-faint">({untertitel})</span>
          ) : null}
        </span>
        <span className="tnum text-[13px] text-ink-muted">
          {formatDays(anspruch)} Tage Jahresanspruch
          {uebertrag > 0 ? ` + ${formatDays(uebertrag)} Übertrag` : ""}
        </span>
      </div>

      <p className="mt-1 flex items-baseline gap-2">
        <span className="tnum text-3xl font-semibold tracking-tight">
          {formatDays(Math.max(rest, 0))}
        </span>
        <span className="text-sm text-ink-muted">Tage verfügbar</span>
      </p>

      <dl
        className="mt-3 grid gap-2 text-center"
        style={{ gridTemplateColumns: `repeat(${felder.length}, minmax(0, 1fr))` }}
      >
        {felder.map((feld) => (
          <div key={feld.label} className="rounded-lg bg-surface-muted px-2 py-2">
            <dt className="text-[12px] text-ink-muted">{feld.label}</dt>
            <dd className="tnum mt-0.5 text-base font-semibold">{formatDays(feld.wert)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
