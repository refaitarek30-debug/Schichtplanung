"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { addDays, formatDE, fromISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { Erinnerung, Termin, TerminEingabe, Wiederholung } from "@/lib/data/partner";
import type { Vorlage } from "@/lib/data/todos";
import type { LoeschModus } from "@/lib/data/verbindungen";
import { ErinnerungHinweis } from "./erinnerungen";
import { mitSymbol, STANDARD_TERMINE, useVorlieben } from "./vorschlaege";

/**
 * Termine im Kalender – Formular und Hilfen.
 *
 * Gespeichert in der Datenbank (0139_kalender_partner_termine.sql): eigene
 * Termine sieht nur die Person selbst – und ihr Partner, wenn sie das bei
 * der Einladung freigegeben hat. Termine des Partners sehen beide. Die
 * Firma sieht keine Termine.
 */


export type { Erinnerung, Termin, TerminEingabe, Wiederholung };

/**
 * Termine lagen anfangs nur im Browser. Was dort noch steht, wird einmal in
 * die Datenbank übernommen und danach gelöscht (siehe MeinKalender).
 */
export function alteLokaleTermine(benutzer: string): TerminEingabe[] | null {
  try {
    const roh = window.localStorage.getItem(`schichtplan.termine.${benutzer}`);
    if (!roh) return null;
    const daten: unknown = JSON.parse(roh);
    if (!Array.isArray(daten)) return [];
    return daten
      .filter((t) => t && typeof t === "object" && typeof t.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.datum))
      .map((t) => ({
        id: null,
        datum: t.datum,
        titel: String(t.titel ?? "").slice(0, 80),
        ganztaegig: t.ganztaegig === true,
        von: typeof t.von === "string" ? t.von : "",
        bis: typeof t.bis === "string" ? t.bis : "",
        wiederholung: (["nie", "taeglich", "woechentlich", "monatlich"].includes(t.wiederholung)
          ? t.wiederholung
          : "nie") as Wiederholung,
        notiz: String(t.notiz ?? "").slice(0, 500),
        ort: String(t.ort ?? "").slice(0, 120),
      }));
  } catch {
    return null;
  }
}

export function vergissLokaleTermine(benutzer: string) {
  try {
    window.localStorage.removeItem(`schichtplan.termine.${benutzer}`);
  } catch {
    // dann beim nächsten Mal – doppelt übernommen wird nichts, weil erst danach gelöscht wird
  }
}

/** Ganze Tage zwischen zwei Daten (lokal, ohne Zeitumstellungsfehler). */
function tageZwischen(a: string, b: string) {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** Beginnt der Termin (bzw. eine seiner Wiederholungen) an diesem Tag? */
function beginntAm(t: Termin, iso: string): boolean {
  if (iso < t.datum) return false;
  if (t.ausfaelle?.includes(iso)) return false;
  if (t.serieAb && iso >= t.serieAb) return false;
  switch (t.wiederholung) {
    case "taeglich":
      return true;
    case "woechentlich":
      return tageZwischen(t.datum, iso) % 7 === 0;
    case "monatlich":
      return fromISO(iso).getDate() === fromISO(t.datum).getDate();
    default:
      return iso === t.datum;
  }
}

/** Wie viele Tage ein ganztägiger Termin über den ersten hinaus dauert. */
export function weitereTage(t: Termin): number {
  if (!t.ganztaegig || !t.bisDatum || t.bisDatum <= t.datum) return 0;
  return Math.min(62, tageZwischen(t.datum, t.bisDatum));
}

/** Erster Tag des Vorkommens, das am Tag `iso` zu sehen ist (bei mehrtägigen früher). */
export function vorkommenAm(t: Termin, iso: string): string {
  const extra = weitereTage(t);
  for (let k = 0; k <= extra; k++) {
    const tag = k ? addDays(iso, -k) : iso;
    if (beginntAm(t, tag)) return tag;
  }
  return iso;
}

/** Alle Termine an einem Tag, auch wiederkehrende und mehrtägige. Ganztägige zuerst. */
export function termineAm(termine: Termin[], iso: string): Termin[] {
  return termine
    .filter((t) => {
      const extra = weitereTage(t);
      for (let k = 0; k <= extra; k++) if (beginntAm(t, k ? addDays(iso, -k) : iso)) return true;
      return false;
    })
    .sort((a, b) => (a.ganztaegig ? "" : a.von).localeCompare(b.ganztaegig ? "" : b.von));
}

function dauer(von: string, bis: string): string {
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  if ([vh, vm, bh, bm].some((n) => n === undefined || Number.isNaN(n))) return "";
  let m = bh! * 60 + bm! - (vh! * 60 + vm!);
  if (m <= 0) m += 24 * 60;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} Std. ${m % 60} Min.` : `${h} Std.`;
}

const feld =
  "flex min-h-[52px] items-center justify-between gap-3 border-b border-line text-[16px]";
const eingabe =
  "min-w-0 flex-1 bg-transparent py-2 text-right text-[16px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md";


/** "HH:MM" plus Minuten (über Mitternacht hinaus wieder von vorn). */
export function zeitPlus(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const gesamt = ((((h ?? 0) * 60 + (m ?? 0) + min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(gesamt / 60)).padStart(2, "0")}:${String(gesamt % 60).padStart(2, "0")}`;
}

