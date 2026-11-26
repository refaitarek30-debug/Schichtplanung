"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Delete, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useLoeschFrage } from "@/components/kalender/loesch-frage";
import { addDays, formatDE, fromISO, toISO } from "@/lib/dates";
import { farbStil, speichereSchichtart, wendeRotationAn, type Schichtart, type SchichtartEingabe } from "@/lib/privat/daten";
import { usePrivat } from "./kontext";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";

/**
 * Schichtfolge eintragen: Muster zusammenklicken (oder Vorlage wählen),
 * Startdatum und Dauer – der Rest füllt sich von selbst.
 */

const DAUER = [
  { monate: 3, text: "3 Monate" },
  { monate: 6, text: "6 Monate" },
  { monate: 12, text: "1 Jahr" },
  { monate: 24, text: "2 Jahre" },
  { monate: 36, text: "3 Jahre" },
  { monate: 48, text: "4 Jahre" },
];

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

interface Vorlage {
  name: string;
  kurz: string;
  folge: string[];
}

const VORLAGEN: Vorlage[] = [
  { name: "Je 2 Früh, Spät, Nacht, dann 2 frei", kurz: "FFSSNNXX", folge: ["F", "F", "S", "S", "N", "N", "X", "X"] },
  { name: "Je 2 Früh, Spät, Nacht, dann 4 frei", kurz: "FFSSNNXXXX", folge: ["F", "F", "S", "S", "N", "N", "X", "X", "X", "X"] },
  {
    name: "Woche Früh, Woche Spät (Mo–Fr)",
    kurz: "Wechsel",
    folge: ["F", "F", "F", "F", "F", "X", "X", "S", "S", "S", "S", "S", "X", "X"],
  },
  { name: "Mo–Fr Früh, Wochenende frei", kurz: "Mo–Fr", folge: ["F", "F", "F", "F", "F", "X", "X"] },
];

/** Standard-Schichten für die Vorlagen – werden nur angelegt, wenn sie fehlen. */
const STANDARD: Record<string, SchichtartEingabe> = {
  F: { id: null, name: "Früh", kuerzel: "F", farbe: "#F5A524", art: "arbeit", beginn: "06:00", ende: "14:00", stunden: 8, reihenfolge: 0 },
  S: { id: null, name: "Spät", kuerzel: "S", farbe: "#22A06B", art: "arbeit", beginn: "14:00", ende: "22:00", stunden: 8, reihenfolge: 0 },
  N: { id: null, name: "Nacht", kuerzel: "N", farbe: "#2F6FDE", art: "arbeit", beginn: "22:00", ende: "06:00", stunden: 8, reihenfolge: 0 },
  X: { id: null, name: "Frei", kuerzel: "X", farbe: "#E5484D", art: "frei", beginn: "", ende: "", stunden: 0, reihenfolge: 0 },
};

function plusMonate(iso: string, monate: number): string {
  const d = fromISO(iso);
  return addDays(toISO(new Date(d.getFullYear(), d.getMonth() + monate, d.getDate())), -1);
}

