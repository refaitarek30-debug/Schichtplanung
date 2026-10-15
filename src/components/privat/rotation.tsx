"use client";

import { useMemo, useState } from "react";
import { Delete, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { addDays, formatDE, fromISO, toISO } from "@/lib/dates";
import { farbStil, wendeRotationAn, type Schichtart } from "@/lib/privat/daten";
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
  onFertig: () => void;
  onClose: () => void;
}) {
  const [muster, setMuster] = useState<(string | null)[]>([]);
  const [start, setStart] = useState(heute);
  const [monate, setMonate] = useState(12);
  const [ueberschreiben, setUeberschreiben] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const nachKuerzel = useMemo(() => new Map(arten.map((a) => [a.kuerzel.toUpperCase(), a])), [arten]);
  const nachId = useMemo(() => new Map(arten.map((a) => [a.id, a])), [arten]);

  // Nur Vorlagen anbieten, deren Kürzel es gibt.
  const vorlagen = VORLAGEN.filter((v) => v.folge.every((k) => nachKuerzel.has(k)));

  const bis = plusMonate(start, monate);

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
      await wendeRotationAn(start, bis, muster, ueberschreiben);
      onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  return (
    <Blatt
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
      {vorlagen.length ? (
        <>
          <p className="mb-2 text-[13px] font-semibold text-ink-muted">Vorlage</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {vorlagen.map((v) => (
              <button
                key={v.kurz}
                type="button"
                onClick={() => setMuster(v.folge.map((k) => nachKuerzel.get(k)!.id))}
                className="rounded-[14px] bg-ink/[0.06] px-3 py-2 text-left text-[13px] hover:bg-ink/[0.1]"
              >
                {v.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <p className="mb-2 text-[13px] font-semibold text-ink-muted">
        Deine Folge {muster.length ? <span className="font-normal">· {muster.length} Tage</span> : null}
      </p>
      <div className="min-h-[52px] rounded-[16px] bg-ink/[0.05] p-2">
        {muster.length ? (
          <ol className="flex flex-wrap gap-1.5">
            {muster.map((id, i) => {
              const a = id ? nachId.get(id) : null;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-[13px] font-bold",
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
          onClick={() => setMuster([])}
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Erster Tag der Folge</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Wie lange</span>
          <select
            value={monate}
            onChange={(e) => setMonate(Number(e.target.value))}
            className="w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40"
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
