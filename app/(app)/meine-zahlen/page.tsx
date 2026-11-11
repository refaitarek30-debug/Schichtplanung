"use client";

import { useCallback } from "react";
import { MeineZahlen, type JahrDaten } from "@/components/statistik/meine-zahlen";
import { fetchHolidays } from "@/lib/data/holidays";
import { createClient } from "@/lib/supabase/client";
import type { StatTag, TagArt } from "@/lib/statistik";

/**
 * „Meine Zahlen“ im Betrieb: eigene Statistik aus dem eigenen Plan. Die Datenbank
 * liefert ausschließlich die Tage der angemeldeten Person (`meine_statistik_tage`,
 * Migration 0216) – niemand sonst sieht diese Zahlen, gespeichert wird nichts.
 */
export default function MeineZahlenSeite() {
  const lade = useCallback(async (jahr: number): Promise<JahrDaten> => {
    const [{ data, error }, feiertage] = await Promise.all([
      createClient().rpc("meine_statistik_tage", { p_jahr: jahr }),
      fetchHolidays().catch(() => []),
    ]);
    if (error) throw new Error("Die Zahlen konnten nicht geladen werden.");
    const tage: StatTag[] = ((data ?? []) as { tag: string; schicht: string | null; kuerzel: string | null; abwesenheit: string | null; stunden: number }[]).map((z) => {
      const art: TagArt = z.abwesenheit === "K" ? "krank" : z.abwesenheit === "U" ? "urlaub" : z.abwesenheit ? "sonst" : z.schicht ? "arbeit" : "frei";
      return {
        iso: z.tag,
        art,
        stunden: art === "arbeit" ? Number(z.stunden) || 0 : 0,
        nacht: art === "arbeit" && (z.kuerzel === "N" || /nacht/i.test(z.schicht ?? "")),
        schicht: z.schicht ?? undefined,
      };
    });
    return { tage, feiertage: new Set(feiertage.map((h) => h.date).filter((d) => d.startsWith(`${jahr}-`))) };
  }, []);
  return (
    <div className="privat-schrift">
      <MeineZahlen lade={lade} />
    </div>
  );
}
