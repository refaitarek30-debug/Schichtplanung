"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Blatt } from "@/components/privat/blatt";
import { createClient } from "@/lib/supabase/client";
import { datenFehlerText } from "@/lib/errors";
import { dreheHerein, wechsleBereich } from "@/lib/bereich";
import { LEGAL_VERSIONS } from "@/lib/legal/version";

/**
 * Wechsel Betrieb ↔ Privat (Migration 0194): ein Login, zwei Bereiche.
 * Der Privatbereich entsteht beim ersten Tipp – mit einem Klick und dem
 * Hinweis zum Datenschutz.
 */

/** Zweite Hälfte der Drehung – in beiden Bereichen eingebunden. */
export function BereichDrehung() {
  useEffect(() => {
    dreheHerein();
  }, []);
  return null;
}

/**
 * Wechsel in den Privatbereich aus dem Betrieb. Gibt es ihn noch nicht, kommt
 * zuerst das Fenster „Dein Privatbereich“.
 */
export function usePrivatWechsel(hatPrivat: boolean) {
  const [frage, setFrage] = useState(false);
  const fenster = frage ? <PrivatEinrichten onClose={() => setFrage(false)} /> : null;
  return {
    wechseln: () => (hatPrivat ? wechsleBereich("privat") : setFrage(true)),
    fenster,
  };
}

function PrivatEinrichten({ onClose }: { onClose: () => void }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function einrichten() {
    setLaeuft(true);
    setFehler(null);
    const { error } = await createClient().rpc("privatbereich_einrichten", { p_version: LEGAL_VERSIONS.datenschutz });
    if (error) {
      setFehler(datenFehlerText(error, "Der Privatbereich ließ sich nicht einrichten. Bitte versuch es noch einmal."));
      setLaeuft(false);
      return;
    }
    wechsleBereich("privat");
  }

  return (
    <Blatt titel="Dein Privatbereich" onClose={onClose}>
      <p className="text-[15px] leading-snug text-ink-muted">
        Ein eigener Kalender nur für dich – mit demselben Login. Kostenlos, auch wenn du den Betrieb einmal verlässt.
      </p>
      <ul className="mt-3 space-y-2 text-[14.5px]">
        <li className="flex gap-2.5 rounded-[14px] bg-ink/[0.05] px-3.5 py-2.5">
          <span aria-hidden>🗓️</span>
          <span>Termine und To-dos sind in beiden Bereichen dieselben.</span>
        </li>
        <li className="flex gap-2.5 rounded-[14px] bg-ink/[0.05] px-3.5 py-2.5">
          <span aria-hidden>🏢</span>
          <span>Deine Schichten aus dem Betrieb stehen automatisch drin – nur zum Ansehen.</span>
        </li>
        <li className="flex gap-2.5 rounded-[14px] bg-ink/[0.05] px-3.5 py-2.5">
          <span aria-hidden>✏️</span>
          <span>Eigene Schichten, z. B. einen Nebenjob, trägst du selbst ein.</span>
        </li>
      </ul>
      <p className="mt-3 flex gap-2 rounded-[14px] bg-ok-bg px-3.5 py-2.5 text-[13.5px] leading-snug text-ink">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok-fg" />
        <span>
          Dein Betrieb sieht davon nichts. Was im Privatbereich gespeichert wird, steht in der{" "}
          <Link href="/datenschutz" target="_blank" className="font-semibold text-brand-600 underline">
            Datenschutzerklärung
          </Link>
          .
        </span>
      </p>
      {fehler ? <p className="mt-3 text-[14px] font-medium text-crit-fg">{fehler}</p> : null}
      <button
        type="button"
        onClick={() => void einrichten()}
        disabled={laeuft}
        className="mt-4 h-12 w-full rounded-[16px] bg-brand-600 text-[16px] font-semibold text-white disabled:opacity-60"
      >
        {laeuft ? "Wird eingerichtet …" : "Privatbereich einrichten"}
      </button>
    </Blatt>
  );
}
