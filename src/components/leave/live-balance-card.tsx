import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDE, formatDays } from "@/lib/dates";
import type { LiveAfKonto, LiveLeaveBalance, LiveLeaveKindQuota, LiveVKonto } from "@/lib/types";
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
  vKonto,
}: {
  balance: LiveLeaveBalance | null;
  /** Angezeigtes Urlaubsjahr – für die Planung des kommenden Jahres. */
  year?: number;
  onYearChange?: (year: number) => void;
  /** Jahreskontingente der Sonderarten (für den Sonderurlaub). */
  quoten?: LiveLeaveKindQuota[] | null;
  /** Altersfreizeit als Stundenkonto; null = nicht freigeschaltet. */
  afKonto?: LiveAfKonto | null;
  /** V-Tage als Stundenkonto; null = V in Tagen geführt. */
  vKonto?: LiveVKonto | null;
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
      <CardBody className="space-y-3">
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

        {vKonto ? (
          <VStundenBlock konto={vKonto} />
        ) : (
          // V-Tage dürfen ins Minus – deshalb steht hier auch ein negativer
          // Stand, nicht 0.
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
            { label: "Verbraucht", wert: formatDays(balance.vUsedDays) },
            { label: "Beantragt", wert: formatDays(balance.vPendingDays) },
          ]}
        />
        )}

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
            kopf={`Stand heute ${formatStunden(afFrei.standStunden)} Std.`}
            wert={formatDays(Math.max(afFrei.verfuegbar, 0))}
            einheit="AF-Tage noch möglich"
            felder={[
              {
                label: `Stand ${formatDE(afFrei.freigeschaltetAb!)}`,
                wert: `${formatStunden(afFrei.startStunden)} Std.`,
              },
              {
                label: `+ ${afFrei.arbeitstage} Schichten`,
                wert: `${formatStunden(afFrei.stundenAngespart)} Std.`,
              },
              { label: "Genommen", wert: `${formatDays(afFrei.genommen)} × 8` },
              { label: "Eingeplant", wert: `${formatDays(afFrei.verplant)} × 8` },
            ]}
            fuss={
              <>
                Je gearbeiteter Schicht +0,83 Std., je AF-Tag −8 Std. Es zählt nur, was schon
                angespart ist.{" "}
                {afFrei.verfuegbar >= 0 ? (
                  <>
                    Bis zum nächsten AF-Tag fehlen noch{" "}
                    <span className="tnum font-semibold">
                      {formatStunden(Math.max(8 - afFrei.restStunden, 0))} Std.
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-warn-fg">
                    Die eingeplanten AF-Tage brauchen{" "}
                    {formatStunden(afFrei.verplant * 8 - afFrei.standStunden)} Std. mehr, als heute
                    angespart sind – neue AF-Tage gehen erst, wenn genug dazugekommen ist.
                  </span>
                )}
              </>
            }
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

const V_STUNDEN_JE_TAG = 7.5;

/** Stunden in ganze V-Tage – im Minus wird auf den angebrochenen Tag gerundet. */
function vTageAus(stunden: number): number {
  return stunden >= 0
    ? Math.floor(stunden / V_STUNDEN_JE_TAG + 1e-9)
    : -Math.ceil(-stunden / V_STUNDEN_JE_TAG - 1e-9);
}

/**
 * V-Tage aus dem Stundenkonto – in Tagen gezeigt, Stunden nur als Zusatz.
 *
 * Die Leiste zeigt jeden V-Tag als Kästchen: frei, schon eingeplant oder
 * (wenn mehr eingeplant ist als da) im Minus.
 */
