"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { monthName } from "@/lib/dates";
import type { Rechnung } from "@/lib/privat/gehalt";
import {
  LOHN_LEER,
  STEUER_STANDARD,
  ladeLohn,
  rechneAuszahlung,
  speichereLohn,
  type Extras,
  type LohnSpeicher,
  type SteuerDaten,
} from "@/lib/privat/lohn";
import type { Steuerklasse } from "@/lib/privat/netto";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";
import { FeldZeile, Schalter, Wahl, Zahlenfeld } from "./gehalt";

/**
 * Lohn: Auszahlung des Monats (aus dem Brutto je Job), Extras, Abzüge im
 * Detail und die Jahresübersicht. Alles bleibt auf diesem Gerät.
 */

const LOHN_EREIGNIS = "sp-lohn-geaendert";
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const euroRund = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function useLohn(userId: string) {
  const [lohn, setLohn] = useState<LohnSpeicher>(LOHN_LEER);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLohn(ladeLohn(userId));
    const neu = () => setLohn(ladeLohn(userId));
    window.addEventListener(LOHN_EREIGNIS, neu);
    return () => window.removeEventListener(LOHN_EREIGNIS, neu);
  }, [userId]);
  const setze = useCallback(
    (f: (alt: LohnSpeicher) => LohnSpeicher) => {
      const neu = f(ladeLohn(userId));
      speichereLohn(userId, neu);
      setLohn(neu);
      window.dispatchEvent(new Event(LOHN_EREIGNIS));
    },
    [userId],
  );
  return { lohn, setze };
}

