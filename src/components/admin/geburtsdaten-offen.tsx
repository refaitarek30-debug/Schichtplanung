"use client";

import { useCallback, useEffect, useState } from "react";
import { Cake, Check, ListChecks, LogOut, UserX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Blatt } from "@/components/privat/blatt";
import { useSession } from "@/context/session";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dataErrorMessage } from "@/lib/errors";
import { formatDE } from "@/lib/dates";

interface Zeile {
  employee_id: string;
  name: string;
  birth_date: string;
  geaendert_am: string;
}

/** Seit über sechs Monaten nicht in der App (Migration 0239). */
interface Inaktiv {
  employee_id: string;
  name: string;
  zuletzt: string;
}

/**
 * Offene Aufgaben der Administration: selbst geänderte Geburtsdaten, die
 * noch bestätigt werden müssen – erst danach zählt das Datum für den
 * Sonderurlaub ab 55. Ist nichts offen, ist die Liste leer.
 */
export function useAufgaben() {
  const { mode, echteRolle } = useSession();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [inaktiv, setInaktiv] = useState<Inaktiv[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const darf = mode === "live" && echteRolle === "admin" && isSupabaseConfigured;

  const laden = useCallback(async () => {
    if (!darf) return;
    const supabase = createClient();
    const [geb, ina] = await Promise.all([supabase.rpc("geburtsdaten_offen"), supabase.rpc("inaktive_konten")]);
    // Still bleiben, wenn es nicht klappt – das ist ein Hinweis, keine Pflicht.
    if (!geb.error) setZeilen((geb.data ?? []) as Zeile[]);
    if (!ina.error) setInaktiv((ina.data ?? []) as Inaktiv[]);
  }, [darf]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  const bestaetigen = useCallback(async (id: string) => {
    setBusy(id);
    setFehler(null);
    const { error } = await createClient().rpc("geburtsdatum_bestaetigen", { p_employee_id: id });
    setBusy(null);
    if (error) {
      setFehler(dataErrorMessage(error) ?? "Das hat nicht geklappt.");
      return;
    }
    setZeilen((alt) => alt.filter((z) => z.employee_id !== id));
  }, []);

  /** Lange nicht genutzt: auf allen Geräten abmelden oder nur als erledigt markieren. */
  const inaktivErledigt = useCallback(async (id: string, abmelden: boolean) => {
    setBusy(id);
    setFehler(null);
    const { error } = await createClient().rpc("inaktiv_erledigt", { p_employee_id: id, p_abmelden: abmelden });
    setBusy(null);
    if (error) {
      setFehler(dataErrorMessage(error) ?? "Das hat nicht geklappt.");
      return;
    }
    setInaktiv((alt) => alt.filter((z) => z.employee_id !== id));
  }, []);

  return { darf, zeilen, inaktiv, anzahl: darf ? zeilen.length + inaktiv.length : 0, fehler, busy, bestaetigen, inaktivErledigt };
}

type Aufgaben = ReturnType<typeof useAufgaben>;

function Liste({ a }: { a: Aufgaben }) {
  return (
    <div className="space-y-2">
      {a.zeilen.map((z) => (
        <div key={z.employee_id} className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
          <Cake className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{z.name}</p>
            <p className="text-[12px] text-ink-muted">
              geb. {formatDE(z.birth_date)} · geändert am {formatDE(z.geaendert_am.slice(0, 10))}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void a.bestaetigen(z.employee_id)}
            disabled={a.busy !== null}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            <Check className="h-4 w-4" strokeWidth={2.2} />
            {a.busy === z.employee_id ? "…" : "Bestätigen"}
          </button>
        </div>
      ))}
      {a.fehler ? <Alert tone="error">{a.fehler}</Alert> : null}
    </div>
  );
}

/** Die Aufgaben als Blatt (von der Kachel oder vom Punkt auf der Startseite). */
export function AufgabenBlatt({ a, onClose }: { a: Aufgaben; onClose: () => void }) {
  const nichts = !a.zeilen.length && !a.inaktiv.length;
  return (
    <Blatt titel="Aufgaben" onClose={onClose}>
      <div className="space-y-5">
        {a.zeilen.length ? (
          <section className="space-y-2">
            <p className="text-[13px] text-ink-muted">Geburtsdatum bestätigen – erst dann zählt es für den Sonderurlaub ab 55.</p>
            <Liste a={a} />
          </section>
        ) : null}
        {a.inaktiv.length ? (
          <section className="space-y-2" data-inaktiv>
            <p className="text-[13px] text-ink-muted">
              Seit über 6 Monaten nicht in der App. Wenn das Konto nicht mehr gebraucht wird oder ein Handy verloren ging:
              auf allen Geräten abmelden. Die Person kann sich danach ganz normal wieder anmelden.
            </p>
            {a.inaktiv.map((z) => (
              <div key={z.employee_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                <UserX className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{z.name}</p>
                  <p className="text-[12px] text-ink-muted">zuletzt am {formatDE(z.zuletzt.slice(0, 10))}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void a.inaktivErledigt(z.employee_id, false)}
                    disabled={a.busy !== null}
                    className="rounded-full border border-line px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
                  >
                    Passt so
                  </button>
                  <button
                    type="button"
                    onClick={() => void a.inaktivErledigt(z.employee_id, true)}
                    disabled={a.busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={2} />
                    {a.busy === z.employee_id ? "…" : "Abmelden"}
                  </button>
                </div>
              </div>
            ))}
            {a.fehler && !a.zeilen.length ? <Alert tone="error">{a.fehler}</Alert> : null}
          </section>
        ) : null}
        {nichts ? <p className="text-[14px] text-ink-muted">Alles erledigt.</p> : null}
      </div>
    </Blatt>
  );
}

/** Ohne Aufgaben-Kachel: ein kleiner Punkt mit Zahl unter der Begrüßung. */
export function AufgabenPunkt({ anzahl, onClick }: { anzahl: number; onClick: () => void }) {
  if (!anzahl) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-aufgaben-punkt
      className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/12 px-2.5 py-1 text-[12.5px] font-semibold text-brand-700"
    >
      <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden />
      {anzahl} {anzahl === 1 ? "Aufgabe" : "Aufgaben"}
    </button>
  );
}

export const AufgabenSymbol = ListChecks;

/**
 * Als Karte (Seite Altersfreizeit): nur für die Administration; ist nichts
 * offen, erscheint die Karte gar nicht.
 */
export function GeburtsdatenOffen() {
  const a = useAufgaben();
  if (!a.darf || a.zeilen.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Geburtsdatum bestätigen"
        hint="Selbst geändert – erst nach der Bestätigung zählt es für den Sonderurlaub ab 55."
      />
      <CardBody>
        <Liste a={a} />
      </CardBody>
    </Card>
  );
}
