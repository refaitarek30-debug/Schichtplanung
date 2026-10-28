"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { privatWeitermachen } from "@/lib/auth/bereich-actions";
import { leereZwischenspeicher } from "@/lib/zwischenspeicher";
import { forgetIdentity } from "@/lib/supabase/identity";

const MIT = ["Termine", "To-dos", "Eigene Einträge", "Deine Farben"];
const OHNE = ["Schichten aus dem Betrieb", "Krank- und Urlaubsanträge"];

export function PrivatWeiter({ firma, hatPrivat }: { firma: string | null; hatPrivat: boolean }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <main className="privat flex min-h-dvh items-center justify-center px-3 py-10">
      <div className="glas w-full max-w-md rounded-[28px] p-6">
        <div className="text-[34px]" aria-hidden>
          🏠
        </div>
        <h1 className="mt-2 text-[24px] font-bold leading-tight">Privat weitermachen?</h1>
        <p className="mt-2 text-[15px] leading-snug text-ink-muted">
          {firma ? `Dein Zugang bei ${firma} ist beendet.` : "Dein Zugang zum Betrieb ist beendet."}{" "}
          {hatPrivat
            ? "Dein Privatbereich bleibt – kostenlos."
            : "Du kannst deinen Kalender privat weiter nutzen – kostenlos."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[14px]">
          <div className="rounded-[16px] bg-ok-bg px-3.5 py-3">
            <p className="font-semibold text-ok-fg">Kommt mit</p>
            <ul className="mt-1.5 space-y-1">
              {MIT.map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 shrink-0 text-ok-fg" /> {m}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[16px] bg-ink/[0.05] px-3.5 py-3">
            <p className="font-semibold text-ink-muted">Bleibt im Betrieb</p>
            <ul className="mt-1.5 space-y-1 text-ink-muted">
              {OHNE.map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <X className="h-4 w-4 shrink-0" /> {m}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-3 text-[12.5px] text-ink-faint">
          Was im Privatbereich gespeichert wird, steht in der{" "}
          <Link href="/datenschutz" target="_blank" className="underline">
            Datenschutzerklärung
          </Link>
          . Dein bisheriger Betrieb sieht davon nichts.
        </p>

        {fehler ? <p className="mt-3 text-[14px] font-medium text-crit-fg">{fehler}</p> : null}

        <button
          type="button"
          disabled={laeuft}
          onClick={() =>
            starte(async () => {
              setFehler(null);
              const r = await privatWeitermachen();
              if (r?.error) setFehler(r.error);
            })
          }
          className="mt-5 h-12 w-full rounded-[16px] bg-brand-600 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {laeuft ? "Einen Moment …" : "Privat weitermachen"}
        </button>
        <form
          action={signOut}
          onSubmit={() => {
            leereZwischenspeicher();
            forgetIdentity();
          }}
        >
          <button type="submit" className="mt-2 h-11 w-full rounded-[16px] text-[15px] font-semibold text-ink-muted">
            Nein danke, abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
