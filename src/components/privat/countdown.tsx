"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Plus } from "lucide-react";
import { fetchMeineTermine, type Termin } from "@/lib/data/partner";
import { addDays, formatDE, heuteInBerlin, monthGrid, monthName, weekdayLong } from "@/lib/dates";
import { aufteilen, aufteilungText, bildVerkleinern, restBis, restText, tageBis, useCountdowns, useJetzt, zeitpunkt, type EigenerCountdown } from "@/lib/countdown";
import { idsVon, istAbwesenheit, type Schichtart } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";
import { useGehalt, useLohnDaten } from "./gehalt";
import { usePrivat } from "./kontext";
import { PrivatKopf } from "./rahmen";

/**
 * Countdown (Entwurf A): oben die nächste Schicht als Ring, darunter alles,
 * worauf man wartet – der nächste Urlaub von selbst, gemerkte Termine, auf
 * Wunsch Geburtstage und eigene Countdowns. Läuft sekundengenau mit; gemerkt
 * wird nur auf diesem Gerät.
 */

interface Eintrag {
  key: string;
  emoji: string;
  titel: string;
  wann: string;
  ziel: Date;
  farbe: string;
  eigen?: string;
  termin?: string;
}

const FENSTER_TAGE = 60;
/** Geburtstage erscheinen so viele Tage vorher. */
const GEBURTSTAG_TAGE = 31;

/**
 * Geburtstage von selbst erkennen: jeder ganztägige Termin, der sich jedes Jahr
 * wiederholt (so legt der Import Geburtstage an). Mit 🎂 oder „Geburtstag“ im
 * Namen ist es sicher einer; sonst ist es ein Jahrestag und bekommt 🎉.
 */
const istJahrestermin = (t: Termin) => t.wiederholung === "jaehrlich" && t.ganztaegig;
const siehtNachGeburtstagAus = (t: Termin) =>
  t.titel.trimStart().startsWith("🎂") || /geburtstag|\bgeb\.?\b|birthday|bday/i.test(t.titel) || !/\d|jahrestag|hochzeit|todestag/i.test(t.titel);

/** Restzeit in der gewählten Einheit – Antippen der Zahl wechselt (aus Spaß). */
const EINHEITEN = ["auto", "std", "min", "sek"] as const;
function inEinheit(ms: number, einheit: (typeof EINHEITEN)[number], auto: string): string {
  const z = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("de-DE");
  if (einheit === "std") return `${z(ms / 3.6e6)} Std`;
  if (einheit === "min") return `${z(ms / 6e4)} Min`;
  if (einheit === "sek") return `${z(ms / 1e3)} Sek`;
  return auto;
}

