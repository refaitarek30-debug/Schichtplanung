"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { fetchMyAgeLeave } from "@/lib/data/age-leave";
import type { LiveMyAgeLeave } from "@/lib/types";

/**
 * Der eigene Stand zur Altersfreizeit.
 *
 * Bewusst zurückhaltend formuliert: solange nichts festgelegt ist, steht hier
 * ausdrücklich, dass es sich um keinen Anspruch handelt. Wer das anders liest,
 * wäre zu Recht verärgert, wenn die Führung später weniger festlegt.
 *
 * Die interne Begründung der Führung wird hier nicht angezeigt – sie kommt
 * gar nicht erst mit, `my_age_leave()` gibt sie nicht heraus.
 */
export function MyAgeLeaveHint() {
  const [stand, setStand] = useState<LiveMyAgeLeave | null>(null);
  const [geladen, setGeladen] = useState(false);
  const jahr = new Date().getFullYear();

  const laden = useCallback(async () => {
    try {
      setStand(await fetchMyAgeLeave(jahr));
    } catch {
      // Kein Fehlertext: der Hinweis ist eine Zugabe. Wenn er nicht lädt,
      // soll er still verschwinden statt das Formular zu verstellen.
      setStand(null);
    } finally {
      setGeladen(true);
    }
  }, [jahr]);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (!geladen || !stand) return null;

  if (stand.confirmed) {
    return (
      <Alert tone="success">
        Für {jahr} sind <strong>{stand.confirmedDays} Tage Altersfreizeit</strong> festgelegt.
      </Alert>
    );
  }

  if (stand.autoPossible) {
    return (
      <Alert tone="info">
        Du wirst {jahr} {stand.ageInYear} Jahre alt. Damit <strong>könnten</strong> rund{" "}
        {stand.suggestedDays} zusätzliche Tage in Frage kommen. Das ist ein Hinweis und noch kein
        Anspruch – Schichtleitung oder Administration prüfen und legen fest, was tatsächlich gilt.
      </Alert>
    );
  }

  return null;
}
