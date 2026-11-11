"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Einmalige kurze Umfrage im Privatbereich: frühestens 3 Tage nach dem
 * Einrichten, danach nie wieder – ob beantwortet oder übersprungen
 * (Migration 0217). Die Antwort geht ohne Namen an den Betreiber.
 */
const GESICHTER = [
  { wert: 1, zeichen: "😞", text: "Schlecht" },
  { wert: 2, zeichen: "🙁", text: "Eher nicht" },
  { wert: 3, zeichen: "😐", text: "Geht so" },
  { wert: 4, zeichen: "🙂", text: "Gut" },
  { wert: 5, zeichen: "😍", text: "Super" },
];

const UMFRAGE_QUELLEN = [
  { id: "tiktok", text: "TikTok" },
  { id: "instagram", text: "Instagram" },
  { id: "suche", text: "Google / Suche" },
  { id: "freunde", text: "Freunde / Kollegen" },
  { id: "arbeit", text: "Über die Arbeit" },
  { id: "sonstiges", text: "Anderes" },
] as const;

export function PrivatUmfrage() {
  const [offen, setOffen] = useState(false);
  const [note, setNote] = useState<number | null>(null);
  const [quelle, setQuelle] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [stand, setStand] = useState<"frage" | "sendet" | "danke">("frage");

  useEffect(() => {
    let weg = false;
    // Erst nach dem Laden der Seite fragen – nie mitten in den Start hinein.
    const t = window.setTimeout(async () => {
      const { data, error } = await createClient().rpc("privat_umfrage_offen");
      if (!weg && !error && data === true) setOffen(true);
    }, 1500);
    return () => {
      weg = true;
      window.clearTimeout(t);
    };
  }, []);

  if (!offen) return null;

  const etwas = note !== null || quelle !== null || text.trim().length > 0;

  async function senden(ueberspringen: boolean) {
    setStand("sendet");
    await createClient().rpc(
      "privat_umfrage_senden",
      ueberspringen ? {} : { p_quelle: quelle, p_zufriedenheit: note, p_verbesserung: text.trim() || null },
    );
    if (ueberspringen) {
      setOffen(false);
      return;
    }
    setStand("danke");
    window.setTimeout(() => setOffen(false), 1600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="umfrage-titel"
        data-umfrage
        className="glas-voll max-h-[92dvh] shadow-[0_12px_40px_rgba(0,0,0,0.25)] w-full max-w-md overflow-y-auto rounded-[26px] p-5"
      >
        {stand === "danke" ? (
          <div className="py-6 text-center" data-umfrage-danke>
            <p className="text-[34px]">🙏</p>
            <p className="mt-1 text-[18px] font-bold">Danke dir!</p>
            <p className="mt-1 text-[14px] text-ink-muted">Das hilft uns sehr, ShiftNexo besser zu machen.</p>
          </div>
        ) : (
          <>
            <p id="umfrage-titel" className="text-[19px] font-bold leading-tight">
              Kurze Frage – 20 Sekunden
            </p>
            <p className="mt-1 text-[14px] leading-snug text-ink-muted">
              Du nutzt ShiftNexo seit ein paar Tagen. Magst du uns kurz sagen, wie es dir gefällt? Freiwillig und ohne
              deinen Namen.
            </p>

            <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">Wie zufrieden bist du?</p>
            <div role="radiogroup" aria-label="Zufriedenheit" className="mt-1.5 grid grid-cols-5 gap-1.5">
              {GESICHTER.map((g) => (
                <button
                  key={g.wert}
                  type="button"
                  role="radio"
                  aria-checked={note === g.wert}
                  aria-label={g.text}
                  onClick={() => setNote(note === g.wert ? null : g.wert)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-[14px] py-2 ring-1 ring-inset transition-colors",
                    note === g.wert ? "bg-brand-500/15 ring-brand-500" : "bg-ink/[0.05] ring-transparent hover:bg-ink/[0.08]",
                  )}
                >
                  <span className={cn("text-[26px] leading-none transition-transform", note === g.wert && "scale-110")}>
                    {g.zeichen}
                  </span>
                  <span className="text-[10.5px] font-semibold text-ink-muted">{g.text}</span>
                </button>
              ))}
            </div>

            <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
              Wie hast du von uns erfahren?
            </p>
            <div role="radiogroup" aria-label="Woher" className="mt-1.5 flex flex-wrap gap-1.5">
              {UMFRAGE_QUELLEN.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  role="radio"
                  aria-checked={quelle === q.id}
                  onClick={() => setQuelle(quelle === q.id ? null : q.id)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[14px] font-semibold ring-1 ring-inset transition-colors",
                    quelle === q.id ? "bg-brand-600 text-white ring-brand-600" : "bg-ink/[0.06] text-ink ring-transparent hover:bg-ink/[0.1]",
                  )}
                >
                  {q.text}
                </button>
              ))}
            </div>

            <label htmlFor="umfrage-text" className="mt-4 block text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
              Was sollen wir besser machen? <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="umfrage-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Was fehlt dir, was nervt, was wünschst du dir?"
              className="mt-1.5 w-full resize-none rounded-[14px] border border-line bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-brand-500"
            />
            <p className="mt-1 text-[12px] text-ink-faint">Bitte keine Namen oder Angaben zur Gesundheit.</p>

            <button
              type="button"
              disabled={!etwas || stand === "sendet"}
              onClick={() => senden(false)}
              className="mt-4 h-11 w-full rounded-[14px] bg-brand-600 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              Absenden
            </button>
            <button
              type="button"
              disabled={stand === "sendet"}
              onClick={() => senden(true)}
              className="mt-1.5 h-10 w-full rounded-[14px] text-[14px] font-semibold text-ink-muted hover:text-ink"
            >
              Überspringen
            </button>
            <p className="text-center text-[11.5px] text-ink-faint">Wir fragen nur dieses eine Mal.</p>
          </>
        )}
      </div>
    </div>
  );
}
