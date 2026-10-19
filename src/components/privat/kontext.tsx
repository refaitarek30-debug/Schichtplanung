"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PrivatKonto } from "@/lib/privat/server";
import { ladeSchichtarten, type Schichtart } from "@/lib/privat/daten";
import { aufGeraet, ausGeraet } from "@/lib/geraete-speicher";

interface PrivatKontext {
  konto: PrivatKonto;
  /** null = wird noch geladen */
  schichtarten: Schichtart[] | null;
  artNach: Map<string, Schichtart>;
  ladeArtenNeu: () => Promise<void>;
  artenFehler: string | null;
}

const Kontext = createContext<PrivatKontext | null>(null);

export function PrivatProvider({ konto, children }: { konto: PrivatKonto; children: ReactNode }) {
  const [schichtarten, setSchichtarten] = useState<Schichtart[] | null>(null);
  const [artenFehler, setArtenFehler] = useState<string | null>(null);

  const ladeArtenNeu = useCallback(async () => {
    try {
      const neu = await ladeSchichtarten();
      setSchichtarten(neu);
      setArtenFehler(null);
      aufGeraet(`${konto.userId}:privat:arten`, neu);
    } catch (e) {
      setArtenFehler(e instanceof Error ? e.message : "Die Schichten konnten nicht geladen werden.");
    }
  }, [konto.userId]);

  useEffect(() => {
    // Gleich nach dem Öffnen: die zuletzt gemerkten Schichten dieses Geräts, bis die frischen da sind.
    const gemerkt = ausGeraet<Schichtart[]>(`${konto.userId}:privat:arten`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Array.isArray(gemerkt)) setSchichtarten((alt) => alt ?? gemerkt);
    void ladeArtenNeu();
  }, [ladeArtenNeu, konto.userId]);

  const artNach = useMemo(() => new Map((schichtarten ?? []).map((a) => [a.id, a])), [schichtarten]);

  return (
    <Kontext.Provider value={{ konto, schichtarten, artNach, ladeArtenNeu, artenFehler }}>{children}</Kontext.Provider>
  );
}

export function usePrivat(): PrivatKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error("usePrivat außerhalb des Privatbereichs");
  return k;
}
