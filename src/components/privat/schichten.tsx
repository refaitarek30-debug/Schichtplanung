"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import {
  ART_TEXT,
  FARBEN,
  dauerStunden,
  farbStil,
  loescheSchichtart,
  speichereSchichtart,
  type SchichtArt,
  type Schichtart,
  type SchichtartEingabe,
} from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { PrivatKopf, RundKnopf } from "./rahmen";
import { Blatt } from "./blatt";

/** Eigene Schichten: Name, Kürzel, Farbe, Uhrzeit, Stunden. */
export function PrivatSchichten() {
  const { schichtarten, ladeArtenNeu, artenFehler } = usePrivat();
  const [offen, setOffen] = useState<SchichtartEingabe | null>(null);

  function neu() {
    setOffen({
      id: null,
      name: "",
      kuerzel: "",
      farbe: FARBEN[(schichtarten?.length ?? 0) % FARBEN.length]!,
      art: "arbeit",
      beginn: "08:00",
      ende: "16:00",
      stunden: 8,
      reihenfolge: (schichtarten?.length ?? 0) + 1,
    });
  }

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Schichten"
        unter="Deine Schichtarten mit Farbe und Uhrzeit."
        rechts={
          <RundKnopf label="Neue Schicht" onClick={neu}>
            <Plus className="h-5 w-5" />
          </RundKnopf>
        }
      />
      {artenFehler ? <Alert tone="error">{artenFehler}</Alert> : null}
      <ul aria-busy={!schichtarten} className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {(schichtarten ?? []).map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOffen({ ...a })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={farbStil(a.farbe)}>
                {a.kuerzel}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium">{a.name}</span>
                <span className="block text-[13px] text-ink-muted">
                  {ART_TEXT[a.art]}
                  {a.beginn && a.ende ? ` · ${a.beginn}–${a.ende}` : ""}
                </span>
              </span>
              <span className="tnum shrink-0 text-[14px] text-ink-muted">{a.stunden.toLocaleString("de-DE")} h</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={neu}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line py-3 text-[14px] font-semibold text-brand-600"
      >
        <Plus className="h-4 w-4" /> Schicht hinzufügen
      </button>

      {offen ? (
        <SchichtBlatt
          wert={offen}
          onClose={() => setOffen(null)}
          onFertig={async () => {
            setOffen(null);
            await ladeArtenNeu();
          }}
        />
      ) : null}
    </div>
  );
}

function SchichtBlatt({
  wert,
  onClose,
  onFertig,
}: {
  wert: SchichtartEingabe;
  onClose: () => void;
  onFertig: () => Promise<void>;
}) {
  const [s, setS] = useState<SchichtartEingabe>(wert);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState(false);

  function setze<K extends keyof SchichtartEingabe>(k: K, v: SchichtartEingabe[K]) {
    setS((alt) => {
      const neu = { ...alt, [k]: v };
      // Stunden aus der Uhrzeit vorschlagen.
      if ((k === "beginn" || k === "ende") && neu.art === "arbeit") {
        const h = dauerStunden(neu.beginn, neu.ende);
        if (h !== null) neu.stunden = h;
      }
      if (k === "art") {
        if (v === "frei") neu.stunden = 0;
        if (v !== "arbeit") {
          neu.beginn = "";
          neu.ende = "";
        }
      }
      return neu;
    });
  }

  async function speichern() {
    if (!s.name.trim()) return setFehler("Bitte einen Namen eingeben.");
    if (!s.kuerzel.trim()) return setFehler("Bitte ein Kürzel (1–3 Zeichen) eingeben.");
    if ((s.beginn && !s.ende) || (!s.beginn && s.ende)) return setFehler("Bitte Beginn und Ende angeben – oder beides leer lassen.");
    if (!(s.stunden >= 0 && s.stunden <= 24)) return setFehler("Stunden zwischen 0 und 24.");
    setLaeuft(true);
    setFehler(null);
    try {
      await speichereSchichtart(s);
      await onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  async function loeschen() {
    if (!s.id) return;
    setLaeuft(true);
    try {
      await loescheSchichtart(s.id);
      await onFertig();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setLaeuft(false);
    }
  }

  const feld = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px]";

  return (
    <Blatt
      titel={s.id ? "Schicht bearbeiten" : "Neue Schicht"}
      onClose={onClose}
      fuss={
        <div className="space-y-2">
          {fehler ? <Alert tone="error">{fehler}</Alert> : null}
          {loeschFrage ? (
            <div className="space-y-2 rounded-xl bg-crit-bg p-3">
              <p className="text-[13px] text-crit-fg">
                Alle Tage mit „{s.name}“ werden dabei geleert. Wirklich löschen?
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={loeschen} disabled={laeuft} className="rounded-lg bg-crit-fg px-3 py-2 text-[13px] font-semibold text-white">
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
                className="flex-1 rounded-xl bg-brand-500 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
              >
                {laeuft ? "Speichert …" : "Speichern"}
              </button>
              {s.id ? (
                <button type="button" onClick={() => setLoeschFrage(true)} className="rounded-xl px-4 py-3 text-[14px] font-semibold text-crit-fg">
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
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold" style={farbStil(s.farbe)}>
            {s.kuerzel || "?"}
          </span>
          <span className="text-[13px] text-ink-muted">So sieht die Schicht im Kalender aus.</span>
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Name</span>
            <input id="schicht-name" value={s.name} maxLength={30} onChange={(e) => setze("name", e.target.value)} className={feld} placeholder="z. B. Bereitschaft" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Kürzel</span>
            <input id="schicht-kuerzel" value={s.kuerzel} maxLength={3} onChange={(e) => setze("kuerzel", e.target.value.toUpperCase())} className={feld} placeholder="B" />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-muted">Farbe</span>
          <div className="flex flex-wrap gap-2">
            {FARBEN.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setze("farbe", f)}
                aria-label={`Farbe ${f}`}
                aria-pressed={s.farbe === f}
                className={cn("h-9 w-9 rounded-full", s.farbe === f && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
                style={{ backgroundColor: f }}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-muted">Art</span>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-sunken p-1">
            {(Object.keys(ART_TEXT) as SchichtArt[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setze("art", a)}
                aria-pressed={s.art === a}
                className={cn("rounded-lg py-1.5 text-[13px] font-semibold", s.art === a ? "bg-surface shadow-card" : "text-ink-muted")}
              >
                {ART_TEXT[a]}
              </button>
            ))}
          </div>
        </div>

        {s.art === "arbeit" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Beginn</span>
              <input id="schicht-beginn" type="time" value={s.beginn} onChange={(e) => setze("beginn", e.target.value)} className={feld} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Ende</span>
              <input id="schicht-ende" type="time" value={s.ende} onChange={(e) => setze("ende", e.target.value)} className={feld} />
            </label>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-[13px] font-semibold text-ink-muted">Stunden für die Auswertung</span>
          <input
            id="schicht-stunden"
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.25}
            value={Number.isFinite(s.stunden) ? s.stunden : 0}
            onChange={(e) => setze("stunden", Number(e.target.value))}
            className={feld}
          />
          <span className="mt-1 block text-[12px] text-ink-faint">
            {s.art === "arbeit" ? "Wird aus der Uhrzeit vorgeschlagen; Pausen kannst du abziehen." : "Zum Beispiel 8 für einen bezahlten Urlaubstag."}
          </span>
        </label>
      </div>
    </Blatt>
  );
}

export type { Schichtart };
