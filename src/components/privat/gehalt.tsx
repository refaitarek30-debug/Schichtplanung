"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Settings2, Wallet } from "lucide-react";
import { monthName, toISO } from "@/lib/dates";
import { ladeFeiertage, ladeTage, ladeTagZeiten, type Schichtart, type TagEintrag, type TagZeit } from "@/lib/privat/daten";
import {
  rechne,
  GEHALT_STANDARD,
  JOB_STANDARD,
  ladeGehaltEinstellungen,
  minijobGrenze,
  speichereGehaltEinstellungen,
  zahlAusText,
  type GehaltEinstellungen,
  type Job,
  type JobArt,
  type JobRechnung,
  type Rechnung,
} from "@/lib/privat/gehalt";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";
import { usePrivat } from "./kontext";
import { AbschnittKopf, PrivatKarte, RundKnopf } from "./rahmen";

/**
 * Geld je Job: Jede Arbeitsschicht gehört zu einem Job (z. B. Tankstelle als
 * Minijob, Ausbildung ohne Geld). Je Job ein eigener Lohn, eigene Zuschläge,
 * Netto (Minijob) oder Brutto-Schätzung. Beim ersten Mal führt ein kurzer
 * Assistent durch die Einrichtung. Jobs, Lohn und Zuschläge stehen nur in
 * diesem Browser, nie auf dem Server.
 */

const GEHALT_EREIGNIS = "sp-gehalt-geaendert";

const std = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const mitVorzeichen = (n: number) => `${n > 0.05 ? "+" : ""}${std(Math.abs(n) < 0.05 ? 0 : n)}`;
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function useGehalt(userId: string) {
  const [einst, setEinst] = useState<GehaltEinstellungen>(GEHALT_STANDARD);
  useEffect(() => {
    // Erst nach dem Laden im Browser: auf dem Server gibt es keinen lokalen Speicher.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEinst(ladeGehaltEinstellungen(userId));
    // Andere Stellen auf der Seite (z. B. die Kachel „Geld“) lesen mit, wenn hier etwas geändert wird.
    const neuLesen = () => setEinst(ladeGehaltEinstellungen(userId));
    window.addEventListener(GEHALT_EREIGNIS, neuLesen);
    return () => window.removeEventListener(GEHALT_EREIGNIS, neuLesen);
  }, [userId]);
  const setze = useCallback(
    (teil: Partial<GehaltEinstellungen>) => {
      const neu = { ...ladeGehaltEinstellungen(userId), ...teil };
      speichereGehaltEinstellungen(userId, neu);
      setEinst(neu);
      window.dispatchEvent(new Event(GEHALT_EREIGNIS));
    },
    [userId],
  );
  return { einst, setze };
}

