"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveShiftSystem } from "@/lib/auth/setup-actions";
import type { PatternBlock } from "@/lib/auth/rotation-pattern-actions";
import type { SetupState } from "@/lib/data/setup";
import { cn } from "@/lib/utils";

const blockMeta: Record<PatternBlock["code"], { label: string; cls: string }> = {
  F: { label: "Frühschicht", cls: "bg-shift-frueh text-shift-frueh-ink" },
  S: { label: "Spätschicht", cls: "bg-shift-spaet text-shift-spaet-ink" },
  N: { label: "Nachtschicht", cls: "bg-shift-nacht text-shift-nacht-ink" },
  FREI: { label: "frei", cls: "bg-surface-sunken text-ink-muted" },
};

/** Gängige Modelle als Startpunkt – von Hand ändern geht danach immer noch. */
const VORLAGEN: { name: string; gruppen: number; blocks: PatternBlock[] }[] = [
  {
    name: "Konti, 4 Gruppen (28 Tage)",
    gruppen: 4,
    blocks: [
      { code: "F", days: 2 },
      { code: "S", days: 2 },
      { code: "N", days: 3 },
      { code: "FREI", days: 2 },
      { code: "F", days: 2 },
      { code: "S", days: 3 },
      { code: "N", days: 2 },
      { code: "FREI", days: 2 },
      { code: "F", days: 3 },
      { code: "S", days: 2 },
      { code: "N", days: 2 },
      { code: "FREI", days: 3 },
    ],
  },
  {
    name: "Drei Schichten, 3 Gruppen (21 Tage)",
    gruppen: 3,
    blocks: [
      { code: "F", days: 5 },
      { code: "FREI", days: 2 },
      { code: "S", days: 5 },
      { code: "FREI", days: 2 },
      { code: "N", days: 5 },
      { code: "FREI", days: 2 },
    ],
  },
  {
    name: "Zwei Schichten, 2 Gruppen (14 Tage)",
    gruppen: 2,
    blocks: [
      { code: "F", days: 5 },
      { code: "FREI", days: 2 },
      { code: "S", days: 5 },
      { code: "FREI", days: 2 },
    ],
  },
];

/**
 * Schritt 2 – Schichtsystem.
 *
 * Wer keine Schichtarbeit hat, überspringt den Schritt: dann gibt es kein
 * rollierendes Muster, jeder arbeitet Montag bis Freitag, und Urlaub
 * kostet schlicht einen Urlaubstag je Arbeitstag.
 */