/** Nächster Jahrestag ab heute ("YYYY-MM-DD"); 29.02. in Nicht-Schaltjahren am 28.02. */
function naechsterJahrestag(datum: string, heute: string): string {
  const md = datum.slice(5);
  const am = (j: number) => {
    const schalt = (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;
    return `${j}-${md === "02-29" && !schalt ? "02-28" : md}`;
  };
  const j = Number(heute.slice(0, 4));
  return am(j) >= heute ? am(j) : am(j + 1);
}

export function PrivatCountdown() {
  const { konto } = usePrivat();
  const heute = heuteInBerlin();
  const bis = addDays(heute, 365);
  const { einst } = useGehalt(konto.userId);
  const { tage, arten } = useLohnDaten(heute, bis, einst);
  const jetzt = useJetzt(1000);
  const { countdowns, setze } = useCountdowns();
  const [termine, setTermine] = useState<Termin[]>([]);
  /** offenes Blatt: "neu" oder der Schlüssel des Eintrags */
  const [offen, setOffen] = useState<string | null>(null);
  /** Einheit der großen Zahl je Eintrag (Index in EINHEITEN). */
  const [einheit, setEinheit] = useState<Record<string, number>>({});
  const weiterEinheit = (key: string) => setEinheit((e) => ({ ...e, [key]: ((e[key] ?? 0) + 1) % EINHEITEN.length }));
  const zahl = (key: string, ms: number, auto: string) => inEinheit(ms, EINHEITEN[einheit[key] ?? 0]!, auto);

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

  // Der nächste Urlaub am Stück, ab morgen. Freie Tage dazwischen (Wochenende,
  // Feiertag, frei) trennen ihn nicht – 24.12. und 28.–31.12. sind ein Urlaub.
  const urlaub = useMemo(() => {
    if (!tage) return [] as { von: string; bis: string }[];
    const arbeitAm = (d: string) => idsVon(tage[d]).some((id) => nach.get(id)?.art === "arbeit");
    let block: { von: string; bis: string } | null = null;
    for (let d = addDays(heute, 1); d <= bis; d = addDays(d, 1)) {
      const istUrlaub = idsVon(tage[d]).some((id) => nach.get(id)?.art === "urlaub");
      if (istUrlaub) {
        if (block) block.bis = d;
        else block = { von: d, bis: d };
      } else if (block && (arbeitAm(d) || d > addDays(block.bis, 4))) break;
    }
    return block ? [block] : [];
  }, [tage, nach, heute, bis]);

  const geburtstage = useMemo(() => {
    if (!countdowns.geburtstage) return [];
    const grenze = addDays(heute, GEBURTSTAG_TAGE);
    return termine
      .filter(istJahrestermin)
      .map((t) => ({ t, tag: naechsterJahrestag(t.datum, heute) }))
      .filter(({ t, tag }) => tag <= grenze && !(t.ausfaelle ?? []).includes(tag) && !(t.serieAb && tag >= t.serieAb));
  }, [countdowns.geburtstage, termine, heute]);

  const eintraege: Eintrag[] = [
    ...urlaub.map((u) => ({
      key: `u-${u.von}`,
      emoji: "🌴",
      titel: "Urlaub",
      wann: u.von === u.bis ? formatDE(u.von) : `${formatDE(u.von)} – ${formatDE(u.bis)}`,
      ziel: zeitpunkt(u.von),
      farbe: "#f59e0b",
    })),
    ...geburtstage.map(({ t, tag }) => ({
      key: `g-${t.id}`,
      emoji: siehtNachGeburtstagAus(t) ? "🎂" : "🎉",
      titel: t.titel.replace(/^\s*🎂\s*/, "") || "Geburtstag",
      wann: tag === heute ? "heute" : formatDE(tag),
      ziel: zeitpunkt(tag),
      farbe: "#ec4899",
    })),
    ...termine
      .filter((t) => countdowns.termine.includes(t.id) && !(countdowns.geburtstage && istJahrestermin(t)))
      .map((t) => ({
        key: `t-${t.id}`,
        emoji: "📅",
        titel: t.titel || "Termin",
        wann: `${formatDE(t.datum)}${t.ganztaegig ? "" : ` · ${t.von}`}`,
        ziel: zeitpunkt(t.datum, t.ganztaegig ? "00:00" : t.von),
        farbe: "#6366f1",
        termin: t.id,
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

  const aktiv = offen && offen !== "neu" ? eintraege.find((e) => e.key === offen) : undefined;
  const eigenAktiv = aktiv?.eigen ? countdowns.eigene.find((x) => x.id === aktiv.eigen) : undefined;

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
            <>
              <p className="text-[13px] text-ink-muted">
                {naechste.tag === heute ? "heute" : formatDE(naechste.tag)} · {naechste.art.beginn}
                {naechste.art.ende ? `–${naechste.art.ende}` : ""}
              </p>
              <p className="tnum mt-0.5 text-[12px] text-ink-muted" data-countdown-genau>
                {aufteilungText(aufteilen(naechste.start, jetzt))}
              </p>
            </>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-[12.5px] font-semibold text-ink-muted">Worauf du wartest</p>
        <button
          type="button"
          onClick={() => setOffen("neu")}
          className="flex h-11 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-[15px] font-semibold text-white shadow-sm active:scale-[0.97] transition-transform"
          data-countdown-neu
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} /> Hinzufügen
        </button>
      </div>
      <div className="-mt-1 flex gap-1.5 px-1">
        <button
          type="button"
          aria-pressed={countdowns.geburtstage}
          onClick={() => setze((c) => ({ ...c, geburtstage: !c.geburtstage }))}
          className={cn(
            "h-8 rounded-full px-3 text-[13px] font-semibold transition-colors",
            countdowns.geburtstage ? "bg-brand-500 text-white" : "bg-ink/[0.06] text-ink-muted",
          )}
          data-countdown-geburtstage
        >
          🎂 Geburtstage {countdowns.geburtstage ? "an" : "aus"}
        </button>
      </div>

      {eintraege.length ? (
        <div className="space-y-2">
          {eintraege.map((e) => {
            const r = restBis(e.ziel, jetzt);
            const p = Math.max(0.03, Math.min(1, 1 - r.ms / (FENSTER_TAGE * 864e5)));
            const bild = countdowns.bilder[e.key];
            if (bild) {
              return (
                <div
                  key={e.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOffen(e.key)}
                  onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && setOffen(e.key)}
                  className="relative block h-[148px] w-full cursor-pointer overflow-hidden rounded-[22px] text-left text-white active:scale-[0.99] transition-transform"
                  data-countdown-eintrag
                  data-countdown-foto
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bild} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/0" />
                  <span className="absolute inset-x-4 bottom-3 flex items-end gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold">
                        {e.emoji} {e.titel}
                      </span>
                      <span className="block truncate text-[12.5px] opacity-85">{e.wann}</span>
                      <span className="tnum block truncate text-[11.5px] opacity-85" data-countdown-genau>
                        {aufteilungText(aufteilen(e.ziel, jetzt))}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(k) => {
                        k.stopPropagation();
                        weiterEinheit(e.key);
                      }}
                      aria-label="Andere Einheit"
                      className="tnum -m-2 shrink-0 p-2 text-[22px] font-bold leading-none"
                      data-countdown-zahl
                    >
                      {zahl(e.key, r.ms, restText(r))}
                    </button>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <span className="block h-full bg-white/90 transition-[width] duration-700" style={{ width: `${p * 100}%` }} />
                  </span>
                </div>
              );
            }
            return (
              <div
                key={e.key}
                role="button"
                tabIndex={0}
                onClick={() => setOffen(e.key)}
                onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && setOffen(e.key)}
                className="glas flex w-full cursor-pointer items-center gap-3 rounded-[18px] px-4 py-3 text-left active:scale-[0.99] transition-transform"
                data-countdown-eintrag
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[18px]" style={{ backgroundColor: `${e.farbe}22` }}>
                  {e.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{e.titel}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{e.wann}</span>
                  <span className="tnum block truncate text-[11.5px] text-ink-muted" data-countdown-genau>
                    {aufteilungText(aufteilen(e.ziel, jetzt))}
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                    <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${p * 100}%`, backgroundColor: e.farbe }} />
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(k) => {
                    k.stopPropagation();
                    weiterEinheit(e.key);
                  }}
                  aria-label="Andere Einheit"
                  className="tnum -my-2 -mr-2 shrink-0 p-2 text-right text-[16px] font-bold"
                  data-countdown-zahl
                >
                  {zahl(e.key, r.ms, restText(r))}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="glas rounded-[20px] px-4 py-5 text-center text-[14px] text-ink-muted">
          Urlaub erscheint hier von selbst. Termine merkst du im Termin mit „Countdown“ – oder du fügst etwas hinzu.
        </p>
      )}

      {offen === "neu" || aktiv ? (
        <CountdownBlatt
          key={offen}
          heute={heute}
          start={offen === "neu" ? undefined : eigenAktiv}
          fest={aktiv && !aktiv.eigen ? { titel: `${aktiv.emoji} ${aktiv.titel}`, wann: aktiv.wann } : undefined}
          bild={aktiv ? countdowns.bilder[aktiv.key] : undefined}
          onSpeichern={(e, bild) => {
            const key = e ? `e-${e.id}` : aktiv!.key;
            const ok = setze((c) => {
              const bilder = { ...c.bilder };
              if (bild) bilder[key] = bild;
              else delete bilder[key];
              const eigene = e ? (c.eigene.some((x) => x.id === e.id) ? c.eigene.map((x) => (x.id === e.id ? e : x)) : [...c.eigene, e]) : c.eigene;
              return { ...c, eigene, bilder };
            });
            if (ok) setOffen(null);
            return ok;
          }}
          onEntfernen={
            aktiv?.eigen || aktiv?.termin
              ? () => {
                  setze((c) => {
                    const bilder = { ...c.bilder };
                    delete bilder[aktiv.key];
                    return {
                      ...c,
                      termine: c.termine.filter((x) => x !== aktiv.termin),
                      eigene: c.eigene.filter((x) => x.id !== aktiv.eigen),
                      bilder,
                    };
                  });
                  setOffen(null);
                }
              : undefined
          }
          onClose={() => setOffen(null)}
        />
      ) : null}
    </div>
  );
}

const EMOJIS = ["⏳", "🎉", "✈️", "🎂", "🏖️", "🎄", "💪", "❤️", "🎓", "🏠", "🎵", "⚽"];

function CountdownBlatt({
  heute,
  start,
  fest,
  bild: bildStart,
  onSpeichern,
  onEntfernen,
  onClose,
}: {
  heute: string;
  start?: EigenerCountdown;
  /** Urlaub oder Termin: nur das Foto lässt sich ändern. */
  fest?: { titel: string; wann: string };
  bild?: string;
  onSpeichern: (e: EigenerCountdown | null, bild: string | null) => boolean;
  onEntfernen?: () => void;
  onClose: () => void;
}) {
  const [titel, setTitel] = useState(start?.titel ?? "");
  const [datum, setDatum] = useState(start?.datum ?? addDays(heute, 7));
  const [zeit, setZeit] = useState(start?.zeit ?? "");
  const [emoji, setEmoji] = useState(start?.emoji ?? EMOJIS[0]!);
  const [bild, setBild] = useState<string | null>(bildStart ?? null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = "h-11 w-full min-w-0 rounded-[12px] bg-ink/[0.06] px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40";

  async function fotoWahl(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setLaedt(true);
    try {
      setBild(await bildVerkleinern(datei));
    } catch {
      setFehler("Dieses Foto lässt sich nicht öffnen. Versuch ein anderes.");
    } finally {
      setLaedt(false);
    }
  }

  const fotoKnopf = (
    <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur">
      <ImagePlus className="h-4 w-4" /> Foto ändern
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => void fotoWahl(e.target.files?.[0])} />
    </label>
  );

  return (
    <Blatt titel={fest ? fest.titel : start ? "Countdown bearbeiten" : "Neuer Countdown"} onClose={onClose} wischZu="kopf">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!fest && (!titel.trim() || datum < heute)) return;
          const eintrag = fest ? null : { id: start?.id ?? `c-${Date.now().toString(36)}`, titel: titel.trim(), datum, zeit, emoji };
          if (!onSpeichern(eintrag, bild)) setFehler("Auf diesem Gerät ist kein Platz mehr. Nimm ein Foto bei einem anderen Countdown heraus.");
        }}
      >
        {fest ? <p className="text-[13px] text-ink-muted">{fest.wann}</p> : null}

        {bild ? (
          <div className="relative h-[120px] overflow-hidden rounded-[18px]" data-countdown-vorschau>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bild} alt="Gewähltes Foto" className="h-full w-full object-cover" />
            <div className="absolute inset-x-2 bottom-2 flex justify-between">
              {fotoKnopf}
              <button type="button" onClick={() => setBild(null)} className="rounded-full bg-black/45 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur">
                Entfernen
              </button>
            </div>
          </div>
        ) : (
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-line text-[14px] font-semibold text-ink-muted">
            <ImagePlus className="h-5 w-5" /> {laedt ? "Foto wird geladen …" : "Foto hinzufügen"}
            <input type="file" accept="image/*" className="sr-only" aria-label="Foto hinzufügen" onChange={(e) => void fotoWahl(e.target.files?.[0])} />
          </label>
        )}

        {fest ? null : (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
              {EMOJIS.map((x) => (
                <button key={x} type="button" onClick={() => setEmoji(x)} aria-pressed={emoji === x} className={cn("h-10 w-10 shrink-0 rounded-full text-[18px]", emoji === x ? "bg-brand-500/15 ring-2 ring-brand-500" : "bg-ink/[0.05]")}>
                  {x}
                </button>
              ))}
            </div>
            <input aria-label="Titel" placeholder="Worauf wartest du?" value={titel} maxLength={60} onChange={(e) => setTitel(e.target.value)} className={feld} autoFocus={!start} />
            <DatumWahl heute={heute} wert={datum} onWahl={setDatum} />
            <label className="flex items-center justify-between gap-3 rounded-[12px] bg-ink/[0.06] px-3">
              <span className="text-[14px] text-ink-muted">Uhrzeit (frei lassen = ganzer Tag)</span>
              <input aria-label="Uhrzeit" type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} className="h-11 bg-transparent text-[15px] outline-none" />
            </label>
          </>
        )}

        {fehler ? <p className="text-[13px] text-crit-fg">{fehler}</p> : null}

        {/* Bleibt unten im Blatt sichtbar, auch wenn Foto und Kalender lang sind. */}
        <div className="sticky -bottom-5 z-10 -mx-5 bg-gradient-to-t from-surface via-surface/95 to-surface/0 px-5 pb-5 pt-3">
          <button type="submit" disabled={laedt || (!fest && !titel.trim())} className="h-12 w-full rounded-[14px] bg-brand-500 text-[15px] font-semibold text-white shadow-sm disabled:opacity-40">
            {fest || start ? "Speichern" : "Countdown starten"}
          </button>
        </div>
        {onEntfernen ? (
          <button type="button" onClick={onEntfernen} className="h-11 w-full rounded-[14px] text-[14.5px] font-semibold text-crit-fg">
            {start ? "Countdown löschen" : "Nicht mehr merken"}
          </button>
        ) : null}
      </form>
    </Blatt>
  );
}

const KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Datum wählen: schnelle Vorschläge und ein kleiner Monatskalender. */
function DatumWahl({ heute, wert, onWahl }: { heute: string; wert: string; onWahl: (iso: string) => void }) {
  const [blatt, setBlatt] = useState(() => ({ j: Number(wert.slice(0, 4)), m: Number(wert.slice(5, 7)) - 1 }));
  const plusMonate = (n: number) => {
    const d = new Date(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1 + n, Number(heute.slice(8)));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const samstag = addDays(heute, ((6 - new Date(`${heute}T12:00:00`).getDay() + 7) % 7) || 7);
  const vorschlaege: [string, string][] = [
    ["Morgen", addDays(heute, 1)],
    ["Wochenende", samstag],
    ["1 Woche", addDays(heute, 7)],
    ["1 Monat", plusMonate(1)],
    ["3 Monate", plusMonate(3)],
    ["100 Tage", addDays(heute, 100)],
  ];
  const waehle = (iso: string) => {
    onWahl(iso);
    setBlatt({ j: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 });
  };
  const blaettern = (n: number) =>
    setBlatt((b) => {
      const m = b.m + n;
      return { j: b.j + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  const n = tageBis(wert, heute);
  const istVorher = blatt.j * 12 + blatt.m <= Number(heute.slice(0, 4)) * 12 + Number(heute.slice(5, 7)) - 1;

  return (
    <div className="space-y-2" data-datum-wahl>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {vorschlaege.map(([t, iso]) => (
          <button
            key={t}
            type="button"
            onClick={() => waehle(iso)}
            className={cn("h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold", wert === iso ? "bg-brand-500 text-white" : "bg-ink/[0.06]")}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="rounded-[16px] bg-ink/[0.04] p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <button type="button" aria-label="Monat zurück" disabled={istVorher} onClick={() => blaettern(-1)} className="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-25">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[14px] font-semibold" data-datum-monat>
            {monthName(blatt.m)} {blatt.j}
          </span>
          <button type="button" aria-label="Monat vor" onClick={() => blaettern(1)} className="flex h-8 w-8 items-center justify-center rounded-full">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {KURZ.map((k) => (
            <span key={k} className="pb-1 text-[11px] font-medium text-ink-faint">
              {k}
            </span>
          ))}
          {monthGrid(blatt.j, blatt.m)
            .filter((iso, i, alle) => alle.slice(i - (i % 7), i - (i % 7) + 7).some((x) => Number(x.slice(5, 7)) - 1 === blatt.m))
            .map((iso) => {
            const drin = Number(iso.slice(5, 7)) - 1 === blatt.m;
            const vorbei = iso < heute;
            const gewaehlt = iso === wert;
            return (
              <button
                key={iso}
                type="button"
                disabled={vorbei || !drin}
                onClick={() => onWahl(iso)}
                data-datum={iso}
                className={cn(
                  "tnum mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[14px]",
                  !drin && "invisible",
                  vorbei && "text-ink-faint/60",
                  iso === heute && !gewaehlt && "ring-1 ring-ink/30",
                  gewaehlt && "bg-brand-500 font-bold text-white",
                )}
              >
                {Number(iso.slice(8))}
              </button>
            );
          })}
        </div>
      </div>
      <p className="px-1 text-[13px] text-ink-muted" data-datum-text>
        {weekdayLong(wert)}, {formatDE(wert)} · {n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`}
      </p>
    </div>
  );
}
