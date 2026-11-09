"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { CalendarPlus, Copy, Download, Minus, Palmtree, Plus, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { addDays, fromISO, heuteInBerlin, monthName } from "@/lib/dates";
import { speicherePrivatEinstellungen } from "@/lib/privat/actions";
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
import {
  anlaesse,
  datumKurz,
  planIcs,
  planText,
  planVorschlag,
  type Anlass,
  type Auswahl,
  type Moeglichkeit,
  type Strategie,
} from "@/lib/privat/urlaub";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { AbschnittKopf, PrivatKarte, PrivatKopf } from "./rahmen";

/**
 * Urlaubsplaner: je Feiertag, wie viele Urlaubstage wie viele freie Tage am
 * Stück bringen („Hebel“ = freie Tage je Urlaubstag). Vorschlag nach
 * Strategie, jede Zeile änderbar, Jahreskalender, Plan kopieren, als .ics
 * speichern oder gleich in den eigenen Kalender eintragen.
 * Gerechnet wird nur auf dem Gerät.
 */

type Modus = "tag" | "plan";
const SCHLUESSEL = "sp_urlaub:";

interface Einst {
  modus: Modus;
  tage: number;
  strategie: Strategie;
  samstag: boolean;
}

export function leseUrlaubEinst(userId: string): Einst {
  try {
    const r = JSON.parse(window.localStorage.getItem(SCHLUESSEL + userId) ?? "{}") as Record<string, unknown>;
    return {
      modus: r.modus === "plan" ? "plan" : "tag",
      tage: typeof r.tage === "number" && r.tage >= 0 && r.tage <= 60 ? Math.round(r.tage) : 30,
      strategie: r.strategie === "ausschoepfen" ? "ausschoepfen" : "bruecke",
      samstag: r.samstag === true,
    };
  } catch {
    return { modus: "tag", tage: 30, strategie: "bruecke", samstag: false };
  }
}

