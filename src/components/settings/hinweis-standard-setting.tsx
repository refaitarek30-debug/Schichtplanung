"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { fetchHinweisStandard, type HinweisPush } from "@/lib/data/hinweise";
import { setHinweisStandard } from "@/lib/auth/settings-actions";
import { PUSH_WAHL } from "@/components/hinweise/hinweis-senden";
import { cn } from "@/lib/utils";

/**
 * Was beim Senden eines Hinweises vorausgewählt ist. Die Schichtleitung kann
 * es im Senden-Fenster für den einzelnen Hinweis trotzdem ändern.
 */
export function HinweisStandardSetting({ canManage }: { canManage: boolean }) {
  const [wert, setWert] = useState<HinweisPush | null>(null);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchHinweisStandard()
      .then(setWert)
      .catch(() => setWert("schicht"));
  }, []);

  function waehlen(neu: HinweisPush) {
    if (!canManage || wert === null || neu === wert) return;
    const alt = wert;
    setWert(neu);
    setMeldung({});
    startTransition(async () => {
      const result = await setHinweisStandard(neu);
      setMeldung(result);
      if (result.error) setWert(alt);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Hinweise an Mitarbeiter"
        hint="Was beim Senden vorausgewählt ist. Für einen einzelnen Hinweis lässt es sich trotzdem ändern."
      />
      <CardBody className="space-y-3">
        <div className="space-y-1.5" role="radiogroup" aria-label="Vorgabe für Hinweise">
          {PUSH_WAHL.map((w) => (
            <button
              key={w.wert}
              type="button"
              role="radio"
              aria-checked={wert === w.wert}
              disabled={!canManage || wert === null || pending}
              onClick={() => waehlen(w.wert)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left disabled:cursor-default",
                wert === w.wert ? "border-brand-500 bg-brand-500/[0.06]" : "border-line",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                  wert === w.wert ? "border-brand-500" : "border-line",
                )}
              >
                {wert === w.wert ? <span className="h-2 w-2 rounded-full bg-brand-500" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{w.titel}</span>
                <span className="block text-[12.5px] leading-snug text-ink-muted">{w.text}</span>
              </span>
            </button>
          ))}
        </div>
        {!canManage ? (
          <p className="text-[12.5px] text-ink-faint">Ändern kann das nur die Administration.</p>
        ) : null}
        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}
      </CardBody>
    </Card>
  );
}