/** Minuten zwischen zwei Uhrzeiten (über Mitternacht: bis zum nächsten Tag). */
export function minutenZwischen(von: string, bis: string): number {
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  let m = (bh ?? 0) * 60 + (bm ?? 0) - ((vh ?? 0) * 60 + (vm ?? 0));
  if (m <= 0) m += 1440;
  return m;
}

const ERINNERUNG_MIT_ZEIT: { id: Erinnerung | null; name: string }[] = [
  { id: null, name: "Keine" },
  { id: "m10", name: "10 Min." },
  { id: "h1", name: "1 Std. vorher" },
  { id: "d1", name: "1 Tag vorher" },
  { id: "morgens8", name: "Morgens 8:00" },
];
const ERINNERUNG_GANZ: { id: Erinnerung | null; name: string }[] = [
  { id: null, name: "Keine" },
  { id: "vortag18", name: "Am Vortag 18:00" },
  { id: "tag8", name: "Am Tag 8:00" },
  { id: "d2", name: "2 Tage vorher" },
];
const DAUERN = [
  { tage: 1, name: "1 Tag" },
  { tage: 2, name: "2 Tage" },
  { tage: 3, name: "3 Tage" },
  { tage: 7, name: "1 Woche" },
];

/** Kurzer Text zur Erinnerung, z. B. für das Tagesblatt. */
export function erinnerungText(e: Erinnerung | null | undefined): string | null {
  if (!e) return null;
  return [...ERINNERUNG_MIT_ZEIT, ...ERINNERUNG_GANZ].find((x) => x.id === e)?.name ?? null;
}

const pille = (an: boolean) =>
  cn(
    "h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
    an ? "bg-ink text-surface" : "bg-ink/[0.06] text-ink",
  );

