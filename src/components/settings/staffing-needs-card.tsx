"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataError, fetchNeedMatrix, setNeed, type NeedCell } from "@/lib/data/staffing-needs";

/**
 * Wie viele einer Funktion eine Schicht mindestens braucht.
 *
 * Ohne diese Angaben prüft die Anwendung nur die Kopfzahl: eine Schicht
 * kann vollzählig sein und trotzdem niemanden mit B-Schein haben. Erst
 * ein Eintrag hier macht aus „vollzählig" eine echte Aussage.
 *
 * Eine 0 bedeutet „keine Anforderung" und löscht den Eintrag – sonst
 * bliebe eine Zeile stehen, die eine Anforderung von null Personen
 * behauptet und die man später suchen müsste.
 */
export function StaffingNeedsCard({ canManage }: { canManage: boolean }) {
  const [zellen, setZellen] = useState<NeedCell[] | null>(null);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const laden = useCallback(async () => {
    try {
      setZellen(await fetchNeedMatrix());
    } catch (caught) {
      setZellen([]);
      setMeldung({
        error:
          caught instanceof DataError ? caught.message : "Der Bedarf konnte nicht geladen werden.",
      });
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const schichten = useMemo(() => {
    const gesehen = new Map<string, string>();
    for (const z of zellen ?? []) gesehen.set(z.shiftId, z.shiftName);
    return [...gesehen.entries()].map(([id, name]) => ({ id, name }));
  }, [zellen]);

  const funktionen = useMemo(() => {
    const gesehen = new Map<string, string>();
    for (const z of zellen ?? []) gesehen.set(z.qualificationId, z.qualificationLabel);
    return [...gesehen.entries()].map(([id, label]) => ({ id, label }));
  }, [zellen]);

  function wert(shiftId: string, qualId: string) {
    return (
      (zellen ?? []).find((z) => z.shiftId === shiftId && z.qualificationId === qualId)?.minimum ?? 0
    );
  }

  function speichern(shiftId: string, qualId: string, roh: string) {
    const zahl = Number.parseInt(roh, 10);
    if (!Number.isFinite(zahl) || zahl < 0) return;
    setMeldung({});
    startTransition(async () => {
      try {
        await setNeed(shiftId, qualId, zahl);
        await laden();
        setMeldung({ success: "Gespeichert." });
      } catch (caught) {
        setMeldung({
          error: caught instanceof DataError ? caught.message : "Speichern fehlgeschlagen.",
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Besetzungsbedarf je Funktion"
        hint="Wie viele einer Funktion eine Schicht mindestens braucht. 0 heißt: keine Anforderung."
      />
      <CardBody className="space-y-3">
        {zellen === null ? (
          <p className="text-sm text-ink-muted">wird geladen …</p>
        ) : schichten.length === 0 || funktionen.length === 0 ? (
          <Alert tone="info">
            Dafür braucht es mindestens eine aktive Schicht und eine aktive Qualifikation.
          </Alert>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                    Funktion
                  </th>
                  {schichten.map((s) => (
                    <th
                      key={s.id}
                      className="whitespace-nowrap px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint"
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funktionen.map((q) => (
                  <tr key={q.id} className="border-b border-line-soft last:border-0">
                    <td className="px-2 py-2 font-medium">{q.label}</td>
                    {schichten.map((s) => (
                      <td key={s.id} className="px-2 py-1.5 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="99"
                          defaultValue={String(wert(s.id, q.id))}
                          disabled={!canManage || pending}
                          aria-label={`${q.label} in ${s.name}`}
                          onBlur={(e) => {
                            const neu = Number.parseInt(e.target.value, 10);
                            if (neu !== wert(s.id, q.id)) speichern(s.id, q.id, e.target.value);
                          }}
                          className="mx-auto w-16 text-center"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}
      </CardBody>
    </Card>
  );
}
