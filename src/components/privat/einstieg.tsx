"use client";

import { useState } from "react";
import { BellRing, Check, Heart, Home, Pencil, Repeat, Smile, Upload, Users, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PUSH_TEXT, SCHICHT_ERINNERUNG_WAHL, usePush } from "@/components/kalender/erinnerungen";
import { formatDE } from "@/lib/dates";
import type { PersonArt } from "@/lib/data/partner";
import { setzeSchichtErinnerung, type SchichtErinnerung } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { Blatt } from "./blatt";

/**
 * Der Weg vom leeren Kalender zum ersten Plan – und was direkt danach kommt:
 *  1. EinstiegKarte: „Wie arbeitest du?“ mit drei Wegen (solange noch kein Tag eingetragen ist)
 *  2. FertigBlatt: „Fertig!“ und gleich die Frage nach der Erinnerung an die Schicht
 *  3. TeilenKarte: „Zeig deinen Plan jemandem“ (solange noch nichts geteilt ist)
 */

export function EinstiegKarte({
  onFolge,
  onFoto,
  onSelbst,
  onSpaeter,
}: {
  onFolge: () => void;
  onFoto: () => void;
  onSelbst: () => void;
  onSpaeter: () => void;
}) {
  const wege = [
    { icon: <Repeat className="h-[18px] w-[18px]" />, titel: "Immer gleiche Folge", text: "z. B. 2 Früh, 2 Spät, 2 Nacht, dann frei", onClick: onFolge, haupt: true },
    { icon: <Upload className="h-[18px] w-[18px]" />, titel: "Foto vom Plan", text: "Screenshot oder Kalender-Datei hochladen", onClick: onFoto, haupt: false },
    { icon: <Pencil className="h-[18px] w-[18px]" />, titel: "Selbst eintippen", text: "Tag für Tag mit dem Pinsel", onClick: onSelbst, haupt: false },
  ];
  return (
    <div className="absolute inset-0 z-20 flex justify-center bg-surface/45 px-3 pt-4 backdrop-blur-[3px] sm:px-0 sm:pt-10">
      <div
        data-einstieg
        role="dialog"
        aria-label="Wie arbeitest du?"
        className="h-fit w-full max-w-md rounded-[24px] bg-surface p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)] ring-1 ring-line"
      >
        <p className="text-[19px] font-bold leading-tight">Wie arbeitest du?</p>
        <p className="mt-0.5 text-[13.5px] text-ink-muted">Such dir einen Weg aus – das dauert etwa eine Minute.</p>
        <div className="mt-3 space-y-2">
          {wege.map((w) => (
            <button
              key={w.titel}
              type="button"
              onClick={w.onClick}
              className={cn(
                "flex w-full items-center gap-3 rounded-[16px] p-3 text-left ring-1 transition-colors",
                w.haupt ? "bg-brand-500/[0.08] ring-brand-500" : "bg-ink/[0.03] ring-line hover:bg-ink/[0.06]",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-500 text-white">{w.icon}</span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{w.titel}</span>
                <span className="block text-[12.5px] leading-snug text-ink-muted">{w.text}</span>
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onSpaeter} className="mt-2 h-10 w-full text-[14px] font-medium text-ink-muted">
          Später
        </button>
      </div>
    </div>
  );
}

export function FertigBlatt({
  tage,
  bis,
  userId,
  onClose,
}: {
  tage: number;
  bis: string;
  userId: string;
  onClose: () => void;
}) {
  const push = usePush();
  const [wahl, setWahl] = useState<SchichtErinnerung>("vortag18");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState(false);
  // In der iPhone-App und in Browsern ohne Mitteilungen gibt es (noch) keine Erinnerung.
  const fragen = push.status !== null && push.status !== "app" && push.status !== "nicht-moeglich";

  async function einschalten() {
    if (!wahl) return onClose();
    setLaeuft(true);
    setFehler(null);
    try {
      await setzeSchichtErinnerung(userId, wahl);
      if (push.status === "aus") await push.umschalten(true);
      setErledigt(true);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  const hinweis =
    erledigt && push.status && push.status !== "an" && push.status !== "aus" ? PUSH_TEXT[push.status] : null;

  return (
    <Blatt
      titel={<span className="sr-only">Plan eingetragen</span>}
      onClose={onClose}
      fuss={
        <div className="space-y-2">
          {fehler || push.fehler ? <Alert tone="error">{fehler ?? push.fehler}</Alert> : null}
          {fragen && !erledigt ? (
            <button
              type="button"
              onClick={() => void einschalten()}
              disabled={laeuft || push.laeuft}
              className="w-full rounded-[16px] bg-brand-500 px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {laeuft || push.laeuft ? "Einen Moment …" : wahl ? "Erinnerung einschalten" : "Weiter"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-[16px] bg-brand-500 px-4 py-3.5 text-[15px] font-semibold text-white"
            >
              Zum Kalender
            </button>
          )}
        </div>
      }
    >
      <div data-fertig className="flex flex-col items-center pt-1 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-fg text-white">
          <Check className="h-8 w-8" strokeWidth={3} />
        </span>
        <p className="mt-3 text-[21px] font-bold leading-tight">
          Fertig! {tage > 0 ? `${tage} ${tage === 1 ? "Tag" : "Tage"} eingetragen` : "Dein Plan steht"}
        </p>
        <p className="mt-1 text-[13.5px] text-ink-muted">Bis {formatDE(bis)}. Jeden Tag kannst du einzeln ändern.</p>
      </div>

      {fragen && !erledigt ? (
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
            <BellRing className="h-[18px] w-[18px] text-brand-600" /> Soll ich dich an deine Schichten erinnern?
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Erinnerung an deine Schichten">
            {SCHICHT_ERINNERUNG_WAHL.map((w) => {
              const an = wahl === w.wert;
              return (
                <label
                  key={w.wert ?? "aus"}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[16px] px-3.5 py-3 ring-1",
                    an ? "bg-brand-500/[0.08] ring-brand-500" : "ring-line",
                  )}
                >
                  <input
                    type="radio"
                    name="schicht-erinnerung"
                    checked={an}
                    onChange={() => setWahl(w.wert)}
                    className="h-5 w-5 accent-brand-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold">{w.wert ? w.titel : "Nein, danke"}</span>
                    {w.wert ? <span className="block text-[12.5px] text-ink-muted">{w.text}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {push.status === "gesperrt" || push.status === "ios-home" ? (
            <p className="mt-2 text-[12.5px] leading-snug text-ink-muted">{PUSH_TEXT[push.status]}</p>
          ) : null}
        </div>
      ) : null}

      {erledigt ? (
        <div className="mt-6 rounded-[16px] bg-ok-bg px-3.5 py-3 text-[13.5px] leading-snug">
          <p className="font-semibold">{push.status === "an" ? "Erinnerung ist an." : "Erinnerung ist eingestellt."}</p>
          <p className="text-ink-muted">
            {hinweis ?? "Ändern kannst du das jederzeit unter Mehr → Mitteilungen."}
          </p>
        </div>
      ) : null}
    </Blatt>
  );
}

export const TEILEN_ARTEN: { art: PersonArt; text: string; icon: React.ReactNode; farbe: string }[] = [
  { art: "partner", text: "Partner", icon: <Heart className="h-5 w-5" />, farbe: "#E5484D" },
  { art: "familie", text: "Familie", icon: <Home className="h-5 w-5" />, farbe: "#9B59D0" },
  { art: "freunde", text: "Freunde", icon: <Smile className="h-5 w-5" />, farbe: "#22A06B" },
  { art: "kollegen", text: "Kollegen", icon: <Users className="h-5 w-5" />, farbe: "#2F6FDE" },
];

export function TeilenKarte({ onWahl, onWeg }: { onWahl: (art: PersonArt) => void; onWeg: () => void }) {
  return (
    <div data-teilen-karte className="glas mx-3.5 mt-2 shrink-0 rounded-[18px] px-3 pb-2.5 pt-2 sm:mx-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-semibold">Zeig deinen Plan jemandem</p>
        <button
          type="button"
          onClick={onWeg}
          aria-label="Hinweis schließen"
          className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted active:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {TEILEN_ARTEN.map((a) => (
          <button
            key={a.art}
            type="button"
            onClick={() => onWahl(a.art)}
            className="flex flex-col items-center gap-1 rounded-[12px] py-1 text-[11.5px] font-medium text-ink-muted active:bg-black/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: a.farbe }}>
              {a.icon}
            </span>
            {a.text}
          </button>
        ))}
      </div>
    </div>
  );
}