export function SchrittSchichtsystem({
  stand,
  onFertig,
}: {
  stand: SetupState | null;
  onFertig: () => void | Promise<void>;
}) {
  const [schichtbetrieb, setSchichtbetrieb] = useState(true);
  const [gruppen, setGruppen] = useState(stand?.gruppen && stand.gruppen > 0 ? stand.gruppen : 4);
  const [blocks, setBlocks] = useState<PatternBlock[]>(VORLAGEN[0].blocks);
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const zyklus = blocks.reduce((summe, b) => summe + b.days, 0);

  function vorlage(index: number) {
    setBlocks(VORLAGEN[index].blocks.map((b) => ({ ...b })));
    setGruppen(VORLAGEN[index].gruppen);
    setMeldung({});
  }

  function verschieben(index: number, richtung: -1 | 1) {
    setBlocks((b) => {
      const ziel = index + richtung;
      if (ziel < 0 || ziel >= b.length) return b;
      const next = [...b];
      [next[index], next[ziel]] = [next[ziel], next[index]];
      return next;
    });
  }

  function speichern() {
    setMeldung({});
    startTransition(async () => {
      const result = await saveShiftSystem(blocks, anchor, gruppen);
      setMeldung(result);
      if (!result.error) await onFertig();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Schritt 2 · Wie wird gearbeitet?"
        hint="Ein kompletter Durchlauf des Musters – das System setzt ihn fort und verteilt die Gruppen versetzt."
      />
      <CardBody className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <Auswahl
            aktiv={schichtbetrieb}
            titel="Schichtbetrieb"
            text="Rollierendes Muster über mehrere Gruppen, auch nachts und am Wochenende."
            onClick={() => setSchichtbetrieb(true)}
          />
          <Auswahl
            aktiv={!schichtbetrieb}
            titel="Keine Schichtarbeit"
            text="Feste Arbeitszeit, Montag bis Freitag. Kein Muster nötig."
            onClick={() => setSchichtbetrieb(false)}
          />
        </div>

        {!schichtbetrieb ? (
          <Alert tone="info">
            Ohne Schichtbetrieb ist hier nichts einzurichten. Urlaub kostet dann je
            Arbeitstag von Montag bis Freitag einen Urlaubstag, Feiertage ausgenommen.
            Weiter zu Schritt 3.
          </Alert>
        ) : (
          <>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-muted">Vorlage wählen</p>
              <div className="flex flex-wrap gap-2">
                {VORLAGEN.map((v, i) => (
                  <Button key={v.name} variant="secondary" onClick={() => vorlage(i)}>
                    {v.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Rotationsgruppen"
                hint="Wie viele Mannschaften wechseln sich ab? Daraus ergibt sich der Versatz."
              >
                <select
                  value={gruppen}
                  onChange={(e) => setGruppen(Number(e.target.value))}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "Gruppe" : "Gruppen"}
                      {n > 1 ? ` (A–${String.fromCharCode(64 + n)})` : " (A)"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Erster Tag des Musters" hint="Ab hier zählt der erste Block.">
                <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-[13px] font-medium text-ink-muted">Blöcke der Reihe nach</p>
                <p className="tnum text-[12px] text-ink-faint">
                  Zyklus: {zyklus} Tage · Versatz je Gruppe:{" "}
                  {Math.max(1, Math.round(zyklus / gruppen))} Tage
                </p>
              </div>

              {blocks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
                  Noch keine Blöcke. Unten hinzufügen oder eine Vorlage wählen.
                </p>
              ) : (
                <ol className="space-y-2">
                  {blocks.map((block, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                    >
                      <span
                        className={cn(
                          "flex h-9 w-14 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold",
                          blockMeta[block.code].cls,
                        )}
                      >
                        {block.code === "FREI" ? "Frei" : block.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {blockMeta[block.code].label}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={block.days}
                        onChange={(e) =>
                          setBlocks((b) =>
                            b.map((x, i) =>
                              i === index ? { ...x, days: Math.max(1, Number(e.target.value)) } : x,
                            ),
                          )
                        }
                        className="tnum w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm"
                        aria-label="Anzahl Tage"
                      />
                      <span className="hidden text-[12px] text-ink-faint sm:inline">Tage</span>
                      <button
                        onClick={() => verschieben(index, -1)}
                        disabled={index === 0}
                        className="rounded p-1 text-ink-faint hover:bg-surface-muted disabled:opacity-30"
                        aria-label="nach oben"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => verschieben(index, 1)}
                        disabled={index === blocks.length - 1}
                        className="rounded p-1 text-ink-faint hover:bg-surface-muted disabled:opacity-30"
                        aria-label="nach unten"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setBlocks((b) => b.filter((_, i) => i !== index))}
                        className="rounded p-1 text-ink-faint hover:bg-surface-muted"
                        aria-label="entfernen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {(["F", "S", "N", "FREI"] as const).map((code) => (
                  <Button
                    key={code}
                    variant="secondary"
                    onClick={() =>
                      setBlocks((b) => [...b, { code, days: code === "N" ? 3 : 2 }])
                    }
                  >
                    + {blockMeta[code].label}
                  </Button>
                ))}
              </div>
            </div>

            {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
            {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

            <Button onClick={speichern} disabled={pending || blocks.length === 0}>
              {pending ? "Wird gespeichert …" : "Schichtmuster speichern"}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Auswahl({
  aktiv,
  titel,
  text,
  onClick,
}: {
  aktiv: boolean;
  titel: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-left transition-colors",
        aktiv ? "border-brand-500 bg-brand-50" : "border-line bg-surface hover:bg-surface-muted",
      )}
    >
      <span className={cn("block text-sm font-medium", aktiv && "text-brand-700")}>{titel}</span>
      <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{text}</span>
    </button>
  );
}
