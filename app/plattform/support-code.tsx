"use client";

import { useActionState } from "react";
import { CodeAnzeige } from "@/components/ui/code-anzeige";
import { plattformPasswortCode } from "@/lib/auth/passwort-code";
import type { FormState } from "@/lib/auth/form-state";

/**
 * Support: ein Privatkonto hat Passwort und Wiederherstellungs-Code verloren.
 * Hier entsteht ein neuer Code (24 Stunden, einmal) – erst geben, wenn klar
 * ist, dass die Anfrage wirklich von der Person kommt.
 */
export function SupportCode() {
  const [stand, aktion, laeuft] = useActionState(plattformPasswortCode, {} as FormState & { code?: string });
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-[15px] font-semibold">Support: Passwort-Code für ein Privatkonto</h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        Nur wenn sicher ist, dass die Anfrage von der Person selbst kommt. Der Code gilt 24 Stunden und einmal.
      </p>
      <form action={aktion} className="mt-3 flex flex-wrap gap-2">
        <input
          name="kennung"
          required
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Spitzname oder E-Mail"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <button type="submit" disabled={laeuft} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">
          {laeuft ? "…" : "Code erzeugen"}
        </button>
      </form>
      {stand.error ? <p className="mt-2 text-sm text-crit-fg">{stand.error}</p> : null}
      {stand.code ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-[13px]">Code für {stand.success}:</p>
          <CodeAnzeige code={stand.code} />
        </div>
      ) : null}
    </section>
  );
}
