"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Send, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataError,
  fetchCandidates,
  fetchReplacementRequests,
  type CandidateRecord,
  type ReplacementRequestRecord,
} from "@/lib/data/replacement";
import { requestReplacement, confirmReplacement } from "@/lib/auth/replacement-actions";
import { formatDE } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Ersatzsuche für eine Schicht an einem Tag.
 *
 * Zeigt bewusst auch die Personen, die **nicht** in Frage kommen, jeweils
 * mit Grund. Eine Liste, aus der naheliegende Kollegen kommentarlos
 * fehlen, lässt die Schichtleitung raten, ob das System sie übersehen hat
 * oder ob es einen Grund gibt.
 *
 * Eine Anfrage plant niemanden ein. Erst nach der Zusage setzt
 * „Einplanen" die Besetzung – über dieselbe Funktion, die auch im
 * Schichtplan verwendet wird.
 */
export function ReplacementDialog({
  date,
  shiftId,
  shiftName,
  qualificationId,
  qualificationLabel,
  absentEmployeeId,
  absentName,
  onClose,
}: {
  date: string;
  shiftId: string;
  shiftName: string;
  qualificationId: string | null;
  qualificationLabel: string | null;
  absentEmployeeId?: string | null;
  absentName?: string | null;
  onClose: () => void;
}) {
  const [kandidaten, setKandidaten] = useState<CandidateRecord[] | null>(null);
  const [anfragen, setAnfragen] = useState<ReplacementRequestRecord[]>([]);
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const laden = useCallback(async () => {
    try {
      const [liste, gestellt] = await Promise.all([
        fetchCandidates(date, shiftId, qualificationId),
        fetchReplacementRequests(date, shiftId),
      ]);
      setKandidaten(liste);
      setAnfragen(gestellt);
    } catch (caught) {
      setKandidaten([]);
      setMeldung({
        error:
          caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      });
    }
  }, [date, shiftId, qualificationId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Escape schließt – erwartetes Verhalten für einen Dialog.
  useEffect(() => {
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [onClose]);

  function anfragen_stellen(kandidat: CandidateRecord) {
    setMeldung({});
    startTransition(async () => {
      const ergebnis = await requestReplacement(
        date,
        shiftId,
        kandidat.employeeId,
        qualificationId,
        absentEmployeeId ?? null,
        absentName ? `${absentName} fällt aus.` : "",
      );
      setMeldung(ergebnis);
      if (!ergebnis.error) await laden();
    });
  }

  function einplanen(anfrageId: string) {
    setMeldung({});
    startTransition(async () => {
      const ergebnis = await confirmReplacement(anfrageId);
      setMeldung(ergebnis);
      if (!ergebnis.error) await laden();
    });
  }

  const anfrageZu = (employeeId: string) =>
    anfragen.find((a) => a.askedEmployeeId === employeeId);

  const geeignet = (kandidaten ?? []).filter((k) => k.auswaehlbar);
  const ungeeignet = (kandidaten ?? []).filter((k) => !k.auswaehlbar && k.hatQualifikation);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ersatz suchen"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-card bg-surface shadow-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-crit-fg">
              Besetzung nicht ausreichend
            </p>
            <h2 className="mt-1 text-base font-semibold">
              {qualificationLabel ?? "Besetzung"} · {shiftName}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {formatDE(date)}
              {absentName ? ` · ${absentName} fällt aus` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
          {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}

          {kandidaten === null ? (
            <p className="text-sm text-ink-muted">wird geladen …</p>
          ) : (
            <>
              <section>
                <h3 className="mb-2 text-[13px] font-semibold text-ink-muted">
                  Geeignete Ersatzmitarbeiter
                </h3>
                {geeignet.length === 0 ? (
                  <Alert tone="warning">
                    Niemand kommt in Frage. Die Gründe stehen unten – meist fehlt die
                    Qualifikation, die Ruhezeit reicht nicht, oder die Person ist bereits
                    eingeplant.
                  </Alert>
                ) : (
                  <ul className="space-y-2">
                    {geeignet.map((k) => {
                      const anfrage = anfrageZu(k.employeeId);
                      return (
                        <li
                          key={k.employeeId}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{k.name}</p>
                            <p className="text-[12px] text-ink-muted">
                              {k.rotationTeam ? `Schicht ${k.rotationTeam}` : "Tagschicht"}
                              {k.ruhezeitStunden !== null && k.ruhezeitStunden < 999
                                ? ` · Ruhezeit ${k.ruhezeitStunden} h`
                                : ""}
                              {k.dauerStunden !== null ? ` · Einsatz ${k.dauerStunden} h` : ""}
                            </p>
                          </div>
                          {anfrage ? (
                            <AnfrageStand
                              anfrage={anfrage}
                              pending={pending}
                              onEinplanen={() => einplanen(anfrage.id)}
                            />
                          ) : (
                            <Button disabled={pending} onClick={() => anfragen_stellen(k)}>
                              <Send className="h-4 w-4" strokeWidth={2} />
                              Anfragen
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {ungeeignet.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink-muted">
                    Kommt nicht in Frage
                  </h3>
                  <ul className="space-y-1.5">
                    {ungeeignet.map((k) => (
                      <li
                        key={k.employeeId}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-[13px]"
                      >
                        <span className="font-medium">
                          {k.name}
                          <span className="ml-2 text-[12px] font-normal text-ink-faint">
                            {k.rotationTeam ? `Schicht ${k.rotationTeam}` : "Tagschicht"}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "text-[12px]",
                            k.eigeneSchicht ? "text-ok-fg" : "text-ink-muted",
                          )}
                        >
                          {k.grund}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <p className="border-t border-line pt-3 text-[12px] text-ink-faint">
                Eine Anfrage plant niemanden ein. Erst nach der Zusage setzt „Einplanen&ldquo; die
                Besetzung.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Stand einer bereits gestellten Anfrage. */
function AnfrageStand({
  anfrage,
  pending,
  onEinplanen,
}: {
  anfrage: ReplacementRequestRecord;
  pending: boolean;
  onEinplanen: () => void;
}) {
  if (anfrage.assignedAt) {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ok-fg">
        <Check className="h-4 w-4" strokeWidth={2.5} />
        Eingeplant
      </span>
    );
  }
  if (anfrage.status === "angenommen") {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="ok">zugesagt</Badge>
        <Button disabled={pending} onClick={onEinplanen}>
          Einplanen
        </Button>
      </div>
    );
  }
  if (anfrage.status === "abgelehnt") {
    return <Badge tone="critical">abgelehnt</Badge>;
  }
  return <Badge tone="info">Anfrage gesendet</Badge>;
}
