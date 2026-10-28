"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { betriebBeitreten } from "@/lib/auth/bereich-actions";
import type { FormState } from "@/lib/auth/form-state";
import { cn } from "@/lib/utils";

export interface BeitrittVorschau {
  firma: string;
  name: string;
  termine: number;
  todos: number;
  eigene_schichten: number;
}

/** Übernahme-Frage beim Beitritt: was im Betrieb mit erscheinen soll. */
export function Beitreten({ code, vorschau }: { code: string; vorschau: BeitrittVorschau }) {
  const [stand, aktion, laeuft] = useActionState(betriebBeitreten, {} as FormState);
  const [wahl, setWahl] = useState({ termine: true, todos: true, schichten: false });

  const zeilen: { key: keyof typeof wahl; titel: string; unter: string }[] = [
    { key: "termine", titel: `${vorschau.termine} ${vorschau.termine === 1 ? "Termin" : "Termine"}`, unter: "nur für dich sichtbar" },
    { key: "todos", titel: `${vorschau.todos} ${vorschau.todos === 1 ? "To-do" : "To-dos"}`, unter: "nur für dich sichtbar" },
    {
      key: "schichten",
      titel: "Eigene Schichten",
      unter: vorschau.eigene_schichten
        ? `${vorschau.eigene_schichten} ab heute – im Betrieb gilt der Schichtplan, sie erscheinen als eigene Einträge`
        : "keine eingetragen",
    },
  ];

  return (
    <main className="privat flex min-h-dvh items-center justify-center px-3 py-10">
      <form action={aktion} className="glas w-full max-w-md rounded-[28px] p-6">
        <input type="hidden" name="code" value={code} />
        <div className="text-[34px]" aria-hidden>
          🗓️
        </div>
        <h1 className="mt-2 text-[22px] font-bold leading-tight">Deinen privaten Kalender übernehmen?</h1>
        <p className="mt-2 text-[15px] leading-snug text-ink-muted">
          <b className="text-ink">{vorschau.firma}</b> nimmt dich auf{vorschau.name ? ` als ${vorschau.name}` : ""}. Zu
          deinem Konto gibt es schon einen ShiftNexo-Privatkalender. Was soll im Betrieb mit erscheinen?
        </p>

        <div className="mt-4 space-y-2">
          {zeilen.map((z) => {
            const an = wahl[z.key];
            return (
              <label key={z.key} className="flex cursor-pointer items-center gap-3 rounded-[16px] bg-ink/[0.05] px-3.5 py-3">
                <input
                  type="checkbox"
                  name={z.key}
                  checked={an}
                  onChange={(e) => setWahl((w) => ({ ...w, [z.key]: e.target.checked }))}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2",
                    an ? "border-brand-600 bg-brand-600 text-white" : "border-ink-faint",
                  )}
                >
                  {an ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{z.titel}</span>
                  <span className="block text-[13px] text-ink-muted">{z.unter}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-faint">
          Im Privatbereich bleibt alles, wie es ist. Neue Termine und To-dos gelten danach in beiden Bereichen.
        </p>

        {stand.error ? <p className="mt-3 text-[14px] font-medium text-crit-fg">{stand.error}</p> : null}

        <button
          type="submit"
          disabled={laeuft}
          className="mt-5 h-12 w-full rounded-[16px] bg-brand-600 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {laeuft ? "Einen Moment …" : "Übernehmen und beitreten"}
        </button>
        <Link href="/start" className="mt-2 flex h-11 items-center justify-center text-[15px] font-semibold text-ink-muted">
          Nicht jetzt
        </Link>
        <p className="mt-2 text-center text-[12.5px] text-ink-faint">Dein Betrieb sieht davon nichts.</p>
      </form>
    </main>
  );
}
