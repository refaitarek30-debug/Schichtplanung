"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, CalendarHeart, ChevronLeft, ChevronRight, Layers, Palmtree, Sparkles, Upload, Wallet } from "lucide-react";
import { nachOben } from "@/lib/app-scroller";
import { heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { rechne } from "@/lib/privat/gehalt";
import type { Reiter } from "@/lib/privat/reiter";
import { cn } from "@/lib/utils";
import { PrivatAuswertung } from "./auswertung";
import { PrivatGemeinsam } from "./gemeinsam";
import { PrivatGeld, useGehalt, useMonatsDaten } from "./gehalt";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";
import { PrivatSchichten } from "./schichten";
import { PrivatUrlaub, leseUrlaubEinst } from "./urlaub";

const std = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const euroGanz = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Schichten: oben die Stunden des Monats groß, darunter eine ruhige Liste
 * (Übersicht, Geld, Urlaub, Gemeinsam frei · Meine Schichten, Plan hochladen).
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
          <ChevronLeft className="h-5 w-5" /> Schichten
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
  const { konto, schichtarten } = usePrivat();
  const heute = heuteInBerlin();
  const [monat, setMonat] = useState(() => new Date(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, 1));
  const { einst } = useGehalt(konto.userId);
  const von = toISO(new Date(monat.getFullYear(), monat.getMonth(), 1));
  const bis = toISO(new Date(monat.getFullYear(), monat.getMonth() + 1, 0));
  const { tage, zeiten, feiertage } = useMonatsDaten(von, bis);

  const re = useMemo(() => {
    if (!tage || !schichtarten) return null;
    return rechne({ tage, von, bis, arten: schichtarten, feiertage, wochenstunden: konto.wochenstunden, einst, zeiten });
  }, [tage, zeiten, schichtarten, feiertage, konto.wochenstunden, einst, von, bis]);

  // Anzahl der Arbeitsschichten im Monat.
  const anzahl = useMemo(() => {
    if (!tage || !schichtarten) return null;
    const arbeit = new Set(schichtarten.filter((a) => a.art === "arbeit").map((a) => a.id));
    let n = 0;
    for (const e of Object.values(tage)) for (const id of [e.schicht, e.zusatz, e.dritte]) if (id && arbeit.has(id)) n += 1;
    return n;
  }, [tage, schichtarten]);

  // Übrige Urlaubstage stehen nur auf diesem Gerät.
  const [urlaubTage, setUrlaubTage] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlaubTage(leseUrlaubEinst(konto.userId).tage);
  }, [konto.userId]);

  const mitGeld = re ? re.jobs.filter((j) => j.geld) : [];
  const geldUnter =
    mitGeld.length > 1
      ? `${mitGeld.length} Jobs zusammen`
      : mitGeld[0]
        ? `${mitGeld[0].job.name}, ${mitGeld[0].job.art === "minijob" ? "ausgezahlt" : "brutto"}`
        : "Lohn je Job einrichten";
  // Erst Text zeigen, wenn alles geladen ist: Safari malt sich ändernden Text
  // unter Glasflächen sonst übereinander (alter Text bleibt stehen).
  const bereit = re !== null;

  const springe = (s: number) => setMonat((m) => new Date(m.getFullYear(), m.getMonth() + s, 1));
  const monatKurz = `${monthName(monat.getMonth()).slice(0, 3)} ${monat.getFullYear()}`;

  const soll = re?.soll ?? null;
  const diff = re?.differenz ?? null;
  const ist = re?.ist ?? 0;
  const anteilIst = soll && soll > 0 ? Math.min(100, (Math.min(ist, soll) / Math.max(ist, soll)) * 100) : 100;

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Schichten"
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

      <section className="glas glas-ruhig space-y-3 rounded-[24px] px-4 pb-4 pt-3.5" data-stunden-karte>
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
              {soll !== null ? `Soll ${std(soll)}` : anzahl !== null ? `${anzahl} Schichten` : ""}
            </div>
          </div>
        </div>
        {soll !== null ? (
          <div className="flex h-2 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
            <span className="h-full bg-brand-500" style={{ width: `${diff !== null && diff > 0 ? anteilIst : Math.min(100, (ist / soll) * 100)}%` }} />
            {diff !== null && diff > 0.05 ? <span className="h-full bg-warn-dot" style={{ width: `${100 - anteilIst}%` }} /> : null}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-muted">
            Wochenstunden unter{" "}
            <Link href="/privat/mehr" className="font-semibold text-brand-600">
              Mehr
            </Link>{" "}
            eintragen, dann siehst du hier deine Überstunden.
          </p>
        )}
      </section>

      <Gruppe>
        <Eintrag
          href="/privat/schichten?reiter=uebersicht"
          icon={<BarChart3 className="h-[18px] w-[18px]" />}
          farbe="bg-brand-500/15 text-brand-600"
          name="Übersicht"
          unter={bereit && anzahl !== null ? `${anzahl} Schichten im ${monthName(monat.getMonth())}` : ""}
        />
        <Eintrag
          href="/privat/schichten?reiter=geld"
          icon={<Wallet className="h-[18px] w-[18px]" />}
          farbe="bg-ok-bg text-ok-fg"
          name="Geld"
          unter={bereit ? geldUnter : ""}
          wert={re?.summe != null ? euroGanz(re.summe) : undefined}
        />
        <Eintrag
          href="/privat/schichten?reiter=urlaub"
          icon={<Palmtree className="h-[18px] w-[18px]" />}
          farbe="bg-[rgb(124_77_214/0.15)] text-[rgb(124_77_214)]"
          name="Urlaubsplaner"
          unter="Brückentage · Urlaubstage im Jahr"
          wert={bereit && urlaubTage !== null ? `${urlaubTage} Tage` : undefined}
        />
        <Eintrag
          href="/privat/zahlen"
          icon={<Sparkles className="h-[18px] w-[18px]" />}
          farbe="bg-[rgb(47_91_234/0.15)] text-[rgb(47_91_234)]"
          name="Meine Zahlen"
          unter="Sonntage · Nächte · dein Jahr"
        />
        <Eintrag
          href="/privat/schichten?reiter=gemeinsam"
          icon={<CalendarHeart className="h-[18px] w-[18px]" />}
          farbe="bg-[rgb(214_64_159/0.15)] text-[rgb(184_50_137)]"
          name="Gemeinsam frei"
          unter="Wann habt ihr beide frei?"
        />
      </Gruppe>

      <Gruppe>
        <Eintrag
          href="/privat/schichten?reiter=liste"
          icon={<Layers className="h-[18px] w-[18px]" />}
          farbe="bg-ink/[0.07] text-ink-muted"
          name="Meine Schichten"
          unter={bereit && schichtarten ? `${schichtarten.length} Schichten · Farben, Zeiten` : ""}
        />
        <Eintrag
          href="/privat/import"
          icon={<Upload className="h-[18px] w-[18px]" />}
          farbe="bg-warn-bg text-warn-fg"
          name="Plan hochladen"
          unter="Screenshot oder .ics-Datei"
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

