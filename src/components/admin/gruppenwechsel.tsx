"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDE, heuteInBerlin } from "@/lib/dates";
import { ladeGruppenwechsel, loescheGruppenwechsel, planeGruppenwechsel, type Gruppenwechsel } from "@/lib/data/gruppenwechsel";
import { ROTATION_TEAMS } from "@/lib/qualifications";

/**
 * Gruppenwechsel ab Datum: z. B. ab 01.01.2027 von Schicht A nach Schicht B.
 * Bis dahin steht die Person in der alten Gruppe, ab dem Datum in der neuen –
 * im Plan, in der Rotation, im Druck und bei der 4er-Regel. Am Tag selbst
 * stellt die Datenbank die Gruppe im Stammsatz um.
 */
export function GruppenwechselPlanen({ employeeId, jetzt }: { employeeId: string; jetzt: string | null }) {
  const [liste, setListe] = useState<Gruppenwechsel[] | null | undefined>(undefined);
  const [ab, setAb] = useState(`${Number(heuteInBerlin().slice(0, 4)) + 1}-01-01`);
  const [nach, setNach] = useState<string>(ROTATION_TEAMS.find((t) => t !== jetzt) ?? "A");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const laden = () => ladeGruppenwechsel(employeeId).then(setListe);
  useEffect(() => {
    void laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  if (liste === null) return null; // Migration 0232 fehlt noch
  const offen = (liste ?? []).filter((w) => !w.vollzogen);

  return (
    <section className="mt-5 border-t border-line pt-4" data-gruppenwechsel>
      <h3 className="text-[15px] font-semibold">Gruppenwechsel ab Datum</h3>
      <p className="mt-0.5 text-[13px] text-ink-muted">
        Wechselt die Person z. B. zum 1.1. in eine andere Schicht, hier eintragen. Bis dahin bleibt sie in Schicht {jetzt ?? "–"}, ab dem Datum steht sie in der
        neuen Gruppe – im Plan, im Druck und bei der Urlaubsplanung.
      </p>

      {offen.length ? (
        <ul className="mt-3 space-y-1.5">
          {offen.map((w) => (
            <li key={w.id} className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm" data-gruppenwechsel-eintrag>
              <span className="tnum font-medium">ab {formatDE(w.ab)}</span>
              <span className="flex items-center gap-1 text-ink-muted">
                Schicht {w.vonTeam ?? "–"} <ArrowRight className="h-3.5 w-3.5" /> <b className="text-ink">Schicht {w.nachTeam}</b>
              </span>
              <button
                type="button"
                aria-label="Wechsel streichen"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setFehler(null);
                    const f = await loescheGruppenwechsel(w.id);
                    if (f) setFehler(f);
                    else {
                      setOk("Wechsel gestrichen.");
                      await laden();
                    }
                  })
                }
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-ink/[0.06]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-muted">ab</span>
          <input type="date" value={ab} onChange={(e) => setAb(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" aria-label="Wechsel ab" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-muted">neue Gruppe</span>
          <select value={nach} onChange={(e) => setNach(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm" aria-label="Neue Gruppe">
            {ROTATION_TEAMS.map((t) => (
              <option key={t} value={t}>
                Schicht {t}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !ab}
          onClick={() =>
            start(async () => {
              setFehler(null);
              setOk(null);
              const f = await planeGruppenwechsel(employeeId, ab, nach);
              if (f) setFehler(f);
              else {
                setOk(`Wechsel nach Schicht ${nach} ab ${formatDE(ab)} geplant.`);
                await laden();
              }
            })
          }
        >
          Wechsel planen
        </Button>
      </div>
      {fehler ? <div className="mt-2"><Alert tone="error">{fehler}</Alert></div> : null}
      {ok ? <div className="mt-2"><Alert tone="success">{ok}</Alert></div> : null}
    </section>
  );
}
