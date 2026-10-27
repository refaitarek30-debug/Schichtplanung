"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BellRing, Check, Clock, Send, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchEmployees } from "@/lib/data/employees";
import {
  HINWEIS_VORLAGEN,
  HINWEIS_ZIELE,
  HinweisFehler,
  fetchHinweisStandard,
  hinweisSenden,
  type HinweisPush,
} from "@/lib/data/hinweise";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 300;

export const PUSH_WAHL: { wert: HinweisPush; titel: string; text: string }[] = [
  {
    wert: "schicht",
    titel: "Zur Arbeitszeit",
    text: "Erst ab der nächsten Schicht – in der App und aufs Handy. Nicht in der Freizeit.",
  },
  { wert: "sofort", titel: "Sofort", text: "Gleich in der App und aufs Handy, auch in der Freizeit." },
  { wert: "aus", titel: "Nur in der App", text: "Beim nächsten Öffnen der App, keine Mitteilung aufs Handy." },
];

/**
 * Hinweis an eine oder mehrere Personen. Erscheint beim nächsten Öffnen der
 * App als Fenster; auf Wunsch zusätzlich als Mitteilung aufs Handy –
 * standardmäßig (Vorgabe des Betriebs) erst zur nächsten Schicht der Person.
 */
export function HinweisSenden({
  vorauswahl = [],
  vorlage,
  ziel: zielStart = "",
  onClose,
  onGesendet,
}: {
  /** Mitarbeiter-IDs, die schon ausgewählt sind. */
  vorauswahl?: string[];
  vorlage?: string;
  ziel?: string;
  onClose: () => void;
  onGesendet?: (anzahl: number) => void;
}) {
  const [personen, setPersonen] = useState<EmployeeRecord[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(() => new Set(vorauswahl));
  const [suche, setSuche] = useState("");
  const [text, setText] = useState(vorlage ?? "");
  const [ziel, setZiel] = useState<string>(zielStart);
  const [push, setPush] = useState<HinweisPush>("schicht");
  const pushGewaehlt = useRef(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, starte] = useTransition();

  useEffect(() => {
    let ab = false;
    fetchEmployees()
      .then((liste) => !ab && setPersonen(liste.filter((p) => p.active)))
      .catch(() => !ab && setLadeFehler("Die Personen konnten nicht geladen werden."));
    return () => {
      ab = true;
    };
  }, []);

  // Vorgabe des Betriebs (Regeln) – nur solange noch nichts angetippt wurde.
  useEffect(() => {
    let ab = false;
    void fetchHinweisStandard().then((w) => {
      if (!ab && !pushGewaehlt.current) setPush(w);
    });
    return () => {
      ab = true;
    };
  }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onClose]);

  const sichtbar = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return (personen ?? []).filter(
      (p) => !s || `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || (p.shiftName ?? "").toLowerCase().includes(s),
    );
  }, [personen, suche]);

  const gewaehlt = (personen ?? []).filter((p) => auswahl.has(p.id));
  const ohneZugang = gewaehlt.filter((p) => !p.hasAccount);
  const textOk = text.trim().length > 0 && text.length <= MAX;
  const kannSenden = textOk && gewaehlt.length > 0 && !sendet;

  function umschalten(id: string) {
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  function senden() {
    setFehler(null);
    starte(async () => {
      try {
        const n = await hinweisSenden([...auswahl], text.trim(), ziel || null, push);
        onGesendet?.(n);
        onClose();
      } catch (e) {
        setFehler(e instanceof HinweisFehler ? e.message : "Der Hinweis konnte nicht gesendet werden.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hinweis senden"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-surface shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">Hinweis senden</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
              Erscheint als Fenster in der App – wann, stellst du unten ein. Eine Antwort ist nicht nötig.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* An wen */}
          <section>
            <p className="mb-1.5 text-[13px] font-medium text-ink-muted">
              An {gewaehlt.length > 0 ? `${gewaehlt.length} ${gewaehlt.length === 1 ? "Person" : "Personen"}` : "…"}
            </p>
            {gewaehlt.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {gewaehlt.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => umschalten(p.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[13px] font-medium text-brand-700"
                    aria-label={`${p.firstName} ${p.lastName} entfernen`}
                  >
                    {p.firstName} {p.lastName}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            ) : null}
            <Input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Name oder Schicht suchen"
              aria-label="Person suchen"
            />
            {ladeFehler ? (
              <div className="mt-2">
                <Alert tone="error">{ladeFehler}</Alert>
              </div>
            ) : (
              <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-line" aria-label="Personen">
                {personen === null ? (
                  <li className="px-3 py-2.5 text-[13px] text-ink-muted">Lädt …</li>
                ) : sichtbar.length === 0 ? (
                  <li className="px-3 py-2.5 text-[13px] text-ink-muted">Niemand gefunden.</li>
                ) : (
                  sichtbar.map((p) => {
                    const an = auswahl.has(p.id);
                    return (
                      <li key={p.id} className="border-b border-line last:border-b-0">
                        <button
                          type="button"
                          onClick={() => umschalten(p.id)}
                          aria-pressed={an}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px]"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                              an ? "border-brand-500 bg-brand-500 text-white" : "border-line",
                            )}
                          >
                            {an ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {p.firstName} {p.lastName}
                            {p.shiftName ? <span className="text-ink-faint"> · {p.shiftName}</span> : null}
                          </span>
                          {!p.hasAccount ? <span className="shrink-0 text-[11.5px] text-ink-faint">ohne Zugang</span> : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
            {ohneZugang.length > 0 ? (
              <p className="mt-1.5 text-[12.5px] leading-snug text-warn-fg">
                {ohneZugang.map((p) => p.firstName).join(", ")} {ohneZugang.length === 1 ? "hat" : "haben"} noch keinen
                Zugang zur App und {ohneZugang.length === 1 ? "sieht" : "sehen"} den Hinweis erst nach dem ersten Anmelden.
              </p>
            ) : null}
          </section>

          {/* Text */}
          <section>
            <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Hinweis</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {HINWEIS_VORLAGEN.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setText(v);
                    if (v.includes("Urlaubsantrag") && !ziel) setZiel("/urlaub");
                    if (v.includes("Schichtplan") && !ziel) setZiel("/meine-schichten");
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-left text-[12.5px]",
                    text === v ? "border-brand-500 bg-brand-500/10 text-brand-700" : "border-line text-ink-muted",
                  )}
                >
                  {v.length > 42 ? `${v.slice(0, 40)}…` : v}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              rows={3}
              maxLength={MAX}
              placeholder="z. B. Bitte stell deinen Urlaubsantrag noch einmal."
              aria-label="Text des Hinweises"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] leading-snug placeholder:text-ink-faint"
            />
            <p className="tnum mt-0.5 text-right text-[11.5px] text-ink-faint">
              {text.length}/{MAX}
            </p>
          </section>

          {/* Knopf */}
          <section>
            <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Knopf im Hinweis</p>
            <div className="flex flex-wrap gap-1.5">
              {HINWEIS_ZIELE.map((z) => (
                <button
                  key={z.wert}
                  type="button"
                  onClick={() => setZiel(z.wert)}
                  aria-pressed={ziel === z.wert}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px]",
                    ziel === z.wert ? "border-brand-500 bg-brand-500 text-white" : "border-line text-ink",
                  )}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </section>

          {/* Push */}
          <section>
            <p className="mb-1.5 text-[13px] font-medium text-ink-muted">Wann ankommen?</p>
            <div className="space-y-1.5" role="radiogroup" aria-label="Wann ankommen?">
              {PUSH_WAHL.map((w) => (
                <button
                  key={w.wert}
                  type="button"
                  role="radio"
                  aria-checked={push === w.wert}
                  onClick={() => {
                    pushGewaehlt.current = true;
                    setPush(w.wert);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left",
                    push === w.wert ? "border-brand-500 bg-brand-500/[0.06]" : "border-line",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                      push === w.wert ? "border-brand-500" : "border-line",
                    )}
                  >
                    {push === w.wert ? <span className="h-2 w-2 rounded-full bg-brand-500" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[14px] font-medium">
                      {w.wert === "schicht" ? <Clock className="h-4 w-4 text-ink-muted" /> : null}
                      {w.wert === "sofort" ? <BellRing className="h-4 w-4 text-ink-muted" /> : null}
                      {w.titel}
                      {w.wert === "schicht" ? (
                        <span className="rounded-full bg-ok-bg px-1.5 py-px text-[10.5px] font-semibold text-ok-fg">empfohlen</span>
                      ) : null}
                    </span>
                    <span className="block text-[12.5px] leading-snug text-ink-muted">{w.text}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">
              Aufs Handy nur bei Personen, die Mitteilungen eingeschaltet haben. Ohne Schichtplan gilt Mo–Fr 8–16 Uhr als
              Arbeitszeit.
            </p>
          </section>

          {fehler ? <Alert tone="error">{fehler}</Alert> : null}
        </div>

        <div className="flex gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button onClick={senden} disabled={!kannSenden} className="flex-1">
            <Send className="h-4 w-4" />
            {sendet ? "Wird gesendet …" : gewaehlt.length > 1 ? `An ${gewaehlt.length} Personen senden` : "Senden"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={sendet}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}
