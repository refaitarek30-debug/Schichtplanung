"use client";

import { useActionState, useState, useTransition } from "react";
import { teamAufnehmen, teamEntfernen, teamRecht, type TeamStand } from "./aktionen";

export interface Mitglied {
  user_id: string;
  email: string;
  nur_lesen: boolean;
  notiz: string | null;
  seit: string;
  zuletzt: string | null;
  zwei_faktor: boolean;
}

const tag = (w: string | null) => (w ? new Date(w).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "noch nie");

export function TeamListe({ team, ich, nurLesen }: { team: Mitglied[]; ich: string; nurLesen: boolean }) {
  const [stand, aufnehmen, laeuft] = useActionState(teamAufnehmen, {} as TeamStand);
  const [fehler, setFehler] = useState<string | null>(null);
  const [beschaeftigt, starte] = useTransition();
  const tu = (f: () => Promise<{ error?: string }>) =>
    starte(async () => {
      const r = await f();
      setFehler(r.error ?? null);
    });

  return (
    <>
      <section className="rounded-card border border-line bg-surface shadow-card" data-team>
        <ul className="divide-y divide-line">
          {team.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block break-all text-sm font-medium">
                  {m.email}
                  {m.user_id === ich ? <span className="font-normal text-ink-muted"> (du)</span> : null}
                </span>
                <span className="block text-[12.5px] text-ink-muted">
                  {m.nur_lesen ? "Nur lesen" : "Voller Zugriff"} · Zwei-Faktor {m.zwei_faktor ? "an" : "noch nicht eingerichtet"} · zuletzt {tag(m.zuletzt)}
                </span>
              </span>
              {nurLesen || m.user_id === ich ? null : (
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={beschaeftigt}
                    onClick={() => tu(() => teamRecht(m.user_id, !m.nur_lesen))}
                    className="rounded-full border border-line px-3 py-1.5 text-[13px] font-medium"
                  >
                    {m.nur_lesen ? "Vollen Zugriff geben" : "Auf nur lesen"}
                  </button>
                  <button
                    type="button"
                    disabled={beschaeftigt}
                    onClick={() => {
                      if (window.confirm(`${m.email} aus dem Betreiber-Team entfernen?`)) tu(() => teamEntfernen(m.user_id));
                    }}
                    className="rounded-full border border-line px-3 py-1.5 text-[13px] font-medium text-crit-fg"
                  >
                    Entfernen
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {fehler ? <p className="px-5 pb-3 text-[13px] text-crit-fg">{fehler}</p> : null}
      </section>

      {nurLesen ? null : (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="text-[15px] font-semibold">Person ins Team holen</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            Hat die Person schon ein Konto, meldet sie sich damit an. Sonst entsteht ein Link, den du persönlich weitergibst. Beim ersten Öffnen der Konsole
            richtet sie die Zwei-Faktor-Anmeldung ein.
          </p>
          <form action={aufnehmen} className="mt-3 flex flex-wrap items-center gap-2" data-team-aufnehmen>
            <input
              name="email"
              type="email"
              required
              placeholder="E-Mail-Adresse"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm"
            />
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" name="nur_lesen" defaultChecked /> nur lesen
            </label>
            <button type="submit" disabled={laeuft} className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-surface">
              Aufnehmen
            </button>
          </form>
          {stand.error ? <p className="mt-2 text-[13px] text-crit-fg">{stand.error}</p> : null}
          {stand.success ? <p className="mt-2 text-[13px] text-ok-fg">{stand.success}</p> : null}
          {stand.link ? (
            <div className="mt-2 flex gap-2">
              <input readOnly value={stand.link} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-sunken px-3 text-[12.5px]" />
              <button type="button" onClick={() => navigator.clipboard?.writeText(stand.link ?? "")} className="h-10 rounded-xl border border-line px-3 text-[13px] font-medium">
                Kopieren
              </button>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
