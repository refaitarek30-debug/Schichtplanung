"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { farbStil, idsVon, istAbwesenheit, ladeFeiertage, ladeTage, ladeTagZeiten, tagZeitSchluessel, type TagEintrag, type TagZeit } from "@/lib/privat/daten";
import { rechne, schichtAmTag } from "@/lib/privat/gehalt";
import { cn } from "@/lib/utils";
import { UeberstundenKarte, useGehalt } from "./gehalt";
import { usePrivat } from "./kontext";
import { AbschnittKopf, PrivatKarte, PrivatKopf, RundKnopf } from "./rahmen";

/**
 * Auswertung: Schichten zählen, Stunden je Schicht, Soll und Ist, im Monat
 * dazu Gehalts-Schätzung und Zuschläge (siehe gehalt.tsx).
 */

type Zeitraum = "monat" | "jahr";

const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

export function PrivatAuswertung({ titel = "Auswertung", unterKopf, eingebettet = false }: { titel?: string; unterKopf?: ReactNode; eingebettet?: boolean }) {
  const { konto, schichtarten } = usePrivat();
  const heute = heuteInBerlin();
  const [zeitraum, setZeitraum] = useState<Zeitraum>("monat");
  const [anker, setAnker] = useState(heute);
  const [bisHeute, setBisHeute] = useState(false);
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [feiertage, setFeiertage] = useState<ReadonlySet<string>>(new Set());
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeiten, setZeiten] = useState<Record<string, TagZeit>>({});
  const { einst } = useGehalt(konto.userId);

  const d = fromISO(anker);
  const von = zeitraum === "jahr" ? `${d.getFullYear()}-01-01` : toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const bisVoll = zeitraum === "jahr" ? `${d.getFullYear()}-12-31` : toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const bis = bisHeute && heute < bisVoll ? (heute < von ? addDays(von, -1) : heute) : bisVoll;

  useEffect(() => {
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTage(null);
    const jahre = [...new Set([fromISO(von).getFullYear(), fromISO(bisVoll).getFullYear()])];
    Promise.all(jahre.map((j) => ladeFeiertage(j)))
      .then((l) => !aus && setFeiertage(new Set(l.flat().map((h) => h.tag))))
      .catch(() => undefined);
    void ladeTagZeiten(von, bisVoll).then((z) => !aus && setZeiten(z));
    ladeTage(von, bisVoll)
      .then((t) => !aus && setTage(t))
      .catch((e: unknown) => !aus && setFehler(e instanceof Error ? e.message : "Konnte nicht geladen werden."));
    return () => {
      aus = true;
    };
  }, [von, bisVoll]);

  const werte = (() => {
    if (!tage || !schichtarten) return null;
    const nach = new Map(schichtarten.map((a) => [a.id, a]));
    const anzahl = new Map<string, number>();
    const stunden = new Map<string, number>();
    for (const [tag, e] of Object.entries(tage)) {
      if (tag < von || tag > bis) continue;
      const ids = idsVon(e);
      for (const id of ids) anzahl.set(id, (anzahl.get(id) ?? 0) + 1);
      // Stunden: Ist an dem Tag Urlaub oder Krank eingetragen, zählen dessen
      // Stunden – die Schicht darunter nicht noch einmal.
      const abw = ids.filter((id) => istAbwesenheit(nach.get(id)));
      for (const id of abw.length ? abw : ids) {
        const a = nach.get(id);
        const h = a ? schichtAmTag(a, zeiten[tagZeitSchluessel(tag, id)]).stunden : 0;
        stunden.set(id, (stunden.get(id) ?? 0) + h);
      }
    }
    const zeilen = schichtarten.map((a) => ({ art: a, anzahl: anzahl.get(a.id) ?? 0, stunden: stunden.get(a.id) ?? 0 }));
    const gesamtAnzahl = zeilen.reduce((s, z) => s + z.anzahl, 0);
    const gesamtStunden = zeilen.reduce((s, z) => s + z.stunden, 0);
    return { zeilen, gesamtAnzahl, gesamtStunden };
  })();

  const rechnung =
    tage && schichtarten
      ? rechne({ tage, von, bis: bis < von ? von : bis, arten: schichtarten, feiertage, wochenstunden: konto.wochenstunden, einst, zeiten })
      : null;

  function springe(s: number) {
    setAnker(
      zeitraum === "jahr"
        ? toISO(new Date(d.getFullYear() + s, 0, 1))
        : toISO(new Date(d.getFullYear(), d.getMonth() + s, 1)),
    );
  }

  const titelZeitraum = zeitraum === "jahr" ? String(d.getFullYear()) : `${monthName(d.getMonth())} ${d.getFullYear()}`;
  const unterZeitraum = bisHeute && bis < bisVoll ? `${titelZeitraum} · bis ${formatDE(bis < von ? von : bis)}` : titelZeitraum;

  return (
    <div className="space-y-4">
      {eingebettet ? (
        <AbschnittKopf
          icon={<BarChart3 className="h-[18px] w-[18px]" />}
          titel="Übersicht"
          unter={<span className="tnum">{unterZeitraum}</span>}
          rechts={
            <>
              <RundKnopf label="Vorher" onClick={() => springe(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </RundKnopf>
              <RundKnopf label="Weiter" onClick={() => springe(1)}>
                <ChevronRight className="h-5 w-5" />
              </RundKnopf>
            </>
          }
        />
      ) : (
        <PrivatKopf
          titel={titel}
          unter={<span className="tnum">{unterZeitraum}</span>}
          rechts={
            <>
              <RundKnopf label="Vorher" onClick={() => springe(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </RundKnopf>
              <RundKnopf label="Weiter" onClick={() => springe(1)}>
                <ChevronRight className="h-5 w-5" />
              </RundKnopf>
            </>
          }
        />
      )}

      {unterKopf}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Zeitraum" className="glas inline-flex rounded-[14px] p-1">
          {(["monat", "jahr"] as const).map((z) => (
            <button
              key={z}
              type="button"
              role="tab"
              aria-selected={zeitraum === z}
              onClick={() => setZeitraum(z)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold",
                zeitraum === z ? "bg-surface text-ink shadow-card" : "text-ink-muted",
              )}
            >
              {z === "monat" ? "Monat" : "Jahr"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-muted">
          <input type="checkbox" checked={bisHeute} onChange={(e) => setBisHeute(e.target.checked)} className="h-4 w-4 accent-brand-500" />
          nur bis heute
        </label>
      </div>

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      <div aria-busy={!werte} className="space-y-4">
        <PrivatKarte titel="Schichten">
          <SchichtListe zeilen={werte?.zeilen ?? null} stunden={werte?.gesamtStunden ?? 0} />
        </PrivatKarte>
        {rechnung ? <UeberstundenKarte re={rechnung} /> : null}
      </div>
    </div>
  );
}

/** Eine Liste: je Schicht Anzahl und Stunden, mit einem schmalen Balken für den Anteil. */
function SchichtListe({
  zeilen,
  stunden,
}: {
  zeilen: { art: { id: string; name: string; kuerzel: string; farbe: string }; anzahl: number; stunden: number }[] | null;
  stunden: number;
}) {
  if (!zeilen) return <p className="px-4 py-4 text-[14px] text-ink-muted">Wird geladen …</p>;
  const belegt = zeilen.filter((z) => z.anzahl > 0).sort((a, b) => b.anzahl - a.anzahl);
  if (!belegt.length) return <p className="px-4 py-4 text-[14px] text-ink-muted">In diesem Zeitraum ist nichts eingetragen.</p>;
  const max = Math.max(...belegt.map((z) => z.anzahl));
  return (
    <dl className="divide-y divide-line" data-schicht-liste>
      {belegt.map((z) => (
        <div key={z.art.id} className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            <dt className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={farbStil(z.art.farbe)}>
                {z.art.kuerzel}
              </span>
              <span className="truncate text-[16px]">{z.art.name}</span>
            </dt>
            <dd className="tnum w-10 shrink-0 text-right text-[14px] text-ink-muted">{zahl(z.anzahl)}×</dd>
            <dd className="tnum w-16 shrink-0 text-right text-[16px] font-semibold">{zahl(z.stunden)} h</dd>
          </div>
          <div className="ml-11 mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${(z.anzahl / max) * 100}%`, backgroundColor: z.art.farbe }} />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 px-4 py-3 font-semibold">
        <dt className="text-[16px]">Gesamt</dt>
        <dd className="tnum text-[16px]">{zahl(stunden)} h</dd>
      </div>
    </dl>
  );
}
