"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DataError,
  fetchQualifications,
  saveQualification,
  type QualificationRecord,
} from "@/lib/data/qualifications";

/**
 * Der Qualifikationskatalog des Unternehmens.
 *
 * Bis Migration 0050 waren das fünf feste Werte im Programm – jeder
 * Betrieb bekam dieselben, ob sie passten oder nicht. Jetzt legt jedes
 * Unternehmen seine eigenen an.
 *
 * Deaktivieren statt löschen: an einer Qualifikation hängen Zuordnungen
 * und später Besetzungsvorgaben. Eine deaktivierte taucht in neuen
 * Formularen nicht mehr auf, bestehende Zuordnungen bleiben nachvollziehbar.
 */
export function QualificationsCard({ canManage }: { canManage: boolean }) {
  const [katalog, setKatalog] = useState<QualificationRecord[] | null>(null);
  const [neu, setNeu] = useState("");
  const [meldung, setMeldung] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const laden = useCallback(async () => {
    try {
      setKatalog(await fetchQualifications());
      setMeldung((m) => ({ ...m, error: undefined }));
    } catch (caught) {
      setKatalog([]);
      setMeldung({
        error:
          caught instanceof DataError
            ? caught.message
            : "Die Qualifikationen konnten nicht geladen werden.",
      });
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  function speichern(id: string | null, label: string, active: boolean) {
    setMeldung({});
    startTransition(async () => {
      try {
        await saveQualification(id, label, active);
        await laden();
        setNeu("");
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
        title="Qualifikationen"
        hint="Funktionen und Befähigungen, die euer Betrieb führt. Sie steuern später die Besetzungsprüfung und die Ersatzsuche."
      />
      <CardBody className="space-y-4">
        {katalog === null ? (
          <p className="text-sm text-ink-muted">wird geladen …</p>
        ) : katalog.length === 0 ? (
          <p className="text-sm text-ink-muted">Noch keine Qualifikation angelegt.</p>
        ) : (
          <ul className="space-y-2">
            {katalog.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{q.label}</p>
                  <p className="text-[12px] text-ink-muted">
                    {q.anzahl === 1 ? "1 Mitarbeiter" : `${q.anzahl} Mitarbeiter`}
                    {q.active ? "" : " · deaktiviert"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {q.active ? null : <Badge tone="warn">inaktiv</Badge>}
                  {canManage ? (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => speichern(q.id, q.label, !q.active)}
                    >
                      {q.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (neu.trim()) speichern(null, neu.trim(), true);
            }}
          >
            <div className="min-w-[12rem] flex-1">
              <label
                htmlFor="neue-qualifikation"
                className="mb-1.5 block text-[13px] font-medium text-ink-muted"
              >
                Neue Qualifikation
              </label>
              <Input
                id="neue-qualifikation"
                value={neu}
                onChange={(e) => setNeu(e.target.value)}
                placeholder="z. B. Staplerschein"
              />
            </div>
            <Button type="submit" disabled={pending || !neu.trim()}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              Hinzufügen
            </Button>
          </form>
        ) : null}

        {meldung.error ? <Alert tone="error">{meldung.error}</Alert> : null}
        {meldung.success ? <Alert tone="success">{meldung.success}</Alert> : null}
      </CardBody>
    </Card>
  );
}
