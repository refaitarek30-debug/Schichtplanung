"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDays } from "@/lib/dates";
import { ladeFarben } from "@/lib/data/kalender-eigene";
import { farbeFuer, schichtSchluessel } from "@/lib/kalender-farben";
import { aufGeraet, ausGeraet } from "@/lib/geraete-speicher";
import { dauerStunden, eintragAus, idsVon, type Schichtart, type TagEintrag } from "@/lib/privat/daten";

/**
 * Schichten aus dem Betrieb im Privatbereich (Migration 0194): nur die
 * eigenen, nur Schichten (kein Urlaub, kein Krank), nur zum Ansehen – in den
 * eigenen Farben aus dem Betriebskalender.
 */

interface BetriebTag {
  name: string;
  kuerzel: string | null;
}

/** Uhrzeiten der Schichten im Betrieb – damit Lohn und Zuschläge im Privatbereich rechnen können. */
interface BetriebZeit {
  name: string;
  kuerzel: string | null;
  beginn: string;
  ende: string;
}

/** Ohne „schicht“ am Ende, wie im Betriebskalender („Frühschicht“ → „Früh“). */
function kurz(name: string): string {
  return name.replace(/schicht$/i, "").trim() || name;
}

export const BETRIEB_PREFIX = "betrieb:";

/** Frei ohne eigene Farbe: hellgrau wie im Betriebskalender. */
const FREI_NEUTRAL = "#E6E8EC";

export function istBetriebsArt(id: string): boolean {
  return id.startsWith(BETRIEB_PREFIX);
}

export function useBetriebsschichten(benutzer: string, aktiv: boolean, von: string, bis: string) {
  const [tage, setTage] = useState<Record<string, BetriebTag>>({});
  const [farben, setFarben] = useState<Record<string, string>>({});
  const [zeiten, setZeiten] = useState<BetriebZeit[]>([]);
  const geladen = useRef(new Set<string>());

  useEffect(() => {
    if (!aktiv) return;
    // Gleich nach dem Öffnen: der zuletzt gemerkte Stand dieses Geräts.
    const gemerkt = ausGeraet<Record<string, BetriebTag>>(`${benutzer}:privat:betrieb`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (gemerkt) setTage((alt) => (Object.keys(alt).length ? alt : gemerkt));
    const f = ausGeraet<Record<string, string>>(`${benutzer}:privat:betrieb-farben`);
    if (f) setFarben((alt) => (Object.keys(alt).length ? alt : f));
    ladeFarben()
      .then((neu) => {
        setFarben(neu);
        aufGeraet(`${benutzer}:privat:betrieb-farben`, neu);
      })
      .catch(() => undefined);
    const z = ausGeraet<BetriebZeit[]>(`${benutzer}:privat:betrieb-zeiten`);
    if (z) setZeiten((alt) => (alt.length ? alt : z));
    void Promise.resolve(createClient().from("shifts").select("name, short_name, start_time, end_time"))
      .then(({ data }) => {
        if (!data) return;
        const neu = (data as { name: string; short_name: string | null; start_time: string | null; end_time: string | null }[]).map((r) => ({
          name: r.name,
          kuerzel: r.short_name,
          beginn: r.start_time?.slice(0, 5) ?? "",
          ende: r.end_time?.slice(0, 5) ?? "",
        }));
        setZeiten(neu);
        aufGeraet(`${benutzer}:privat:betrieb-zeiten`, neu);
      })
      .catch(() => undefined);
  }, [aktiv, benutzer]);

  useEffect(() => {
    if (!aktiv) return;
    // Mit Rand, damit beim Blättern die Nachbarmonate schon da sind.
    const ab = addDays(von, -35);
    const bisRand = addDays(bis, 35);
    const schluessel = `${ab}|${bisRand}`;
    if (geladen.current.has(schluessel)) return;
    geladen.current.add(schluessel);
    void Promise.resolve(createClient().rpc("meine_betriebsschichten", { p_von: ab, p_bis: bisRand }))
      .then(({ data, error }) => {
        if (error) {
          geladen.current.delete(schluessel);
          return;
        }
        setTage((alt) => {
          const neu = { ...alt };
          for (let d = ab; d <= bisRand; d = addDays(d, 1)) delete neu[d];
          for (const z of (data ?? []) as { tag: string; name: string; kuerzel: string | null }[]) {
            neu[z.tag] = { name: z.name, kuerzel: z.kuerzel };
          }
          aufGeraet(`${benutzer}:privat:betrieb`, neu);
          return neu;
        });
      })
      .catch(() => geladen.current.delete(schluessel));
  }, [aktiv, von, bis, benutzer]);

  const arten = useMemo(() => {
    const m = new Map<string, Schichtart>();
    if (!aktiv) return m;
    for (const t of Object.values(tage)) {
      const id = `${BETRIEB_PREFIX}${t.kuerzel ?? ""}:${t.name}`;
      if (m.has(id)) continue;
      const frei = t.kuerzel === "FREI";
      const z = frei ? undefined : (zeiten.find((x) => x.kuerzel && x.kuerzel === t.kuerzel && x.name === t.name) ?? zeiten.find((x) => x.name === t.name));
      const dauer = z ? dauerStunden(z.beginn, z.ende) : null;
      m.set(id, {
        id,
        name: kurz(t.name),
        kuerzel: t.kuerzel === "FREI" ? "X" : (t.kuerzel ?? t.name.slice(0, 1)),
        // Freie Tage (Migration 0196) wie im Betriebskalender: neutral, außer man hat sich eine Farbe gesetzt.
        farbe:
          t.kuerzel === "FREI"
            ? (farben.frei ?? FREI_NEUTRAL)
            : (farbeFuer(schichtSchluessel(t.kuerzel, t.name), farben) ?? "#12A594"),
        art: frei ? "frei" : "arbeit",
        beginn: z?.beginn ?? "",
        ende: z?.ende ?? "",
        stunden: dauer ?? 0,
        reihenfolge: -1,
      });
    }
    return m;
  }, [aktiv, tage, farben, zeiten]);

  /** Die Betriebsschicht eines Tages (oder nichts). */
  const am = (iso: string): Schichtart[] => {
    const t = aktiv ? tage[iso] : undefined;
    const a = t ? arten.get(`${BETRIEB_PREFIX}${t.kuerzel ?? ""}:${t.name}`) : undefined;
    return a ? [a] : [];
  };

  return { aktiv, tage, arten, am };
}

/**
 * Für die Anzeige: Betriebsschicht zuerst, danach die eigenen Einträge
 * (höchstens drei). Bearbeitet werden weiter nur die eigenen.
 */
export function mitBetrieb(
  eigene: Record<string, TagEintrag>,
  betrieb: ReturnType<typeof useBetriebsschichten>,
): Record<string, TagEintrag> {
  if (!betrieb.aktiv || !Object.keys(betrieb.tage).length) return eigene;
  const alle: Record<string, TagEintrag> = { ...eigene };
  for (const iso of Object.keys(betrieb.tage)) {
    const ids = [...betrieb.am(iso).map((a) => a.id), ...idsVon(eigene[iso])].slice(0, 3);
    const e = eintragAus(ids);
    if (e) alle[iso] = e;
  }
  return alle;
}
