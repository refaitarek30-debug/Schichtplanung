"use client";

import { useEffect, useState } from "react";
import { Blatt } from "@/components/privat/blatt";
import { Button } from "@/components/ui/button";
import { setzeLokal, useLokalNachLaden } from "@/components/kalender/lokal";
import { StartAnsichtSchalter } from "@/components/layout/start-ansicht-schalter";
import { neuGesehenSchluessel } from "@/components/layout/neu-marke";
import { useSession } from "@/context/session";
import type { StartAnsicht } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAME = "kompakt-startseite";

/**
 * Einmaliger Hinweis auf die Kompakte Startseite – nur für Personen, die
 * noch „Klassisch“ haben, und nur einmal je Gerät. Zwei kleine Bilder zum
 * Vergleichen und derselbe Umschalter wie auf der Startseite; erst
 * „Übernehmen“ stellt um. Kommt nie über ein anderes Fenster.
 */
export function KompaktHinweis() {
  const { startAnsicht, setStartAnsicht } = useSession();
  const gesehen = useLokalNachLaden(neuGesehenSchluessel(NAME), false, true);
  const [offen, setOffen] = useState(false);
  const [wahl, setWahl] = useState<StartAnsicht>("kompakt");

  useEffect(() => {
    if (gesehen || startAnsicht !== "klassisch") return;
    // Erst wenn die Seite steht – und nur, wenn nicht schon ein anderes
    // Fenster (Einführung, Hinweis, Datenschutz) offen ist. Sonst beim
    // nächsten Besuch.
    const id = window.setTimeout(() => {
      if (!document.querySelector('[role="dialog"]')) setOffen(true);
    }, 2500);
    return () => window.clearTimeout(id);
  }, [gesehen, startAnsicht]);

  if (!offen) return null;

  function zu() {
    setzeLokal(neuGesehenSchluessel(NAME), true);
    setOffen(false);
  }
  function uebernehmen() {
    if (wahl !== startAnsicht) setStartAnsicht(wahl);
    zu();
  }

  return (
    <Blatt
      titel="Neu: Kompakte Startseite"
      unter="Mehr auf einen Blick, weniger Scrollen. Du kannst jederzeit zurück."
      onClose={zu}
      wischZu
      fuss={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={uebernehmen}>
            Übernehmen
          </Button>
          <Button variant="ghost" onClick={zu}>
            Nicht jetzt
          </Button>
        </div>
      }
    >
      <div data-kompakt-hinweis className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Vorschau wert="klassisch" gewaehlt={wahl === "klassisch"} onWahl={setWahl} />
          <Vorschau wert="kompakt" gewaehlt={wahl === "kompakt"} onWahl={setWahl} />
        </div>
        <div className="flex justify-center">
          <StartAnsichtSchalter klein wert={wahl} onWahl={setWahl} />
        </div>
        <p className="text-center text-[13px] text-ink-muted">
          {wahl === "kompakt"
            ? "Kleine Kacheln, der Plan steht gleich oben."
            : "Große Kacheln und der große Urlaubs-Knopf, wie bisher."}
        </p>
      </div>
    </Blatt>
  );
}

/** Kleines Bild der Startseite zum Antippen. */
function Vorschau({
  wert,
  gewaehlt,
  onWahl,
}: {
  wert: StartAnsicht;
  gewaehlt: boolean;
  onWahl: (w: StartAnsicht) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onWahl(wert)}
      aria-pressed={gewaehlt}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border-2 p-2 text-left transition-colors",
        gewaehlt ? "border-brand-500" : "border-line",
      )}
    >
      <span aria-hidden className="flex h-[132px] flex-col gap-1.5 overflow-hidden rounded-xl bg-surface-muted p-2">
        {wert === "klassisch" ? (
          <>
            <span className="grid grid-cols-2 gap-1">
              <span className="h-8 rounded-md bg-ok-bg" />
              <span className="h-8 rounded-md bg-brand-50" />
              <span className="h-8 rounded-md bg-warn-bg" />
              <span className="h-8 rounded-md bg-shift-vtag" />
            </span>
            <span className="h-4 rounded-md bg-brand-600" />
            <span className="min-h-0 flex-1 rounded-md bg-surface" />
          </>
        ) : (
          <>
            <span className="grid grid-cols-4 gap-1">
              <span className="h-3.5 rounded bg-ok-bg" />
              <span className="h-3.5 rounded bg-brand-50" />
              <span className="h-3.5 rounded bg-warn-bg" />
              <span className="h-3.5 rounded bg-shift-vtag" />
            </span>
            <span className="grid min-h-0 flex-1 grid-cols-7 content-start gap-0.5">
              {Array.from({ length: 42 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 rounded-[2px]",
                    ["bg-shift-frueh", "bg-shift-spaet", "bg-shift-nacht", "bg-surface", "bg-shift-spaet", "bg-shift-frueh", "bg-surface"][
                      (i * 3 + Math.floor(i / 7)) % 7
                    ],
                  )}
                />
              ))}
            </span>
          </>
        )}
      </span>
      <span className="px-1 pb-0.5 text-[14px] font-semibold">{wert === "klassisch" ? "Klassisch" : "Kompakt"}</span>
    </button>
  );
}