const zahl1 = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function Umschalter<T extends string>({ wert, optionen, onWahl, label }: { wert: T; optionen: [T, string][]; onWahl: (w: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-[14px] bg-ink/[0.07] p-[3px]" style={{ gridTemplateColumns: `repeat(${optionen.length}, minmax(0, 1fr))` }}>
      {optionen.map(([id, name]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={wert === id}
          onClick={() => onWahl(id)}
          className={cn(
            "rounded-[11px] px-2 py-2 text-[13.5px] font-semibold transition-all",
            wert === id ? "bg-surface text-ink shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "text-ink-muted",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export function PrivatUrlaub({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const { konto, schichtarten, artNach } = usePrivat();
  const router = useRouter();
  const [, uebergang] = useTransition();
  const heute = heuteInBerlin();
  const diesesJahr = Number(heute.slice(0, 4));
  // Ab Oktober plant man den Urlaub fürs nächste Jahr.
  const [jahr, setJahr] = useState(() => diesesJahr + (Number(heute.slice(5, 7)) >= 10 ? 1 : 0));
  const [einst, setEinst] = useState<Einst>({ modus: "tag", tage: 30, strategie: "bruecke", samstag: false });
  const [feiertage, setFeiertage] = useState<Map<string, string> | null>(null);
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [manuell, setManuell] = useState<Auswahl | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [eingetragen, setEingetragen] = useState<{ text: string; vorher: Record<string, TagEintrag | undefined> } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEinst(leseUrlaubEinst(konto.userId));
  }, [konto.userId]);
  const setze = useCallback(
    (teil: Partial<Einst>) => {
      setEinst((alt) => {
        const neu = { ...alt, ...teil };
        try {
          window.localStorage.setItem(SCHLUESSEL + konto.userId, JSON.stringify(neu));
        } catch {
          // gilt dann nur bis zum Schließen
        }
        return neu;
      });
      setManuell(null);
      setEingetragen(null);
    },
    [konto.userId],
  );

  useEffect(() => {
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeiertage(null);
    setManuell(null);
    void (async () => {
      try {
        const [f, t] = await Promise.all([
          Promise.all([jahr - 1, jahr, jahr + 1].map((j) => ladeFeiertage(j))),
          ladeTage(`${jahr - 1}-12-01`, `${jahr + 1}-01-31`),
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
  }, [jahr, konto.bundesland]);

  const istFrei = useMemo(() => {
    if (!feiertage || !tage) return null;
    const standard = (iso: string) => {
      const w = fromISO(iso).getDay();
      return w === 0 || (w === 6 && !einst.samstag) || feiertage.has(iso);
    };
    if (einst.modus === "tag") return standard;
    const plan = meineFreiheit(tage, artNach);
    return (iso: string) => plan(iso) ?? standard(iso);
  }, [feiertage, tage, artNach, einst.modus, einst.samstag]);

  const liste = useMemo<Anlass[] | null>(() => (feiertage && istFrei ? anlaesse(jahr, feiertage, istFrei) : null), [feiertage, istFrei, jahr]);
  const nurAb = jahr === diesesJahr ? heute : undefined;
  const vorschlag = useMemo(() => (liste ? planVorschlag(liste, einst.tage, einst.strategie, nurAb) : {}), [liste, einst.tage, einst.strategie, nurAb]);
  const auswahl = manuell ?? vorschlag;

  const imPlan = useMemo(
    () =>
      (liste ?? [])
        .filter((a) => auswahl[a.id])
        .map((a) => ({ anlass: a, m: a.moeglichkeiten.find((m) => m.k === auswahl[a.id])! }))
        .filter((z) => z.m),
    [liste, auswahl],
  );
  const urlaubSumme = imPlan.reduce((s, z) => s + z.m.k, 0);
  const freiSumme = imPlan.reduce((s, z) => s + z.m.laenge, 0);
  const land = BUNDESLAENDER.find((b) => b.code === konto.bundesland)?.name ?? konto.bundesland;
  const urlaubArt = (schichtarten ?? []).find((a) => a.art === "urlaub") ?? null;

  function waehle(a: Anlass, k: number) {
    const neu = { ...auswahl };
    if (k) neu[a.id] = k;
    else delete neu[a.id];
    setManuell(neu);
    setEingetragen(null);
  }

  async function kopieren() {
    const text = planText(jahr, land, imPlan);
    try {
      await navigator.clipboard.writeText(text);
      setMeldung("Plan kopiert – du kannst ihn jetzt einfügen.");
    } catch {
      setMeldung("Kopieren ging nicht. Halte den Text unten gedrückt und kopiere ihn.");
    }
  }

  function icsSpeichern() {
    const blob = new Blob([planIcs(jahr, imPlan)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `urlaubsplan-${jahr}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function eintragen() {
    if (!urlaubArt || !tage) return;
    setLaeuft(true);
    setFehler(null);
    const vorher: Record<string, TagEintrag | undefined> = {};
    const neu: Record<string, TagEintrag | undefined> = {};
    for (const iso of imPlan.flatMap((z) => z.m.urlaubstage)) {
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
      setEingetragen({ text: n ? `${n} ${n === 1 ? "Urlaubstag" : "Urlaubstage"} in deinen Kalender eingetragen.` : "Alles steht schon in deinem Kalender.", vorher });
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
      setEingetragen(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Rückgängig hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  const titel = `Urlaubsplaner ${jahr}`;
  const unter = "Viele freie Tage für wenige Urlaubstage";
  const wirkungslos = (liste ?? []).filter((a) => a.wirkungslos);

  return (
    <div className="space-y-4" data-urlaubsplaner>
      {eingebettet ? (
        <AbschnittKopf icon={<Palmtree className="h-[18px] w-[18px]" />} titel={titel} unter={unter} />
      ) : (
        <PrivatKopf titel={titel} unter={unter} />
      )}

      <PrivatKarte>
        <div className="space-y-3.5 px-4 py-4">
          <Umschalter
            label="Jahr"
            wert={String(jahr)}
            optionen={[
              [String(diesesJahr), String(diesesJahr)],
              [String(diesesJahr + 1), String(diesesJahr + 1)],
            ]}
            onWahl={(j) => {
              setJahr(Number(j));
              setEingetragen(null);
            }}
          />
          <label className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Bundesland</span>
            <select
              aria-label="Bundesland"
              value={konto.bundesland}
              onChange={(e) => {
                const wert = e.target.value;
                void speicherePrivatEinstellungen({ bundesland: wert }).then(() => uebergang(() => router.refresh()));
              }}
              className="max-w-[60%] rounded-xl bg-ink/[0.07] px-3 py-2 text-[14px] font-semibold"
            >
              {BUNDESLAENDER.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3">
            <span id="urlaub-tage" className="text-[15px] font-semibold">
              Urlaubstage im Jahr
            </span>
            <div className="flex items-center gap-2.5" role="group" aria-labelledby="urlaub-tage">
              <button
                type="button"
                aria-label="Weniger"
                disabled={einst.tage <= 0}
                onClick={() => setze({ tage: einst.tage - 1 })}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.07] disabled:opacity-40"
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="tnum min-w-8 text-center text-[21px] font-bold" data-urlaub-budget>
                {einst.tage}
              </span>
              <button
                type="button"
                aria-label="Mehr"
                disabled={einst.tage >= 60}
                onClick={() => setze({ tage: einst.tage + 1 })}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.07] disabled:opacity-40"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-ink-muted">Strategie</span>
            <Umschalter
              label="Strategie"
              wert={einst.strategie}
              optionen={[
                ["bruecke", "Nur echte Brückentage"],
                ["ausschoepfen", "Alle Tage nutzen"],
              ]}
              onWahl={(strategie) => setze({ strategie })}
            />
            <p className="text-[12.5px] leading-snug text-ink-muted">
              {einst.strategie === "bruecke"
                ? "Wenige Urlaubstage mit dem größten Hebel je Feiertag."
                : "Alle Urlaubstage so verteilen, dass möglichst viele freie Tage am Stück entstehen."}
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold text-ink-muted">Wie arbeitest du?</span>
            <Umschalter
              label="Wie arbeitest du?"
              wert={einst.modus}
              optionen={[
                ["tag", "Montag bis Freitag"],
                ["plan", "Nach meinem Schichtplan"],
              ]}
              onWahl={(modus) => setze({ modus })}
            />
          </div>
          {einst.modus === "tag" ? (
            <label className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold">Samstag ist bei mir Arbeitstag</span>
              <input type="checkbox" checked={einst.samstag} onChange={(e) => setze({ samstag: e.target.checked })} className="h-5 w-5 accent-brand-500" />
            </label>
          ) : (
            <p className="text-[12.5px] leading-snug text-ink-muted">
              Freie Tage aus deinem Kalender zählen mit. Monate ohne Einträge rechnen wie Montag bis Freitag.
            </p>
          )}
        </div>
      </PrivatKarte>

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}
      {!liste && !fehler ? <p className="px-1 text-[14px] text-ink-muted">Wird berechnet …</p> : null}

      {liste ? (
        <>
          <section className="glas space-y-3 rounded-[24px] px-4 pb-4 pt-3.5" data-mein-plan>
            <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">Mein Plan {jahr} · {land}</div>
            <p className="text-[24px] font-bold leading-tight tracking-[-0.02em]" data-plan-kopf>
              {freiSumme} freie Tage mit {urlaubSumme} von {einst.tage} Urlaubstagen
            </p>
            <div className="space-y-0.5 text-[14px] text-ink-muted">
              <p>
                Der Kalender schenkt dir <b className="text-ok-fg">{Math.max(0, freiSumme - urlaubSumme)} Tage</b> dazu.
              </p>
              <p>{Math.max(0, einst.tage - urlaubSumme)} Urlaubstage bleiben frei verplanbar.</p>
            </div>
            {imPlan.length ? (
              <div className="grid grid-cols-2 gap-2">
                <Knopf onClick={() => void kopieren()} icon={<Copy className="h-4 w-4" />}>
                  Plan kopieren
                </Knopf>
                <Knopf onClick={icsSpeichern} icon={<Download className="h-4 w-4" />}>
                  Als .ics speichern
                </Knopf>
                {urlaubArt ? (
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => void eintragen()}
                    className="col-span-2 flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-brand-600 text-[14.5px] font-semibold text-white disabled:opacity-50"
                  >
                    <CalendarPlus className="h-4 w-4" /> In meinen Kalender eintragen
                  </button>
                ) : null}
              </div>
            ) : null}
            {meldung ? <p className="text-[13px] font-semibold text-ok-fg" role="status">{meldung}</p> : null}
            {manuell ? (
              <button type="button" onClick={() => setManuell(null)} className="text-[13px] font-semibold text-brand-600">
                Zurück zum Vorschlag
              </button>
            ) : null}
          </section>

          {eingetragen ? (
            <div className="flex items-center gap-3 rounded-[18px] bg-ok-bg px-4 py-3 text-ok-fg" role="status">
              <span className="min-w-0 flex-1 text-[14px] font-semibold">{eingetragen.text}</span>
              <Link href="/privat" className="shrink-0 text-[13.5px] font-bold underline">
                Kalender
              </Link>
              <button type="button" onClick={() => void zuruecknehmen()} disabled={laeuft} className="flex shrink-0 items-center gap-1 text-[13.5px] font-bold">
                <Undo2 className="h-4 w-4" /> Rückgängig
              </button>
            </div>
          ) : null}

          <h2 className="px-1 pt-1 text-[18px] font-bold">Brückentage {jahr} in {land}</h2>
          <div className="space-y-3">
            {liste
              .filter((a) => !a.wirkungslos)
              .map((a) => (
                <AnlassKarte
                  key={a.id}
                  anlass={a}
                  gewaehlt={auswahl[a.id] ?? 0}
                  vorbei={!!nurAb && a.tage[a.tage.length - 1]! < nurAb}
                  onWahl={(k) => waehle(a, k)}
                />
              ))}
          </div>
          {wirkungslos.length ? (
            <p className="px-1 text-[12.5px] leading-snug text-ink-muted">
              Ohne Wirkung, weil sie auf ein Wochenende fallen: {wirkungslos.map((a) => `${a.name} (${datumKurz(a.tage[0]!)})`).join(", ")}.
            </p>
          ) : null}

          {imPlan.length ? <ImPlan zeilen={imPlan} /> : null}

          <Jahreskalender jahr={jahr} feiertage={feiertage!} istFrei={istFrei!} imPlan={imPlan} />
        </>
      ) : null}

      <p className="px-1 text-[12px] leading-snug text-ink-faint">
        Die App schlägt nur vor. Welche Tage du wirklich bekommst, klärst du mit deinem Betrieb. Gerechnet wird nur auf deinem Gerät.
      </p>
    </div>
  );
}

function Knopf({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] bg-ink/[0.07] text-[14px] font-semibold">
      {icon}
      {children}
    </button>
  );
}

/** Ein Feiertag: was welche Anzahl Urlaubstage bringt. */
function AnlassKarte({ anlass, gewaehlt, vorbei, onWahl }: { anlass: Anlass; gewaehlt: number; vorbei: boolean; onWahl: (k: number) => void }) {
  const m = anlass.moeglichkeiten.find((x) => x.k === gewaehlt) ?? null;
  return (
    <section className={cn("glas space-y-2.5 rounded-[22px] p-3.5", vorbei && "opacity-55")} data-anlass={anlass.name}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold">{anlass.name}</h3>
          <p className="text-[12.5px] text-ink-muted">{anlass.tage.map(datumKurz).join(" + ")}{vorbei ? " · schon vorbei" : ""}</p>
        </div>
        {m ? (
          <span className="tnum shrink-0 rounded-full bg-ok-bg px-2.5 py-1 text-[12.5px] font-bold text-ok-fg">
            {m.laenge} Tage frei · Hebel {zahl1(m.hebel)}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-ink/[0.07] px-2.5 py-1 text-[12.5px] font-semibold text-ink-muted">nicht im Plan</span>
        )}
      </div>
      {m ? (
        <p className="text-[13.5px]">
          <span className="text-ink-muted">Frei </span>
          <b className="tnum">
            {datumKurz(m.von)}–{datumKurz(m.bis)}
          </b>
          <span className="text-ink-muted"> · Urlaub nehmen: </span>
          <b className="tnum">{m.urlaubstage.map(datumKurz).join(", ")}</b>
        </p>
      ) : null}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label={`Urlaubstage für ${anlass.name}`}>
        <Chip an={!gewaehlt} onClick={() => onWahl(0)}>
          aus
        </Chip>
        {anlass.moeglichkeiten.map((x) => (
          <Chip key={x.k} an={gewaehlt === x.k} onClick={() => onWahl(x.k)} best={anlass.beste?.k === x.k}>
            {x.k} → {x.laenge} frei
          </Chip>
        ))}
      </div>
    </section>
  );
}

function Chip({ an, best, onClick, children }: { an: boolean; best?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={an}
      onClick={onClick}
      className={cn(
        "tnum shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
        an ? "border-ink bg-ink text-surface" : best ? "border-ok-dot/50 bg-ok-bg text-ok-fg" : "border-line bg-surface/60 text-ink-muted",
      )}
    >
      {children}
      {best && !an ? " ★" : ""}
    </button>
  );
}

function ImPlan({ zeilen }: { zeilen: { anlass: Anlass; m: Moeglichkeit }[] }) {
  return (
    <PrivatKarte titel="Im Plan">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-[13.5px]" data-im-plan>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.05em] text-ink-muted">
              <th className="px-4 py-2 font-bold">Anlass</th>
              <th className="px-2 py-2 text-right font-bold">Urlaub</th>
              <th className="px-2 py-2 text-right font-bold">Frei</th>
              <th className="px-4 py-2 text-right font-bold">Hebel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {zeilen.map((z) => (
              <tr key={z.anlass.id}>
                <td className="px-4 py-2">
                  <span className="block font-semibold">{z.anlass.name}</span>
                  <span className="tnum block text-[12px] text-ink-muted">
                    {datumKurz(z.m.von)}–{datumKurz(z.m.bis)}
                  </span>
                </td>
                <td className="tnum px-2 py-2 text-right">{z.m.k}</td>
                <td className="tnum px-2 py-2 text-right font-semibold">{z.m.laenge}</td>
                <td className="tnum px-4 py-2 text-right">{zahl1(z.m.hebel)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink font-bold">
              <td className="px-4 py-2">Gesamt</td>
              <td className="tnum px-2 py-2 text-right">{zeilen.reduce((s, z) => s + z.m.k, 0)}</td>
              <td className="tnum px-2 py-2 text-right">{zeilen.reduce((s, z) => s + z.m.laenge, 0)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </PrivatKarte>
  );
}

/** Zwölf Monate: Urlaub, Feiertag, frei – Zeiträume „frei am Stück“ umrandet. */
function Jahreskalender({
  jahr,
  feiertage,
  istFrei,
  imPlan,
}: {
  jahr: number;
  feiertage: ReadonlyMap<string, string>;
  istFrei: (iso: string) => boolean;
  imPlan: { anlass: Anlass; m: Moeglichkeit }[];
}) {
  const urlaub = new Set(imPlan.flatMap((z) => z.m.urlaubstage));
  const amStueck = (iso: string) => imPlan.some((z) => iso >= z.m.von && iso <= z.m.bis);
  return (
    <PrivatKarte titel={`Jahreskalender ${jahr}`}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-3 py-3.5 sm:grid-cols-3 lg:grid-cols-4" data-jahreskalender>
        {Array.from({ length: 12 }, (_, m) => {
          const erster = `${jahr}-${String(m + 1).padStart(2, "0")}-01`;
          const versatz = (fromISO(erster).getDay() + 6) % 7;
          const anzahl = new Date(jahr, m + 1, 0).getDate();
          return (
            <div key={m} className="min-w-0">
              <p className="mb-1 text-[12.5px] font-bold">{monthName(m)}</p>
              <div className="grid grid-cols-7 gap-[2px] text-center">
                {KURZ.map((k) => (
                  <span key={k} className="text-[8.5px] font-semibold text-ink-faint">
                    {k[0]}
                  </span>
                ))}
                {Array.from({ length: versatz }, (_, i) => (
                  <span key={`l${i}`} />
                ))}
                {Array.from({ length: anzahl }, (_, i) => {
                  const iso = addDays(erster, i);
                  const art = urlaub.has(iso) ? "urlaub" : feiertage.has(iso) ? "feiertag" : istFrei(iso) ? "frei" : "arbeit";
                  return (
                    <span
                      key={iso}
                      title={feiertage.get(iso)}
                      className={cn(
                        "tnum flex aspect-square items-center justify-center rounded-[4px] text-[9.5px] font-semibold",
                        art === "urlaub" && "bg-[#7C4DD6] text-white",
                        art === "feiertag" && "bg-[#CC3B40] text-white",
                        art === "frei" && "bg-ink/[0.08] text-ink-muted",
                        art === "arbeit" && "text-ink",
                        amStueck(iso) && "ring-[1.5px] ring-ok-dot",
                      )}
                    >
                      {i + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] font-semibold text-ink-muted">
        <Legende farbe="bg-[#7C4DD6]">Urlaubstag</Legende>
        <Legende farbe="bg-[#CC3B40]">Feiertag</Legende>
        <Legende farbe="bg-ink/[0.12]">Wochenende / frei</Legende>
        <Legende farbe="ring-[1.5px] ring-ok-dot">frei am Stück</Legende>
      </div>
    </PrivatKarte>
  );
}

function Legende({ farbe, children }: { farbe: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-[3px]", farbe)} />
      {children}
    </span>
  );
}
