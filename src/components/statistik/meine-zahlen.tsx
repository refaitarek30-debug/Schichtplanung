"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { nurMonat, rechne, type StatTag, type Zahlen } from "@/lib/statistik";
import { cn } from "@/lib/utils";

/**
 * „Meine Zahlen“ – eigene Statistik, nur für die Person selbst, freiwillig und
 * zur Unterhaltung. Nichts wird gespeichert; gerechnet wird beim Öffnen aus dem
 * eigenen Plan. Vergleich nur mit dem eigenen Vorjahr. Kranktage erst auf Wunsch.
 */

export interface JahrDaten {
  tage: StatTag[];
  feiertage: Set<string>;
}

type Reiter = "jahr" | "monat" | "vergleich";
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WT = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const std = (n: number) => `${zahl(Math.round(n))} Std.`;

export function MeineZahlen({ lade, zurueck }: { lade: (jahr: number) => Promise<JahrDaten>; zurueck?: () => void }) {
  const heute = new Date();
  const [jahr, setJahr] = useState(heute.getFullYear());
  const [monat, setMonat] = useState(heute.getMonth());
  const [reiter, setReiter] = useState<Reiter>("jahr");
  const [daten, setDaten] = useState<Record<number, JahrDaten>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [krankZeigen, setKrankZeigen] = useState(false);
  const [rueckblick, setRueckblick] = useState(false);
  const angefragt = useRef(new Set<number>());

  useEffect(() => {
    for (const j of [jahr, jahr - 1]) {
      if (angefragt.current.has(j)) continue;
      angefragt.current.add(j);
      lade(j)
        .then((d) => setDaten((alt) => ({ ...alt, [j]: d })))
        .catch((e: unknown) => {
          // Das Vorjahr ist Beiwerk – nur das gewählte Jahr meldet einen Fehler.
          if (j === jahr) {
            angefragt.current.delete(j);
            setFehler(e instanceof Error ? e.message : "Die Zahlen konnten nicht geladen werden.");
          } else setDaten((alt) => ({ ...alt, [j]: { tage: [], feiertage: new Set() } }));
        });
    }
  }, [jahr, lade]);

  const d = daten[jahr];
  const dVor = daten[jahr - 1];
  const z = useMemo(() => (d ? rechne(reiter === "monat" ? nurMonat(d.tage, jahr, monat) : d.tage, d.feiertage) : null), [d, reiter, jahr, monat]);
  const zJahr = useMemo(() => (d ? rechne(d.tage, d.feiertage) : null), [d]);
  const zVor = useMemo(() => (dVor ? rechne(dVor.tage, dVor.feiertage) : null), [dVor]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-3.5 pb-6 sm:px-0" data-meine-zahlen>
      <header className="flex items-center gap-2 pt-1">
        {zurueck ? (
          <button type="button" onClick={zurueck} aria-label="Zurück" className="glas flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight">Meine Zahlen</h1>
          <p className="text-[13px] text-ink-muted">Nur du siehst das · zum Spaß, nichts wird gespeichert</p>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <div className="glas flex flex-1 rounded-[14px] p-[3px]">
          {(
            [
              ["jahr", "Jahr"],
              ["monat", "Monat"],
              ["vergleich", "Vergleich"],
            ] as [Reiter, string][]
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              aria-pressed={reiter === id}
              onClick={() => setReiter(id)}
              className={cn("h-9 flex-1 rounded-[11px] text-[13.5px] font-semibold", reiter === id ? "bg-surface text-ink shadow-sm" : "text-ink-muted")}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="glas flex h-[42px] items-center rounded-[14px] px-1">
          <button type="button" aria-label="Jahr zurück" onClick={() => setJahr((j) => j - 1)} className="flex h-9 w-8 items-center justify-center">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tnum w-11 text-center text-[14px] font-bold">{jahr}</span>
          <button type="button" aria-label="Jahr vor" disabled={jahr >= heute.getFullYear() + 1} onClick={() => setJahr((j) => j + 1)} className="flex h-9 w-8 items-center justify-center disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {reiter === "monat" ? (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {MON.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-pressed={monat === i}
              onClick={() => setMonat(i)}
              className={cn("h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold", monat === i ? "bg-ink text-surface" : "glas")}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : null}

      {fehler ? <p className="glas rounded-[16px] px-4 py-3 text-[14px] text-crit-fg">{fehler}</p> : null}
      {!z && !fehler ? <p className="px-1 text-[14px] text-ink-muted">Zahlen werden gerechnet …</p> : null}

      {z && z.tageMitDaten === 0 ? (
        <p className="glas rounded-[16px] px-4 py-4 text-[14px] text-ink-muted">Für diesen Zeitraum steht noch nichts im Plan.</p>
      ) : null}

      {z && z.tageMitDaten > 0 && reiter !== "vergleich" ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Kachel n={z.arbeitstage} titel="Arbeitstage" unter={std(z.stunden)} farbe="#DDEBE0" />
            <Kachel n={z.sonntage} titel="Sonntage gearbeitet" unter={std(z.sonntagStunden)} farbe="#FBE9C8" />
            <Kachel n={z.feiertage} titel="Feiertage gearbeitet" unter={std(z.feiertagStunden)} farbe="#F3D6DC" />
            <Kachel n={z.naechte} titel="Nachtschichten" unter={z.naechte ? `${std(z.nachtStunden)} wach, wenn andere schlafen` : "keine"} farbe="#D9DEEE" />
            <Kachel n={z.laengsteSerie} titel="längste Serie" unter="Arbeitstage am Stück" farbe="#E6F0FA" />
            <Kachel n={z.laengsteFrei} titel="längste Pause" unter="freie Tage am Stück" farbe="#E0F4F1" />
            <Kachel n={z.freieWochenenden} titel="freie Wochenenden" unter={`von ${z.wochenenden}`} farbe="#EEE1F1" />
            <Kachel n={z.urlaub} titel="Urlaubstage" unter={z.freieTage ? `dazu ${z.freieTage} freie Tage` : ""} farbe="#FCE9DB" />
          </div>

          <div className="glas divide-y divide-line rounded-[18px] text-[14px]">
            <Zeile name="Samstage gearbeitet" wert={zahl(z.samstage)} />
            <Zeile name="Wechsel zwischen Schichten" wert={zahl(z.wechsel)} />
            <Zeile name="Am häufigsten frei" wert={z.freiTag === null ? "–" : WT[z.freiTag]} />
            {reiter === "jahr" ? <Zeile name="Fleißigster Monat" wert={z.fleissigsterMonat === null ? "–" : MON[z.fleissigsterMonat]} /> : null}
            <Zeile name="Anteil deiner Zeit bei der Arbeit" wert={`${zahl(z.anteilArbeit)} %`} />
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span>Kranktage</span>
              {krankZeigen ? (
                <span className="font-semibold" data-krank-wert>
                  {zahl(z.krank)}
                </span>
              ) : (
                <button type="button" onClick={() => setKrankZeigen(true)} className="font-semibold text-brand-600" data-krank-zeigen>
                  anzeigen
                </button>
              )}
            </div>
          </div>
        </>
      ) : null}

      {reiter === "vergleich" && zJahr && zVor ? (
        zVor.tageMitDaten === 0 ? (
          <p className="glas rounded-[16px] px-4 py-4 text-[14px] text-ink-muted">Für {jahr - 1} gibt es keine Einträge – der Vergleich kommt, sobald zwei Jahre im Plan stehen.</p>
        ) : (
          <div className="glas space-y-3.5 rounded-[18px] px-4 py-4" data-vergleich>
            <p className="text-[12.5px] text-ink-muted">
              <i className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-brand-500 align-[-1px]" />
              {jahr}
              <i className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-ink/25 align-[-1px]" />
              {jahr - 1} · nur deine eigenen Zahlen
            </p>
            {(
              [
                ["Arbeitstage", "arbeitstage"],
                ["Sonntage", "sonntage"],
                ["Feiertage", "feiertage"],
                ["Nachtschichten", "naechte"],
                ["Urlaubstage", "urlaub"],
                ["Freie Wochenenden", "freieWochenenden"],
                ["Längste Serie", "laengsteSerie"],
              ] as [string, keyof Zahlen][]
            ).map(([name, k]) => (
              <Balken key={k} name={name} a={Number(zJahr[k])} b={Number(zVor[k])} />
            ))}
          </div>
        )
      ) : null}

      {zJahr && zJahr.tageMitDaten > 0 ? (
        <button
          type="button"
          onClick={() => setRueckblick(true)}
          data-rueckblick-start
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-surface active:scale-[0.98]"
        >
          <Sparkles className="h-[18px] w-[18px]" /> Mein Jahr {jahr} ansehen
        </button>
      ) : null}

      {rueckblick && zJahr ? <Rueckblick z={zJahr} jahr={jahr} onZu={() => setRueckblick(false)} /> : null}
    </div>
  );
}

function Kachel({ n, titel, unter, farbe }: { n: number; titel: string; unter: string; farbe: string }) {
  return (
    <div className="flex min-h-[104px] flex-col rounded-[18px] p-3 text-[#14161c]" style={{ backgroundColor: farbe }}>
      <b className="tnum text-[30px] leading-[1.05]">{zahl(n)}</b>
      <span className="mt-0.5 text-[13px] font-semibold leading-tight">{titel}</span>
      <small className="mt-auto pt-1 text-[11.5px] leading-tight text-black/60">{unter}</small>
    </div>
  );
}

function Zeile({ name, wert }: { name: string; wert: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span>{name}</span>
      <span className="font-semibold">{wert}</span>
    </div>
  );
}

function Balken({ name, a, b }: { name: string; a: number; b: number }) {
  const max = Math.max(a, b, 1);
  const diff = a - b;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-semibold">{name}</span>
        <span className="text-[12px] text-ink-muted">{diff === 0 ? "gleich" : `${diff > 0 ? "+" : "−"}${zahl(Math.abs(diff))}`}</span>
      </div>
      {[
        [a, "bg-brand-500"],
        [b, "bg-ink/25"],
      ].map(([w, klasse], i) => (
        <div key={i} className="mt-1 flex items-center gap-2">
          <i className={cn("block h-2.5 rounded-full", klasse as string)} style={{ width: `${Math.max(2, (Number(w) / max) * 86)}%` }} />
          <span className="tnum text-[12px] text-ink-muted">{zahl(Number(w))}</span>
        </div>
      ))}
    </div>
  );
}

/** „Mein Jahr“: eine Zahl je Seite zum Durchtippen. Ohne Kranktage. */
function Rueckblick({ z, jahr, onZu }: { z: Zahlen; jahr: number; onZu: () => void }) {
  const seiten = useMemo(
    () =>
      (
        [
          [z.arbeitstage, "Arbeitstage", `Zusammen ${std(z.stunden)} – das sind rund ${zahl(Math.round(z.stunden / 24))} volle Tage am Stück.`],
          [z.sonntage, "Sonntage gearbeitet", `${std(z.sonntagStunden)}, während andere frühstücken.${z.samstage ? ` Dazu ${zahl(z.samstage)} Samstage.` : ""}`],
          [z.feiertage, "Feiertage gearbeitet", `${std(z.feiertagStunden)} an Tagen, an denen der Kalender rot ist.`],
          [z.naechte, "Nächte durchgearbeitet", `${std(z.nachtStunden)} wach, wenn andere schlafen.`],
          [z.laengsteSerie, "Tage am Stück", "Deine längste Serie ohne freien Tag."],
          [z.laengsteFrei, "freie Tage am Stück", "Deine längste Pause – hoffentlich mit Sonne."],
          [z.freieWochenenden, "freie Wochenenden", `Von ${zahl(z.wochenenden)} Wochenenden im Plan.${z.freiTag !== null ? ` Am häufigsten frei: ${WT[z.freiTag]}.` : ""}`],
          [z.wechsel, "Schichtwechsel", z.fleissigsterMonat !== null ? `Dein fleißigster Monat war der ${MON[z.fleissigsterMonat]}.` : "So oft hat dein Rhythmus gewechselt."],
        ] as [number, string, string][]
      ).filter(([n]) => n > 0),
    [z],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onZu();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onZu]);
  const s = seiten[Math.min(i, seiten.length - 1)];
  if (!s) return null;
  const letzte = i >= seiten.length - 1;
  return (
    <div className="privat-schrift fixed inset-0 z-[80] flex flex-col justify-center bg-[linear-gradient(160deg,#1b2350,#0e1330)] px-7 text-white" role="dialog" aria-label={`Mein Jahr ${jahr}`} data-rueckblick>
      <button type="button" onClick={onZu} aria-label="Schließen" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        <X className="h-5 w-5" />
      </button>
      <p className="text-[14px] text-[#9fb0ff]">
        Dein Jahr {jahr} · {i + 1} von {seiten.length}
      </p>
      <div className="tnum bg-[linear-gradient(90deg,#8ea2ff,#f0a6ff)] bg-clip-text text-[112px] font-extrabold leading-none text-transparent">{zahl(s[0])}</div>
      <h2 className="mt-1 text-[26px] font-bold leading-tight">{s[1]}</h2>
      <p className="mt-2 text-[16px] leading-relaxed text-[#c9d0f0]">{s[2]}</p>
      <div className="my-6 flex gap-1.5">
        {seiten.map((_, k) => (
          <i key={k} className={cn("h-1 flex-1 rounded-full", k === i ? "bg-white" : "bg-white/20")} />
        ))}
      </div>
      <div className="flex gap-2">
        {i > 0 ? (
          <button type="button" onClick={() => setI(i - 1)} className="h-12 rounded-full bg-white/10 px-5 text-[15px] font-semibold">
            Zurück
          </button>
        ) : null}
        <button type="button" onClick={() => (letzte ? onZu() : setI(i + 1))} className="h-12 flex-1 rounded-full bg-white text-[15px] font-bold text-[#111]" data-rueckblick-weiter>
          {letzte ? "Fertig" : "Weiter"}
        </button>
      </div>
    </div>
  );
}