function VStundenBlock({ konto }: { konto: LiveVKonto }) {
  const guthabenTage = vTageAus(konto.standHeute);
  const frei = konto.nochMoeglich;
  const eingeplant = konto.verplant;
  const imMinus = Math.max(eingeplant - Math.max(guthabenTage, 0), 0);
  const kaestchen = Math.max(guthabenTage, 0) + imMinus;

  return (
    <Kontoblock
      farbe="vtag"
      titel="V-Tage"
      untertitel="Freischichten"
      kopf={`Guthaben ${formatStunden(konto.standHeute)} Std.`}
      wert={formatDays(frei)}
      einheit={frei < 0 ? "V-Tage im Minus" : frei === 1 ? "V-Tag frei" : "V-Tage frei"}
      minus={frei < 0}
      extra={
        kaestchen > 0 && kaestchen <= 40 ? (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1" aria-hidden>
              {Array.from({ length: kaestchen }, (_, i) => {
                const art =
                  i < Math.max(guthabenTage - eingeplant, 0)
                    ? "frei"
                    : i < Math.max(guthabenTage, 0)
                      ? "geplant"
                      : "minus";
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-4 w-4 rounded-[3px] border",
                      art === "frei" && "border-shift-vtag bg-shift-vtag",
                      art === "geplant" && "border-shift-vtag bg-surface",
                      art === "minus" && "border-crit-fg bg-crit-bg",
                    )}
                  />
                );
              })}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-muted">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-shift-vtag" /> frei
              </span>
              {eingeplant > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-shift-vtag bg-surface" />{" "}
                  eingeplant
                </span>
              ) : null}
              {imMinus > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-crit-fg bg-crit-bg" /> im
                  Minus
                </span>
              ) : null}
            </p>
          </div>
        ) : null
      }
      felder={[
        {
          label: "Guthaben heute",
          wert: `${formatDays(guthabenTage)} ${Math.abs(guthabenTage) === 1 ? "Tag" : "Tage"}`,
          unter: `${formatStunden(konto.standHeute)} Std.`,
        },
        {
          label: "Eingeplant",
          wert: `${formatDays(eingeplant)} ${eingeplant === 1 ? "Tag" : "Tage"}`,
          unter: `${formatStunden(eingeplant * V_STUNDEN_JE_TAG)} Std.`,
        },
        {
          label: "Genommen",
          wert: `${formatDays(konto.genommen)} ${konto.genommen === 1 ? "Tag" : "Tage"}`,
          unter: `seit ${formatDE(konto.stichtag!)}`,
        },
      ]}
      fuss={
        <>
          Grundlage: {formatStunden(konto.startStunden)} Std. am {formatDE(konto.stichtag!)}, dazu{" "}
          {konto.arbeitstage} Schichten × 0,75 Std. (+{formatStunden(konto.angespart)} Std.). Ein
          V-Tag kostet 7,5 Std.
          {frei < 0 ? (
            <span className="font-medium text-crit-fg">
              {" "}
              Die eingeplanten V-Tage liegen{" "}
              {formatStunden(eingeplant * V_STUNDEN_JE_TAG - konto.standHeute)} Std. über dem
              Guthaben.
            </span>
          ) : null}
        </>
      }
    />
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
  extra,
  fuss,
}: {
  farbe: keyof typeof farben;
  titel: string;
  untertitel?: string;
  kopf: string;
  wert: string;
  einheit: string;
  minus?: boolean;
  felder: { label: string; wert: string; unter?: string }[];
  /** Steht zwischen der großen Zahl und den Feldern. */
  extra?: React.ReactNode;
  fuss?: React.ReactNode;
}) {
  const f = farben[farbe];
  return (
    <div className={cn("rounded-xl border border-l-4 border-line px-4 py-3", f.rand, f.grund)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className={cn("h-2.5 w-2.5 rounded-full", f.punkt)} aria-hidden />
          {titel}
          {untertitel ? (
            <span className="text-[12px] font-normal text-ink-faint">({untertitel})</span>
          ) : null}
        </span>
        <span className="tnum text-[12px] text-ink-muted">{kopf}</span>
      </div>

      <p className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            "tnum text-3xl font-semibold tracking-tight",
            minus && "text-crit-fg",
          )}
        >
          {wert}
        </span>
        <span className="text-sm text-ink-muted">{einheit}</span>
      </p>

      {extra}

      <dl
        className="mt-2.5 grid gap-2 text-center"
        style={{ gridTemplateColumns: `repeat(${Math.min(felder.length, 4)}, minmax(0, 1fr))` }}
      >
        {felder.map((feld) => (
          <div key={feld.label} className="rounded-lg bg-surface/80 px-1.5 py-1.5">
            <dt className="text-[11px] leading-tight text-ink-muted">{feld.label}</dt>
            <dd className="tnum mt-0.5 text-[15px] font-semibold">{feld.wert}</dd>
            {feld.unter ? (
              <dd className="tnum text-[11px] leading-tight text-ink-muted">{feld.unter}</dd>
            ) : null}
          </div>
        ))}
      </dl>
      {fuss ? <p className="mt-2 text-[12px] leading-snug text-ink-muted">{fuss}</p> : null}
    </div>
  );
}
