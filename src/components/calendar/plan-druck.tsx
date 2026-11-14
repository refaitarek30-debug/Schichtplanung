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
 * In den Zeilen der Personen steht nur Urlaub (beantragt oder genehmigt) –
 * der Rest wird wie auf Papier von Hand ergänzt, und ein ausgehängter Plan
 * verrät keine Krankheit oder andere Gründe. Ohne Legende; das Blatt passt
 * immer auf eine Seite quer (Zeilenhöhe und Schrift passen sich an), und am
 * Bildschirm wird es auf die Breite verkleinert.
 */

type Format = "A4" | "A3";
const WT = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const zwei = (n: number) => String(n).padStart(2, "0");
const tageIm = (j: number, m: number) => new Date(j, m + 1, 0).getDate();

/** Farben wie auf dem Papierplan. */
const SCHICHT_VOLL: Record<string, string> = { F: "#f4e64b", S: "#6aa84f", N: "#3d85c6" };
const URLAUB = "#f6d58e";
const SA = "#ecdccb";
const SO = "#e3c3a3";
const FEIERTAG = "#c0392b";
const FERIEN = "#9fbfe5";

/** Urlaub: „U“ genehmigt, „u“ beantragt (Kleinbuchstaben = noch offen). Alles andere bleibt leer. */
function urlaub(code: string | null | undefined): "genehmigt" | "beantragt" | null {
  if (code === "U") return "genehmigt";
  if (code === "u") return "beantragt";
  return null;
}

/** Druckbare Fläche quer (Seite minus 8 mm Rand), in mm. */
const SEITE: Record<"A4" | "A3", { b: number; h: number; schrift: number; zeile: number; kopf: number; name: number }> = {
  A4: { b: 280, h: 192, schrift: 2.9, zeile: 9, kopf: 26, name: 34 },
  A3: { b: 403, h: 279, schrift: 3.9, zeile: 13, kopf: 34, name: 48 },
};
const PX_JE_MM = 96 / 25.4;

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
  const [breite, setBreite] = useState(0);
  const [daten, setDaten] = useState<Monat[] | null>(null);
  const [feiertage, setFeiertage] = useState<Map<string, string>>(new Map());
  const [ferien, setFerien] = useState<SchoolHolidayRange[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [da, setDa] = useState(false);

  useEffect(() => {
    setDa(true);
    const messen = () => setBreite(window.innerWidth);
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);
  // Am Bildschirm aufs Fenster verkleinern – gedruckt wird in Originalgröße.
  const zoom = breite ? Math.min(1, (breite - 24) / (SEITE[format].b * PX_JE_MM + 2)) : 1;

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
          .plan-druck-blaetter { padding: 0 !important; gap: 0 !important; display: block !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .plan-blatt { box-shadow: none !important; margin: 0 !important; break-after: page; zoom: 1 !important; }
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
        <button type="button" onClick={() => window.print()} disabled={!daten} className="ml-auto flex items-center gap-2 rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-40" data-plan-drucken>
          <Printer className="h-4 w-4" /> Drucken / als PDF
        </button>
      </div>

      {fehler ? <p className="p-6 text-[15px] text-red-700">{fehler}</p> : null}
      {!daten && !fehler ? <p className="p-6 text-[15px] text-black/60">Plan wird geladen …</p> : null}

      <div className="plan-druck-blaetter flex flex-col items-center gap-6 py-6">
        {blaetter.map((b) => (
          <Blatt key={`${b.jahr}-${b.monat}`} {...b} format={format} team={team} zoom={zoom} feiertage={feiertage} istFerien={istFerien} />
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
  zoom,
  feiertage,
  istFerien,
}: Monat & {
  format: Format;
  team: string;
  zoom: number;
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

  // Alles auf eine Seite: Zeilenhöhe (und damit Schrift) nach der Zahl der Zeilen.
  const seite = SEITE[format];
  const leer = 2;
  const zeilen = personenListe.length + gruppenFolge.length + leer;
  // Kopf (Ferienband, Wochentage, Datum) und Rand haben feste Höhe; die Zeilen teilen sich den Rest.
  const zeileMm = Math.max(3.2, Math.min(seite.zeile, (seite.h - seite.kopf) / Math.max(1, zeilen)));
  const schriftMm = Math.min(seite.schrift, zeileMm * 0.58);
  const masse = { breite: `${seite.b}mm`, hoehe: `${seite.h}mm`, schrift: `${schriftMm}mm`, name: `${seite.name}mm`, zeile: `${zeileMm}mm` };

  return (
    <section
      className="plan-blatt flex flex-col overflow-hidden bg-white px-[4mm] py-[4mm] shadow-[0_2px_16px_rgba(0,0,0,0.18)]"
      style={{ width: masse.breite, height: masse.hoehe, fontSize: masse.schrift, fontFamily: "Arial, Helvetica, sans-serif", zoom }}
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
                    const u = urlaub(p.tage.get(t)?.absenceCode);
                    return (
                      <td
                        key={t}
                        className="border border-black/70 text-center font-semibold"
                        style={{ background: u === "genehmigt" ? URLAUB : hinterTag(t), color: u === "beantragt" ? "#8a6d1f" : undefined }}
                        title={u === "beantragt" ? "Urlaub beantragt" : u === "genehmigt" ? "Urlaub" : undefined}
                      >
                        {u ? "U" : ""}
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

    </section>
  );
}
