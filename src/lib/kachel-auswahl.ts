"use client";

import { useSyncExternalStore } from "react";
import type { TileOption } from "@/components/dashboard/tile-settings";

/**
 * Das Dashboard meldet hier seine Kachel-Auswahl an, damit das Profil-Fenster
 * (auf dem Handy) sie anzeigen kann. Ohne Dashboard ist der Eintrag leer und
 * das Profil zeigt keine Kacheln.
 */
export interface KachelAuswahl {
  profileId: string;
  optionen: TileOption[];
  versteckt: Set<string>;
  onChange: (naechste: Set<string>) => void;
}

let aktuell: KachelAuswahl | null = null;
const hoerer = new Set<() => void>();

export function setzeKachelAuswahl(wert: KachelAuswahl | null) {
  aktuell = wert;
  for (const h of hoerer) h();
}

export function useKachelAuswahl(): KachelAuswahl | null {
  return useSyncExternalStore(
    (rueckruf) => {
      hoerer.add(rueckruf);
      return () => hoerer.delete(rueckruf);
    },
    () => aktuell,
    () => null,
  );
}
