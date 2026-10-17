"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Blatt } from "@/components/privat/blatt";
import { loescheEigeneArt, speichereEigeneArt, type EigeneArtEingabe } from "@/lib/data/kalender-eigene";
import { FARBEN, farbStil } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

/**
 * Kürzel aus dem Namen: zwei Wörter → Anfangsbuchstaben („Halber Tag“ → HT),
 * ein Wort → die ersten zwei Buchstaben („Nebenjob“ → NE). Ohne Buchstaben
 * (nur ein Emoji) das erste Zeichen.
 */
export function kuerzelAus(name: string): string {
  const woerter = name
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (woerter.length >= 2) return (Array.from(woerter[0]!)[0]! + Array.from(woerter[1]!)[0]!).toUpperCase();
  if (woerter.length === 1) return Array.from(woerter[0]!).slice(0, 2).join("").toUpperCase();
  return Array.from(name.trim()).slice(0, 1).join("");
}

/** Eigenen Eintrag anlegen oder bearbeiten: Name, Farbe, Uhrzeit. Das Kürzel kommt aus dem Namen. */
export function EigeneArtBlatt({
  wert,
  onClose,
  onFertig,
}: {
  wert: EigeneArtEingabe;
  onClose: () => void;
  onFertig: () => void;
}) {
  const [a, setA] = useState<EigeneArtEingabe>(wert);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState(false);

  function setze<K extends keyof EigeneArtEingabe>(k: K, v: EigeneArtEingabe[K]) {
    setA((alt) => ({ ...alt, [k]: v }));
  }

  async function speichern() {
    if (!a.name.trim()) return setFehler("Bitte einen Namen eingeben.");
    if ((a.beginn && !a.ende) || (!a.beginn && a.ende)) {
      return setFehler("Bitte Beginn und Ende angeben – oder beides leer lassen.");
    }
    setLaeuft(true);
    setFehler(null);
    try {
      await speichereEigeneArt(a);
      onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  async function loeschen() {
    if (!a.id) return;
    setLaeuft(true);
    try {
      await loescheEigeneArt(a.id);
      onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  const feld = "w-full rounded-[14px] bg-ink/[0.06] px-3.5 py-3 text-[15px] outline-none focus:ring-2 focus:ring-brand-500/40";

  return (
    <Blatt
      titel={a.id ? "Eigenen Eintrag bearbeiten" : "Eigener Eintrag"}
      unter="Nur für dich sichtbar – der Schichtplan bleibt unverändert."
      onClose={onClose}
      fuss={
        <div className="space-y-2">
          {fehler ? <Alert tone="error">{fehler}</Alert> : null}
          {loeschFrage ? (
            <div className="space-y-2 rounded-xl bg-crit-bg p-3">
              <p className="text-[13px] text-crit-fg">
                „{a.name}“ wird an allen Tagen entfernt. Wirklich löschen?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loeschen}
                  disabled={laeuft}
                  className="rounded-lg bg-crit-fg px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  Löschen
                </button>
                <button type="button" onClick={() => setLoeschFrage(false)} className="rounded-lg px-3 py-2 text-[13px] font-semibold">
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={speichern}
                disabled={laeuft}
                className="flex-1 rounded-[16px] bg-brand-500 px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
              >
                {laeuft ? "Speichert …" : "Speichern"}
              </button>
              {a.id ? (
                <button
                  type="button"
                  onClick={() => setLoeschFrage(true)}
                  className="rounded-[16px] px-4 py-3 text-[14px] font-semibold text-crit-fg"
                >
                  Löschen
                </button>
              ) : null}
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed text-[15px] font-bold"
            style={{ ...farbStil(a.farbe), borderColor: farbStil(a.farbe).color === "#fff" ? "rgba(255,255,255,0.75)" : "rgba(22,24,29,0.45)" }}
          >
            {a.kuerzel || "?"}
          </span>
          <span className="text-[13px] text-ink-muted">
            {a.kuerzel ? `Kürzel „${a.kuerzel}“ – kommt automatisch aus dem Namen.` : "Das Kürzel kommt automatisch aus dem Namen."}
          </span>
        </div>
        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Name</span>
          <input
            id="eigen-name"
            value={a.name}
            maxLength={30}
            onChange={(e) => {
              const name = e.target.value;
              setA((alt) => ({ ...alt, name, kuerzel: kuerzelAus(name) }));
            }}
            className={feld}
            placeholder="z. B. Nebenjob"
            autoComplete="off"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-muted">Farbe</span>
          <div className="flex flex-wrap gap-2">
            {FARBEN.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setze("farbe", f)}
                aria-label={`Farbe ${f}`}
                aria-pressed={a.farbe === f}
                className={cn("h-9 w-9 rounded-full", a.farbe === f && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                style={{ backgroundColor: f }}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Uhrzeit (wenn du willst)</span>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-[12px] text-ink-faint">von</span>
              <input
                id="eigen-beginn"
                type="time"
                value={a.beginn}
                onChange={(e) => setze("beginn", e.target.value)}
                className={cn(feld, "block h-12 min-w-0 appearance-none")}
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[12px] text-ink-faint">bis</span>
              <input
                id="eigen-ende"
                type="time"
                value={a.ende}
                onChange={(e) => setze("ende", e.target.value)}
                className={cn(feld, "block h-12 min-w-0 appearance-none")}
              />
            </label>
          </div>
          {a.beginn || a.ende ? (
            <button
              type="button"
              onClick={() => setA((alt) => ({ ...alt, beginn: "", ende: "" }))}
              className="mt-1.5 text-[13px] font-semibold text-brand-600"
            >
              Ohne Uhrzeit
            </button>
          ) : null}
        </div>
      </div>
    </Blatt>
  );
}
