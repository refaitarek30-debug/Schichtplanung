"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PrivatKonto } from "@/lib/privat/server";
import { ladeSchichtarten, type Schichtart } from "@/lib/privat/daten";
import { aufGeraet, ausGeraet } from "@/lib/geraete-speicher";
import { START_COOKIE, START_COOKIE_MAX_AGE, startCookieWert } from "@/lib/start-seite";

/** Gleicher Login zusätzlich im Betrieb (Migration 0194) – sonst null. */
export interface BetriebInfo {
  firma: string;
}

interface PrivatKontext {
  konto: PrivatKonto;
  betrieb: BetriebInfo | null;
  /** null = wird noch geladen */
  schichtarten: Schichtart[] | null;
  artNach: Map<string, Schichtart>;
  ladeArtenNeu: () => Promise<void>;
  artenFehler: string | null;
}

const Kontext = createContext<PrivatKontext | null>(null);

export function PrivatProvider({
  konto,
  betrieb = null,
  children,
}: {
  konto: PrivatKonto;
  betrieb?: BetriebInfo | null;
  children: ReactNode;
}) {
  const mitBetrieb = !!betrieb;
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
    // Merkzettel „diese Person startet im Privatbereich“: Die Middleware schickt dann gleich dorthin
    // und lässt die lange Anmeldefrist der Privatkonten auch auf dem Weg dorthin gelten.
    // Mit Betriebszugang bleibt dessen Startseite – der Privatbereich ist dann ein Wechsel, kein Start.
    if (!mitBetrieb) {
      const sicher = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${START_COOKIE}=${encodeURIComponent(startCookieWert(konto.userId, "privat"))}; path=/; max-age=${START_COOKIE_MAX_AGE}; samesite=lax${sicher}`;
    }
    // Gleich nach dem Öffnen: die zuletzt gemerkten Schichten dieses Geräts, bis die frischen da sind.
    const gemerkt = ausGeraet<Schichtart[]>(`${konto.userId}:privat:arten`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Array.isArray(gemerkt)) setSchichtarten((alt) => alt ?? gemerkt);
    void ladeArtenNeu();
  }, [ladeArtenNeu, konto.userId, mitBetrieb]);

  const artNach = useMemo(() => new Map((schichtarten ?? []).map((a) => [a.id, a])), [schichtarten]);

  return (
    <Kontext.Provider value={{ konto, betrieb, schichtarten, artNach, ladeArtenNeu, artenFehler }}>{children}</Kontext.Provider>
  );
}

export function usePrivat(): PrivatKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error("usePrivat außerhalb des Privatbereichs");
  return k;
}
