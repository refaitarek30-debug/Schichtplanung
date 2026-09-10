"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DataError, fetchCurrentPattern } from "@/lib/data/rotation";
import { saveRotationPattern, type PatternBlock } from "@/lib/auth/rotation-pattern-actions";
import { cn } from "@/lib/utils";

const shiftMeta: Record<PatternBlock["code"], { label: string; cls: string }> = {
  F: { label: "Frühschicht", cls: "bg-[#FBD7A6] text-[#7A4A05]" },
  S: { label: "Spätschicht", cls: "bg-[#D7EFB0] text-[#3F5D12]" },
  N: { label: "Nachtschicht", cls: "bg-[#BBD9F7] text-[#123E68]" },
  FREI: { label: "Frei", cls: "bg-surface-sunken text-ink-muted" },
};

const order: PatternBlock["code"][] = ["F", "S", "N", "FREI"];

export function RotationPatternEditor() {
  const [blocks, setBlocks] = useState<PatternBlock[]>([]);
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState("Schichtmuster");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchCurrentPattern()
      .then((current) => {
        if (current) {
          setBlocks(
            current.blocks.map((b) => ({ code: b.code as PatternBlock["code"], days: b.days })),
          );
          setAnchor(current.anchorDate);
          setName(current.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const cycleLength = blocks.reduce((sum, b) => sum + b.days, 0);

  function addBlock(code: PatternBlock["code"]) {
    setBlocks((b) => [...b, { code, days: code === "N" ? 3 : 2 }]);
    setState({});
  }
  function removeBlock(index: number) {
    setBlocks((b) => b.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    setBlocks((b) => {
      const next = [...b];
      const target = index + dir;
      if (target < 0 || target >= next.length) return b;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function setDays(index: number, days: number) {
    setBlocks((b) => b.map((block, i) => (i === index ? { ...block, days } : block)));
  }

  function save() {
    setState({});
    startTransition(async () => {
      const result = await saveRotationPattern(blocks, anchor, name);
      setState(result);
    });
  }

  if (!loaded) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink-muted">Muster wird geladen …</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Schichtmuster festlegen"
        hint="Einen kompletten Durchlauf eingeben – z. B. 2× Früh, 2× Spät, 3× Nacht, 2× frei. Das System setzt das Muster automatisch fort und verteilt die Gruppen A–D versetzt."
      />
      <CardBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name des Musters">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Startdatum (Tag 1 des Musters)" hint="Ab hier zählt der erste Block.">
            <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-muted">Blöcke der Reihe nach</p>
          {blocks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
              Noch keine Blöcke. Unten hinzufügen.
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
                      "flex h-9 w-14 items-center justify-center rounded-lg text-[13px] font-semibold",
                      shiftMeta[block.code].cls,
                    )}
                  >
                    {block.code === "FREI" ? "Frei" : block.code}
                  </span>
                  <span className="flex-1 text-sm">{shiftMeta[block.code].label}</span>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={block.days}
                    onChange={(e) => setDays(index, Math.max(1, Number(e.target.value)))}
                    className="tnum w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-center text-sm"
                    aria-label="Anzahl Tage"
                  />
                  <span className="text-[12px] text-ink-faint">Tage</span>
                  <div className="flex items-center">
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1 text-ink-faint hover:bg-surface-muted disabled:opacity-30"
                      aria-label="nach oben"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === blocks.length - 1}
                      className="rounded p-1 text-ink-faint hover:bg-surface-muted disabled:opacity-30"
                      aria-label="nach unten"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeBlock(index)}
                      className="rounded p-1 text-ink-faint hover:bg-crit-bg hover:text-crit-fg"
                      aria-label="entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>        <div className="flex flex-wrap gap-2">
          {order.map((code) => (
            <Button key={code} variant="secondary" onClick={() => addBlock(code)}>
              <Plus className="h-4 w-4" />
              {shiftMeta[code].label}
            </Button>
          ))}
        </div>

        {cycleLength > 0 ? (
          <p className="text-[13px] text-ink-muted">
            Zykluslänge: <strong className="tnum">{cycleLength} Tage</strong>. Nach {cycleLength}{" "}
            Tagen beginnt das Muster von vorn.
          </p>
        ) : null}

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        {state.success ? <Alert tone="success">{state.success}</Alert> : null}

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending || blocks.length === 0}>
            {pending ? "Wird gespeichert …" : "Muster speichern & zuordnen"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