export function RotationBlatt({
  arten,
  heute,
  onFertig,
  onClose,
}: {
  arten: Schichtart[];
  heute: string;
  /** Mit der Zahl der eingetragenen Tage und dem letzten Tag. */
  onFertig: (ergebnis: { tage: number; bis: string }) => void;
  onClose: () => void;
}) {
  const [muster, setMuster] = useState<(string | null)[]>([]);
  const [start, setStart] = useState(heute);
  const [anderesDatum, setAnderesDatum] = useState(false);
  const [monate, setMonate] = useState(12);
  const [ueberschreiben, setUeberschreiben] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const loesch = useLoeschFrage();
  // Die Folge steht in einer festen Zeile, die seitlich scrollt – so wächst
  // das Fenster beim Antippen nicht und kein Knopf rutscht unter den Finger.
  const zeile = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = zeile.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [muster.length]);

  const nachKuerzel = useMemo(() => new Map(arten.map((a) => [a.kuerzel.toUpperCase(), a])), [arten]);
  const nachId = useMemo(() => new Map(arten.map((a) => [a.id, a])), [arten]);

  // Alle Vorlagen anbieten. Fehlt eine Schicht (neue Konten starten nur mit
  // Arbeit, Urlaub, Arzt, Krank), wird sie beim Antippen mit Standardzeiten angelegt.
  const vorlagen = VORLAGEN;
  const { ladeArtenNeu } = usePrivat();
  const [wartet, setWartet] = useState<string[] | null>(null);
  useEffect(() => {
    if (!wartet || !wartet.every((k) => nachKuerzel.has(k))) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuster(wartet.map((k) => nachKuerzel.get(k)!.id));
    setWartet(null);
  }, [wartet, nachKuerzel]);
  async function vorlageMitFehlenden(folge: string[]) {
    const fehlen = [...new Set(folge)].filter((k) => !nachKuerzel.has(k));
    if (!fehlen.length) return setMuster(folge.map((k) => nachKuerzel.get(k)!.id));
    setFehler(null);
    try {
      let rf = arten.reduce((m, a) => Math.max(m, a.reihenfolge), 0);
      for (const k of fehlen) {
        const s = STANDARD[k];
        if (s) await speichereSchichtart({ ...s, reihenfolge: ++rf });
      }
      await ladeArtenNeu();
      setWartet(folge);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Schichten konnten nicht angelegt werden.");
    }
  }

  const bis = plusMonate(start, monate);
  const erste = muster[0] ? nachId.get(muster[0]) : undefined;
  const naechsteTage = Array.from({ length: 7 }, (_, i) => addDays(heute, i));

  async function anwenden() {
    if (!muster.length) {
      setFehler("Tippe mindestens eine Schicht für die Folge an.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      setFehler("Bitte ein Startdatum wählen.");
      return;
    }
    setLaeuft(true);
    setFehler(null);
    try {
      const tage = await wendeRotationAn(start, bis, muster, ueberschreiben);
      onFertig({ tage, bis });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  return (
    <Blatt
      wischZu="kopf"
      titel="Schichtfolge eintragen"
      unter="Die Folge wiederholt sich ab dem Startdatum."
      onClose={onClose}
      fuss={
        <div className="space-y-2">
          {fehler ? <Alert tone="error">{fehler}</Alert> : null}
          <button
            type="button"
            onClick={anwenden}
            disabled={laeuft || !muster.length}
            className="w-full rounded-[16px] bg-brand-500 px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {laeuft ? "Wird eingetragen …" : `Eintragen bis ${formatDE(bis)}`}
          </button>
        </div>
      }
    >
      {loesch.fenster}
      {vorlagen.length ? (
        <>
          <p className="mb-2 text-[13px] font-semibold text-ink-muted">Welche Folge passt?</p>
          <div data-vorlagen className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vorlagen.map((v) => {
              const ids = v.folge.map((k) => nachKuerzel.get(k)?.id ?? null);
              const gewaehlt = ids.every((id) => id) && ids.length === muster.length && ids.every((id, i) => muster[i] === id);
              return (
                <button
                  key={v.kurz}
                  type="button"
                  aria-pressed={gewaehlt}
                  onClick={() => {
                    if (gewaehlt) return;
                    if (!muster.length || VORLAGEN.some((x) => x.folge.length === muster.length && x.folge.every((k, i) => nachKuerzel.get(k)?.id === muster[i])))
                      return void vorlageMitFehlenden(v.folge);
                    loesch.frage({
                      titel: "Vorlage übernehmen?",
                      text: "Deine bisherige Folge wird dabei ersetzt.",
                      knopf: "Übernehmen",
                      onJa: () => void vorlageMitFehlenden(v.folge),
                    });
                  }}
                  className={cn(
                    "rounded-[16px] px-3 py-2.5 text-left ring-1 transition-colors",
                    gewaehlt ? "bg-brand-500/[0.1] ring-2 ring-brand-500" : "bg-ink/[0.04] ring-line hover:bg-ink/[0.07]",
                  )}
                >
                  <span className="block text-[13.5px] font-semibold">{v.name}</span>
                  <span className="mt-1.5 flex gap-[3px]" aria-hidden>
                    {v.folge.map((k, i) => (
                      <span key={i} className="h-2.5 flex-1 rounded-[3px]" style={{ background: nachKuerzel.get(k)?.farbe ?? STANDARD[k]?.farbe }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <p className="mb-2 text-[13px] font-semibold text-ink-muted">
        {vorlagen.length ? "Oder eigene Folge" : "Deine Folge"} {muster.length ? <span className="font-normal">· {muster.length} Tage</span> : null}
      </p>
      <div className="h-[52px] rounded-[16px] bg-ink/[0.05] p-2">
        {muster.length ? (
          <ol
            ref={zeile}
            aria-label="Deine Folge"
            className="flex h-full gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {muster.map((id, i) => {
              const a = id ? nachId.get(id) : null;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-1.5 text-[13px] font-bold",
                    !a && "border border-dashed border-ink/20 text-ink-faint",
                  )}
                  style={a ? farbStil(a.farbe) : undefined}
                  title={`Tag ${i + 1}: ${a?.name ?? "nichts"}`}
                >
                  {a?.kuerzel ?? "–"}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-1 py-2 text-[13px] text-ink-faint">Tippe unten die Schichten in der richtigen Reihenfolge an.</p>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMuster(muster.slice(0, -1))}
          disabled={!muster.length}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-ink/[0.07] text-[14px] font-semibold text-ink disabled:opacity-40"
        >
          <Delete className="h-[18px] w-[18px]" /> Letzten entfernen
        </button>
        <button
          type="button"
          onClick={() =>
            loesch.frage({
              titel: "Wirklich neu beginnen?",
              text: `Deine Folge mit ${muster.length} ${muster.length === 1 ? "Tag" : "Tagen"} wird gelöscht.`,
              knopf: "Neu beginnen",
              onJa: () => setMuster([]),
            })
          }
          disabled={!muster.length}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-ink/[0.07] text-[14px] font-semibold text-ink disabled:opacity-40"
        >
          <Trash2 className="h-[18px] w-[18px]" /> Neu beginnen
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {arten.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => muster.length < 56 && setMuster([...muster, a.id])}
            className="h-11 rounded-[14px] px-2 text-[14px] font-semibold"
            style={farbStil(a.farbe)}
          >
            + {a.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => muster.length < 56 && setMuster([...muster, null])}
          className="h-11 rounded-[14px] border border-dashed border-ink/20 px-2 text-[13px] font-semibold text-ink-muted"
          title="An diesem Tag nichts eintragen"
        >
          + leer lassen
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-semibold text-ink-muted">Wann beginnt die Folge?</p>
        {erste ? (
          <p className="text-[12.5px] text-ink-faint">
            Also der nächste Tag mit „{erste.name}“ ganz vorne in der Folge.
          </p>
        ) : null}
        <div data-start-tage className="mt-2 flex flex-wrap gap-1.5">
          {naechsteTage.map((iso) => {
            const d = fromISO(iso);
            const an = !anderesDatum && start === iso;
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={an}
                onClick={() => {
                  setAnderesDatum(false);
                  setStart(iso);
                }}
                className={cn(
                  "h-9 rounded-full px-3 text-[13px] font-semibold",
                  an ? "bg-brand-500 text-white" : "bg-ink/[0.06] text-ink",
                )}
              >
                {iso === heute ? "Heute" : `${WT[d.getDay()]} ${d.getDate()}.`}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={anderesDatum}
            onClick={() => setAnderesDatum(true)}
            className={cn(
              "h-9 rounded-full px-3 text-[13px] font-semibold",
              anderesDatum ? "bg-brand-500 text-white" : "bg-ink/[0.06] text-ink",
            )}
          >
            Anderer Tag …
          </button>
        </div>
        {anderesDatum ? (
          <input
            type="date"
            aria-label="Erster Tag der Folge"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-2 block w-full min-w-0 max-w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        ) : null}
      </div>
      <div className="mt-4">
        <label className="block min-w-0">
          <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Wie lange</span>
          <select
            value={monate}
            onChange={(e) => setMonate(Number(e.target.value))}
            className="block w-full min-w-0 max-w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            {DAUER.map((d) => (
              <option key={d.monate} value={d.monate}>
                {d.text}
              </option>
            ))}
          </select>
        </label>
      </div>

      {muster.length ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-semibold text-ink-muted">So sieht es aus</p>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 14 }, (_, i) => {
              const iso = addDays(start, i);
              const id = muster[i % muster.length];
              const a = id ? nachId.get(id) : null;
              return (
                <div key={iso} className="text-center">
                  <div className="text-[10.5px] text-ink-faint">
                    {WT[fromISO(iso).getDay()]} {fromISO(iso).getDate()}.
                  </div>
                  <div
                    className={cn("mt-0.5 rounded-md py-1 text-[12px] font-bold", !a && "bg-ink/[0.06] text-ink-faint")}
                    style={a ? farbStil(a.farbe) : undefined}
                  >
                    {a?.kuerzel ?? "–"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <label className="mt-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={ueberschreiben}
          onChange={(e) => setUeberschreiben(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-500"
        />
        <span className="text-[13px] leading-snug">
          Bestehende Einträge in diesem Zeitraum ersetzen
          <span className="block text-ink-faint">
            Aus: nur leere Tage füllen, deine Änderungen bleiben.
          </span>
        </span>
      </label>
    </Blatt>
  );
}