/** Soll, Ist und Überstunden – mit den einzelnen Wochen. */
export function UeberstundenKarte({ re, titel = "Überstunden" }: { re: Rechnung; titel?: string }) {
  if (re.soll === null || re.differenz === null) {
    return (
      <PrivatKarte titel={titel}>
        <p className="px-4 py-4 text-[14px] text-ink-muted">
          Trag unter{" "}
          <Link href="/privat/mehr" className="font-semibold text-brand-600">
            Mehr
          </Link>{" "}
          deine Wochenstunden ein, dann siehst du hier Soll, Ist und Überstunden.
        </p>
      </PrivatKarte>
    );
  }
  const maxAbw = Math.max(1, ...re.wochen.map((w) => Math.abs(w.ist - w.soll)));
  const plus = re.differenz > 0.05;
  return (
    <PrivatKarte titel={titel}>
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className={cn("tnum text-[34px] font-bold leading-none tracking-[-0.02em]", plus && "text-warn-fg")}>
              {mitVorzeichen(re.differenz)} <span className="text-[18px] font-semibold">Std</span>
            </div>
            <div className="mt-1 text-[13px] text-ink-muted">{plus ? "Überstunden" : re.differenz < -0.05 ? "Minusstunden" : "genau im Soll"}</div>
          </div>
          <dl className="tnum text-right text-[13px] leading-snug text-ink-muted">
            <div>
              Soll <b className="font-semibold text-ink">{std(re.soll)}</b>
            </div>
            <div>
              Ist <b className="font-semibold text-ink">{std(re.ist)}</b>
            </div>
          </dl>
        </div>
        {re.wochen.length > 1 ? (
          <ul className="mt-4 space-y-2" aria-label="Überstunden je Woche">
            {re.wochen.map((w) => {
              const d = w.ist - w.soll;
              const anteil = Math.min(100, (Math.abs(d) / maxAbw) * 100);
              return (
                <li key={w.von} className="grid grid-cols-[3.4rem_1fr_3.6rem] items-center gap-2 text-[12.5px]">
                  <span className="text-ink-muted">KW {w.kw}</span>
                  <span className="relative h-3 rounded-full bg-ink/[0.06]" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-ink/25" />
                    <span
                      className={cn("absolute inset-y-0 rounded-full", d > 0.05 ? "bg-warn-dot" : "bg-ink/30")}
                      style={d > 0.05 ? { left: "50%", width: `${anteil / 2}%` } : { right: "50%", width: `${anteil / 2}%` }}
                    />
                  </span>
                  <span className="tnum text-right font-semibold">{mitVorzeichen(d)} h</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="mt-3 text-[12px] leading-snug text-ink-faint">
          Ist zählt alle eingetragenen Stunden, bei Urlaub und Krank deren Stunden statt der Schicht darunter. Soll: Wochenstunden
          verteilt auf Montag bis Freitag, ohne Feiertage unter der Woche, ab deinem ersten eingetragenen Tag.
        </p>
      </div>
    </PrivatKarte>
  );
}

function Schalter({ an, onChange, labelId }: { an: boolean; onChange: (an: boolean) => void; labelId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-labelledby={labelId}
      onClick={() => onChange(!an)}
      className={cn("relative h-[34px] w-[56px] shrink-0 rounded-full transition-colors", an ? "bg-brand-500" : "bg-ink/20")}
    >
      <span
        className={cn("absolute top-[3px] h-7 w-7 rounded-full bg-white shadow transition-all", an ? "left-[25px]" : "left-[3px]")}
      />
    </button>
  );
}

/** Zahlenfeld: tippt man etwas Ungültiges, springt es beim Verlassen zurück. */
function Zahlenfeld({
  id,
  wert,
  min,
  max,
  einheit,
  breite = "w-[72px]",
  platzhalter,
  onWert,
  kommastellen = 2,
}: {
  id: string;
  wert: number | null;
  min: number;
  max: number;
  einheit: string;
  breite?: string;
  platzhalter?: string;
  onWert: (n: number | null) => void;
  kommastellen?: number;
}) {
  const alsText = (n: number | null) =>
    n === null
      ? ""
      : n.toLocaleString("de-DE", { maximumFractionDigits: kommastellen, minimumFractionDigits: einheit === "€" && !Number.isInteger(n) ? 2 : 0 });
  const [text, setText] = useState(alsText(wert));
  const [fokus, setFokus] = useState(false);
  // Wert von außen (z. B. beim Laden) nur übernehmen, solange nicht getippt wird.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!fokus) setText(alsText(wert));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert, fokus]);
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={platzhalter}
        onFocus={() => setFokus(true)}
        onBlur={() => setFokus(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = zahlAusText(e.target.value);
          if (n === null && e.target.value.trim() === "" && min <= 0 && platzhalter !== undefined) onWert(null);
          else if (n !== null && n >= min && n <= max) onWert(n);
        }}
        className={cn(
          "h-11 rounded-[12px] border-2 border-ink/10 bg-surface px-3 text-right text-[17px] font-bold outline-none focus:border-brand-500",
          breite,
        )}
      />
      <span className="text-[15px] font-bold text-ink-muted">{einheit}</span>
    </span>
  );
}


const ART_TEXT: Record<JobArt, { name: string; kurz: string; unter: string }> = {
  minijob: { name: "Minijob", kurz: "Minijob · netto", unter: "Ausgezahlt wird, was du verdienst – ohne Abzüge." },
  brutto: { name: "Normaler Job", kurz: "Brutto-Schätzung", unter: "Mit Steuern und Abgaben – ShiftNexo schätzt brutto." },
  ohne: { name: "Ohne Geld", kurz: "nur Stunden", unter: "Z. B. Ausbildung mit festem Betrag: nur Stunden zählen." },
};

/** Arbeitsschichten, die zu diesem Job gehören (ohne Zuordnung: zum Hauptjob). */
function schichtenVon(job: Job, einst: GehaltEinstellungen, arten: readonly Schichtart[]): Schichtart[] {
  return arten.filter(
    (a) => a.art === "arbeit" && (einst.zuordnung[a.id] === job.id || (!einst.zuordnung[a.id] && einst.hauptjob === job.id)),
  );
}

const jobFarbe = (job: Job, einst: GehaltEinstellungen, arten: readonly Schichtart[]) =>
  schichtenVon(job, einst, arten)[0]?.farbe ?? "rgb(var(--c-brand-500))";

/** Wahl aus zwei oder drei Möglichkeiten (z. B. Minijob / Normal / Ohne Geld). */
function Wahl<T extends string>({ wert, optionen, onWahl, label }: { wert: T; optionen: { id: T; name: string }[]; onWahl: (w: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-[14px] bg-ink/[0.07] p-1" style={{ gridTemplateColumns: `repeat(${optionen.length}, minmax(0, 1fr))` }}>
      {optionen.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={wert === o.id}
          onClick={() => onWahl(o.id)}
          className={cn(
            "rounded-[11px] px-2 py-2 text-[13.5px] font-semibold transition-colors",
            wert === o.id ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted",
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

const ART_OPTIONEN: { id: JobArt; name: string }[] = [
  { id: "minijob", name: "Minijob" },
  { id: "brutto", name: "Normal" },
  { id: "ohne", name: "Ohne Geld" },
];

/** Band 0–24 Uhr: welche Stunden der Schicht normal sind und welche Nachtzuschlag bekommen. */
function UhrBand({ schicht, job }: { schicht: Schichtart; job: Pick<Job, "nacht" | "nachtVon" | "nachtBis"> }) {
  const b = /^(\d{2}):(\d{2})$/.exec(schicht.beginn);
  const e = /^(\d{2}):(\d{2})$/.exec(schicht.ende);
  if (!b || !e) return null;
  const von = Number(b[1]) + Number(b[2]) / 60;
  let bis = Number(e[1]) + Number(e[2]) / 60;
  if (bis <= von) bis += 24;
  const nv = job.nachtVon % 24;
  const nb = job.nachtBis % 24;
  const istNacht = (h: number) => job.nacht > 0 && nv !== nb && (nv > nb ? h >= nv || h < nb : h >= nv && h < nb);
  const stunden = Array.from({ length: 24 }, (_, h) => h);
  const inSchicht = (h: number) => (h >= von && h < bis) || (h + 24 >= von && h + 24 < bis);
  let normal = 0;
  let nacht = 0;
  for (let m = von * 60; m < bis * 60; m++) {
    if (istNacht(Math.floor(m / 60) % 24)) nacht += 1;
    else normal += 1;
  }
  return (
    <div className="space-y-1.5" data-uhr-band>
      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]" aria-hidden>
        {stunden.map((h) => (
          <span
            key={h}
            className={cn("h-4 rounded-[3px]", !inSchicht(h) ? "bg-ink/[0.07]" : istNacht(h) ? "bg-warn-dot" : "bg-brand-500/45")}
          />
        ))}
      </div>
      <div className="tnum flex justify-between text-[10.5px] text-ink-faint" aria-hidden>
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
      <p className="text-[12.5px] text-ink-muted">
        {schicht.name} {schicht.beginn}–{schicht.ende}: {std(normal / 60)} Std normal
        {nacht > 0 ? `, ${std(nacht / 60)} Std mit ${std(job.nacht)} % Nachtzuschlag` : ", kein Nachtzuschlag"}.
      </p>
    </div>
  );
}

/** Eine Karte je Job: was im Monat herauskommt, aufgeschlüsselt. */
function JobKarte({ jr, farbe, onEinstellungen }: { jr: JobRechnung; farbe: string; onEinstellungen: () => void }) {
  const { job, geld } = jr;
  const zeilen: { text: string; detail: string; betrag: number }[] = [];
  if (geld && job.stundenlohn !== null) {
    zeilen.push({ text: "Grundlohn", detail: `${std(jr.stunden)} Std × ${euro(job.stundenlohn)}`, betrag: geld.grundlohn });
    if (jr.zuschlag.nacht > 0 && job.nacht > 0)
      zeilen.push({
        text: `Nachtzuschlag ${std(job.nacht)} %`,
        detail: `${std(jr.zuschlag.nacht)} Std zwischen ${job.nachtVon} und ${job.nachtBis} Uhr`,
        betrag: geld.nacht,
      });
    if (jr.zuschlag.sonntag > 0 && job.sonntag > 0)
      zeilen.push({ text: `Sonntagszuschlag ${std(job.sonntag)} %`, detail: `${std(jr.zuschlag.sonntag)} Std`, betrag: geld.sonntag });
    if (jr.zuschlag.feiertag > 0 && job.feiertag > 0)
      zeilen.push({ text: `Feiertagszuschlag ${std(job.feiertag)} %`, detail: `${std(jr.zuschlag.feiertag)} Std`, betrag: geld.feiertag });
    if (geld.ueber > 0) zeilen.push({ text: `Überstundenzuschlag ${std(job.ueber)} %`, detail: "Stunden über Soll", betrag: geld.ueber });
  }
  const anteil = jr.minijob ? Math.min(100, (jr.minijob.zaehlt / jr.minijob.grenze) * 100) : 0;
  const ueberGrenze = jr.minijob ? jr.minijob.zaehlt > jr.minijob.grenze : false;
  return (
    <section className="glas overflow-hidden rounded-[22px]" data-job-karte={job.name}>
      <div className="space-y-3 px-4 pb-4 pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: farbe }} aria-hidden />
          <h3 className="min-w-0 flex-1 truncate text-[17px] font-bold">{job.name}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
              job.art === "minijob" ? "bg-ok-bg text-ok-fg" : job.art === "brutto" ? "bg-brand-500/12 text-brand-600" : "bg-ink/[0.07] text-ink-muted",
            )}
          >
            {ART_TEXT[job.art].kurz}
          </span>
        </div>

        {job.art === "ohne" ? (
          <p className="text-[14px] text-ink-muted">
            {jr.schichten} Schichten · {std(jr.stunden)} Std{jr.istHaupt ? " · zählt für deine Überstunden" : ""}
          </p>
        ) : geld ? (
          <>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
                {job.art === "minijob" ? "Wird ausgezahlt" : "Geschätzt brutto"}
              </div>
              <div className="tnum mt-0.5 text-[30px] font-bold leading-none tracking-[-0.02em]" data-job-betrag>
                {euro(geld.summe)}
              </div>
              <div className="mt-1 text-[12.5px] text-ink-muted">
                {jr.schichten} Schichten · {std(jr.stunden)} Std
              </div>
            </div>
            <dl className="divide-y divide-line">
              {zeilen.map((z) => (
                <div key={z.text} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <dt className="text-[14px] font-semibold">{z.text}</dt>
                    <dd className="text-[12.5px] text-ink-muted">{z.detail}</dd>
                  </div>
                  <span className="tnum shrink-0 text-[14.5px] font-semibold">{euro(z.betrag)}</span>
                </div>
              ))}
            </dl>
            {jr.minijob ? (
              <div className="space-y-1.5" data-minijob-grenze>
                <div className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-ink-muted">Minijob-Grenze</span>
                  <span className={cn("tnum font-semibold", ueberGrenze && "text-crit-fg")}>
                    {euro(jr.minijob.zaehlt)} von {euro(jr.minijob.grenze)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink/[0.08]" aria-hidden>
                  <span
                    className={cn("block h-full rounded-full", ueberGrenze ? "bg-crit-dot" : anteil > 90 ? "bg-warn-dot" : "bg-ok-dot")}
                    style={{ width: `${anteil}%` }}
                  />
                </div>
                <p className="text-[11.5px] leading-snug text-ink-faint">
                  {ueberGrenze
                    ? "Über der Grenze – sprich mit deinem Arbeitgeber, sonst ist es kein Minijob mehr."
                    : "Zuschläge für Nacht, Sonntag und Feiertag zählen in der Regel nicht zur Grenze."}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[14px] text-ink-muted">Trag den Stundenlohn ein, dann rechnet ShiftNexo diesen Job aus.</p>
        )}

        <button
          type="button"
          onClick={onEinstellungen}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-ink/[0.06] text-[14px] font-semibold"
        >
          <Settings2 className="h-4 w-4" /> Lohn, Zuschläge, Schichten
        </button>
      </div>
    </section>
  );
}

/** Feld mit Beschriftung links und Eingabe rechts. */
function FeldZeile({ id, name, hinweis, children, aus = false }: { id?: string; name: string; hinweis?: ReactNode; children: ReactNode; aus?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", aus && "opacity-45")}>
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[15px] font-semibold">{name}</span>
        {hinweis ? <span className="block text-[12.5px] leading-snug text-ink-muted">{hinweis}</span> : null}
      </label>
      {children}
    </div>
  );
}

/** Nachtzuschlag: Prozent und Zeitraum. */
function NachtFelder({ job, aendere, praefix }: { job: Job; aendere: (t: Partial<Job>) => void; praefix: string }) {
  return (
    <>
      <FeldZeile id={`${praefix}-nacht`} name="Nachtzuschlag" hinweis="0 = keiner">
        <Zahlenfeld id={`${praefix}-nacht`} wert={job.nacht} min={0} max={500} einheit="%" onWert={(n) => n !== null && aendere({ nacht: n })} />
      </FeldZeile>
      <FeldZeile name="Nachtzeit" hinweis="volle Stunden, z. B. 23 bis 24 oder 20 bis 6" aus={job.nacht === 0}>
        <span className="flex shrink-0 items-center gap-1.5">
          <Zahlenfeld id={`${praefix}-nacht-von`} wert={job.nachtVon} min={0} max={24} einheit="–" breite="w-[56px]" kommastellen={0} onWert={(n) => n !== null && aendere({ nachtVon: Math.round(n) })} />
          <Zahlenfeld id={`${praefix}-nacht-bis`} wert={job.nachtBis} min={0} max={24} einheit="Uhr" breite="w-[56px]" kommastellen={0} onWert={(n) => n !== null && aendere({ nachtBis: Math.round(n) })} />
        </span>
      </FeldZeile>
    </>
  );
}

/** Schichten ankreuzen, die zu diesem Job gehören. */
function SchichtWahl({
  job,
  einst,
  arten,
  gewaehlt,
  onTipp,
}: {
  job: Job;
  einst: GehaltEinstellungen;
  arten: readonly Schichtart[];
  gewaehlt: ReadonlySet<string>;
  onTipp: (id: string) => void;
}) {
  const arbeit = arten.filter((a) => a.art === "arbeit");
  if (!arbeit.length) {
    return (
      <p className="py-2 text-[13.5px] text-ink-muted">
        Du hast noch keine Arbeitsschicht. Leg sie unter{" "}
        <Link href="/privat/schichten?reiter=liste" className="font-semibold text-brand-600">
          Meine Schichten
        </Link>{" "}
        an.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line" data-schicht-wahl>
      {arbeit.map((a) => {
        const an = gewaehlt.has(a.id);
        const anderer = einst.jobs.find((j) => j.id === einst.zuordnung[a.id] && j.id !== job.id);
        return (
          <li key={a.id}>
            <button type="button" role="checkbox" aria-checked={an} onClick={() => onTipp(a.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border-2",
                  an ? "border-brand-500 bg-brand-500 text-white" : "border-ink/15",
                )}
              >
                {an ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: a.farbe }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{a.name}</span>
                <span className="block text-[12.5px] text-ink-muted">
                  {a.beginn && a.ende ? `${a.beginn}–${a.ende} · ` : ""}
                  {std(a.stunden)} Std{!an && anderer ? ` · gehört zu ${anderer.name}` : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Einstellungen eines Jobs – jede Änderung gilt sofort. */
function JobBlatt({
  job,
  einst,
  arten,
  setze,
  onClose,
}: {
  job: Job;
  einst: GehaltEinstellungen;
  arten: readonly Schichtart[];
  setze: (teil: Partial<GehaltEinstellungen>) => void;
  onClose: () => void;
}) {
  const [loeschen, setLoeschen] = useState(false);
  const aendere = (t: Partial<Job>) => setze({ jobs: einst.jobs.map((j) => (j.id === job.id ? { ...j, ...t } : j)) });
  const istHaupt = einst.hauptjob === job.id;
  const gewaehlt = new Set(schichtenVon(job, einst, arten).map((a) => a.id));
  const tipp = (id: string) => {
    const z = { ...einst.zuordnung };
    if (gewaehlt.has(id)) {
      // Abwählen: beim Hauptjob ausdrücklich „keinem Job“ geht nicht – dann nur die Zuordnung lösen.
      delete z[id];
      if (istHaupt) {
        const anderer = einst.jobs.find((j) => j.id !== job.id);
        if (anderer) z[id] = anderer.id;
      }
    } else z[id] = job.id;
    setze({ zuordnung: z });
  };
  const beispiel = arten.find((a) => gewaehlt.has(a.id) && a.beginn && a.ende);
  const jahr = new Date().getFullYear();
  return (
    <Blatt titel={job.name} unter={ART_TEXT[job.art].unter} onClose={onClose} wischZu="kopf">
      <div className="space-y-4 pb-2" data-job-blatt>
        <div className="space-y-1">
          <label htmlFor="job-name" className="text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
            Name
          </label>
          <input
            id="job-name"
            defaultValue={job.name}
            maxLength={40}
            onBlur={(e) => e.target.value.trim() && aendere({ name: e.target.value.trim() })}
            className="h-11 w-full rounded-[12px] border-2 border-ink/10 bg-surface px-3 text-[16px] font-semibold outline-none focus:border-brand-500"
          />
        </div>
        <Wahl label="Art des Jobs" wert={job.art} optionen={ART_OPTIONEN} onWahl={(art) => aendere({ art })} />

        {job.art !== "ohne" ? (
          <div className="divide-y divide-line">
            <FeldZeile id="job-lohn" name="Stundenlohn" hinweis={job.art === "minijob" ? "so wie er ausgezahlt wird" : "brutto"}>
              <Zahlenfeld
                id="job-lohn"
                wert={job.stundenlohn}
                min={0}
                max={1000}
                einheit="€"
                breite="w-[92px]"
                platzhalter="z. B. 13,90"
                onWert={(n) => aendere({ stundenlohn: n !== null && n > 0 ? n : null })}
              />
            </FeldZeile>
            <NachtFelder job={job} aendere={aendere} praefix="job" />
            <FeldZeile id="job-sonntag" name="Sonntagszuschlag" hinweis="0 = keiner">
              <Zahlenfeld id="job-sonntag" wert={job.sonntag} min={0} max={500} einheit="%" onWert={(n) => n !== null && aendere({ sonntag: n })} />
            </FeldZeile>
            <FeldZeile id="job-feiertag" name="Feiertagszuschlag" hinweis="0 = keiner">
              <Zahlenfeld id="job-feiertag" wert={job.feiertag} min={0} max={500} einheit="%" onWert={(n) => n !== null && aendere({ feiertag: n })} />
            </FeldZeile>
            {job.art === "minijob" ? (
              <FeldZeile id="job-grenze" name="Minijob-Grenze im Monat" hinweis={`leer = gesetzlich (${jahr}: ${minijobGrenze(jahr)} €)`}>
                <Zahlenfeld
                  id="job-grenze"
                  wert={job.grenze}
                  min={0}
                  max={10000}
                  einheit="€"
                  breite="w-[92px]"
                  platzhalter={String(minijobGrenze(jahr))}
                  onWert={(n) => aendere({ grenze: n !== null && n > 0 ? n : null })}
                />
              </FeldZeile>
            ) : null}
          </div>
        ) : null}

        {beispiel && job.art !== "ohne" ? <UhrBand schicht={beispiel} job={job} /> : null}

        <div className="flex items-center justify-between gap-3 rounded-[16px] bg-brand-500/10 px-3.5 py-3">
          <div className="min-w-0">
            <div id="job-haupt" className="text-[15px] font-semibold">
              Hauptjob
            </div>
            <div className="text-[12.5px] leading-snug text-ink-muted">
              Deine Wochenstunden und Überstunden gelten hier. Schichten ohne Job zählen auch dazu.
            </div>
          </div>
          <Schalter an={istHaupt} onChange={(an) => setze({ hauptjob: an ? job.id : null })} labelId="job-haupt" />
        </div>
        {istHaupt && job.art !== "ohne" ? (
          <FeldZeile id="job-ueber" name="Überstundenzuschlag" hinweis="auf Stunden über deinem Soll">
            <Zahlenfeld id="job-ueber" wert={job.ueber} min={0} max={500} einheit="%" onWert={(n) => n !== null && aendere({ ueber: n })} />
          </FeldZeile>
        ) : null}

        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">Schichten von {job.name}</p>
          <SchichtWahl job={job} einst={einst} arten={arten} gewaehlt={gewaehlt} onTipp={tipp} />
        </div>

        {loeschen ? (
          <div className="space-y-2 rounded-[16px] bg-crit-bg px-3.5 py-3">
            <p className="text-[14px] font-semibold text-crit-fg">{job.name} löschen?</p>
            <p className="text-[13px] text-ink-muted">Die Schichten bleiben im Kalender, sie zählen dann nur nicht mehr für diesen Job.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLoeschen(false)} className="h-10 flex-1 rounded-[12px] bg-surface text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  const z = Object.fromEntries(Object.entries(einst.zuordnung).filter(([, j]) => j !== job.id));
                  setze({ jobs: einst.jobs.filter((j) => j.id !== job.id), zuordnung: z, hauptjob: istHaupt ? null : einst.hauptjob });
                  onClose();
                }}
                className="h-10 flex-1 rounded-[12px] bg-crit-dot text-[14px] font-semibold text-white"
              >
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setLoeschen(true)} className="text-[13.5px] font-semibold text-crit-fg">
            Job löschen
          </button>
        )}
      </div>
    </Blatt>
  );
}

/**
 * Assistent für einen neuen Job: Name und Art, Stundenlohn, Schichten,
 * Zuschläge – eine Frage pro Schritt.
 */
function Assistent({
  einst,
  arten,
  onFertig,
  onAbbrechen,
}: {
  einst: GehaltEinstellungen;
  arten: readonly Schichtart[];
  onFertig: (job: Job, schichten: string[], haupt: boolean) => void;
  onAbbrechen?: () => void;
}) {
  const [schritt, setSchritt] = useState(0);
  const [job, setJob] = useState<Job>(() => ({
    id: `job-${Date.now().toString(36)}`,
    name: "",
    art: "minijob",
    ...JOB_STANDARD,
    nacht: 0,
    sonntag: 0,
    feiertag: 0,
    nachtVon: 23,
    nachtBis: 6,
  }));
  const [haupt, setHaupt] = useState(einst.hauptjob === null);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const aendere = (t: Partial<Job>) => setJob((j) => ({ ...j, ...t }));
  const ohneGeld = job.art === "ohne";
  // „Ohne Geld“ überspringt Lohn und Zuschläge.
  const schritte = ohneGeld ? ["art", "schichten"] : ["art", "lohn", "schichten", "zuschlag"];
  const aktuell = schritte[Math.min(schritt, schritte.length - 1)]!;
  const letzter = schritt >= schritte.length - 1;
  const name = job.name.trim() || "dein Job";
  const kannWeiter = aktuell !== "art" || job.name.trim().length > 0;
  const beispiel = arten.find((a) => gewaehlt.has(a.id) && a.beginn && a.ende);

  function weiter() {
    if (!kannWeiter) return;
    if (letzter) onFertig({ ...job, name: job.name.trim() }, [...gewaehlt], haupt && job.art !== "minijob");
    else setSchritt((s) => s + 1);
  }

  let frage: string;
  let unter: string;
  let inhalt: ReactNode;
  if (aktuell === "art") {
    frage = "Für welchen Job willst du dein Geld sehen?";
    unter = "Hast du zwei Jobs, legst du danach den zweiten an.";
    inhalt = (
      <div className="space-y-3">
        <input
          aria-label="Name des Jobs"
          autoFocus
          value={job.name}
          maxLength={40}
          placeholder="z. B. Tankstelle"
          onChange={(e) => aendere({ name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && weiter()}
          className="h-12 w-full rounded-[14px] border-2 border-ink/10 bg-surface px-3.5 text-[17px] font-semibold outline-none focus:border-brand-500"
        />
        <div className="space-y-2" role="radiogroup" aria-label="Art des Jobs">
          {ART_OPTIONEN.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={job.art === o.id}
              onClick={() => aendere({ art: o.id })}
              className={cn(
                "flex w-full items-start gap-3 rounded-[16px] border-2 px-3.5 py-3 text-left",
                job.art === o.id ? "border-brand-500 bg-brand-500/[0.07]" : "border-ink/10",
              )}
            >
              <span className={cn("mt-0.5 h-5 w-5 shrink-0 rounded-full border-2", job.art === o.id ? "border-[6px] border-brand-500" : "border-ink/20")} />
              <span>
                <span className="block text-[15px] font-semibold">{ART_TEXT[o.id].name}</span>
                <span className="block text-[13px] leading-snug text-ink-muted">{ART_TEXT[o.id].unter}</span>
              </span>
            </button>
          ))}
        </div>
        {job.art !== "minijob" ? (
          <div className="flex items-center justify-between gap-3 rounded-[16px] bg-brand-500/10 px-3.5 py-3">
            <div className="min-w-0">
              <div id="assistent-haupt" className="text-[15px] font-semibold">
                Das ist mein Hauptjob
              </div>
              <div className="text-[12.5px] leading-snug text-ink-muted">Wochenstunden und Überstunden gelten hier.</div>
            </div>
            <Schalter an={haupt} onChange={setHaupt} labelId="assistent-haupt" />
          </div>
        ) : null}
      </div>
    );
  } else if (aktuell === "lohn") {
    frage = `Wie viel bekommst du bei ${name} pro Stunde?`;
    unter = job.art === "minijob" ? "Beim Minijob: so viel, wie ausgezahlt wird." : "Brutto, so wie er im Vertrag steht.";
    inhalt = (
      <div className="flex justify-center py-2">
        <Zahlenfeld
          id="assistent-lohn"
          wert={job.stundenlohn}
          min={0}
          max={1000}
          einheit="€"
          breite="w-[130px]"
          platzhalter="13,90"
          onWert={(n) => aendere({ stundenlohn: n !== null && n > 0 ? n : null })}
        />
      </div>
    );
  } else if (aktuell === "schichten") {
    frage = `Welche Schichten gehören zu ${name}?`;
    unter = `Nur diese zählen für ${name}.`;
    inhalt = (
      <SchichtWahl
        job={job}
        einst={einst}
        arten={arten}
        gewaehlt={gewaehlt}
        onTipp={(id) =>
          setGewaehlt((g) => {
            const n = new Set(g);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          })
        }
      />
    );
  } else {
    frage = "Bekommst du Zuschläge?";
    unter = "Zum Beispiel 25 % für die Stunde von 23 bis 24 Uhr. 0 = keiner.";
    inhalt = (
      <div className="space-y-3">
        <div className="divide-y divide-line">
          <NachtFelder job={job} aendere={aendere} praefix="assistent" />
          <FeldZeile id="assistent-sonntag" name="Sonntagszuschlag">
            <Zahlenfeld id="assistent-sonntag" wert={job.sonntag} min={0} max={500} einheit="%" onWert={(n) => n !== null && aendere({ sonntag: n })} />
          </FeldZeile>
          <FeldZeile id="assistent-feiertag" name="Feiertagszuschlag">
            <Zahlenfeld id="assistent-feiertag" wert={job.feiertag} min={0} max={500} einheit="%" onWert={(n) => n !== null && aendere({ feiertag: n })} />
          </FeldZeile>
        </div>
        {beispiel ? <UhrBand schicht={beispiel} job={job} /> : null}
      </div>
    );
  }

  return (
    <PrivatKarte>
      <div className="space-y-4 px-4 pb-4 pt-4" data-assistent={aktuell}>
        <div className="flex justify-center gap-1.5" aria-hidden>
          {schritte.map((s, i) => (
            <span key={s} className={cn("h-1.5 w-7 rounded-full", i <= schritt ? "bg-brand-500" : "bg-ink/10")} />
          ))}
        </div>
        <p className="text-center text-[12.5px] text-ink-muted">
          Schritt {Math.min(schritt, schritte.length - 1) + 1} von {schritte.length}
        </p>
        <div className="space-y-1">
          <h3 className="text-[21px] font-bold leading-tight tracking-[-0.02em]">{frage}</h3>
          <p className="text-[13.5px] text-ink-muted">{unter}</p>
        </div>
        {inhalt}
        <button
          type="button"
          disabled={!kannWeiter}
          onClick={weiter}
          className="h-12 w-full rounded-[14px] bg-brand-600 text-[15.5px] font-semibold text-white disabled:opacity-40"
        >
          {letzter ? "Fertig" : "Weiter"}
        </button>
        {schritt > 0 ? (
          <button type="button" onClick={() => setSchritt((s) => s - 1)} className="block w-full text-center text-[14px] font-semibold text-ink-muted">
            Zurück
          </button>
        ) : onAbbrechen ? (
          <button type="button" onClick={onAbbrechen} className="block w-full text-center text-[14px] font-semibold text-ink-muted">
            Abbrechen
          </button>
        ) : null}
      </div>
    </PrivatKarte>
  );
}

/** Ergebnis des Assistenten in die Einstellungen schreiben. */
function jobAnlegen(einst: GehaltEinstellungen, job: Job, schichten: string[], haupt: boolean): Partial<GehaltEinstellungen> {
  const zuordnung = { ...einst.zuordnung };
  for (const id of schichten) zuordnung[id] = job.id;
  return {
    jobs: [...einst.jobs, job],
    zuordnung,
    hauptjob: haupt ? job.id : einst.hauptjob,
    eingerichtet: true,
  };
}

/** Tage, Tages-Uhrzeiten und Feiertage eines Monats – für Geld und die Kachel. */
export function useMonatsDaten(von: string, bis: string, neuLaden: unknown = null) {
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [zeiten, setZeiten] = useState<Record<string, TagZeit>>({});
  const [feiertage, setFeiertage] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTage(null);
    void ladeFeiertage(Number(von.slice(0, 4)))
      .then((f) => !aus && setFeiertage(new Set(f.map((h) => h.tag))))
      .catch(() => undefined);
    void ladeTagZeiten(von, bis)
      .then((z) => !aus && setZeiten(z))
      .catch(() => undefined);
    void ladeTage(von, bis)
      .then((t) => !aus && setTage(t))
      .catch(() => !aus && setTage({}));
    return () => {
      aus = true;
    };
  }, [von, bis, neuLaden]);
  return { tage, zeiten, feiertage };
}

/** Der Monat mit Geld je Job – für den Bereich „Geld“ unter den Kacheln. */
export function PrivatGeld() {
  const { konto, schichtarten } = usePrivat();
  const { einst, setze } = useGehalt(konto.userId);
  const [monat, setMonat] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [offen, setOffen] = useState<string | null>(null);
  const [neuerJob, setNeuerJob] = useState(false);
  const von = toISO(new Date(monat.getFullYear(), monat.getMonth(), 1));
  const bis = toISO(new Date(monat.getFullYear(), monat.getMonth() + 1, 0));
  const { tage, zeiten, feiertage } = useMonatsDaten(von, bis);
  const arten = schichtarten ?? [];

  const re =
    tage && schichtarten ? rechne({ tage, von, bis, arten: schichtarten, feiertage, wochenstunden: konto.wochenstunden, einst, zeiten }) : null;
  const springe = (s: number) => setMonat((m) => new Date(m.getFullYear(), m.getMonth() + s, 1));
  const fertig = useCallback(
    (job: Job, schichten: string[], haupt: boolean) => {
      setze(jobAnlegen(einst, job, schichten, haupt));
      setNeuerJob(false);
    },
    [einst, setze],
  );
  const offenerJob = einst.jobs.find((j) => j.id === offen) ?? null;
  const mitGeld = re ? re.jobs.filter((j) => j.geld) : [];

  return (
    <div className="space-y-4">
      <AbschnittKopf
        icon={<Wallet className="h-[18px] w-[18px]" />}
        titel={`Geld · ${monthName(monat.getMonth())}`}
        unter={String(monat.getFullYear())}
        rechts={
          <>
            <RundKnopf label="Vorheriger Monat" onClick={() => springe(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </RundKnopf>
            <RundKnopf label="Nächster Monat" onClick={() => springe(1)}>
              <ChevronRight className="h-5 w-5" />
            </RundKnopf>
          </>
        }
      />
      {einst.jobs.length === 0 || neuerJob ? (
        <Assistent key={einst.jobs.length} einst={einst} arten={arten} onFertig={fertig} onAbbrechen={einst.jobs.length ? () => setNeuerJob(false) : undefined} />
      ) : !re ? (
        <p className="px-1 text-[14px] text-ink-muted">Wird berechnet …</p>
      ) : (
        <>
          {mitGeld.length > 1 && re.summe !== null ? (
            <div className="flex items-center justify-between gap-3 px-1" data-geld-summe>
              <span className="text-[14px] text-ink-muted">Alle Jobs zusammen</span>
              <span className="tnum text-[17px] font-bold">{euro(re.summe)}</span>
            </div>
          ) : null}
          {re.jobs.map((jr) => (
            <JobKarte key={jr.job.id} jr={jr} farbe={jobFarbe(jr.job, einst, arten)} onEinstellungen={() => setOffen(jr.job.id)} />
          ))}
          <button
            type="button"
            onClick={() => setNeuerJob(true)}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-[16px] bg-brand-500/10 text-[15px] font-semibold text-brand-600"
          >
            <Plus className="h-4 w-4" /> Job hinzufügen
          </button>
          <p className="px-1 text-[12px] leading-snug text-ink-faint">
            Minijob: Betrag, wie er ausgezahlt wird. Normaler Job: Schätzung vor Steuern und Abgaben, keine Lohnabrechnung. Andere
            Uhrzeit an einem Tag? Tag im Kalender antippen. Jobs, Lohn und Sätze bleiben nur in diesem Browser.
          </p>
        </>
      )}
      {offenerJob ? <JobBlatt job={offenerJob} einst={einst} arten={arten} setze={setze} onClose={() => setOffen(null)} /> : null}
    </div>
  );
}

