"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { fetchMyAgeLeave } from "@/lib/data/age-leave";
import { fetchMyAfKonto } from "@/lib/data/leave";
import { formatDE, formatDays } from "@/lib/dates";
import type { LiveAfKonto, LiveMyAgeLeave } from "@/lib/types";

/**
 * Der eigene Stand zur Altersfreizeit.
 *
 * Freigeschaltet: der Stand des Stundenkontos. Sonst nur ein zurückhaltender
 * Hinweis ab 50 – ausdrücklich kein Anspruch; freigeschaltet wird von der
 * Administration.
 */
export function MyAgeLeaveHint() {
  const [stand, setStand] = useState<LiveMyAgeLeave | null>(null);
  const [konto, setKonto] = useState<LiveAfKonto | null>(null);
  const [geladen, setGeladen] = useState(false);
  const jahr = new Date().getFullYear();

  const laden = useCallback(async () => {
    const [hinweis, af] = await Promise.allSettled([fetchMyAgeLeave(jahr), fetchMyAfKonto()]);
    // Kein Fehlertext: der Hinweis ist eine Zugabe.
    setStand(hinweis.status === "fulfilled" ? hinweis.value : null);
    setKonto(af.status === "fulfilled" ? af.value : null);
    setGeladen(true);
  }, [jahr]);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (!geladen) return null;

  if (konto?.freigeschaltetAb) {
    return (
      <Alert tone="success">
        Altersfreizeit: Stand{" "}
        {konto.standStunden.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std. –{" "}
        <strong>{formatDays(konto.verfuegbar)} AF-Tage verfügbar</strong> (je Tag 8 Std.). Grundlage
        ist der Stand vom {formatDE(konto.freigeschaltetAb)}. Details stehen im Urlaubskonto.
      </Alert>
    );
  }

  if (stand?.autoPossible) {
    return (
      <Alert tone="info">
        Du wirst {jahr} {stand.ageInYear} Jahre alt. Damit <strong>könnte</strong> Altersfreizeit in
        Frage kommen. Das ist ein Hinweis und noch kein Anspruch – freigeschaltet wird von der
        Administration.
      </Alert>
    );
  }

  return null;
}
