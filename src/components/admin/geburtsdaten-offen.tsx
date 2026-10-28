"use client";

import { useCallback, useEffect, useState } from "react";
import { Cake, Check } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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

/**
 * Selbst geänderte Geburtsdaten, die noch bestätigt werden müssen – erst
 * danach zählt das Datum für den Sonderurlaub ab 55. Nur für die
 * Administration; ist nichts offen, erscheint die Karte gar nicht.
 */
export function GeburtsdatenOffen() {
  const { mode, echteRolle } = useSession();
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const darf = mode === "live" && echteRolle === "admin" && isSupabaseConfigured;

  const laden = useCallback(async () => {
    if (!darf) return;
    const { data, error } = await createClient().rpc("geburtsdaten_offen");
    // Still bleiben, wenn es nicht klappt – das ist ein Hinweis, keine Pflicht.
    if (!error) setZeilen((data ?? []) as Zeile[]);
  }, [darf]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  async function bestaetigen(id: string) {
    setBusy(id);
    setFehler(null);
    const { error } = await createClient().rpc("geburtsdatum_bestaetigen", { p_employee_id: id });
    setBusy(null);
    if (error) {
      setFehler(dataErrorMessage(error) ?? "Das hat nicht geklappt.");
      return;
    }
    setZeilen((alt) => alt.filter((z) => z.employee_id !== id));
  }

  if (!darf || zeilen.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Geburtsdatum bestätigen"
        hint="Selbst geändert – erst nach der Bestätigung zählt es für den Sonderurlaub ab 55."
      />
      <CardBody className="space-y-2">
        {zeilen.map((z) => (
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
              onClick={() => void bestaetigen(z.employee_id)}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              <Check className="h-4 w-4" strokeWidth={2.2} />
              {busy === z.employee_id ? "…" : "Bestätigen"}
            </button>
          </div>
        ))}
        {fehler ? <Alert tone="error">{fehler}</Alert> : null}
      </CardBody>
    </Card>
  );
}
