"use client";

import { useActionState } from "react";
import { plattformZugang } from "@/lib/auth/zwei-faktor-actions";
import type { FormState } from "@/lib/auth/form-state";

export type Sperre = { email: string; seit: string; firma: string | null };

/**
 * Support: gesperrte Konten (5 Fehlversuche) freischalten und die
 * Zwei-Faktor-Anmeldung zurücksetzen, wenn das Handy weg ist (Migration 0219).
 * Für Firmenkonten macht das normalerweise die Administration des Betriebs.
 */
export function ZugangVerwalten({ sperren, nurLesen = false }: { sperren: Sperre[]; nurLesen?: boolean }) {
  const [stand, aktion, laeuft] = useActionState(plattformZugang, {} as FormState);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4" data-plattform-zugang>
      <h2 className="text-[15px] font-semibold">Support: Sperre und Zwei-Faktor</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Nur wenn sicher ist, dass die Anfrage von der Person selbst kommt. Für Firmenkonten ist zuerst die Administration
        des Betriebs zuständig.
      </p>
      {sperren.length > 0 ? (
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-[13.5px]">
          {sperren.map((s) => (
            <li key={s.email} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span className="font-medium">{s.email}</span>
              <span className="text-ink-muted">
                {s.firma ?? "privat"} · gesperrt seit {new Date(s.seit).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-faint">Gerade ist kein Konto gesperrt.</p>
      )}
      {nurLesen ? null : (
      <form action={aktion} className="mt-3 flex flex-wrap gap-2">
        <input
          name="kennung"
          required
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Spitzname oder E-Mail"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          name="aktion"
          value="entsperren"
          disabled={laeuft}
          className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Freischalten
        </button>
        <button
          type="submit"
          name="aktion"
          value="zwei_faktor"
          disabled={laeuft}
          className="rounded-xl bg-surface-muted px-4 py-2.5 text-sm font-semibold"
        >
          Zwei-Faktor zurücksetzen
        </button>
      </form>
      )}
      {stand.error ? <p className="mt-2 text-sm text-crit-fg">{stand.error}</p> : null}
      {stand.success ? <p className="mt-2 text-sm text-ok-fg">{stand.success}</p> : null}
    </section>
  );
}
