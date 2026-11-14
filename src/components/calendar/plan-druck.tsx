"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { fetchHolidays, fetchSchoolHolidays, type SchoolHolidayRange } from "@/lib/data/holidays";
import { monthName } from "@/lib/dates";
import { ROTATION_TEAMS } from "@/lib/qualifications";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Schichtplan zum Ausdrucken – wie der Plan auf Papier: je Monat ein Blatt
 * (A4 oder A3 quer), Namen links, Tage oben, Wochenenden hellbraun,
 * Feiertage rot, Ferien blau, darüber die Zeile der Schichtgruppe mit
 * F/S/N und unten die Legende. „Drucken“ öffnet den Druckdialog – dort
 * lässt sich der Plan auch als PDF sichern und teilen.
 *
 * Abwesenheiten erscheinen auf dem Papier nur als U (Urlaub), V (V-Tag)
 * oder A (abwesend) – ein ausgehängter Plan verrät keine Gründe.
 */

type Format = "A4" | "A3";
const WT = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const zwei = (n: number) => String(n).padStart(2, "0");
const tageIm = (j: number, m: number) => new Date(j, m + 1, 0).getDate();

/** Farben wie auf dem Papierplan. */
const SCHICHT_VOLL: Record<string, string> = { F: "#f4e64b", S: "#6aa84f", N: "#3d85c6" };
const SCHICHT_HELL: Record<string, string> = { F: "#fbf4b0", S: "#d3e8c8", N: "#cadcf0" };
const SA = "#ecdccb";
const SO = "#e3c3a3";
const FEIERTAG = "#c0392b";
const FERIEN = "#9fbfe5";

function abwesenheit(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c === "U" || c === "V") return c;
  return "A";
}

interface Monat {
  jahr: number;
  monat: number;
  zellen: LiveShiftPlanCell[];
}

