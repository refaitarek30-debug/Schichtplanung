"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { monthName, toISO } from "@/lib/dates";
import { ladeFeiertage, ladeTage, type TagEintrag } from "@/lib/privat/daten";
import {
  rechne,
  GEHALT_STANDARD,
  ladeGehaltEinstellungen,
  speichereGehaltEinstellungen,
  zahlAusText,
  type GehaltEinstellungen,
  type Rechnung,
} from "@/lib/privat/gehalt";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { AbschnittKopf, PrivatKarte, RundKnopf } from "./rahmen";

/**
 * Überstunden und Brutto-Schätzung (nur für dich). Stundenlohn und Zuschläge
 * stehen nur in diesem Browser, nie auf dem Server.
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
  const alsText = (n: number | null) => (n === null ? "" : n.toLocaleString("de-DE", { maximumFractionDigits: kommastellen }));
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

/** Brutto-Schätzung mit Schalter „Ich arbeite in Schicht“. */
export function GehaltKarte({
  re,
  einst,
  setze,
}: {
  re: Rechnung;
  einst: GehaltEinstellungen;
  setze: (teil: Partial<GehaltEinstellungen>) => void;
}) {
  const zeilen: { text: string; detail: string; betrag: number }[] = [];
  if (re.geld) {
    zeilen.push({ text: "Grundlohn", detail: `${std(re.ist)} Std × ${euro(einst.stundenlohn ?? 0)}`, betrag: re.geld.grundlohn });
    if (einst.schicht) {
      if (re.zuschlag.nacht > 0)
        zeilen.push({ text: `Nachtzuschlag ${std(einst.nacht)} %`, detail: `${std(re.zuschlag.nacht)} Std`, betrag: re.geld.nacht });
      if (re.zuschlag.sonntag > 0)
        zeilen.push({ text: `Sonntagszuschlag ${std(einst.sonntag)} %`, detail: `${std(re.zuschlag.sonntag)} Std`, betrag: re.geld.sonntag });
      if (re.zuschlag.feiertag > 0)
        zeilen.push({ text: `Feiertagszuschlag ${std(einst.feiertag)} %`, detail: `${std(re.zuschlag.feiertag)} Std`, betrag: re.geld.feiertag });
    }
    if (re.differenz !== null && re.differenz > 0.05)
      zeilen.push({ text: `Überstundenzuschlag ${std(einst.ueber)} %`, detail: `${std(re.differenz)} Std`, betrag: re.geld.ueber });
  }
  return (
    <PrivatKarte titel="Gehalt (Schätzung)">
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">Geschätzt brutto</div>
            <div className="tnum mt-0.5 text-[30px] font-bold leading-none tracking-[-0.02em]">
              {re.geld ? euro(re.geld.summe) : "–"}
            </div>
          </div>
          <label className="flex flex-col items-end gap-1 text-[12px] font-semibold text-ink-muted" htmlFor="gehalt-lohn">
            Stundenlohn
            <Zahlenfeld
              id="gehalt-lohn"
              wert={einst.stundenlohn}
              min={0}
              max={1000}
              einheit="€"
              breite="w-[92px]"
              platzhalter="z. B. 18,00"
              onWert={(n) => setze({ stundenlohn: n !== null && n > 0 ? n : null })}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[16px] bg-brand-500/10 px-3.5 py-3">
          <div className="min-w-0">
            <div id="gehalt-schicht" className="text-[15px] font-semibold">
              Ich arbeite in Schicht
            </div>
            <div className="text-[12.5px] leading-snug text-ink-muted">Dann zählen Zuschläge für Nacht, Sonntag und Feiertag.</div>
          </div>
          <Schalter an={einst.schicht} onChange={(an) => setze({ schicht: an })} labelId="gehalt-schicht" />
        </div>

        {re.geld ? (
          <dl className="divide-y divide-line">
            {zeilen.map((z) => (
              <div key={z.text} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <dt className="text-[14.5px] font-semibold">{z.text}</dt>
                  <dd className="text-[12.5px] text-ink-muted">{z.detail}</dd>
                </div>
                <span className="tnum shrink-0 text-[15px] font-semibold">{euro(z.betrag)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t-2 border-ink pt-3">
              <dt className="text-[15px] font-bold">Summe</dt>
              <dd className="tnum text-[18px] font-bold">{euro(re.geld.summe)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-[13.5px] leading-snug text-ink-muted">Trag deinen Stundenlohn (brutto) ein, dann rechnet ShiftNexo deinen Monat aus.</p>
        )}
        <p className="text-[12px] leading-snug text-ink-faint">
          Eine Schätzung vor Steuern und Abgaben, keine Lohnabrechnung. Stundenlohn und Sätze bleiben nur in diesem Browser, sie
          werden nicht an ShiftNexo gesendet. Pausen werden anteilig abgezogen, wenn die Schicht kürzer eingetragen ist als ihre Uhrzeiten.
        </p>
      </div>
    </PrivatKarte>
  );
}

/** Zuschläge in Prozent – so ändern, wie sie im Tarif- oder Arbeitsvertrag stehen. */
export function ZuschlagKarte({ einst, setze }: { einst: GehaltEinstellungen; setze: (teil: Partial<GehaltEinstellungen>) => void }) {
  const saetze = [
    { id: "nacht", name: "Nachtarbeit", hinweis: `${einst.nachtVon} bis ${einst.nachtBis} Uhr`, nurSchicht: true },
    { id: "sonntag", name: "Sonntag", hinweis: "0 bis 24 Uhr", nurSchicht: true },
    { id: "feiertag", name: "Feiertag", hinweis: "nach deinem Bundesland", nurSchicht: true },
    { id: "ueber", name: "Überstunden", hinweis: "Stunden über Soll", nurSchicht: false },
  ] as const;
  return (
    <PrivatKarte titel="Zuschläge in Prozent">
      <div className="px-4 pb-4 pt-3">
        <p className="mb-1 text-[13px] leading-snug text-ink-muted">Trag die Sätze aus deinem Tarifvertrag oder Arbeitsvertrag ein.</p>
        <ul className="divide-y divide-line">
          {saetze.map((s) => {
            const aus = s.nurSchicht && !einst.schicht;
            return (
              <li key={s.id} className={cn("flex items-center justify-between gap-3 py-2.5", aus && "opacity-45")}>
                <label htmlFor={`satz-${s.id}`} className="min-w-0">
                  <span className="block text-[15px] font-semibold">{s.name}</span>
                  <span className="block text-[12.5px] text-ink-muted">{aus ? "nur im Schichtbetrieb" : s.hinweis}</span>
                </label>
                <Zahlenfeld
                  id={`satz-${s.id}`}
                  wert={einst[s.id]}
                  min={0}
                  max={500}
                  einheit="%"
                  onWert={(n) => n !== null && setze({ [s.id]: n })}
                />
              </li>
            );
          })}
        </ul>
        {einst.schicht ? (
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-line py-2.5">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">Nachtzeit (von – bis)</span>
              <span className="block text-[12.5px] text-ink-muted">volle Stunden, z. B. 20 – 6 oder 22 – 6</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Zahlenfeld id="nacht-von" wert={einst.nachtVon} min={0} max={23} einheit="–" breite="w-[56px]" kommastellen={0} onWert={(n) => n !== null && setze({ nachtVon: Math.round(n) })} />
              <Zahlenfeld id="nacht-bis" wert={einst.nachtBis} min={0} max={23} einheit="Uhr" breite="w-[56px]" kommastellen={0} onWert={(n) => n !== null && setze({ nachtBis: Math.round(n) })} />
            </span>
          </div>
        ) : null}
        <p className="mt-2 text-[12px] leading-snug text-ink-faint">
          Fällt eine Stunde auf einen Sonntag und einen Feiertag, zählt der höhere Satz; der Nachtzuschlag kommt dazu. Arbeitest du nicht
          in Schicht, schalte oben „Ich arbeite in Schicht“ aus – dann bleibt nur der Überstundenzuschlag.
        </p>
        <button
          type="button"
          onClick={() => setze({ ...GEHALT_STANDARD, stundenlohn: einst.stundenlohn, schicht: einst.schicht })}
          className="mt-2 text-[13px] font-semibold text-brand-600"
        >
          Sätze zurücksetzen
        </button>
      </div>
    </PrivatKarte>
  );
}

/** Der Monat mit Gehalt und Zuschlägen – für den Bereich „Geld“ unter den Kacheln. */
export function PrivatGeld() {
  const { konto, schichtarten } = usePrivat();
  const { einst, setze } = useGehalt(konto.userId);
  const [monat, setMonat] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [feiertage, setFeiertage] = useState<ReadonlySet<string>>(new Set());
  const von = toISO(new Date(monat.getFullYear(), monat.getMonth(), 1));
  const bis = toISO(new Date(monat.getFullYear(), monat.getMonth() + 1, 0));

  useEffect(() => {
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTage(null);
    void ladeFeiertage(monat.getFullYear())
      .then((f) => !aus && setFeiertage(new Set(f.map((h) => h.tag))))
      .catch(() => undefined);
    void ladeTage(von, bis)
      .then((t) => !aus && setTage(t))
      .catch(() => !aus && setTage({}));
    return () => {
      aus = true;
    };
  }, [von, bis, monat]);

  const re = tage && schichtarten ? rechne({ tage, von, bis, arten: schichtarten, feiertage, wochenstunden: konto.wochenstunden, einst }) : null;
  const springe = (s: number) => setMonat((m) => new Date(m.getFullYear(), m.getMonth() + s, 1));

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
      {re ? (
        <>
          <GehaltKarte re={re} einst={einst} setze={setze} />
          <ZuschlagKarte einst={einst} setze={setze} />
        </>
      ) : (
        <p className="px-1 text-[14px] text-ink-muted">Wird berechnet …</p>
      )}
    </div>
  );
}
