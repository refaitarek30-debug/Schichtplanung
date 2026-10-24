"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { fromISO, heuteInBerlin } from "@/lib/dates";
import {
  BUNDESLAENDER,
  MAX_JE_TAG,
  eintragAus,
  idsVon,
  ladeFeiertage,
  ladeTage,
  speichereTage,
  type TagEintrag,
} from "@/lib/privat/daten";
import { meineFreiheit } from "@/lib/privat/gemeinsam";
import { findeUrlaub, vorschlagTitel, wochentagKurz, zeitraumText, type TagArt, type Vorschlag } from "@/lib/privat/urlaub";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf, RundKnopf } from "./rahmen";

/**
 * Urlaubs-Planer: findet Zeiten, in denen du mit wenigen Urlaubstagen lange
 * frei hast – für Tagschicht (Montag bis Freitag) oder nach deinem eigenen Plan.
 */

type Modus = "tag" | "plan";
const SCHLUESSEL = "sp_urlaub:";
const FARBEN: Record<TagArt, { grund: string; schrift: string }> = {
  urlaub: { grund: "#7C4DD6", schrift: "#ffffff" },
  feiertag: { grund: "#CC3B40", schrift: "#ffffff" },
  frei: { grund: "#DFE3EE", schrift: "#4b5563" },
};
const KURZ = ["S", "M", "D", "M", "D", "F", "S"];

function leseEinst(userId: string): { modus: Modus; tage: number } {
  try {
    const r = JSON.parse(window.localStorage.getItem(SCHLUESSEL + userId) ?? "{}") as { modus?: unknown; tage?: unknown };
    return {
      modus: r.modus === "plan" ? "plan" : "tag",
      tage: typeof r.tage === "number" && r.tage >= 0 && r.tage <= 60 ? Math.round(r.tage) : 12,
    };
  } catch {
    return { modus: "tag", tage: 12 };
  }
}