export function PlanDruck({
  companyId,
  start,
}: {
  companyId: string;
  start: { jahr: number; monat: number | null; team: string; format: Format };
}) {
  const [jahr, setJahr] = useState(start.jahr);
  const [monat, setMonat] = useState<number | null>(start.monat);
  const [team, setTeam] = useState(start.team);
  const [format, setFormat] = useState<Format>(start.format);
  const [eintraege, setEintraege] = useState(true);
  const [daten, setDaten] = useState<Monat[] | null>(null);
  const [feiertage, setFeiertage] = useState<Map<string, string>>(new Map());
  const [ferien, setFerien] = useState<SchoolHolidayRange[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [da, setDa] = useState(false);

  useEffect(() => setDa(true), []);

  useEffect(() => {
    let aktiv = true;
    const monate = monat === null ? Array.from({ length: 12 }, (_, i) => i) : [monat];
    setDaten(null);
    setFehler(null);
    Promise.all([
      Promise.all(
        monate.map(async (m) => ({
          jahr,
          monat: m,
          zellen: await fetchShiftPlanGrid(companyId, `${jahr}-${zwei(m + 1)}-01`, tageIm(jahr, m)),
        })),
      ),
      fetchHolidays().catch(() => []),
      fetchSchoolHolidays(`${jahr}-01-01`, `${jahr}-12-31`).catch(() => []),
    ])
      .then(([m, f, s]) => {
        if (!aktiv) return;
        setDaten(m);
        setFeiertage(new Map(f.filter((h) => h.date.startsWith(`${jahr}-`)).map((h) => [h.date, h.name])));
        setFerien(s);
      })
      .catch((e: unknown) => aktiv && setFehler(e instanceof DataError ? e.message : "Der Plan konnte nicht geladen werden."));
    return () => {
      aktiv = false;
    };
  }, [companyId, jahr, monat]);

  const istFerien = (iso: string) => ferien.some((f) => iso >= f.startDate && iso <= f.endDate);

  const blaetter = useMemo(
    () =>
      (daten ?? []).map((m) => {
        const zellen = team === "all" ? m.zellen : m.zellen.filter((z) => z.rotationTeam === team);
        return { ...m, zellen };
      }),
    [daten, team],
  );

  const seite = (
    <div className="plan-druck fixed inset-0 z-[90] overflow-auto bg-white text-black" data-plan-druck>
      <style>{`
        @page { size: ${format} landscape; margin: 8mm; }
        @media print {
          body > *:not([data-plan-druck-wurzel]) { display: none !important; }
          .plan-druck { position: static !important; overflow: visible !important; }
          .plan-druck-leiste { display: none !important; }
          .plan-blatt { box-shadow: none !important; margin: 0 !important; break-after: page; }
          .plan-blatt:last-child { break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="plan-druck-leiste sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-black/10 bg-white/95 px-4 py-3 text-[14px] backdrop-blur">
        <Link href="/schichtplan" className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-medium">
          <ChevronLeft className="h-4 w-4" /> Zurück
        </Link>
        <select aria-label="Monat" value={monat ?? "jahr"} onChange={(e) => setMonat(e.target.value === "jahr" ? null : Number(e.target.value))} className="rounded-lg border border-black/15 px-2 py-1.5">
          <option value="jahr">Ganzes Jahr (12 Blätter)</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i}>
              {monthName(i)}
            </option>
          ))}
        </select>
        <select aria-label="Jahr" value={jahr} onChange={(e) => setJahr(Number(e.target.value))} className="rounded-lg border border-black/15 px-2 py-1.5">
          {[start.jahr - 1, start.jahr, start.jahr + 1].map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <select aria-label="Schichtgruppe" value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-lg border border-black/15 px-2 py-1.5">
          <option value="all">Alle Schichten</option>
          {ROTATION_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}-Schicht
            </option>
          ))}
        </select>
        <div role="group" aria-label="Papier" className="flex rounded-lg border border-black/15 p-0.5">
          {(["A4", "A3"] as Format[]).map((f) => (
            <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={cn("rounded-md px-3 py-1 font-semibold", format === f ? "bg-black text-white" : "")}>
              {f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={eintraege} onChange={(e) => setEintraege(e.target.checked)} /> Einträge zeigen
        </label>
        <button type="button" onClick={() => window.print()} disabled={!daten} className="ml-auto flex items-center gap-2 rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-40" data-plan-drucken>
          <Printer className="h-4 w-4" /> Drucken / als PDF
        </button>
      </div>

      {fehler ? <p className="p-6 text-[15px] text-red-700">{fehler}</p> : null}
      {!daten && !fehler ? <p className="p-6 text-[15px] text-black/60">Plan wird geladen …</p> : null}

      <div className="flex flex-col items-center gap-6 py-6">
        {blaetter.map((b) => (
          <Blatt key={`${b.jahr}-${b.monat}`} {...b} format={format} team={team} eintraege={eintraege} feiertage={feiertage} istFerien={istFerien} />
        ))}
      </div>
    </div>
  );

  if (!da) return null;
  // Eigene Wurzel direkt unter <body>: beim Drucken wird alles andere ausgeblendet.
  return createPortal(<div data-plan-druck-wurzel>{seite}</div>, document.body);
}

function Blatt({
  jahr,
  monat,
  zellen,
  format,
  team,
  eintraege,
  feiertage,
  istFerien,
}: Monat & {
  format: Format;
  team: string;
  eintraege: boolean;
  feiertage: Map<string, string>;
  istFerien: (iso: string) => boolean;
}) {
  const n = tageIm(jahr, monat);
  const tage = Array.from({ length: n }, (_, i) => `${jahr}-${zwei(monat + 1)}-${zwei(i + 1)}`);
  const wt = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

  // Personen je Gruppe, in Planreihenfolge.
  const personen = new Map<string, { name: string; team: string | null; azubi: boolean; tage: Map<string, LiveShiftPlanCell> }>();
  for (const z of zellen) {
    let p = personen.get(z.employeeId);
    if (!p) {
      p = { name: z.employeeName, team: z.rotationTeam, azubi: !!z.isApprentice, tage: new Map() };
      personen.set(z.employeeId, p);
    }
    p.tage.set(z.day, z);
  }
  const personenListe = [...personen.values()];
  const gruppen = new Map<string, typeof personenListe>();
  for (const p of personenListe) {
    const g = p.team ?? "–";
    gruppen.set(g, [...(gruppen.get(g) ?? []), p]);
  }
  const gruppenFolge = [...gruppen.keys()].sort((a, b) => (a === "–" ? 1 : b === "–" ? -1 : a.localeCompare(b)));

  /** Schicht der Gruppe an einem Tag: was die meisten der Gruppe haben. */
  const gruppenSchicht = (liste: typeof personenListe, iso: string) => {
    const zaehler = new Map<string, number>();
    for (const p of liste) {
      const c = p.tage.get(iso)?.shiftCode;
      if (c && SCHICHT_VOLL[c]) zaehler.set(c, (zaehler.get(c) ?? 0) + 1);
    }
    let best: string | null = null;
    for (const [c, k] of zaehler) if (!best || k > (zaehler.get(best) ?? 0)) best = c;
    return best;
  };

  const hinterTag = (iso: string): string | undefined => {
    if (feiertage.has(iso)) return "#f3c9c4";
    const w = wt(iso);
    if (w === 6) return SA;
    if (w === 0) return SO;
    return undefined;
  };

  const masse = format === "A3" ? { breite: "400mm", hoehe: "273mm", schrift: "11pt", name: "44mm", zeile: "7.6mm" } : { breite: "281mm", hoehe: "190mm", schrift: "8pt", name: "32mm", zeile: "5.4mm" };
  const leer = Math.max(0, 3);

  return (
    <section
      className="plan-blatt flex flex-col bg-white px-[6mm] py-[5mm] shadow-[0_2px_16px_rgba(0,0,0,0.18)]"
      style={{ width: masse.breite, minHeight: masse.hoehe, fontSize: masse.schrift, fontFamily: "Arial, Helvetica, sans-serif" }}
      data-plan-blatt={`${jahr}-${monat + 1}`}
    >
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: masse.name }} />
          {tage.map((t) => (
            <col key={t} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={3} className="pb-[2mm] pr-[2mm] text-left align-top">
              <span className="block font-bold" style={{ fontSize: "1.9em", lineHeight: 1.05 }}>
                {jahr}
              </span>
              <span className="block font-bold" style={{ fontSize: "1.5em" }}>
                {monthName(monat)}
              </span>
              <span className="mt-[1mm] block font-normal">{team === "all" ? "Alle Schichten" : `${team}-Schicht`}</span>
            </th>
            {tage.map((t) => (
              <th key={t} className="h-[2.2mm] p-0" style={{ background: istFerien(t) ? FERIEN : undefined }} title={istFerien(t) ? "Ferien" : undefined} />
            ))}
          </tr>
          <tr>
            {tage.map((t) => (
              <th
                key={t}
                className="border border-black/70 py-[0.6mm] text-center font-semibold"
                style={{ background: hinterTag(t), color: wt(t) === 0 ? "#c0392b" : undefined, fontSize: "0.85em" }}
              >
                {WT[wt(t)]}
              </th>
            ))}
          </tr>
          <tr>
            {tage.map((t) => (
              <th
                key={t}
                className="border border-black/70 py-[0.6mm] text-center font-normal"
                style={{ background: feiertage.has(t) ? FEIERTAG : hinterTag(t), color: feiertage.has(t) ? "#fff" : undefined }}
                title={feiertage.get(t)}
              >
                {Number(t.slice(8))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gruppenFolge.map((g) => {
            const liste = gruppen.get(g) ?? [];
            return [
              <tr key={`g-${g}`}>
                <th className="border border-black/70 px-[1.5mm] text-left font-semibold" style={{ height: masse.zeile }}>
                  {g === "–" ? "ohne Gruppe" : /^[A-Z]$/.test(g) ? `${g}-Schicht` : g}
                </th>
                {tage.map((t) => {
                  const c = gruppenSchicht(liste, t);
                  return (
                    <td key={t} className="border border-black/70 text-center font-bold" style={{ background: c ? SCHICHT_VOLL[c] : hinterTag(t), color: c === "N" || c === "S" ? "#fff" : undefined }}>
                      {c ?? ""}
                    </td>
                  );
                })}
              </tr>,
              ...liste.map((p, i) => (
                <tr key={`${g}-${i}`}>
                  <th className="truncate border border-black/70 px-[1.5mm] text-left font-normal" style={{ height: masse.zeile }}>
                    {p.name}
                    {p.azubi ? <span style={{ color: "#666" }}> (Azubi)</span> : null}
                  </th>
                  {tage.map((t) => {
                    const z = p.tage.get(t);
                    const ab = eintraege ? abwesenheit(z?.absenceCode ?? null) : null;
                    const c = eintraege && !ab ? (z?.shiftCode ?? null) : null;
                    return (
                      <td key={t} className="border border-black/70 text-center" style={{ background: c && SCHICHT_HELL[c] ? SCHICHT_HELL[c] : hinterTag(t) }}>
                        {ab ?? c ?? ""}
                      </td>
                    );
                  })}
                </tr>
              )),
            ];
          })}
          {Array.from({ length: leer }, (_, i) => (
            <tr key={`leer-${i}`}>
              <th className="border border-black/70" style={{ height: masse.zeile }} />
              {tage.map((t) => (
                <td key={t} className="border border-black/70" style={{ background: hinterTag(t) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-auto flex flex-wrap items-center gap-x-[6mm] gap-y-[1.5mm] pt-[4mm]">
        <Legende farbe={FERIEN} text="Ferien" />
        <Legende farbe={FEIERTAG} text="Feiertage" />
        <Legende farbe={SO} text="Wochenende" />
        <Legende farbe={SCHICHT_VOLL.F} text="F Früh" />
        <Legende farbe={SCHICHT_VOLL.S} text="S Spät" />
        <Legende farbe={SCHICHT_VOLL.N} text="N Nacht" />
        <span>U Urlaub · V V-Tag · A abwesend</span>
        <span className="ml-auto" style={{ color: "#888" }}>
          Stand {new Date().toLocaleDateString("de-DE")} · ShiftNexo
        </span>
      </div>
    </section>
  );
}

function Legende({ farbe, text }: { farbe: string; text: string }) {
  return (
    <span className="flex items-center gap-[1.5mm]">
      <i className="inline-block h-[3.5mm] w-[3.5mm]" style={{ background: farbe }} />
      {text}
    </span>
  );
}
