import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { fetchVjStand } from "@/lib/data/leave";
import { Skeleton } from "@/components/ui/skeleton";
import { afTageAusStand } from "@/lib/af";
import { formatDays, V_TAG_STUNDEN, vTageInStunden } from "@/lib/dates";
import type { LiveAfKonto, LiveLeaveBalance, LiveLeaveKindQuota, LiveVjStand } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBegriffe, useZeitausgleich } from "@/lib/begriffe";

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
  const t = useBegriffe();
  const za = useZeitausgleich();
  const jetzt = new Date().getFullYear();
  const jahre = [jetzt, jetzt + 1];
  // Ab 2027: wie viele der V-Tage VJ (fest) und wie viele V (widerrufbar) sind.
  const vjJahr = balance?.year ?? 0;
  const [vj, setVj] = useState<LiveVjStand | null>(null);
  useEffect(() => {
    let aus = false;
    if (vjJahr < 2027) {
      setVj(null);
      return;
    }
    fetchVjStand(vjJahr)
      .then((v) => !aus && setVj(v))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, [vjJahr, balance?.vPendingDays, balance?.vUsedDays]);

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
            // Beide Jahre als sichtbare Reiter: das kommende Konto soll man
            // sehen, ohne erst eine Auswahlliste zu öffnen.
            <div
              role="tablist"
              aria-label="Urlaubsjahr"
              className="inline-flex rounded-lg border border-line bg-surface-muted p-0.5"
            >
              {jahre.map((y) => {
                const aktiv = (year ?? balance.year) === y;
                return (
                  <button
                    key={y}
                    type="button"
                    role="tab"
                    aria-selected={aktiv}
                    onClick={() => onYearChange(y)}
                    className={cn(
                      "tnum rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors",
                      aktiv ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          ) : undefined
        }
      />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" data-konto-kacheln>
          <Kachel
            farbe="urlaub"
            titel="Urlaub"
            frei={balance.remainingDays}
            von={balance.entitlement + balance.carriedOver}
            zeilen={[
              ["genommen", balance.usedDays],
              ["geplant", balance.plannedDays],
              ["beantragt", balance.pendingDays],
            ]}
          />

          {/* Ohne Zeitausgleich im Betrieb gibt es kein V-Tage-Konto. Ab 2027 getrennt in VJ und V. */}
          {za && vj ? (
            <>
              <Kachel
                farbe="vj"
                titel="VJ-Tage"
                frei={vj.rest}
                von={vj.kontingent}
                zeilen={[["verplant", vj.belegt]]}
              />
              <Kachel
                farbe="vtag"
                titel="V-Tage"
                frei={balance.vRemainingDays - vj.rest}
                von={balance.vEntitlement + balance.vCarriedOver + balance.vKorrektur - vj.kontingent}
                zeilen={[
                  ["verplant", vj.vBelegt],
                  ...(balance.vFehlStunden > 0 ? ([["Fehlzeit Std.", -balance.vFehlStunden]] as [string, number][]) : []),
                ]}
                minusErlaubt
              />
            </>
          ) : za ? (
            <Kachel
              farbe="vtag"
              titel={t("V-Tage")}
              frei={balance.vRemainingDays}
              von={balance.vEntitlement + balance.vCarriedOver + balance.vKorrektur}
              zeilen={[
                ["genommen", balance.vUsedDays - balance.vFehlStunden / V_TAG_STUNDEN],
                ["beantragt", balance.vPendingDays],
                ...(balance.vFehlStunden > 0 ? ([["Fehlzeit Std.", -balance.vFehlStunden]] as [string, number][]) : []),
              ]}
              unten={`= ${vTageInStunden(balance.vRemainingDays)}`}
              minusErlaubt
            />
          ) : null}

          {sonderurlaub ? (
            <Kachel
              farbe="sonderurlaub"
              titel="Sonderurlaub"
              frei={sonderurlaub.rest}
              von={sonderurlaub.anspruch}
              zeilen={[["genommen", sonderurlaub.verbraucht]]}
            />
          ) : null}

          {afFrei ? (
            <Kachel
              farbe="altersfrei"
              titel="Altersfreizeit"
              frei={afTageAusStand(afFrei.standStunden)}
              von={null}
              zeilen={afGenommenJahr === null || afGenommenJahr === undefined ? [] : [[`genommen ${jetzt}`, afGenommenJahr]]}
              unten={`${formatStunden(afFrei.standStunden)} Std.`}
            />
          ) : null}
        </div>

        {/* Eine kurze Zeile statt Fließtext. */}
        <p className="text-[12px] leading-snug text-ink-muted" data-vj-legende={vj ? "" : undefined}>
          {vj ? (
            <>
              <b className="text-ink">VJ</b> fest wie Urlaub · <b className="text-ink">V</b> kann widerrufen werden · VJ wird zuerst genommen
              {za ? ` · 1 ${t("V-Tag")} = ${formatDays(V_TAG_STUNDEN)} Std.` : ""}
            </>
          ) : za ? (
            `1 ${t("V-Tag")} = ${formatDays(V_TAG_STUNDEN)} Std.`
          ) : null}
          {balance.carriedOver > 0 || balance.vCarriedOver > 0 ? ` · Übertrag verfällt am 31.03.${balance.year}` : ""}
        </p>
      </CardBody>
    </Card>
  );
}

function formatStunden(wert: number): string {
  return wert.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const farben = {
  urlaub: { balken: "bg-shift-urlaub", grund: "bg-shift-urlaub/10" },
  vj: { balken: "bg-[#6aa84f]", grund: "bg-[#b6d7a8]/20" },
  vtag: { balken: "bg-shift-vtag", grund: "bg-shift-vtag/10" },
  sonderurlaub: { balken: "bg-shift-sonderurlaub", grund: "bg-shift-sonderurlaub/10" },
  altersfrei: { balken: "bg-shift-altersfrei", grund: "bg-shift-altersfrei/10" },
} as const;

/**
 * Eine Kachel: oben der Name, groß die freien Tage, daneben „von N“, darunter
 * höchstens drei kurze Zahlen. Kein Fließtext.
 */
function Kachel({
  farbe,
  titel,
  frei,
  von,
  zeilen,
  unten,
  minusErlaubt = false,
}: {
  farbe: keyof typeof farben;
  titel: string;
  frei: number;
  von: number | null;
  zeilen: [string, number][];
  unten?: string;
  minusErlaubt?: boolean;
}) {
  const f = farben[farbe];
  const minus = frei < 0;
  const wert = minusErlaubt ? frei : Math.max(frei, 0);
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line", f.grund)} data-konto={farbe}>
      <div className={cn("h-1", f.balken)} aria-hidden />
      <div className="px-3 pb-2.5 pt-2">
        <p className="text-[12.5px] font-semibold text-ink-muted">{titel}</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className={cn("tnum text-[28px] font-bold leading-none tracking-tight", minus && "text-crit-fg")} data-konto-frei>
            {formatDays(wert)}
          </span>
          <span className="tnum text-[12.5px] text-ink-muted">{von !== null ? `frei von ${formatDays(von)}` : "frei"}</span>
        </p>
        {zeilen.length || unten ? (
          <dl className="tnum mt-1.5 space-y-0.5 text-[12px]">
            {zeilen.map(([label, zahl]) => (
              <div key={label} className="flex justify-between gap-2 text-ink-muted">
                <dt>{label}</dt>
                <dd className="font-semibold text-ink">{formatDays(zahl)}</dd>
              </div>
            ))}
            {unten ? <div className="text-ink-muted">{unten}</div> : null}
          </dl>
        ) : null}
      </div>
    </div>
  );
}
