"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { HandHelping } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { answerReplacementRequest } from "@/lib/auth/replacement-actions";
import {
  DataError,
  fetchMyOpenRequests,
  type MyReplacementRequest,
} from "@/lib/data/replacement";
import { formatDE } from "@/lib/dates";
import { useSession } from "@/context/session";

/**
 * Offene Anfragen, ob ich einspringe.
 *
 * Steht auf dem Dashboard, weil eine Anfrage schnell beantwortet werden
 * muss – in der Benachrichtigungsglocke allein ginge sie unter. Die Karte
 * verschwindet vollständig, wenn nichts offen ist.
 */
export function MyReplacementRequests() {
  const { mode, profile } = useSession();
  const [anfragen, setAnfragen] = useState<MyReplacementRequest[]>([]);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const laden = useCallback(async () => {
    if (mode !== "live" || !profile.employeeId) return;
    try {
      setAnfragen(await fetchMyOpenRequests(profile.employeeId));
    } catch (caught) {
      setMeldung({
        error:
          caught instanceof DataError
            ? caught.message
            : "Die Anfragen konnten nicht geladen werden.",
      });
    }
  }, [mode, profile.employeeId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  function antworten(id: string, annehmen: boolean) {
    setMeldung({});
    startTransition(async () => {
      const ergebnis = await answerReplacementRequest(id, annehmen);
      setMeldung(ergebnis);
      if (!ergebnis.error) await laden();
    });
  }

  if (mode !== "live") return null;
  if (anfragen.length === 0 && !meldung.success && !meldung.error) return null;

  return (
    <Card>
      <CardHeader
        title="Wirst du einspringen?"
        hint="Eine Zusage plant dich noch nicht ein – das bestätigt die Schichtleitung."
      />
      <CardBody className="space-y-3">
        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

        {anfragen.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <HandHelping className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.8} />
                {formatDE(a.date)} · {a.shiftName}
                {a.startTime ? (
                  <span className="tnum text-[12px] font-normal text-ink-muted">
                    {a.startTime}–{a.endTime}
                  </span>
                ) : null}
              </p>
              {a.note || a.qualificationLabel ? (
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {a.note}
                  {a.note && a.qualificationLabel ? " · " : ""}
                  {a.qualificationLabel ? `Gesucht: ${a.qualificationLabel}` : ""}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button disabled={pending} onClick={() => antworten(a.id, true)}>
                Annehmen
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => antworten(a.id, false)}
              >
                Ablehnen
              </Button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
