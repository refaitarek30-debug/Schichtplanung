"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Mic, Square } from "lucide-react";
import { terminAusSprache } from "@/lib/kalender/sprache-actions";
import type { TerminEingabe } from "@/lib/data/partner";

/**
 * Termin per Sprache: sprechen (Mikrofon der Tastatur oder – wo der Browser
 * es kann – direkt hier), dann versteht die KI den Satz und schlägt einen
 * Termin vor. Gespeichert wird erst im normalen Terminformular.
 */

interface Erkennung {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function neueErkennung(): Erkennung | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Erkennung;
    webkitSpeechRecognition?: new () => Erkennung;
  };
  const Klasse = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Klasse ? new Klasse() : null;
}

export function SprachBlatt({
  onVorschlag,
  onClose,
}: {
  onVorschlag: (t: TerminEingabe) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [hoert, setHoert] = useState(false);
  const [kannHoeren] = useState(() => neueErkennung() !== null);
  const [laeuft, start] = useTransition();
  const erkennung = useRef<Erkennung | null>(null);

  useEffect(() => () => erkennung.current?.stop(), []);

  function zuhoeren() {
    if (hoert) {
      erkennung.current?.stop();
      return;
    }
    const e = neueErkennung();
    if (!e) return;
    e.lang = "de-DE";
    e.interimResults = true;
    e.continuous = false;
    const vorher = text ? `${text.trim()} ` : "";
    e.onresult = (ev) => {
      let gesagt = "";
      for (let i = 0; i < ev.results.length; i++) gesagt += ev.results[i][0].transcript;
      setText(vorher + gesagt);
    };
    e.onend = () => setHoert(false);
    e.onerror = () => {
      setHoert(false);
      setFehler("Das Mikrofon ging nicht. Nutze sonst das Mikrofon der Tastatur.");
    };
    erkennung.current = e;
    setFehler(null);
    setHoert(true);
    e.start();
  }

  function verstehen(ev: React.FormEvent) {
    ev.preventDefault();
    erkennung.current?.stop();
    setFehler(null);
    start(async () => {
      const r = await terminAusSprache(text);
      if (r.ok) onVorschlag(r.vorschlag);
      else setFehler(r.fehler);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />
      <form
        onSubmit={verstehen}
        role="dialog"
        aria-label="Termin sprechen"
        className="relative flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-surface p-5 shadow-pop lg:rounded-3xl"
      >
        <div>
          <p className="text-[17px] font-semibold">Termin sprechen</p>
          <p className="text-[13px] text-ink-muted">
            Zum Beispiel: „Nächsten Dienstag um 15 Uhr Zahnarzt in Leverkusen“ oder „an meinem nächsten freien
            Tag Reifenwechsel“.
          </p>
        </div>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus={!kannHoeren}
            placeholder={kannHoeren ? "Tippe aufs Mikrofon und sprich …" : "Tippe hier und nutze das Mikrofon der Tastatur …"}
            className="w-full resize-none rounded-2xl border border-line bg-surface-sunken p-3 pr-14 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          {kannHoeren ? (
            <button
              type="button"
              onClick={zuhoeren}
              aria-label={hoert ? "Zuhören beenden" : "Sprechen"}
              aria-pressed={hoert}
              className={
                "absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full " +
                (hoert ? "animate-pulse bg-crit-bg text-crit-fg" : "bg-brand-500 text-white")
              }
            >
              {hoert ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : null}
        </div>
        {fehler ? (
          <p role="alert" className="text-[14px] text-crit-fg">
            {fehler}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={laeuft || !text.trim()}
            className="flex-1 rounded-xl bg-brand-500 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {laeuft ? "Wird verstanden …" : "Termin vorschlagen"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-3 text-[15px] font-medium text-ink-muted ring-1 ring-inset ring-line"
          >
            Abbrechen
          </button>
        </div>
        <p className="text-[12px] text-ink-faint">
          Der Satz wird zur Auswertung an eine KI (Anthropic) geschickt. Eingetragen wird erst, wenn du im nächsten
          Schritt speicherst.
        </p>
      </form>
    </div>,
    document.body,
  );
}
