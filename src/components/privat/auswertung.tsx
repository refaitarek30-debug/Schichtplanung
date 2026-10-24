"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { farbStil, idsVon, istAbwesenheit, ladeFeiertage, ladeTage, type TagEintrag } from "@/lib/privat/daten";
import { rechne } from "@/lib/privat/gehalt";
import { cn } from "@/lib/utils";
import { GehaltKarte, UeberstundenKarte, ZuschlagKarte, useGehalt } from "./gehalt";
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf, RundKnopf } from "./rahmen";

/**
 * Auswertung: Schichten zählen, Stunden je Schicht, Soll und Ist, im Monat
 * dazu Gehalts-Schätzung und Zuschläge (siehe gehalt.tsx).
 */

type Zeitraum = "monat" | "jahr";

const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

export function PrivatAuswertung({ titel = "Auswertung", unterKopf }: { titel?: string; unterKopf?: ReactNode }) {
  const { konto, schichtarten } = usePrivat();
  const heute = heuteInBerlin();
  const [zeitraum, setZeitraum] = useState<Zeitraum>("monat");
  const [anker, setAnker] = useState(heute);
  const [bisHeute, setBisHeute] = useState(false);
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [feiertage, setFeiertage] = useState<ReadonlySet<string>>(new Set());
  const { einst, setze } = useGehalt(konto.userId);
  const [fehler, setFehler] = useState<string | null>(null);

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
      for (const id of abw.length ? abw : ids) stunden.set(id, (stunden.get(id) ?? 0) + (nach.get(id)?.stunden ?? 0));
    }
    const zeilen = schichtarten.map((a) => ({ art: a, anzahl: anzahl.get(a.id) ?? 0, stunden: stunden.get(a.id) ?? 0 }));
    const gesamtAnzahl = zeilen.reduce((s, z) => s + z.anzahl, 0);
    const gesamtStunden = zeilen.reduce((s, z) => s + z.stunden, 0);
    return { zeilen, gesamtAnzahl, gesamtStunden };
  })();

  const rechnung =
    tage && schichtarten
      ? rechne({ tage, von, bis: bis < von ? von : bis, arten: schichtarten, feiertage, wochenstunden: konto.wochenstunden, einst })
      : null;

  function springe(s: number) {
    setAnker(
      zeitraum === "jahr"
        ? toISO(new Date(d.getFullYear() + s, 0, 1))
        : toISO(new Date(d.getFullYear(), d.getMonth() + s, 1)),
    );
  }

  const titelZeitraum = zeitraum === "jahr" ? String(d.getFullYear()) : `${monthName(d.getMonth())} ${d.getFullYear()}`;

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel={titel}
        unter={
          <span className="tnum">
            {formatDE(von)} – {formatDE(bis < von ? von : bis)}
          </span>
        }
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
      <p className="text-[15px] font-semibold">{titelZeitraum}</p>

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      <div aria-busy={!werte} className="space-y-4">
        <PrivatKarte titel="Schichten zählen">
          <Liste
            zeilen={(werte?.zeilen ?? []).map((z) => ({ art: z.art, wert: zahl(z.anzahl) }))}
            gesamt={werte ? zahl(werte.gesamtAnzahl) : "…"}
          />
        </PrivatKarte>
        <PrivatKarte titel="Stunden pro Schicht">
          <Liste
            zeilen={(werte?.zeilen ?? []).map((z) => ({ art: z.art, wert: `${zahl(z.stunden)} h` }))}
            gesamt={werte ? `${zahl(werte.gesamtStunden)} h` : "…"}
          />
        </PrivatKarte>
        {rechnung ? (
          <>
            <UeberstundenKarte re={rechnung} />
            {zeitraum === "monat" ? (
              <>
                <GehaltKarte re={rechnung} einst={einst} setze={setze} />
                <ZuschlagKarte einst={einst} setze={setze} />
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Liste({ zeilen, gesamt }: { zeilen: { art: { id: string; name: string; kuerzel: string; farbe: string }; wert: string }[]; gesamt: string }) {
  return (
    <dl className="divide-y divide-line">
      {zeilen.map((z) => (
        <div key={z.art.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
              style={farbStil(z.art.farbe)}
            >
              {z.art.kuerzel}
            </span>
            <span className="truncate text-[16px]">{z.art.name}</span>
          </dt>
          <dd className="tnum text-[16px]">{z.wert}</dd>
        </div>
      ))}
      <Zeile name="Gesamt" wert={gesamt} fett />
    </dl>
  );
}

function Zeile({ name, wert, fett }: { name: string; wert: string; fett?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className={cn("text-[16px]", fett && "font-semibold")}>{name}</dt>
      <dd className={cn("tnum text-[16px]", fett && "font-semibold")}>{wert}</dd>
    </div>
  );
}
