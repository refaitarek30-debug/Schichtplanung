"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarHeart, Check, ChevronLeft, ChevronRight, Palmtree, Timer, Wallet } from "lucide-react";
import { nachOben } from "@/lib/app-scroller";
import { heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { rechne } from "@/lib/privat/gehalt";
import { STEUER_STANDARD, rechneAuszahlung } from "@/lib/privat/lohn";
import type { Reiter } from "@/lib/privat/reiter";
import { cn } from "@/lib/utils";
import { PrivatAuswertung } from "./auswertung";
import { PrivatGemeinsam } from "./gemeinsam";
import { PrivatGeld, useGehalt, useLohnDaten } from "./gehalt";
import { useLohn } from "./lohn";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";
import { PrivatSchichten } from "./schichten";
import { PrivatUrlaub, leseUrlaubEinst } from "./urlaub";

const std = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const euroGanz = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Mein Monat (Entwurf B): eine Karte für den Monat – Stunden mit Farbbalken je
 * Schicht (antippen = Übersicht) und Lohn (antippen = Lohn) –, darunter vier
 * Zeilen. „Meine Schichten“ und „Plan hochladen“ stehen unter „Mehr“.
 * Ein Eintrag öffnet den Bereich auf eigener Seite (`?reiter=…`), „Zurück“
 * führt wieder zur Liste – auch mit der Zurück-Geste des Handys.
 */
export function PrivatSchichtenSeite({ start = null }: { start?: Reiter | null }) {
  const reiter = start;
  useEffect(() => {
    nachOben("auto");
  }, [reiter]);
  if (reiter) {
    return (
      <div className="space-y-4">
        <Link
          href="/privat/schichten"
          className="-ml-1 inline-flex h-9 items-center gap-0.5 rounded-full pr-3 text-[15px] font-semibold text-brand-600"
          data-zurueck-schichten
        >
          <ChevronLeft className="h-5 w-5" /> Mein Monat
        </Link>
        <div data-bereich={reiter}>
          {reiter === "uebersicht" ? (
            <PrivatAuswertung eingebettet />
          ) : reiter === "liste" ? (
            <PrivatSchichten eingebettet />
          ) : reiter === "geld" ? (
            <PrivatGeld />
          ) : reiter === "urlaub" ? (
            <PrivatUrlaub eingebettet />
          ) : (
            <PrivatGemeinsam eingebettet />
          )}
        </div>
      </div>
    );
  }
  return <Startliste />;
}

function Startliste() {
  const { konto } = usePrivat();
  const heute = heuteInBerlin();
  const [monat, setMonat] = useState(() => new Date(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, 1));
  const { einst } = useGehalt(konto.userId);
  const { lohn } = useLohn(konto.userId);
  const von = toISO(new Date(monat.getFullYear(), monat.getMonth(), 1));
  const bis = toISO(new Date(monat.getFullYear(), monat.getMonth() + 1, 0));
  const { tage, arten: lohnArten, zeiten, feiertage } = useLohnDaten(von, bis, einst);

  const re = useMemo(() => {
    if (!tage || !lohnArten) return null;
    return rechne({ tage, von, bis, arten: lohnArten, feiertage, wochenstunden: konto.wochenstunden, einst, zeiten });
  }, [tage, zeiten, lohnArten, feiertage, konto.wochenstunden, einst, von, bis]);

  // Arbeitsschichten im Monat, je Schichtart gezählt (für den Farbbalken).
  const verteilung = useMemo(() => {
    if (!tage || !lohnArten) return [];
    const nach = new Map(lohnArten.filter((a) => a.art === "arbeit").map((a) => [a.id, a]));
    const zahl = new Map<string, number>();
    for (const [tag, e] of Object.entries(tage)) {
      if (tag < von || tag > bis) continue;
      for (const id of [e.schicht, e.zusatz, e.dritte]) if (id && nach.has(id)) zahl.set(id, (zahl.get(id) ?? 0) + 1);
    }
    return [...zahl.entries()]
      .map(([id, n]) => ({ id, anzahl: n, name: nach.get(id)!.name, farbe: nach.get(id)!.farbe }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }, [tage, lohnArten, von, bis]);
  const anzahlSumme = verteilung.reduce((s, v) => s + v.anzahl, 0);
  const anzahl = tage && lohnArten ? anzahlSumme : null;

  // Übrige Urlaubstage stehen nur auf diesem Gerät.
  const [urlaubTage, setUrlaubTage] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlaubTage(leseUrlaubEinst(konto.userId).tage);
  }, [konto.userId]);

  const mitGeld = re ? re.jobs.filter((j) => j.geld) : [];
  const monatKey = `${monat.getFullYear()}-${String(monat.getMonth() + 1).padStart(2, "0")}`;
  // Genau wie auf der Lohn-Seite: derselbe Monat, mit den Extras dieses Monats.
  const extras = lohn.extras?.monat === monatKey ? lohn.extras : null;
  const auszahlung = re && mitGeld.length ? rechneAuszahlung(re, lohn.steuer ?? STEUER_STANDARD, extras, konto.bundesland) : null;
  // Der echte Betrag von der Abrechnung ersetzt die Schätzung, sobald er eingetragen ist.
  const echt = lohn.monate[monatKey]?.echt ?? null;
  const lohnWert = echt ?? auszahlung?.netto ?? null;
  // Erst Text zeigen, wenn alles geladen ist: Safari malt sich ändernden Text
  // unter Glasflächen sonst übereinander (alter Text bleibt stehen).
  const bereit = re !== null;

  const springe = (s: number) => setMonat((m) => new Date(m.getFullYear(), m.getMonth() + s, 1));
  const monatKurz = `${monthName(monat.getMonth()).slice(0, 3)} ${monat.getFullYear()}`;

  const soll = re?.soll ?? null;
  const diff = re?.differenz ?? null;
  const ist = re?.ist ?? 0;

  const lohnZeile = (
    <Link
      href={`/privat/schichten?reiter=geld&monat=${monatKey}`}
      className="glas-linie flex items-end justify-between gap-3 border-t px-4 pb-3.5 pt-3 active:bg-ink/[0.04]"
      data-monat-lohn
    >
      <div className="min-w-0">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">Lohn</div>
        <div className="tnum mt-0.5 text-[28px] font-bold leading-none tracking-[-0.02em]">
          {lohnWert !== null ? euroGanz(lohnWert) : bereit ? <span className="text-[15px] font-semibold text-brand-600">Lohn einrichten</span> : "…"}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {echt !== null ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[11.5px] font-bold text-ok-fg">
              <Check className="h-3 w-3" strokeWidth={3} /> ausgezahlt
            </span>
            {auszahlung ? <div className="tnum mt-0.5 text-[12.5px] text-ink-muted">geschätzt {euroGanz(auszahlung.netto)}</div> : null}
          </>
        ) : auszahlung ? (
          <div className="text-[12.5px] text-ink-muted">{auszahlung.mitSteuer ? "Auszahlung ca." : "wird ausgezahlt"}</div>
        ) : null}
      </div>
    </Link>
  );

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Mein Monat"
        rechts={
          <div className="glas flex items-center rounded-full p-1" role="group" aria-label="Monat">
            <button type="button" aria-label="Vorheriger Monat" onClick={() => springe(-1)} className="grid h-8 w-8 place-items-center rounded-full text-ink-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tnum min-w-[4.8rem] text-center text-[14px] font-semibold" data-monat>
              {monatKurz}
            </span>
            <button type="button" aria-label="Nächster Monat" onClick={() => springe(1)} className="grid h-8 w-8 place-items-center rounded-full text-ink-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {re && anzahl === 0 && ist === 0 ? (
        // Leerer Monat: statt „0 Std“ ein klarer Hinweis mit dem nächsten Schritt.
        <section className="glas glas-ruhig overflow-hidden rounded-[24px]" data-stunden-karte data-schichten-leer>
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Noch keine Schichten im {monthName(monat.getMonth())}</div>
              <div className="text-[12.5px] text-ink-muted">Trag deine Schichtfolge ein – dann füllt sich der Kalender von selbst.</div>
            </div>
            <Link href="/privat" className="shrink-0 rounded-full bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white">
              Zum Kalender
            </Link>
          </div>
          {/* Festes Gehalt gibt es auch ohne Schichten. */}
          {lohnWert !== null ? lohnZeile : null}
        </section>
      ) : (
        // Eine Karte erzählt den Monat: Stunden (antippen = Übersicht) und Lohn (antippen = Lohn).
        <section className="glas glas-ruhig overflow-hidden rounded-[24px]" data-stunden-karte data-monatskarte>
          <Link href="/privat/schichten?reiter=uebersicht" className="block space-y-2.5 px-4 pb-3.5 pt-3.5 active:bg-ink/[0.04]" data-monat-stunden>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">Gearbeitet</div>
                <div className="tnum mt-0.5 text-[36px] font-bold leading-none tracking-[-0.02em]">
                  {re ? std(ist) : "…"} <span className="text-[17px] font-semibold text-ink-muted">Std</span>
                </div>
              </div>
              <div className="text-right">
                {diff !== null ? (
                  <div className={cn("tnum text-[16px] font-bold", diff > 0.05 ? "text-warn-fg" : "text-ink-muted")}>
                    {diff > 0.05 ? "+" : ""}
                    {std(Math.abs(diff) < 0.05 ? 0 : diff)} Std
                  </div>
                ) : null}
                <div className="tnum text-[12.5px] text-ink-muted">
                  {soll !== null ? `Soll ${std(soll)}` : bereit && anzahl !== null ? `${anzahl} Schichten` : ""}
                </div>
              </div>
            </div>
            {/* Balken: Anteil je Schicht (Früh, Spät, Nacht …) in deren Farbe. */}
            {verteilung.length ? (
              <>
                <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
                  {verteilung.map((v) => (
                    <span key={v.id} className="h-full" style={{ width: `${(v.anzahl / anzahlSumme) * 100}%`, backgroundColor: v.farbe }} />
                  ))}
                </div>
                <div className="tnum flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-muted" data-monat-verteilung>
                  {verteilung.map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.farbe }} />
                      {v.anzahl} {v.name}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            {soll === null && bereit ? (
              <p className="text-[12.5px] text-ink-muted">Wochenstunden unter Mehr eintragen, dann siehst du hier deine Überstunden.</p>
            ) : null}
          </Link>
          {lohnZeile}
        </section>
      )}

      <Gruppe>
        <Eintrag
          href={`/privat/schichten?reiter=geld&monat=${monatKey}`}
          icon={<Wallet className="h-[18px] w-[18px]" />}
          farbe="bg-ok-bg text-ok-fg"
          name="Lohn & Steuer"
          unter="Abrechnung, Jahr"
        />
        <Eintrag
          href="/privat/schichten?reiter=urlaub"
          icon={<Palmtree className="h-[18px] w-[18px]" />}
          farbe="bg-[rgb(124_77_214/0.15)] text-[rgb(124_77_214)]"
          name="Urlaub planen"
          unter="Brückentage finden"
          wert={bereit && urlaubTage !== null ? `${urlaubTage} Tage` : undefined}
        />
        <Eintrag
          href="/privat/countdown"
          icon={<Timer className="h-[18px] w-[18px]" />}
          farbe="bg-[rgb(20_184_166/0.15)] text-[rgb(13_148_136)]"
          name="Countdown"
          unter="Bis zur nächsten Schicht"
        />
        <Eintrag
          href="/privat/schichten?reiter=gemeinsam"
          icon={<CalendarHeart className="h-[18px] w-[18px]" />}
          farbe="bg-[rgb(214_64_159/0.15)] text-[rgb(184_50_137)]"
          name="Gemeinsam frei"
          unter="Wann habt ihr beide frei?"
        />
      </Gruppe>
    </div>
  );
}

function Gruppe({ children }: { children: ReactNode }) {
  return <nav className="glas glas-ruhig divide-y divide-line overflow-hidden rounded-[22px]">{children}</nav>;
}

function Eintrag({
  href,
  icon,
  farbe,
  name,
  unter,
  wert,
}: {
  href: string;
  icon: ReactNode;
  farbe: string;
  name: string;
  unter: string;
  wert?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 active:bg-ink/[0.04]" data-eintrag={name}>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[11px]", farbe)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-tight">{name}</span>
        <span className="block min-h-[1.1em] truncate text-[12.5px] text-ink-muted">{unter || "\u00a0"}</span>
      </span>
      {wert ? <span className="tnum shrink-0 text-[15px] font-semibold">{wert}</span> : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </Link>
  );
}

