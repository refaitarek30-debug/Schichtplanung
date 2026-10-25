"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchichtleitungHinweis } from "@/components/ui/schichtleitung-hinweis";
import { melde } from "@/lib/protokoll-melden";

/**
 * Fängt Abstürze einer Seite im Betrieb ab. Statt der leeren Standardseite
 * („Application error“) steht ein Satz, ein Knopf zum erneuten Laden und –
 * für Mitarbeitende – an wen man sich wenden kann.
 */
export default function Fehler({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    void melde("fehler.absturz", error.digest ? `Seite abgestürzt (${error.digest})` : error.message || "Seite abgestürzt");
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-[22px] border border-crit-bg bg-crit-bg/40 p-5 text-crit-fg">
      <p className="flex items-center gap-2 text-[16px] font-semibold">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        Diese Seite konnte nicht geladen werden.
      </p>
      <p className="mt-2 text-[14px] leading-snug">
        Bitte versuche es noch einmal.
        <SchichtleitungHinweis immer />
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => (retry ?? reset ?? (() => window.location.reload()))()}>Erneut versuchen</Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Seite neu laden
        </Button>
      </div>
    </div>
  );
}
