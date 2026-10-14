"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PrivatKonto } from "@/lib/privat/server";
import { ladeSchichtarten, type Schichtart } from "@/lib/privat/daten";

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
      setSchichtarten(await ladeSchichtarten());
      setArtenFehler(null);
    } catch (e) {
      setArtenFehler(e instanceof Error ? e.message : "Die Schichten konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    void ladeArtenNeu();
  }, [ladeArtenNeu]);

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
