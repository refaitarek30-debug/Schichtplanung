"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MeineZahlen, type JahrDaten } from "@/components/statistik/meine-zahlen";
import { usePrivat } from "@/components/privat/kontext";
import { idsVon, ladeFeiertage, ladeTage, type Schichtart } from "@/lib/privat/daten";
import type { StatTag, TagArt } from "@/lib/statistik";

/** Nachtschicht: heißt so, oder geht über Mitternacht. */
const istNacht = (a: Schichtart) => /nacht/i.test(a.name) || (!!a.beginn && !!a.ende && a.ende < a.beginn);

/** „Meine Zahlen“ im Privatbereich: aus den eigenen Einträgen, nur für die Person selbst. */
export default function Seite() {
  const router = useRouter();
  const { artNach, schichtarten } = usePrivat();
  const lade = useCallback(
    async (jahr: number): Promise<JahrDaten> => {
      const [tage, feiertage] = await Promise.all([ladeTage(`${jahr}-01-01`, `${jahr}-12-31`), ladeFeiertage(jahr)]);
      const liste: StatTag[] = [];
      for (const [iso, e] of Object.entries(tage)) {
        const arten = idsVon(e)
          .map((id) => artNach.get(id))
          .filter((a): a is Schichtart => !!a);
        if (!arten.length) continue;
        // Urlaub, V-Tag und Krank ersetzen die Schicht des Tages – dann ist es kein Arbeitstag.
        const abw = arten.find((a) => a.art === "urlaub" || a.art === "krank");
        const arbeit = abw ? [] : arten.filter((a) => a.art === "arbeit");
        const art: TagArt = abw
          ? abw.art === "krank"
            ? "krank"
            : /^v\b|v-?tag|freischicht/i.test(`${abw.kuerzel} ${abw.name}`)
              ? "vtag"
              : "urlaub"
          : arbeit.length
            ? "arbeit"
            : "frei";
        liste.push({
          iso,
          art,
          stunden: arbeit.reduce((s, a) => s + (Number(a.stunden) || 0), 0),
          nacht: arbeit.some(istNacht),
          schicht: arbeit[0]?.name,
        });
      }
      return { tage: liste, feiertage: new Set(feiertage.map((f) => f.tag)) };
    },
    [artNach],
  );
  // Erst rechnen, wenn die eigenen Schichtarten da sind – sonst zählt jeder Tag als leer.
  if (schichtarten === null) return <p className="px-4 py-6 text-[14px] text-ink-muted">Zahlen werden gerechnet …</p>;
  return <MeineZahlen lade={lade} zurueck={() => router.push("/privat/schichten")} />;
}
