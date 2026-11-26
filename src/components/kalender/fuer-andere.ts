"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/dates";
import {
  fetchFremdeSchichtarten,
  fetchFremdeSchichttage,
  fremdeSchichtSetzen,
  type FremdeSchichtart,
} from "@/lib/data/verbindungen";

/**
 * Schichten einer verbundenen Person setzen, die es erlaubt hat (Migration
 * 0246): ihre Schichtarten und die Tage rund um den gezeigten Tag werden
 * geladen, ein Tipp setzt oder löscht die Schicht. Für die Tagesansicht im
 * Privat- und im Betriebskalender.
 */
export function useFremdeSchichten(partner: string | null, iso: string, onGeaendert?: () => void) {
  const [arten, setArten] = useState<Record<string, FremdeSchichtart[]>>({});
  const [tage, setTage] = useState<Record<string, Record<string, Record<number, string>>>>({});
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const bereiche = useRef(new Map<string, { von: string; bis: string }>());

  const laden = useCallback(async (p: string, um: string, erzwingen = false) => {
    const b = bereiche.current.get(p);
    if (!erzwingen && b && um >= addDays(b.von, 3) && um <= addDays(b.bis, -3)) return;
    const von = addDays(um, -30);
    const bis = addDays(um, 30);
    bereiche.current.set(p, { von, bis });
    setLaedt(true);
    setFehler(null);
    try {
      const [a, t] = await Promise.all([fetchFremdeSchichtarten(p), fetchFremdeSchichttage(p, von, bis)]);
      setArten((alt) => ({ ...alt, [p]: a }));
      setTage((alt) => ({ ...alt, [p]: t }));
    } catch (e) {
      bereiche.current.delete(p);
      setFehler(e instanceof Error ? e.message : "Die Schichten konnten nicht geladen werden.");
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (partner) void laden(partner, iso);
  }, [partner, iso, laden]);

  const amTag = partner ? (tage[partner]?.[iso] ?? {}) : {};
  const aktiv = Object.values(amTag);

  async function waehle(id: string) {
    if (!partner) return;
    const ebenen = tage[partner]?.[iso] ?? {};
    const vorhanden = Object.entries(ebenen).find(([, a]) => a === id);
    const frei = [1, 2, 3].find((e) => !ebenen[e]);
    const ebene = vorhanden ? Number(vorhanden[0]) : (frei ?? 1);
    const art = vorhanden ? null : id;
    // Sofort zeigen, dann speichern.
    setTage((alt) => {
      const p = { ...(alt[partner] ?? {}) };
      const tag = { ...(p[iso] ?? {}) };
      if (art) tag[ebene] = art;
      else delete tag[ebene];
      p[iso] = tag;
      return { ...alt, [partner]: p };
    });
    try {
      await fremdeSchichtSetzen(partner, iso, ebene, art);
      setFehler(null);
      onGeaendert?.();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Schicht konnte nicht gespeichert werden.");
      await laden(partner, iso, true);
    }
  }

  return {
    eintraege: partner ? (arten[partner] ?? []).map((a) => ({ id: a.id, name: a.name, farbe: a.farbe })) : [],
    aktiv,
    waehle: (id: string) => void waehle(id),
    laedt,
    fehler,
  };
}
