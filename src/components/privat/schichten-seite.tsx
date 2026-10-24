"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarHeart, Layers, BarChart3, Palmtree, Upload, Wallet } from "lucide-react";
import { heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { ladeFeiertage, ladeTage, type TagEintrag } from "@/lib/privat/daten";
import { rechne } from "@/lib/privat/gehalt";
import type { Reiter } from "@/lib/privat/reiter";
import { cn } from "@/lib/utils";
import { PrivatAuswertung } from "./auswertung";
import { PrivatGemeinsam } from "./gemeinsam";
import { PrivatGeld, useGehalt } from "./gehalt";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";
import { PrivatSchichten } from "./schichten";
import { PrivatUrlaub, leseUrlaubEinst } from "./urlaub";


const std = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const euroGanz = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Schichten: sechs Kacheln mit den wichtigsten Zahlen. Eine Kachel antippen
 * öffnet darunter den Bereich (Übersicht, Meine Schichten, Geld, Urlaub, Gemeinsam
 * frei); „Plan hochladen“ führt zur Import-Seite.
 */
export function PrivatSchichtenSeite({ start = "uebersicht" }: { start?: Reiter }) {
  const { konto, schichtarten } = usePrivat();
  const [reiter, setReiter] = useState<Reiter>(start);
  const heute = heuteInBerlin();
  const jahr = Number(heute.slice(0, 4));
  const monat = Number(heute.slice(5, 7)) - 1;
  const { einst } = useGehalt(konto.userId);

  // Zahlen für die Kacheln: der laufende Monat.
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [feiertage, setFeiertage] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let aus = false;
    const von = toISO(new Date(jahr, monat, 1));
    const bis = toISO(new Date(jahr, monat + 1, 0));
    void ladeFeiertage(jahr)
      .then((f) => !aus && setFeiertage(new Set(f.map((h) => h.tag))))
      .catch(() => undefined);
    void ladeTage(von, bis)
      .then((t) => !aus && setTage(t))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, [jahr, monat, reiter]);
  const re = useMemo(() => {
    if (!tage || !schichtarten) return null;
    return rechne({
      tage,
      von: toISO(new Date(jahr, monat, 1)),
      bis: toISO(new Date(jahr, monat + 1, 0)),
      arten: schichtarten,
      feiertage,
      wochenstunden: konto.wochenstunden,
      einst,
    });
  }, [tage, schichtarten, feiertage, konto.wochenstunden, einst, jahr, monat]);

  // Übrige Urlaubstage (stehen nur auf diesem Gerät) – neu lesen, wenn man den Bereich wechselt.
  const [urlaubTage, setUrlaubTage] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlaubTage(leseUrlaubEinst(konto.userId).tage);
  }, [konto.userId, reiter]);

  const kacheln: { id: Reiter | "hochladen"; name: string; icon: ReactNode; wert: string; sub: string; farbe: string }[] = [
    {
      id: "uebersicht",
      name: "Übersicht",
      icon: <BarChart3 className="h-[19px] w-[19px]" />,
      wert: re ? `${std(re.ist)} Std` : "…",
      sub: re && re.differenz !== null ? `${re.differenz > 0.05 ? "+" : ""}${std(Math.abs(re.differenz) < 0.05 ? 0 : re.differenz)} Überstd.` : "Schichten zählen",
      farbe: "bg-brand-500/15 text-brand-600",
    },
    {
      id: "liste",
      name: "Meine Schichten",
      icon: <Layers className="h-[19px] w-[19px]" />,
      wert: schichtarten ? `${schichtarten.length} Schichten` : "…",
      sub: "bearbeiten",
      farbe: "bg-brand-500/15 text-brand-600",
    },
    {
      id: "geld",
      name: "Geld",
      icon: <Wallet className="h-[19px] w-[19px]" />,
      wert: re?.geld ? `ca. ${euroGanz(re.geld.summe)}` : "Lohn eintragen",
      sub: re?.geld ? `brutto, ${monthName(monat)}` : "Brutto schätzen",
      farbe: "bg-ok-bg text-ok-fg",
    },
    {
      id: "urlaub",
      name: "Urlaub",
      icon: <Palmtree className="h-[19px] w-[19px]" />,
      wert: urlaubTage !== null ? `${urlaubTage} Tage` : "…",
      sub: "übrig · Brückentage",
      farbe: "bg-[rgb(124_77_214/0.15)] text-[rgb(124_77_214)]",
    },
    {
      id: "gemeinsam",
      name: "Gemeinsam",
      icon: <CalendarHeart className="h-[19px] w-[19px]" />,
      wert: "Wann frei?",
      sub: "ihr beide",
      farbe: "bg-[rgb(214_64_159/0.15)] text-[rgb(184_50_137)]",
    },
    {
      id: "hochladen",
      name: "Plan hochladen",
      icon: <Upload className="h-[19px] w-[19px]" />,
      wert: "Screenshot",
      sub: "oder .ics",
      farbe: "bg-warn-bg text-warn-fg",
    },
  ];

  const inhalt =
    reiter === "uebersicht" ? (
      <PrivatAuswertung eingebettet />
    ) : reiter === "liste" ? (
      <PrivatSchichten eingebettet />
    ) : reiter === "geld" ? (
      <PrivatGeld />
    ) : reiter === "urlaub" ? (
      <PrivatUrlaub eingebettet />
    ) : (
      <PrivatGemeinsam eingebettet />
    );

  return (
    <div className="space-y-4">
      <PrivatKopf titel="Schichten" unter={`${monthName(monat)} ${jahr}`} />
      <div role="tablist" aria-label="Bereiche" className="grid grid-cols-3 gap-2">
        {kacheln.map((k) => {
          const inner = (
            <>
              <span className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-[12px]", k.farbe)}>{k.icon}</span>
              <span className="mt-2 block min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-ink-muted">{k.name}</span>
                <span className="block text-[16px] font-bold leading-tight tracking-[-0.01em]">{k.wert}</span>
                <span className="block text-[12px] leading-tight text-ink-muted">{k.sub}</span>
              </span>
            </>
          );
          const klasse = "glas flex min-w-0 flex-col rounded-[20px] p-3 text-left transition-shadow";
          if (k.id === "hochladen")
            return (
              <Link key={k.id} href="/privat/import" className={klasse}>
                {inner}
              </Link>
            );
          const aktiv = reiter === k.id;
          return (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={aktiv}
              onClick={() => setReiter(k.id as Reiter)}
              className={cn(klasse, aktiv && "ring-[2.5px] ring-brand-500 shadow-[0_10px_24px_rgba(47,91,234,0.25)]")}
            >
              {inner}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" key={reiter}>
        {inhalt}
      </div>
    </div>
  );
}
