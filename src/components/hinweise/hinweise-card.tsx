"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, MessageSquarePlus, Smartphone, Undo2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowSkeleton } from "@/components/ui/skeleton";
import { HinweisSenden } from "./hinweis-senden";
import {
  fetchGesendeteHinweise,
  HinweisFehler,
  hinweisZurueckziehen,
  wannText,
  zielLabel,
  type GesendeterHinweis,
} from "@/lib/data/hinweise";

/**
 * Hinweise an einzelne Personen – senden und sehen, ob sie gelesen wurden.
 * Steht auf der Seite „Mitteilungen“ über den Mitteilungen an alle.
 */
export function HinweiseCard({ vorauswahl }: { vorauswahl?: string[] }) {
  const [liste, setListe] = useState<GesendeterHinweis[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState(Boolean(vorauswahl?.length));
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      setListe(await fetchGesendeteHinweise(30));
      setFehler(null);
    } catch (e) {
      setListe([]);
      setFehler(e instanceof HinweisFehler ? e.message : "Die Hinweise konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function zurueck(id: string) {
    try {
      await hinweisZurueckziehen(id);
      void laden();
    } catch (e) {
      setFehler(e instanceof HinweisFehler ? e.message : "Der Hinweis konnte nicht zurückgezogen werden.");
    }
  }

  return (
    <Card>
      <CardHeader title="Hinweis an einzelne Personen" hint="erscheint beim nächsten Öffnen der App – ohne Antwort" />
      <CardBody className="space-y-4">
        <Button onClick={() => setOffen(true)}>
          <MessageSquarePlus className="h-4 w-4" />
          Hinweis senden
        </Button>
        {meldung ? <Alert tone="success">{meldung}</Alert> : null}
        {fehler ? <Alert tone="error">{fehler}</Alert> : null}

        {liste === null ? (
          <RowSkeleton />
        ) : liste.length === 0 ? (
          <EmptyState title="Noch keine Hinweise gesendet." />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Gesendete Hinweise">
            {liste.map((h) => (
              <li key={h.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{h.empfaenger}</p>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-ink-muted">{h.text}</p>
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {wannText(h.erstelltAm)}
                      {h.vonName ? ` · von ${h.vonName}` : ""}
                      {zielLabel(h.ziel) ? ` · Knopf „${zielLabel(h.ziel)}“` : ""}
                    </p>
                  </div>
                  <Status h={h} />
                </div>
                {!h.gelesenAm && !h.zurueckgezogenAm ? (
                  <button
                    type="button"
                    onClick={() => void zurueck(h.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-muted hover:text-ink"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Zurückziehen
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      {offen ? (
        <HinweisSenden
          vorauswahl={vorauswahl}
          onClose={() => setOffen(false)}
          onGesendet={(n) => {
            setMeldung(n === 1 ? "Hinweis gesendet." : `Hinweis an ${n} Personen gesendet.`);
            void laden();
          }}
        />
      ) : null}
    </Card>
  );
}

function Status({ h }: { h: GesendeterHinweis }) {
  if (h.zurueckgezogenAm) {
    return <span className="shrink-0 text-[12px] text-ink-faint">zurückgezogen</span>;
  }
  if (h.gelesenAm) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[12px] font-medium text-ok-fg">
        <Check className="h-3.5 w-3.5" />
        gelesen {wannText(h.gelesenAm)}
      </span>
    );
  }
  if (h.pushGesendet) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-info-bg px-2 py-0.5 text-[12px] font-medium text-info-fg">
        <Smartphone className="h-3.5 w-3.5" />
        aufs Handy geschickt
      </span>
    );
  }
  if (h.pushAb && new Date(h.pushAb) > new Date()) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[12px] font-medium text-warn-fg">
        <Clock className="h-3.5 w-3.5" />
        Handy {wannText(h.pushAb)}
      </span>
    );
  }
  return <span className="shrink-0 text-[12px] text-ink-faint">noch nicht gelesen</span>;
}
