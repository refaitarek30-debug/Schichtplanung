"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fetchLeitungEigeneAntraege } from "@/lib/data/notifications";
import { setLeitungEigeneAntraege } from "@/lib/auth/settings-actions";

/**
 * Darf die Schichtleitung ihre eigenen Urlaubsanträge genehmigen?
 *
 * Aus (Vorgabe für neue Unternehmen): Über eigene Anträge der Schichtleitung
 * entscheidet die Administration (Vier-Augen-Prinzip). An: wie bisher.
 */
export function LeitungEigeneAntraegeSetting({ canManage }: { canManage: boolean }) {
  const [aktiv, setAktiv] = useState<boolean | null>(null);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchLeitungEigeneAntraege()
      .then(setAktiv)
      .catch(() => setAktiv(false));
  }, []);

  function umschalten() {
    if (aktiv === null || !canManage) return;
    const naechste = !aktiv;
    setAktiv(naechste);
    setMeldung({});
    startTransition(async () => {
      const result = await setLeitungEigeneAntraege(naechste);
      setMeldung(result);
      if (result.error) setAktiv(!naechste);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Eigene Anträge der Schichtleitung"
        hint="Wer über den Urlaub einer Schichtleitung entscheidet."
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Schichtleitung genehmigt eigene Anträge</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
              {aktiv
                ? "An: Eine Schichtleitung kann ihren eigenen Urlaub selbst genehmigen."
                : "Aus: Über den eigenen Urlaub einer Schichtleitung entscheidet die Administration (Vier-Augen-Prinzip)."}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={aktiv ?? false}
            aria-label="Schichtleitung genehmigt eigene Anträge"
            disabled={aktiv === null || pending || !canManage}
            onClick={umschalten}
            data-leitung-eigene-antraege
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
