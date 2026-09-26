"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fetchGruendeFuerKollegen } from "@/lib/data/notifications";
import { setGruendeFuerKollegen } from "@/lib/auth/settings-actions";

/**
 * Dürfen Kollegen Abwesenheitsgründe sehen?
 *
 * Aus (Vorgabe): Urlaub, V-Tag, Krank, AF & Co. sehen nur Schichtleitung
 * und Administration; Kollegen sehen „Abwesend". An: es gilt wieder, was
 * jede Person in ihren Datenschutz-Einstellungen freigegeben hat – und
 * auch dann nur für die eigene Schichtgruppe.
 */
export function ReasonVisibilitySetting({ canManage }: { canManage: boolean }) {
  const [aktiv, setAktiv] = useState<boolean | null>(null);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchGruendeFuerKollegen()
      .then(setAktiv)
      .catch(() => setAktiv(false));
  }, []);

  function umschalten() {
    if (aktiv === null || !canManage) return;
    const naechste = !aktiv;
    setAktiv(naechste);
    setMeldung({});
    startTransition(async () => {
      const result = await setGruendeFuerKollegen(naechste);
      setMeldung(result);
      if (result.error) setAktiv(!naechste);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Abwesenheitsgründe"
        hint="Wer im Schichtplan sieht, warum jemand fehlt – Urlaub, V-Tag, Krank, AF und Co."
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Kollegen dürfen Gründe sehen</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
              {aktiv
                ? "An: Kollegen derselben Schichtgruppe sehen den Grund, wenn die Person ihn in ihren Datenschutz-Einstellungen freigegeben hat."
                : "Aus: Gründe sehen nur Schichtleitung und Administration. Kollegen sehen nur „Abwesend“ – egal, was jemand freigegeben hat. Die eigenen Einträge sieht jeder."}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={aktiv ?? false}
            aria-label="Kollegen dürfen Abwesenheitsgründe sehen"
            disabled={aktiv === null || pending || !canManage}
            onClick={umschalten}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              aktiv ? "bg-brand-500" : "bg-surface-sunken"
            } disabled:opacity-50`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                aktiv ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}
      </CardBody>
    </Card>
  );
}