export function PrivatUrlaub() {
  const { konto, schichtarten, artNach } = usePrivat();
  const heute = heuteInBerlin();
  // Ab Oktober plant man den Urlaub fürs nächste Jahr.
  const [jahr, setJahr] = useState(() => Number(heute.slice(0, 4)) + (Number(heute.slice(5, 7)) >= 10 ? 1 : 0));
  const [modus, setModus] = useState<Modus>("tag");
  const [urlaubTage, setUrlaubTage] = useState(12);
  const [feiertage, setFeiertage] = useState<Map<string, string> | null>(null);
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [eingetragen, setEingetragen] = useState<{ text: string; vorher: Record<string, TagEintrag | undefined>; n: number } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    const e = leseEinst(konto.userId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModus(e.modus);
    setUrlaubTage(e.tage);
  }, [konto.userId]);
  const merke = useCallback(
    (m: Modus, t: number) => {
      try {
        window.localStorage.setItem(SCHLUESSEL + konto.userId, JSON.stringify({ modus: m, tage: t }));
      } catch {
        // gilt dann nur bis zum Schließen
      }
    },
    [konto.userId],
  );

  useEffect(() => {
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeiertage(null);
    setTage(null);
    void (async () => {
      try {
        const [f, t] = await Promise.all([
          Promise.all([jahr - 1, jahr, jahr + 1].map((j) => ladeFeiertage(j))),
          ladeTage(`${jahr - 1}-12-15`, `${jahr + 1}-01-20`),
        ]);
        if (aus) return;
        setFeiertage(new Map(f.flat().map((h) => [h.tag, h.name])));
        setTage(t);
        setFehler(null);
      } catch (e) {
        if (!aus) setFehler(e instanceof Error ? e.message : "Konnte nicht geladen werden.");
      }
    })();
    return () => {
      aus = true;
    };
  }, [jahr]);

  const vorschlaege = useMemo<Vorschlag[] | null>(() => {
    if (!feiertage || !tage) return null;
    const wochenende = (iso: string) => [0, 6].includes(fromISO(iso).getDay());
    const standard = (iso: string) => wochenende(iso) || feiertage.has(iso);
    const plan = meineFreiheit(tage, artNach);
    const istFrei = modus === "tag" ? standard : (iso: string) => plan(iso) ?? standard(iso);
    return findeUrlaub({
      von: `${jahr - 1}-12-20`,
      bis: `${jahr + 1}-01-15`,
      startAb: heute > `${jahr}-01-01` ? heute : `${jahr}-01-01`,
      startBis: `${jahr}-12-31`,
      istFrei,
      feiertage,
      budget: urlaubTage,
    });
  }, [feiertage, tage, artNach, modus, jahr, urlaubTage, heute]);

  const urlaubArt = (schichtarten ?? []).find((a) => a.art === "urlaub") ?? null;
  const land = BUNDESLAENDER.find((b) => b.code === konto.bundesland)?.name ?? konto.bundesland;

  async function eintragen(v: Vorschlag) {
    if (!urlaubArt || !tage) return;
    setLaeuft(true);
    setFehler(null);
    const vorher: Record<string, TagEintrag | undefined> = {};
    const neu: Record<string, TagEintrag | undefined> = {};
    for (const iso of v.urlaubstage) {
      const ids = idsVon(tage[iso]);
      if (ids.includes(urlaubArt.id)) continue;
      vorher[iso] = tage[iso];
      // Der Urlaub kommt zu der Schicht dazu; bei drei Einträgen ersetzt er den letzten.
      neu[iso] = eintragAus(ids.length >= MAX_JE_TAG ? [...ids.slice(0, MAX_JE_TAG - 1), urlaubArt.id] : [...ids, urlaubArt.id]);
    }
    try {
      await speichereTage(neu);
      setTage((alt) => {
        const n = { ...(alt ?? {}) };
        for (const [t, e] of Object.entries(neu)) if (e) n[t] = e;
        return n;
      });
      const n = Object.keys(neu).length;
      const rest = Math.max(0, urlaubTage - n);
      setUrlaubTage(rest);
      merke(modus, rest);
      setEingetragen({ text: `${n} ${n === 1 ? "Urlaubstag" : "Urlaubstage"} eingetragen: ${zeitraumText(v.von, v.bis)}`, vorher, n });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht eingetragen werden.");
    } finally {
      setLaeuft(false);
    }
  }

  async function zuruecknehmen() {
    if (!eingetragen) return;
    setLaeuft(true);
    try {
      await speichereTage(eingetragen.vorher);
      setTage((alt) => {
        const n = { ...(alt ?? {}) };
        for (const [t, e] of Object.entries(eingetragen.vorher)) {
          if (e) n[t] = e;
          else delete n[t];
        }
        return n;
      });
      const zurueck = Math.min(60, urlaubTage + eingetragen.n);
      setUrlaubTage(zurueck);
      merke(modus, zurueck);
      setEingetragen(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Rückgängig hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  const feld = "rounded-xl bg-ink/[0.07] px-3.5 py-2 text-[14px] font-semibold";
  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Urlaub clever legen"
        unter="Viele freie Tage für wenige Urlaubstage"
        rechts={
          <>
            <RundKnopf label="Vorheriges Jahr" onClick={() => setJahr((j) => j - 1)}>
              <ChevronLeft className="h-5 w-5" />
            </RundKnopf>
            <RundKnopf label="Nächstes Jahr" onClick={() => setJahr((j) => j + 1)}>
              <ChevronRight className="h-5 w-5" />
            </RundKnopf>
          </>
        }
      />

      <PrivatKarte>
        <div className="space-y-3.5 px-4 py-4">
          <div role="tablist" aria-label="Wie arbeitest du?" className="glas grid grid-cols-2 rounded-[14px] p-[3px]">
            {([
              ["tag", "Tagschicht Mo–Fr"],
              ["plan", "Mein Schichtplan"],
            ] as const).map(([id, name]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={modus === id}
                onClick={() => {
                  setModus(id);
                  merke(id, urlaubTage);
                  setEingetragen(null);
                }}
                className={cn(
                  "rounded-[11px] py-2.5 text-[14px] font-semibold transition-all",
                  modus === id ? "bg-surface text-ink shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "text-ink-muted",
                )}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span id="urlaub-tage" className="text-[15px] font-semibold">
              Urlaubstage übrig
            </span>
            <div className="flex items-center gap-2.5" role="group" aria-labelledby="urlaub-tage">
              <button
                type="button"
                aria-label="Weniger"
                disabled={urlaubTage <= 0}
                onClick={() => {
                  setUrlaubTage(urlaubTage - 1);
                  merke(modus, urlaubTage - 1);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.07] disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="tnum min-w-8 text-center text-[22px] font-bold">{urlaubTage}</span>
              <button
                type="button"
                aria-label="Mehr"
                disabled={urlaubTage >= 60}
                onClick={() => {
                  setUrlaubTage(urlaubTage + 1);
                  merke(modus, urlaubTage + 1);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.07] disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Feiertage für</span>
            <Link href="/privat/mehr" className={feld}>
              {land}
            </Link>
          </div>
          <p className="text-[12.5px] leading-snug text-ink-muted">
            {modus === "plan"
              ? "Bei „Mein Schichtplan“ zählt die App deine freien Tage mit und findet die Lücken in deinem Plan, auch bei Wechselschicht. Monate ohne Einträge zählen wie Montag bis Freitag."
              : "Bei „Tagschicht“ gelten Samstag, Sonntag und Feiertage als frei. Wenn du anders arbeitest, wähl „Mein Schichtplan“."}
          </p>
        </div>
      </PrivatKarte>

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}
      {eingetragen ? (
        <div className="flex items-center gap-3 rounded-[18px] bg-ok-bg px-4 py-3 text-ok-fg" role="status">
          <span className="min-w-0 flex-1 text-[14px] font-semibold">{eingetragen.text}</span>
          <Link href="/privat" className="shrink-0 text-[13.5px] font-bold underline">
            Zum Kalender
          </Link>
          <button type="button" onClick={() => void zuruecknehmen()} disabled={laeuft} className="flex shrink-0 items-center gap-1 text-[13.5px] font-bold">
            <Undo2 className="h-4 w-4" /> Rückgängig
          </button>
        </div>
      ) : null}

      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[18px] font-bold">Beste Zeiten {jahr}</h2>
        <span className="text-[12.5px] font-semibold text-ink-muted">nach Ertrag sortiert</span>
      </div>

      {!vorschlaege && !fehler ? <p className="px-1 text-[14px] text-ink-muted">Wird berechnet …</p> : null}
      {vorschlaege && !vorschlaege.length ? (
        <PrivatKarte>
          <p className="px-4 py-5 text-[14px] leading-snug text-ink-muted">
            {urlaubTage < 1
              ? "Du hast keine Urlaubstage mehr übrig. Stell oben ein, wie viele es noch sind."
              : `Mit ${urlaubTage} Urlaubstagen habe ich in ${jahr} nichts gefunden, das sich richtig lohnt. Stell oben mehr Urlaubstage ein oder wechsel das Jahr.`}
          </p>
        </PrivatKarte>
      ) : null}

      {vorschlaege?.map((v) => {
        const titel = vorschlagTitel(v, modus === "tag" ? "Brückentage" : "Freie Zeit in deinem Plan");
        const k = v.urlaubstage.length;
        const knopf =
          k === 1
            ? `${wochentagKurz(v.urlaubstage[0]!)} ${fromISO(v.urlaubstage[0]!).getDate()}. ${fromISO(v.urlaubstage[0]!).toLocaleDateString("de-DE", { month: "long" })} als Urlaub eintragen`
            : `${k} Urlaubstage eintragen`;
        return (
          <section key={v.von} className="glas space-y-2.5 rounded-[22px] p-3.5" data-von={v.von}>
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold">{titel}</h3>
                <p className="text-[13px] text-ink-muted">{zeitraumText(v.von, v.bis)}</p>
              </div>
              <span className="tnum shrink-0 rounded-full bg-ok-bg px-2.5 py-1 text-[13px] font-bold text-ok-fg">
                {v.faktor.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ×
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-bold tracking-[-0.02em]">{v.laenge} Tage frei</span>
              <span className="text-[14px] font-semibold text-ink-muted">
                für {k} {k === 1 ? "Urlaubstag" : "Urlaubstage"}
              </span>
            </div>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${v.tage.length}, minmax(0, 1fr))` }}>
              {v.tage.map((t) => (
                <span
                  key={t.iso}
                  title={`${wochentagKurz(t.iso)} ${fromISO(t.iso).getDate()}.`}
                  className="flex h-[42px] flex-col items-center justify-center gap-px rounded-md"
                  style={{ background: FARBEN[t.art].grund, color: FARBEN[t.art].schrift }}
                >
                  <span className="text-[9px] font-semibold leading-none opacity-85">{KURZ[fromISO(t.iso).getDay()]}</span>
                  <span className="text-[12px] font-bold leading-none">{fromISO(t.iso).getDate()}</span>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void eintragen(v)}
              disabled={laeuft || !urlaubArt}
              className="h-11 w-full rounded-[14px] bg-brand-500 px-3 text-[14.5px] font-bold text-white disabled:opacity-50"
            >
              {knopf}
            </button>
            {!urlaubArt ? (
              <p className="text-[12.5px] text-ink-muted">
                Lege unter <Link href="/privat/schichten?reiter=liste" className="font-semibold text-brand-600">Schichten</Link> eine Schicht vom Typ „Urlaub“ an, dann kannst du die Tage gleich eintragen.
              </p>
            ) : null}
          </section>
        );
      })}

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] font-semibold text-ink-muted">
        {[
          ["#7C4DD6", "Urlaubstag"],
          ["#CC3B40", "Feiertag"],
          ["#DFE3EE", "ohnehin frei"],
        ].map(([farbe, text]) => (
          <span key={text} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: farbe }} />
            {text}
          </span>
        ))}
      </div>
      <p className="px-1 text-[12px] leading-snug text-ink-faint">
        Die App schlägt nur vor. Welche Tage du wirklich bekommst, klärst du mit deinem Betrieb. Gerechnet wird nur auf deinem Gerät.
      </p>
    </div>
  );
}
