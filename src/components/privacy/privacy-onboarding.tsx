"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { savePrivacySettings } from "@/lib/auth/privacy-actions";
import type { FormState } from "@/lib/auth/form-state";

export function PrivacyOnboarding() {
  const [state, action] = useActionState(savePrivacySettings, {} as FormState);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-onboarding-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Datenschutz
            </p>
            <h2 id="privacy-onboarding-title" className="mt-1 text-xl font-semibold">
              Deine Datenschutz-Einstellungen
            </h2>
          </div>

          <p className="text-sm leading-relaxed text-ink-muted">
            Damit der Schichtplan übersichtlich bleibt, kannst du selbst festlegen,
            welche Informationen deine Kolleginnen und Kollegen sehen dürfen.
          </p>

          <div className="rounded-xl bg-surface-muted p-4">
            <p className="text-sm font-medium">Standard</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-muted">
              Ohne Freigabe sehen Kolleginnen und Kollegen bei deiner Abwesenheit nur „Abwesend“.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
              <input type="radio" name="absence_visibility" value="minimal" defaultChecked className="mt-1" />
              <span>
                <span className="block text-sm font-medium">Nur „Abwesend“ anzeigen</span>
                <span className="block text-[12px] text-ink-muted">
                  Keine konkreten Abwesenheitsgründe für Kolleginnen und Kollegen.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
              <input type="radio" name="absence_visibility" value="shift" className="mt-1" />
              <span>
                <span className="block text-sm font-medium">Abwesenheitsgrund für meine Schicht erlauben</span>
                <span className="block text-[12px] text-ink-muted">
                  Eigene Schichtgruppe darf z. B. Urlaub, V-Tag oder Schulung sehen.
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-line pt-4">
            <p className="text-sm font-medium">Krankheit</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-muted">
              Krankheit ist separat und standardmäßig privat.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" name="sickness_visibility" value="shift" />
              Krankheit für meine Schicht sichtbar machen
            </label>
          </div>

          <p className="text-[12px] leading-snug text-ink-faint">
            Deine Entscheidung ist freiwillig. Sie kann später unter Profil → Datenschutz jederzeit geändert werden.
            Es werden keine Diagnosen erfasst.
          </p>

          <input type="hidden" name="privacy_notice_acknowledged" value="on" />

          {state.error ? <p role="alert" className="text-sm text-crit-fg">{state.error}</p> : null}

          <div className="flex justify-end">
            <SaveButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
    >
      {pending ? "Wird gespeichert …" : "Einstellungen speichern"}
    </button>
  );
}
