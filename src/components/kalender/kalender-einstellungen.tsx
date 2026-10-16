"use client";

import { useState } from "react";
import { ErinnerungenGeraet } from "./erinnerungen";
import { ROLLEN, RollenAuswahl, useVorlieben } from "./vorschlaege";
import type { Rolle } from "@/lib/data/todos";

/**
 * Einstellungen für den Kalender: Erinnerungen auf diesem Gerät und wofür
 * man den Kalender nutzt (für die Vorschläge). Privat und Firma.
 */
export function KalenderVorliebenInhalt() {
  const { vorlieben, setzen } = useVorlieben();
  const [offen, setOffen] = useState(false);
  const [wahl, setWahl] = useState<Rolle[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const rollen = vorlieben?.rollen ?? [];
  const namen = ROLLEN.filter((r) => rollen.includes(r.id)).map((r) => `${r.icon} ${r.name}`);

  return (
    <div className="space-y-4">
      <ErinnerungenGeraet />
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[15px] font-medium">Vorschläge für</span>
            <span className="block truncate text-[13px] text-ink-muted">{namen.length ? namen.join(", ") : "Noch nicht gewählt"}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setWahl(rollen);
              setOffen(!offen);
            }}
            className="shrink-0 text-[14px] font-semibold text-brand-600"
          >
            {offen ? "Schließen" : "Ändern"}
          </button>
        </div>
        {offen ? (
          <div className="mt-3 space-y-3">
            <RollenAuswahl gewaehlt={wahl ?? rollen} onWechsel={setWahl} />
            <button
              type="button"
              onClick={() => {
                setFehler(null);
                void setzen(wahl ?? rollen, null)
                  .then(() => setOffen(false))
                  .catch((e: unknown) => setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden."));
              }}
              className="h-11 w-full rounded-[14px] bg-ink text-[15px] font-bold text-surface"
            >
              Speichern
            </button>
            {fehler ? <p className="text-[13px] text-crit-fg">{fehler}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