const schluessel = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Monat: Auszahlung oben, darunter Extras und Abzüge. */
export function LohnMonat({ re, monat, userId, bundesland }: { re: Rechnung; monat: Date; userId: string; bundesland: string }) {
  const { lohn, setze } = useLohn(userId);
  const [einstellen, setEinstellen] = useState(false);
  const [details, setDetails] = useState(false);
  const [extrasOffen, setExtrasOffen] = useState(false);
  const key = schluessel(monat);
  const extras = lohn.extras?.monat === key ? lohn.extras : null;
  const steuer = lohn.steuer ?? STEUER_STANDARD;
  const aus = rechneAuszahlung(re, steuer, extras, bundesland);
  const gespeichert = lohn.monate[key] ?? null;
  const veraltet = gespeichert !== null && Math.abs(gespeichert.netto - aus.netto) > 0.5;
  const name = monthName(monat.getMonth());

  const setzeExtras = (t: Partial<Omit<Extras, "monat">>) =>
    setze((l) => {
      const alt = l.extras?.monat === key ? l.extras : { monat: key, einmal: 0, frei: 0, netto: 0 };
      return { ...l, extras: { ...alt, ...t } };
    });
  const speichern = () =>
    setze((l) => ({
      ...l,
      monate: {
        ...l.monate,
        [key]: {
          brutto: aus.brutto,
          netto: aus.netto,
          steuerfrei: aus.steuerfrei,
          abzuege: aus.abzuege?.summe ?? 0,
          echt: l.monate[key]?.echt ?? null,
        },
      },
    }));
  const setzeEcht = (n: number | null) =>
    setze((l) => (l.monate[key] ? { ...l, monate: { ...l.monate, [key]: { ...l.monate[key]!, echt: n } } } : l));

  const ohneSteuer = aus.mitSteuer && !lohn.steuer;
  const extraSumme = extras ? extras.einmal + extras.frei + extras.netto : 0;
  const abz = aus.abzuege;
  const posten = abz
    ? ([
        ["Lohnsteuer", abz.lohnsteuer],
        ["Solidaritätszuschlag", abz.soli],
        ["Kirchensteuer", abz.kirche],
        ["Krankenversicherung", abz.kv],
        ["Rentenversicherung", abz.rv],
        ["Arbeitslosenversicherung", abz.av],
        ["Pflegeversicherung", abz.pv],
      ] as const).filter(([, b]) => b > 0)
    : [];

  return (
    <div className="space-y-3" data-lohn-monat>
      <section className="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2563eb] to-[#7c3aed] p-4 text-white shadow-[0_18px_40px_-22px_rgba(76,60,220,0.8)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-white/80">{aus.mitSteuer ? "Auszahlung ca." : "Wird ausgezahlt"}</p>
            <p className="tnum text-[32px] font-bold leading-tight tracking-[-0.02em]" data-lohn-netto>
              {euro(aus.netto)}
            </p>
          </div>
          {aus.mitSteuer ? (
            <button
              type="button"
              onClick={() => setEinstellen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[13px] font-semibold"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Steuerklasse {steuer.steuerklasse}
            </button>
          ) : null}
        </div>
        {aus.mitSteuer ? (
          <p className="tnum mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-white/85">
            <span>Brutto {euroRund(aus.brutto)}</span>
            <span>Abzüge {euroRund(abz?.summe ?? 0)}</span>
            {aus.steuerfrei > 0 ? <span>steuerfrei {euroRund(aus.steuerfrei)}</span> : null}
          </p>
        ) : null}
        <button
          type="button"
          onClick={speichern}
          disabled={gespeichert !== null && !veraltet}
          className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-white/18 text-[14px] font-semibold disabled:opacity-80"
          style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          data-lohn-speichern
        >
          {gespeichert && !veraltet ? (
            <>
              <Check className="h-4 w-4" /> Für {name} gespeichert
            </>
          ) : gespeichert ? (
            `Gespeicherten Stand für ${name} aktualisieren`
          ) : (
            `Für ${name} speichern`
          )}
        </button>
      </section>

      {ohneSteuer ? (
        <button
          type="button"
          onClick={() => setEinstellen(true)}
          className="glas flex w-full items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-left"
        >
          <span className="text-[14px] leading-snug">
            <span className="block font-semibold">Stimmt deine Steuerklasse?</span>
            <span className="text-ink-muted">Gerechnet wird mit Klasse 1, ohne Kinder und Kirche.</span>
          </span>
          <span className="shrink-0 text-[14px] font-semibold text-brand-600">Anpassen</span>
        </button>
      ) : null}

      {gespeichert ? (
        <section className="glas rounded-[18px] px-4" data-lohn-echt>
          <FeldZeile
            id="lohn-echt"
            name="Wirklich bekommen"
            hinweis={
              gespeichert.echt === null
                ? "Laut Lohnabrechnung – für die Jahresübersicht"
                : `${gespeichert.echt - gespeichert.netto >= 0 ? "+" : "−"}${euro(Math.abs(gespeichert.echt - gespeichert.netto))} gegenüber der Schätzung`
            }
          >
            <Zahlenfeld id="lohn-echt" wert={gespeichert.echt} min={0} max={100000} einheit="€" breite="w-[110px]" platzhalter="–" onWert={setzeEcht} />
          </FeldZeile>
        </section>
      ) : null}

      {aus.mitSteuer ? (
        <section className="glas overflow-hidden rounded-[18px]">
          <button type="button" onClick={() => setDetails((d) => !d)} aria-expanded={details} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <span className="text-[15px] font-semibold">So setzt sich das zusammen</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-muted transition-transform", details && "rotate-180")} />
          </button>
          {details ? (
            <dl className="divide-y divide-line border-t border-line px-4 text-[14px]" data-lohn-details>
              {aus.bausteine.map((b) => (
                <Posten key={b.text} text={b.text} betrag={b.betrag} />
              ))}
              {posten.map(([t, b]) => (
                <Posten key={t} text={t} betrag={-b} />
              ))}
              <Posten text="Auszahlung" betrag={aus.netto} fett />
            </dl>
          ) : null}
        </section>
      ) : null}

      <section className="glas overflow-hidden rounded-[18px]" data-lohn-extras>
        <button type="button" onClick={() => setExtrasOffen((o) => !o)} aria-expanded={extrasOffen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="text-[15px] font-semibold">Extras im {name}</span>
          <span className="flex shrink-0 items-center gap-2 text-[13.5px] text-ink-muted">
            {extraSumme !== 0 ? <span className="tnum font-semibold text-ink">{euro(extraSumme)}</span> : "keine"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", extrasOffen && "rotate-180")} />
          </span>
        </button>
        {extrasOffen ? (
          <div className="border-t border-line px-4 py-1">
            {aus.mitSteuer ? (
              <FeldZeile id="lohn-einmal" name="Einmalzahlung" hinweis="Weihnachtsgeld, Prämie, Überstunden">
                <Zahlenfeld id="lohn-einmal" wert={extras?.einmal || null} min={0} max={100000} einheit="€" breite="w-[96px]" platzhalter="0" onWert={(n) => setzeExtras({ einmal: n ?? 0 })} />
              </FeldZeile>
            ) : null}
            <FeldZeile id="lohn-frei" name="Steuerfrei" hinweis="Jobticket, Inflationsprämie …">
              <Zahlenfeld id="lohn-frei" wert={extras?.frei || null} min={0} max={100000} einheit="€" breite="w-[96px]" platzhalter="0" onWert={(n) => setzeExtras({ frei: n ?? 0 })} />
            </FeldZeile>
            <FeldZeile id="lohn-netto" name="Plus / Minus netto" hinweis="Erstattung, Vorschuss, Nachzahlung">
              <Zahlenfeld id="lohn-netto" wert={extras?.netto || null} min={-100000} max={100000} einheit="€" breite="w-[96px]" platzhalter="0" onWert={(n) => setzeExtras({ netto: n ?? 0 })} />
            </FeldZeile>
          </div>
        ) : null}
      </section>

      {einstellen ? <SteuerBlatt steuer={steuer} setze={(s) => setze((l) => ({ ...l, steuer: s }))} onClose={() => setEinstellen(false)} /> : null}
    </div>
  );
}

function Posten({ text, betrag, fett = false }: { text: string; betrag: number; fett?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2", fett && "font-bold")}>
      <dt className="min-w-0">{text}</dt>
      <dd className={cn("tnum shrink-0", betrag < 0 && "text-crit-fg")}>{betrag < 0 ? `−${euro(-betrag)}` : euro(betrag)}</dd>
    </div>
  );
}

const KLASSEN: { id: string; name: string }[] = [1, 2, 3, 4, 5, 6].map((k) => ({ id: String(k), name: String(k) }));

function SteuerBlatt({ steuer, setze, onClose }: { steuer: SteuerDaten; setze: (s: SteuerDaten) => void; onClose: () => void }) {
  const aendere = (t: Partial<SteuerDaten>) => setze({ ...steuer, ...t });
  return (
    <Blatt titel="Steuer & Abgaben" unter="Steht oben auf deiner Lohnabrechnung" onClose={onClose}>
      <div className="space-y-3" data-steuer-blatt>
        <div>
          <p className="pb-1.5 text-[13px] font-semibold text-ink-muted">Steuerklasse</p>
          <Wahl label="Steuerklasse" wert={String(steuer.steuerklasse)} optionen={KLASSEN} onWahl={(w) => aendere({ steuerklasse: Number(w) as Steuerklasse })} />
        </div>
        <div className="divide-y divide-line">
          <FeldZeile id="steuer-kinder" name="Kinder" hinweis="Kinderfreibeträge und Pflegeversicherung">
            <Zahlenfeld id="steuer-kinder" wert={steuer.kinder} min={0} max={12} einheit="" kommastellen={0} onWert={(n) => aendere({ kinder: Math.round(n ?? 0) })} />
          </FeldZeile>
          <FeldZeile id="steuer-kirche" name="Kirchensteuer">
            <Schalter an={steuer.kirche} onChange={(an) => aendere({ kirche: an })} labelId="steuer-kirche" />
          </FeldZeile>
          {steuer.kinder === 0 ? (
            <FeldZeile id="steuer-kinderlos" name="23 Jahre oder älter" hinweis="Ohne Kinder: etwas mehr Pflegeversicherung">
              <Schalter an={steuer.kinderlosZuschlag} onChange={(an) => aendere({ kinderlosZuschlag: an })} labelId="steuer-kinderlos" />
            </FeldZeile>
          ) : null}
          <FeldZeile id="steuer-kv" name="Zusatzbeitrag Krankenkasse" hinweis="Im Schnitt 2,9 %">
            <Zahlenfeld id="steuer-kv" wert={steuer.kvZusatz} min={0} max={6} einheit="%" onWert={(n) => aendere({ kvZusatz: n ?? STEUER_STANDARD.kvZusatz })} />
          </FeldZeile>
          <FeldZeile id="steuer-zulagen" name="Feste Zulagen im Monat" hinweis="Schichtzulage, Erschwernis … (brutto)">
            <Zahlenfeld id="steuer-zulagen" wert={steuer.zulagen || null} min={0} max={100000} einheit="€" breite="w-[96px]" platzhalter="0" onWert={(n) => aendere({ zulagen: n ?? 0 })} />
          </FeldZeile>
        </div>
        <p className="text-[12px] leading-snug text-ink-faint">
          Schätzung nach den Regeln für 2026, gesetzlich versichert, ohne Freibeträge. Keine Lohnabrechnung – ein paar Euro Abweichung sind normal. Die
          Angaben bleiben nur auf diesem Gerät.
        </p>
      </div>
    </Blatt>
  );
}

const KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Jahresübersicht aus den gespeicherten Monaten. */
export function LohnJahr({ jahr, userId, onMonat }: { jahr: number; userId: string; onMonat: (m: number) => void }) {
  const { lohn } = useLohn(userId);
  const monate = KURZ.map((_, i) => lohn.monate[`${jahr}-${String(i + 1).padStart(2, "0")}`] ?? null);
  const wert = (m: (typeof monate)[number]) => (m ? (m.echt ?? m.netto) : 0);
  const da = monate.filter((m): m is NonNullable<typeof m> => m !== null);
  const summe = da.reduce((s, m) => s + wert(m), 0);
  const brutto = da.reduce((s, m) => s + m.brutto, 0);
  const frei = da.reduce((s, m) => s + m.steuerfrei, 0);
  const max = Math.max(1, ...monate.map(wert));
  const bester = da.length ? monate.reduce((b, m, i) => (wert(m) > wert(monate[b] ?? null) ? i : b), 0) : -1;

  if (!da.length) {
    return (
      <section className="glas rounded-[22px] px-5 py-8 text-center" data-lohn-jahr>
        <p className="text-[16px] font-semibold">Noch kein Monat gespeichert</p>
        <p className="mx-auto mt-1 max-w-[280px] text-[14px] text-ink-muted">Unter „Monat“ auf „Für … speichern“ tippen – dann erscheint er hier.</p>
      </section>
    );
  }
  return (
    <div className="space-y-3" data-lohn-jahr>
      <section className="glas rounded-[22px] px-4 pb-3 pt-4">
        <p className="text-[12.5px] text-ink-muted">
          Netto {jahr} · {da.length} von 12 Monaten
        </p>
        <p className="tnum text-[28px] font-bold leading-tight tracking-[-0.02em]">{euroRund(summe)}</p>
        <p className="tnum text-[12.5px] text-ink-muted">
          Brutto {euroRund(brutto)}
          {frei > 0 ? ` · steuerfrei ${euroRund(frei)}` : ""}
        </p>
        <div className="mt-3 flex h-[120px] items-end gap-1" role="img" aria-label={`Netto je Monat ${jahr}`}>
          {monate.map((m, i) => (
            <button key={i} type="button" onClick={() => onMonat(i)} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={m ? `${monthName(i)}: ${euro(wert(m))}` : monthName(i)}>
              {m ? (
                <span className={cn("block w-full max-w-[18px] rounded-t-[4px]", m.echt !== null ? "bg-brand-500" : "bg-brand-500/45")} style={{ height: `${Math.max(4, (wert(m) / max) * 96)}px` }} />
              ) : (
                <span className="block h-4 w-full max-w-[18px] rounded-t-[4px] border border-b-0 border-dashed border-ink/20" />
              )}
              <span className="text-[10.5px] text-ink-muted">{KURZ[i]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 flex gap-3 text-[11.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-brand-500" /> laut Abrechnung
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-[3px] bg-brand-500/45" /> geschätzt
          </span>
        </p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <div className="glas rounded-[18px] px-4 py-3">
          <p className="text-[12px] text-ink-muted">Ø im Monat</p>
          <p className="tnum text-[17px] font-bold">{euroRund(summe / da.length)}</p>
        </div>
        <div className="glas rounded-[18px] px-4 py-3">
          <p className="text-[12px] text-ink-muted">Bester Monat</p>
          <p className="tnum truncate text-[17px] font-bold">
            {KURZ[bester]} · {euroRund(wert(monate[bester] ?? null))}
          </p>
        </div>
      </div>
      <section className="glas overflow-hidden rounded-[18px]">
        <dl className="divide-y divide-line px-4 text-[14px]">
          {monate.map((m, i) =>
            m ? (
              <button key={i} type="button" onClick={() => onMonat(i)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                <dt className="min-w-0">
                  <span className="block font-semibold">{monthName(i)}</span>
                  <span className="block text-[12px] text-ink-muted">{m.echt !== null ? `geschätzt ${euro(m.netto)}` : "geschätzt"}</span>
                </dt>
                <dd className="tnum shrink-0 font-semibold">{euro(wert(m))}</dd>
              </button>
            ) : null,
          )}
        </dl>
      </section>
    </div>
  );
}
