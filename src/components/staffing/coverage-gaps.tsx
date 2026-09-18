"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataError, fetchCoverage, type CoverageRecord } from "@/lib/data/replacement";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { ReplacementDialog } from "./replacement-dialog";
import { TODAY } from "@/lib/demo-data";

interface Luecke extends CoverageRecord {
  shiftId: string;
  shiftName: string;
}

/**
 * Fehlende Funktionen je Schicht an einem Tag.
 *
 * Ergänzt die Kopfzahl-Prüfung im Streifen darüber: eine Schicht kann
 * vollzählig sein und trotzdem niemanden mit B-Schein haben. Geprüft wird
 * nur, wofür unter `Verwaltung → Regeln` ein Bedarf hinterlegt ist – ohne
 * Eintrag gibt es keine Anforderung und damit auch keine Lücke.
 */
export function CoverageGaps() {
  const [tag, setTag] = useState(TODAY);
  // Nur gesetzt, nie gelesen: die Schichtnamen stecken bereits in jeder
  // Luecke. Der Setter bleibt, damit der Ladeweg unveraendert ist.
  const [, setSchichten] = useState<ShiftDetail[]>([]);
  const [luecken, setLuecken] = useState<Luecke[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Luecke | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    try {
      const details = await fetchShiftDetails();
      setSchichten(details);

      const proSchicht = await Promise.all(
        details.map(async (s) => {
          const deckung = await fetchCoverage(s.id, tag);
          return deckung.map((d) => ({ ...d, shiftId: s.id, shiftName: s.name }));
        }),
      );
      setLuecken(proSchicht.flat());
    } catch (caught) {
      setLuecken([]);
      setFehler(
        caught instanceof DataError ? caught.message : "Die Daten konnten nicht geladen werden.",
      );
    }
  }, [tag]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const offen = (luecken ?? []).filter((l) => l.fehlt > 0);
  const gedeckt = (luecken ?? []).filter((l) => l.fehlt === 0);

  return (
    <>
      <Card>
        <CardHeader
          title="Funktionen und Ersatz"
          hint="Ob jede benötigte Funktion an diesem Tag besetzt ist – unabhängig von der reinen Kopfzahl."
          action={
            <Input
              type="date"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              aria-label="Tag"
              className="w-auto"
            />
          }
        />
        <CardBody className="space-y-4">
          {fehler ? <Alert tone="error">{fehler}</Alert> : null}

          {luecken === null ? (
            <p className="text-sm text-ink-muted">wird geladen …</p>
          ) : luecken.length === 0 ? (
            <Alert tone="info">
              Für keine Schicht ist ein Bedarf je Funktion hinterlegt. Solange das so ist, prüft
              die Anwendung nur die Kopfzahl. Den Bedarf legst du je Schicht und Funktion fest.
            </Alert>
          ) : (
            <>
              {offen.length === 0 ? (
                <Alert tone="success">
                  Alle hinterlegten Funktionen sind an diesem Tag besetzt.
                </Alert>
              ) : (
                <ul className="space-y-2">
                  {offen.map((l) => (
                    <li
                      key={`${l.shiftId}-${l.qualificationId}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-crit-bg bg-crit-bg/40 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-crit-fg" strokeWidth={2} />
                          {l.label} fehlt in der {l.shiftName}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-muted">
                          {l.vorhanden} von {l.benoetigt} besetzt
                        </p>
                      </div>
                      <Button onClick={() => setDialog(l)}>
                        <Search className="h-4 w-4" strokeWidth={2} />
                        Ersatz suchen
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {gedeckt.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {gedeckt.map((l) => (
                    <Badge key={`${l.shiftId}-${l.qualificationId}`} tone="ok">
                      {l.shiftName}: {l.label} {l.vorhanden}/{l.benoetigt}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      {dialog ? (
        <ReplacementDialog
          date={tag}
          shiftId={dialog.shiftId}
          shiftName={dialog.shiftName}
          qualificationId={dialog.qualificationId}
          qualificationLabel={dialog.label}
          onClose={() => {
            setDialog(null);
            void laden();
          }}
        />
      ) : null}
    </>
  );
}
