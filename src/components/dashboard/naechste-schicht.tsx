"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { KpiCard } from "./kpi-card";

/**
 * Kachel „Nächste …“: wann eine bestimmte Schicht oder Abwesenheit als
 * Nächstes im eigenen Plan steht – z. B. die Berufsschule für Azubis oder
 * die nächste Nachtschicht. Die Wahl liegt in derselben Liste wie die
 * Kachel-Auswahl (`naechsteschicht:<Name>`), gilt also auf allen Geräten.
 *
 * Gelesen wird nur der eigene Plan (`meine_statistik_tage`, nur Tage der
 * angemeldeten Person).
 */

export const NAECHSTE_KEY = "naechsteschicht";
export const NAECHSTE_PREFIX = `${NAECHSTE_KEY}:`;

/** Abwesenheits-Kürzel im Plan – lesbarer Name. Krank steht bewusst nicht zur Wahl. */
const ABWESENHEIT: Record<string, string> = {
  U: "Urlaub",
  V: "V-Tag",
  AF: "Altersfreizeit",
  SU: "Sonderurlaub",
  BU: "Bildungsurlaub",
  G: "Gewerkschaftstag",
  FB: "Schulung",
};

type Tag = { tag: string; schicht: string | null; abwesenheit: string | null };

const zwei = (n: number) => String(n).padStart(2, "0");
const heuteIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
};
const nameVon = (t: Tag): string | null => t.schicht ?? (t.abwesenheit ? (ABWESENHEIT[t.abwesenheit] ?? null) : null);

async function ladeJahr(jahr: number): Promise<Tag[]> {
  const { data, error } = await createClient().rpc("meine_statistik_tage", { p_jahr: jahr });
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export function NaechsteSchichtKachel({
  wahl,
  onWahl,
  kompakt,
}: {
  wahl: string | null;
  onWahl: (name: string) => void;
  kompakt: boolean;
}) {
  const [tage, setTage] = useState<Tag[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let aktiv = true;
    const jahr = new Date().getFullYear();
    Promise.all([ladeJahr(jahr), ladeJahr(jahr + 1).catch(() => [] as Tag[])])
      .then(([a, b]) => aktiv && setTage([...a, ...b]))
      .catch(() => aktiv && setFehler(true));
    return () => {
      aktiv = false;
    };
  }, []);

  const heute = heuteIso();
  const kommend = useMemo(() => (tage ?? []).filter((t) => t.tag >= heute).sort((a, b) => a.tag.localeCompare(b.tag)), [tage, heute]);
  const auswahl = useMemo(() => [...new Set(kommend.map(nameVon).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, "de")), [kommend]);
  const treffer = wahl ? kommend.find((t) => nameVon(t) === wahl) : undefined;

  if (!wahl) {
    return (
      <div className="flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-line bg-surface p-2.5 shadow-card sm:p-3" data-naechste-wahl>
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted">
          <CalendarSearch className="h-4 w-4" strokeWidth={1.8} /> Nächste …
        </span>
        <select
          aria-label="Welche Schicht soll die Kachel zeigen?"
          defaultValue=""
          onChange={(e) => e.target.value && onWahl(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px]"
        >
          <option value="" disabled>
            {fehler ? "nicht verfügbar" : tage === null ? "lädt …" : auswahl.length ? "Schicht wählen" : "nichts geplant"}
          </option>
          {auswahl.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    );
  }

  let wert = "…";
  let hinweis = "wird gesucht";
  if (fehler) {
    wert = "–";
    hinweis = "konnte nicht geladen werden";
  } else if (tage !== null) {
    if (!treffer) {
      wert = "–";
      hinweis = "nicht mehr im Plan";
    } else {
      const d = new Date(`${treffer.tag}T12:00:00`);
      const inTagen = Math.round((d.getTime() - new Date(`${heute}T12:00:00`).getTime()) / 864e5);
      wert = d.toLocaleDateString("de-DE", kompakt ? { day: "2-digit", month: "2-digit" } : { weekday: "short", day: "2-digit", month: "2-digit" });
      hinweis = inTagen === 0 ? "heute" : inTagen === 1 ? "morgen" : `in ${inTagen} Tagen`;
    }
  }

  return (
    <KpiCard
      label={`Nächste: ${wahl}`}
      kompakt={kompakt}
      kurz={wahl}
      kurzEinheit={tage !== null && treffer ? hinweis : undefined}
      href="/meine-schichten"
      value={wert}
      hint={hinweis}
      accent="neutral"
      ton="neutral"
      icon={<CalendarSearch className="h-4 w-4" strokeWidth={1.8} />}
    />
  );
}
