"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { fetchMeineTermine, type Termin } from "@/lib/data/partner";
import { addDays, formatDE, heuteInBerlin } from "@/lib/dates";
import { restBis, restText, useCountdowns, useJetzt, zeitpunkt, type EigenerCountdown } from "@/lib/countdown";
import { idsVon, istAbwesenheit, type Schichtart } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";
import { useGehalt, useLohnDaten } from "./gehalt";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";

/**
 * Countdown (Entwurf A): oben die nächste Schicht als Ring, darunter alles,
 * worauf man wartet – Urlaub von selbst, gemerkte Termine und eigene
 * Countdowns. Läuft live mit; gemerkt wird nur auf diesem Gerät.
 */

interface Eintrag {
  key: string;
  emoji: string;
  titel: string;
  wann: string;
  ziel: Date;
  farbe: string;
  eigen?: string;
}

const FENSTER_TAGE = 60;

export function PrivatCountdown() {
  const { konto } = usePrivat();
  const heute = heuteInBerlin();
  const bis = addDays(heute, 365);
  const { einst } = useGehalt(konto.userId);
  const { tage, arten } = useLohnDaten(heute, bis, einst);
  const jetzt = useJetzt(15_000);
  const { countdowns, setze } = useCountdowns();
  const [termine, setTermine] = useState<Termin[]>([]);
  const [neu, setNeu] = useState(false);

  useEffect(() => {
    fetchMeineTermine()
      .then(setTermine)
      .catch(() => undefined);
  }, []);

  const nach = useMemo(() => new Map((arten ?? []).map((a) => [a.id, a])), [arten]);

  // Nächste Schicht mit Uhrzeit, die noch nicht angefangen hat.
  const naechste = useMemo(() => {
    if (!tage) return null;
    for (let d = addDays(heute, -1); d <= addDays(heute, 60); d = addDays(d, 1)) {
      const liste = idsVon(tage[d])
        .map((id) => nach.get(id))
        .filter((a): a is Schichtart => !!a);
      if (liste.some((a) => istAbwesenheit(a))) continue;
      for (const a of liste) {
        if (a.art !== "arbeit" || !a.beginn) continue;
        const start = zeitpunkt(d, a.beginn);
        if (start > jetzt) return { art: a, tag: d, start };
      }
    }
    return null;
  }, [tage, nach, heute, jetzt]);

  // Urlaub am Stück (eigene Einträge), ab morgen.
  const urlaub = useMemo(() => {
    if (!tage) return [] as { von: string; bis: string }[];
    const bloecke: { von: string; bis: string }[] = [];
    for (let d = addDays(heute, 1); d <= bis; d = addDays(d, 1)) {
      const istUrlaub = idsVon(tage[d]).some((id) => nach.get(id)?.art === "urlaub");
      if (!istUrlaub) continue;
      const letzter = bloecke[bloecke.length - 1];
      if (letzter && addDays(letzter.bis, 1) === d) letzter.bis = d;
      else bloecke.push({ von: d, bis: d });
    }
    return bloecke.slice(0, 5);
  }, [tage, nach, heute, bis]);

  const eintraege: Eintrag[] = [
    ...urlaub.map((u) => ({
      key: `u-${u.von}`,
      emoji: "🌴",
      titel: "Urlaub",
      wann: u.von === u.bis ? formatDE(u.von) : `${formatDE(u.von)} – ${formatDE(u.bis)}`,
      ziel: zeitpunkt(u.von),
      farbe: "#f59e0b",
    })),
    ...termine
      .filter((t) => countdowns.termine.includes(t.id))
      .map((t) => ({
        key: `t-${t.id}`,
        emoji: "📅",
        titel: t.titel || "Termin",
        wann: `${formatDE(t.datum)}${t.ganztaegig ? "" : ` · ${t.von}`}`,
        ziel: zeitpunkt(t.datum, t.ganztaegig ? "00:00" : t.von),
        farbe: "#6366f1",
      })),
    ...countdowns.eigene.map((e) => ({
      key: `e-${e.id}`,
      emoji: e.emoji,
      titel: e.titel,
      wann: `${formatDE(e.datum)}${e.zeit ? ` · ${e.zeit}` : ""}`,
      ziel: zeitpunkt(e.datum, e.zeit || "00:00"),
      farbe: "#22c55e",
      eigen: e.id,
    })),
  ]
    .filter((e) => e.ziel > jetzt)
    .sort((a, b) => a.ziel.getTime() - b.ziel.getTime());

  const rest = naechste ? restBis(naechste.start, jetzt) : null;
  // Ring: wie viel der letzten 24 Stunden bis zur Schicht schon um ist.
  const anteil = rest ? Math.max(0.02, Math.min(1, 1 - rest.ms / 864e5)) : 0;

  return (
    <div className="space-y-4" data-countdown>
      <PrivatKopf titel="Countdown" unter="Wie lange noch – läuft live mit" />

      <section className="glas flex items-center gap-4 rounded-[24px] p-4">
        <div
          className="flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-full transition-[background] duration-700"
          style={{ background: `conic-gradient(${naechste?.art.farbe ?? "#3b6ef5"} ${anteil * 360}deg, rgb(var(--c-ink) / 0.08) 0)` }}
          aria-hidden
        >
          <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-surface">
            <span className="tnum px-2 text-center text-[16px] font-bold leading-tight">{rest ? restText(rest) : "–"}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] text-ink-muted">Nächste Schicht</p>
          <p className="truncate text-[20px] font-bold leading-tight" data-countdown-schicht>
            {naechste ? naechste.art.name : "keine geplant"}
          </p>
          {naechste ? (
            <p className="text-[13px] text-ink-muted">
              {naechste.tag === heute ? "heute" : formatDE(naechste.tag)} · {naechste.art.beginn}
              {naechste.art.ende ? `–${naechste.art.ende}` : ""}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-[12.5px] font-semibold text-ink-muted">Worauf du wartest</p>
        <button type="button" onClick={() => setNeu(true)} className="flex items-center gap-1 text-[13.5px] font-semibold text-brand-600" data-countdown-neu>
          <Plus className="h-4 w-4" /> Hinzufügen
        </button>
      </div>

      {eintraege.length ? (
        <section className="glas divide-y divide-line overflow-hidden rounded-[20px]">
          {eintraege.map((e) => {
            const r = restBis(e.ziel, jetzt);
            const p = Math.max(0.03, Math.min(1, 1 - r.ms / (FENSTER_TAGE * 864e5)));
            return (
              <div key={e.key} className="flex items-center gap-3 px-4 py-3" data-countdown-eintrag>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[18px]" style={{ backgroundColor: `${e.farbe}22` }}>
                  {e.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{e.titel}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{e.wann}</span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                    <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${p * 100}%`, backgroundColor: e.farbe }} />
                  </span>
                </span>
                <span className="tnum shrink-0 text-right text-[16px] font-bold">{restText(r)}</span>
                {e.eigen ? (
                  <button
                    type="button"
                    aria-label={`${e.titel} entfernen`}
                    onClick={() => setze((c) => ({ ...c, eigene: c.eigene.filter((x) => x.id !== e.eigen) }))}
                    className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : (
        <p className="glas rounded-[20px] px-4 py-5 text-center text-[14px] text-ink-muted">
          Urlaub erscheint hier von selbst. Termine merkst du im Termin mit „Countdown“ – oder du fügst etwas hinzu.
        </p>
      )}

      {neu ? (
        <NeuerCountdown
          heute={heute}
          onFertig={(e) => {
            setze((c) => ({ ...c, eigene: [...c.eigene, e] }));
            setNeu(false);
          }}
          onClose={() => setNeu(false)}
        />
      ) : null}
    </div>
  );
}

const EMOJIS = ["⏳", "🎉", "✈️", "🎂", "🏖️", "🎄", "💪", "❤️"];

function NeuerCountdown({ heute, onFertig, onClose }: { heute: string; onFertig: (e: EigenerCountdown) => void; onClose: () => void }) {
  const [titel, setTitel] = useState("");
  const [datum, setDatum] = useState(addDays(heute, 7));
  const [zeit, setZeit] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const feld = "h-11 w-full min-w-0 rounded-[12px] bg-ink/[0.06] px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40";
  return (
    <Blatt titel="Neuer Countdown" onClose={onClose} wischZu="kopf">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!titel.trim() || datum < heute) return;
          onFertig({ id: `c-${Date.now().toString(36)}`, titel: titel.trim(), datum, zeit, emoji });
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((x) => (
            <button key={x} type="button" onClick={() => setEmoji(x)} aria-pressed={emoji === x} className={cn("h-10 w-10 rounded-full text-[18px]", emoji === x ? "bg-brand-500/15 ring-2 ring-brand-500" : "bg-ink/[0.05]")}>
              {x}
            </button>
          ))}
        </div>
        <input aria-label="Titel" placeholder="Worauf wartest du?" value={titel} maxLength={60} onChange={(e) => setTitel(e.target.value)} className={feld} autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Datum" type="date" min={heute} value={datum} onChange={(e) => setDatum(e.target.value)} className={feld} />
          <input aria-label="Uhrzeit" type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} className={feld} />
        </div>
        <button type="submit" disabled={!titel.trim()} className="h-12 w-full rounded-[14px] bg-brand-500 text-[15px] font-semibold text-white disabled:opacity-40">
          Countdown starten
        </button>
      </form>
    </Blatt>
  );
}