export function TerminBlatt({
  datum,
  termin,
  onSpeichern,
  onLoeschen,
  serieLoeschen = false,
  hinweis,
  nurLesen = false,
  glas = false,
  vorschlaege = false,
  startZeit,
  ziele = [],
  onClose,
}: {
  datum: string;
  termin: Termin | null;
  onSpeichern: (t: TerminEingabe) => void;
  /** Löschen; bei einer Wiederholung mit Wahl (modus) und dem betroffenen Tag. */
  onLoeschen: (id: string, modus?: LoeschModus, datum?: string) => void;
  /** Bei wiederholenden Terminen fragen: nur dieser, ab hier oder alle. */
  serieLoeschen?: boolean;
  /** Zeile unter den Feldern – wer den Termin sieht. */
  hinweis: string;
  /** Nur ansehen (Termin der anderen Person). */
  nurLesen?: boolean;
  /** Glas-Stil des Privatbereichs (schwebende Karte). */
  glas?: boolean;
  /** Vorschläge je nach Person (Schule, Studium, …) und eigene Vorlagen. */
  vorschlaege?: boolean;
  /** Beginn für einen neuen Termin (z. B. aus der Tagesansicht). */
  startZeit?: string;
  /** Verbundene Konten, bei denen man eintragen darf (neuer Termin). */
  ziele?: { id: string; name: string }[];
  onClose: () => void;
}) {
  const id = useId();
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [titel, setTitel] = useState(termin?.titel ?? "");
  const zeile = glas ? feld.replace("border-line", "glas-linie") : feld;
  const [ganz, setGanz] = useState(termin?.ganztaegig ?? false);
  const [von, setVon] = useState(termin?.von || startZeit || "12:00");
  const [bis, setBis] = useState(termin?.bis || zeitPlus(startZeit ?? "12:00", 60));
  const [wdh, setWdh] = useState<Wiederholung>(termin?.wiederholung ?? "nie");
  const [notiz, setNotiz] = useState(termin?.notiz ?? "");
  const [ort, setOrt] = useState(termin?.ort ?? "");
  const tag = termin?.datum ?? datum;
  const [bisDatum, setBisDatum] = useState<string>(termin?.bisDatum && termin.bisDatum > tag ? termin.bisDatum : tag);
  const [erinnerung, setErinnerung] = useState<Erinnerung | null>(termin?.erinnerung ?? null);
  /** null = mein Kalender, sonst das Konto einer verbundenen Person */
  const [ziel, setZiel] = useState<string | null>(null);

  const mitVorschlaegen = vorschlaege && !termin && !nurLesen;
  const { vorlieben, setzen } = useVorlieben();
  const [eigeneNeu, setEigeneNeu] = useState<{ titel: string; min: number } | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [vorlagenFehler, setVorlagenFehler] = useState<string | null>(null);

  function waehle(v: Vorlage) {
    setTitel(mitSymbol(v));
    if (v.min > 0) {
      setGanz(false);
      setBis(zeitPlus(von, v.min));
    } else {
      setGanz(true);
    }
  }

  async function vorlagenSpeichern(liste: Vorlage[]) {
    setVorlagenFehler(null);
    try {
      await setzen(null, liste);
    } catch (e) {
      setVorlagenFehler(e instanceof Error ? e.message : "Die Vorlage konnte nicht gespeichert werden.");
    }
  }

  const tageAnzahl = tageZwischen(tag, bisDatum) + 1;
  const erinnerungen = ganz ? ERINNERUNG_GANZ : ERINNERUNG_MIT_ZEIT;
  // Passt die gewählte Erinnerung nicht mehr (ganztägig umgeschaltet), keine.
  const erinnerungGueltig = erinnerungen.some((e) => e.id === erinnerung) ? erinnerung : null;

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    onSpeichern({
      id: termin?.id ?? null,
      datum: tag,
      bisDatum: ganz && bisDatum > tag ? bisDatum : null,
      titel: titel.trim(),
      ganztaegig: ganz,
      von,
      bis,
      wiederholung: wdh,
      notiz: notiz.trim(),
      ort: ort.trim(),
      erinnerung: ziel ? null : erinnerungGueltig,
      ziel,
    });
  }

  // An den Body gehängt: der Kalender steht auf dem Handy fest (eigene
  // Ebene unter der Navigation) – im Kalender selbst läge das Blatt sonst
  // unter der Navigationsleiste, und „Speichern“ wäre nicht zu erreichen.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center lg:items-center",
        glas && "privat-schrift px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      <button
        type="button"
        aria-label="Schließen"
        className={cn("absolute inset-0 cursor-default", glas ? "bg-black/20" : "bg-black/40")}
        onClick={onClose}
      />
      <form
        onSubmit={speichern}
        role="dialog"
        aria-label={termin ? "Termin bearbeiten" : "Neuer Termin"}
        className={cn(
          "relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden",
          glas ? "glas-dicht max-h-[90dvh] rounded-[30px]" : "rounded-t-3xl bg-surface shadow-pop lg:rounded-3xl",
        )}
      >
        <div className={cn("flex items-baseline justify-between px-5 py-4", glas ? "bg-ink/[0.05]" : "bg-surface-sunken")}>
          <span className="text-[17px] font-semibold">
            {termin?.wiederholung && termin.wiederholung !== "nie" ? "ab " : ""}
            {formatDE(tag)}
            {ganz && tageAnzahl > 1 ? ` – ${formatDE(bisDatum)}` : ""}
          </span>
          <span className="tnum text-[15px] text-ink-muted">
            {ganz ? (tageAnzahl > 1 ? `${tageAnzahl} Tage` : "Ganztägig") : dauer(von, bis)}
          </span>
        </div>

        <div className="overflow-y-auto px-5">
          {mitVorschlaegen ? (
            <div className="space-y-3 pt-4">
              <div
                aria-label="Vorschläge"
                className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {STANDARD_TERMINE.map((v) => (
                  <button key={v.titel} type="button" onClick={() => waehle(v)} className={pille(titel === mitSymbol(v))}>
                    {mitSymbol(v)}
                  </button>
                ))}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[12.5px] font-semibold text-ink-muted">Meine Vorlagen</p>
                  {vorlieben?.vorlagen.length ? (
                    <button
                      type="button"
                      onClick={() => setBearbeiten(!bearbeiten)}
                      className="text-[12.5px] font-semibold text-brand-600"
                    >
                      {bearbeiten ? "Fertig" : "Bearbeiten"}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(vorlieben?.vorlagen ?? []).map((v, i) => (
                    <span key={`${v.titel}-${i}`} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          bearbeiten
                            ? void vorlagenSpeichern((vorlieben?.vorlagen ?? []).filter((_, j) => j !== i))
                            : waehle(v)
                        }
                        aria-label={bearbeiten ? `${v.titel} entfernen` : undefined}
                        className={cn(pille(!bearbeiten && titel === mitSymbol(v)), bearbeiten && "pr-8")}
                      >
                        {mitSymbol(v)}
                      </button>
                      {bearbeiten ? (
                        <X aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-crit-fg" />
                      ) : null}
                    </span>
                  ))}
                  {!eigeneNeu && (vorlieben?.vorlagen.length ?? 0) < 12 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBearbeiten(false);
                        setEigeneNeu({ titel: titel.trim(), min: ganz ? 0 : Math.min(minutenZwischen(von, bis), 1440) });
                      }}
                      className="h-9 rounded-full border-[1.5px] border-dashed border-ink/25 px-3.5 text-[13.5px] font-semibold text-ink-muted"
                    >
                      ＋ Eigene
                    </button>
                  ) : null}
                </div>
                {eigeneNeu ? (
                  <div className="mt-2 space-y-2 rounded-[16px] bg-ink/[0.04] p-3">
                    <input
                      autoFocus
                      value={eigeneNeu.titel}
                      onChange={(e) => setEigeneNeu({ ...eigeneNeu, titel: e.target.value })}
                      placeholder="z. B. 🏋️ Gym"
                      maxLength={48}
                      aria-label="Name der Vorlage"
                      className="h-11 w-full rounded-[12px] bg-surface/80 px-3 text-[16px] outline-none ring-1 ring-inset ring-ink/10 focus-visible:ring-2 focus-visible:ring-brand-500"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { min: 30, name: "30 Min." },
                        { min: 60, name: "1 Std." },
                        { min: 90, name: "1,5 Std." },
                        { min: 120, name: "2 Std." },
                        { min: 0, name: "Ganztägig" },
                      ].map((d) => (
                        <button
                          key={d.min}
                          type="button"
                          onClick={() => setEigeneNeu({ ...eigeneNeu, min: d.min })}
                          className={pille(eigeneNeu.min === d.min)}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEigeneNeu(null)}
                        className="h-10 flex-1 rounded-[12px] text-[14px] font-semibold text-ink-muted"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        disabled={!eigeneNeu.titel.trim()}
                        onClick={() => {
                          const roh = eigeneNeu.titel.trim();
                          // Ein Symbol am Anfang wird zum Symbol der Vorlage.
                          const treffer = /^(\p{Extended_Pictographic}[‍️\p{Extended_Pictographic}]*)\s*(.*)$/u.exec(roh);
                          const v: Vorlage = treffer && treffer[2]
                            ? { icon: treffer[1]!, titel: treffer[2], min: eigeneNeu.min }
                            : { icon: "", titel: roh, min: eigeneNeu.min };
                          setEigeneNeu(null);
                          void vorlagenSpeichern([...(vorlieben?.vorlagen ?? []), v]);
                          waehle(v);
                        }}
                        className="h-10 flex-1 rounded-[12px] bg-ink text-[14px] font-bold text-surface disabled:opacity-40"
                      >
                        Merken
                      </button>
                    </div>
                  </div>
                ) : null}
                {vorlagenFehler ? <p className="mt-2 text-[12.5px] text-crit-fg">{vorlagenFehler}</p> : null}
              </div>
            </div>
          ) : null}

          {!termin && !nurLesen && ziele.length ? (
            <div className="space-y-1.5 pt-4">
              <p className="text-[12.5px] font-semibold text-ink-muted">Eintragen bei</p>
              <div className="flex flex-wrap gap-1.5">
                {[{ id: null as string | null, name: "Mir" }, ...ziele].map((z) => (
                  <button key={z.id ?? "ich"} type="button" onClick={() => setZiel(z.id)} className={pille(ziel === z.id)}>
                    {z.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <fieldset disabled={nurLesen} className="m-0 min-w-0 border-0 p-0">
          <label className={zeile}>
            <span className="shrink-0">Titel</span>
            <input
              id={`${id}-titel`}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Ohne Titel"
              maxLength={80}
              autoComplete="off"
              className={eingabe}
            />
          </label>
          <div className={zeile}>
            <span id={`${id}-ganz`}>Ganztägig</span>
            <button
              type="button"
              role="switch"
              aria-checked={ganz}
              aria-labelledby={`${id}-ganz`}
              onClick={() => setGanz((g) => !g)}
              className={cn(
                "relative h-8 w-[52px] shrink-0 rounded-full transition-colors",
                ganz ? "bg-brand-500" : glas ? "bg-ink/[0.12]" : "bg-surface-sunken ring-1 ring-inset ring-line",
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
                  ganz ? "left-1 translate-x-5" : "left-1",
                )}
              />
            </button>
          </div>
          {!ganz ? (
            <>
              <label className={zeile}>
                <span>Start</span>
                <input
                  id={`${id}-von`}
                  type="time"
                  value={von}
                  onChange={(e) => {
                    // Die Dauer bleibt gleich, wenn der Beginn wandert.
                    const laenge = minutenZwischen(von, bis);
                    setVon(e.target.value);
                    if (e.target.value) setBis(zeitPlus(e.target.value, laenge));
                  }}
                  className={cn(eingabe, "flex-none")}
                  required
                />
              </label>
              <label className={zeile}>
                <span>Ende</span>
                <input
                  id={`${id}-bis`}
                  type="time"
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  className={cn(eingabe, "flex-none")}
                  required
                />
              </label>
            </>
          ) : vorschlaege ? (
            <div className={cn(zeile, "flex-col items-stretch gap-2 py-3")}>
              <span>Wie lange?</span>
              <div className="flex flex-wrap gap-1.5">
                {DAUERN.map((d) => (
                  <button
                    key={d.tage}
                    type="button"
                    onClick={() => setBisDatum(addDays(tag, d.tage - 1))}
                    className={pille(tageAnzahl === d.tage)}
                  >
                    {d.name}
                  </button>
                ))}
                <label className={cn(pille(!DAUERN.some((d) => d.tage === tageAnzahl)), "relative flex items-center gap-1")}>
                  Bis
                  <input
                    type="date"
                    value={bisDatum}
                    min={tag}
                    max={addDays(tag, 62)}
                    onChange={(e) => {
                      const w = e.target.value;
                      if (/^\d{4}-\d{2}-\d{2}$/.test(w) && w >= tag && w <= addDays(tag, 62)) setBisDatum(w);
                    }}
                    aria-label="Letzter Tag"
                    className="w-[7.4rem] bg-transparent text-[13.5px] font-semibold outline-none"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {vorschlaege && !ziel && !termin?.inhaber ? (
          <div className={cn(zeile, "flex-col items-stretch gap-2 py-3")}>
            <span>🔔 Erinnerung</span>
            <div className="flex flex-wrap gap-1.5">
              {erinnerungen.map((e) => (
                <button
                  key={e.id ?? "keine"}
                  type="button"
                  onClick={() => setErinnerung(e.id)}
                  className={pille(erinnerungGueltig === e.id)}
                >
                  {e.name}
                </button>
              ))}
            </div>
            {erinnerungGueltig && !nurLesen ? <ErinnerungHinweis /> : null}
          </div>
          ) : null}

          <label className={zeile}>
            <span>Wiederholen</span>
            <select
              id={`${id}-wdh`}
              value={wdh}
              onChange={(e) => setWdh(e.target.value as Wiederholung)}
              className={cn(eingabe, "text-right")}
            >
              <option value="nie">Niemals</option>
              <option value="taeglich">Täglich</option>
              <option value="woechentlich">Wöchentlich</option>
              <option value="monatlich">Monatlich</option>
            </select>
          </label>

          <div className={cn("my-4 overflow-hidden rounded-2xl", glas ? "bg-ink/[0.05]" : "border border-line")}>
            <textarea
              id={`${id}-notiz`}
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              placeholder="Notizen"
              rows={2}
              maxLength={500}
              className="block w-full resize-none bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-ink-faint"
            />
            <input
              id={`${id}-ort`}
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              placeholder="Ort"
              maxLength={120}
              autoComplete="off"
              className={cn("block w-full border-t bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-ink-faint", glas ? "glas-linie" : "border-line")}
            />
          </div>
          </fieldset>
          <p className="pb-3 text-[12px] text-ink-faint">
            {hinweis}
          </p>
        </div>

        <div className={cn("flex items-center border-t", glas ? "glas-linie" : "border-line pb-[env(safe-area-inset-bottom)]")}>
          {termin && !nurLesen ? (
            <button
              type="button"
              onClick={() => (serieLoeschen && termin.wiederholung !== "nie" ? setLoeschFrage(true) : onLoeschen(termin.id))}
              aria-label="Termin löschen"
              className="flex h-14 w-14 items-center justify-center text-crit-fg"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 text-[16px] font-semibold text-ink-muted"
          >
            Schließen
          </button>
          {!nurLesen ? (
            <button type="submit" className="h-14 flex-1 text-[16px] font-semibold text-brand-600">
              Speichern
            </button>
          ) : null}
        </div>
      </form>
      {loeschFrage && termin ? (
        <TerminLoeschenFrage
          termin={termin}
          datum={vorkommenAm(termin, datum)}
          onJa={(modus) => onLoeschen(termin.id, modus, vorkommenAm(termin, datum))}
          onClose={() => setLoeschFrage(false)}
        />
      ) : null}
    </div>,
    document.body,
  );
}

/**
 * Nachfrage vor dem Löschen eines Termins. Bei einer Wiederholung mit Wahl:
 * nur der Termin an diesem Tag, dieser und alle folgenden oder die ganze Serie.
 */
export function TerminLoeschenFrage({
  termin,
  datum,
  onJa,
  onClose,
}: {
  termin: Termin;
  /** Erster Tag des betroffenen Vorkommens. */
  datum: string;
  onJa: (modus: LoeschModus) => void;
  onClose: () => void;
}) {
  const serie = termin.wiederholung !== "nie";
  const erster = datum <= termin.datum;
  const [modus, setModus] = useState<LoeschModus>(serie ? "dieser" : "alle");
  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);
  const name = `„${termin.titel || "Termin"}“`;
  const optionen: { id: LoeschModus; name: string; text: string }[] = [
    { id: "dieser", name: "Nur diesen Termin", text: `${formatDE(datum)} fällt aus, die anderen bleiben.` },
    ...(erster ? [] : [{ id: "ab" as const, name: "Diesen und alle folgenden", text: "Die Serie endet davor, frühere Termine bleiben." }]),
    { id: "alle", name: "Alle Termine der Serie", text: "Auch die vergangenen." },
  ];
  return createPortal(
    <div
      className="privat privat-schrift fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-label="Termin löschen"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[24px] bg-white p-4 shadow-[0_20px_50px_rgba(31,41,77,0.3)]"
      >
        <p className="text-[17px] font-bold">🗑️ Termin löschen?</p>
        {serie ? (
          <div className="mt-2 space-y-2" role="radiogroup" aria-label="Was soll gelöscht werden?">
            <p className="text-[14px] text-ink-muted">{name} wiederholt sich.</p>
            {optionen.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={modus === o.id}
                onClick={() => setModus(o.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[14px] border-[1.5px] px-3 py-2.5 text-left",
                  modus === o.id ? "border-ink bg-ink/[0.05]" : "border-ink/15",
                )}
              >
                <span
                  aria-hidden
                  className={cn("mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2", modus === o.id ? "border-ink bg-[radial-gradient(#1F294D_45%,transparent_50%)]" : "border-ink-faint")}
                />
                <span>
                  <span className="block text-[15px] font-semibold">{o.name}</span>
                  <span className="block text-[12.5px] text-ink-muted">{o.text}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[14px] text-ink-muted">{name} wird gelöscht.</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-12 rounded-[16px] bg-ink/[0.07] text-[15px] font-semibold">
            Abbrechen
          </button>
          <button type="button" onClick={() => onJa(modus)} className="h-12 rounded-[16px] bg-[#e5484d] text-[15px] font-bold text-white">
            Löschen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
