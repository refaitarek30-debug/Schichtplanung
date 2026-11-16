"use client";

import type { Termin } from "@/components/kalender/termine";
import { addDays } from "@/lib/dates";
import { idsVon, istAbwesenheit, textFarbe, type Schichtart, type TagEintrag } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

/**
 * Woche als Zeitraster (Entwurf A): 7 Spalten, 0–24 Uhr. Schichten als farbige
 * Blöcke an ihrer Uhrzeit (Nachtschichten laufen in den nächsten Tag), Termine
 * als kleine Blöcke, Tage ohne Uhrzeit (Frei, Urlaub, ganztägig) oben im Kopf.
 * Ein Tipp auf eine Spalte öffnet den Tag mit Zeitleiste.
 */

const KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const PX = 20; // Höhe einer Stunde
const std = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const minuten = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const uhr = (hhmm: string) => (hhmm.endsWith(":00") ? hhmm.slice(0, 2) : hhmm.slice(0, 5));

interface Block {
  key: string;
  von: number;
  bis: number;
  farbe: string;
  titel: string;
  unter: string;
  termin: boolean;
}

export function WochenSpalten({
  von,
  heute,
  tage,
  artNach,
  termineAm,
  feiertagVon,
  onTag,
}: {
  /** Montag der Woche */
  von: string;
  heute: string;
  tage: Record<string, TagEintrag>;
  artNach: Map<string, Schichtart>;
  termineAm: (iso: string) => Termin[];
  feiertagVon: (iso: string) => string | undefined;
  onTag: (iso: string) => void;
}) {
  const woche = Array.from({ length: 7 }, (_, i) => addDays(von, i));
  const artenAm = (iso: string) =>
    idsVon(tage[iso])
      .map((id) => artNach.get(id))
      .filter((a): a is Schichtart => !!a);

  const bloecke = new Map<string, Block[]>(woche.map((iso) => [iso, []]));
  const kopf = new Map<string, { text: string; farbe: string | null }[]>(woche.map((iso) => [iso, []]));
  let schichten = 0;
  let stunden = 0;
  let termine = 0;

  // Vortag mitnehmen: eine Nachtschicht vom Sonntag davor reicht in den Montag.
  for (const iso of [addDays(von, -1), ...woche]) {
    const arten = artenAm(iso);
    const abwesend = arten.some((a) => istAbwesenheit(a));
    const imBereich = bloecke.has(iso);
    for (const a of arten) {
      const b = minuten(a.beginn);
      const e = minuten(a.ende);
      if (imBereich && a.art === "arbeit" && !abwesend) {
        schichten += 1;
        stunden += a.stunden;
      }
      if (b === null || e === null || abwesend || a.art !== "arbeit") {
        if (imBereich) kopf.get(iso)!.push({ text: a.kuerzel || a.name, farbe: a.art === "frei" ? null : a.farbe });
        continue;
      }
      const ueber = e <= b; // über Mitternacht
      const titel = a.kuerzel || a.name.slice(0, 1);
      const unter = `${uhr(a.beginn)}–${uhr(a.ende)}`;
      if (imBereich) bloecke.get(iso)!.push({ key: `${a.id}-a`, von: b, bis: ueber ? 1440 : e, farbe: a.farbe, titel, unter, termin: false });
      const naechster = addDays(iso, 1);
      if (ueber && e > 0 && bloecke.has(naechster)) {
        bloecke.get(naechster)!.push({ key: `${a.id}-b-${iso}`, von: 0, bis: e, farbe: a.farbe, titel, unter: `–${uhr(a.ende)}`, termin: false });
      }
    }
  }
  for (const iso of woche) {
    for (const t of termineAm(iso)) {
      termine += 1;
      const b = minuten(t.von);
      const e = minuten(t.bis);
      if (t.ganztaegig || b === null) {
        kopf.get(iso)!.push({ text: t.titel, farbe: "#6366f1" });
        continue;
      }
      bloecke.get(iso)!.push({ key: `${t.id}-${iso}`, von: b, bis: e !== null && e > b ? e : Math.min(1440, b + 60), farbe: "#6366f1", titel: t.titel, unter: t.von, termin: true });
    }
  }

  return (
    <div className="space-y-3" data-woche-spalten>
      <section className="glas overflow-hidden rounded-[20px] pb-2">
        {/* Kopf: Tag, Datum, ganztägige Einträge */}
        <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] gap-x-0.5 px-1 pt-2">
          <span />
          {woche.map((iso, i) => {
            const istHeute = iso === heute;
            const feiertag = feiertagVon(iso);
            return (
              <button key={iso} type="button" onClick={() => onTag(iso)} className="flex min-w-0 flex-col items-center gap-1" data-woche-tag={iso}>
                <span className={cn("w-full rounded-[10px] py-0.5 text-center", istHeute && "bg-ink text-surface")}>
                  <span className={cn("block text-[10.5px] font-medium", istHeute ? "opacity-80" : feiertag ? "text-crit-fg" : "text-ink-muted")}>{KURZ[i]}</span>
                  <span className="tnum block text-[15px] font-bold leading-tight">{Number(iso.slice(8))}</span>
                </span>
                <span className="flex min-h-[18px] w-full flex-col gap-0.5">
                  {kopf.get(iso)!.slice(0, 2).map((k, j) => (
                    <span
                      key={j}
                      className={cn("block truncate rounded-[6px] px-0.5 text-center text-[9.5px] font-bold leading-[16px]", !k.farbe && "border border-line text-ink-muted")}
                      style={k.farbe ? { backgroundColor: k.farbe, color: textFarbe(k.farbe) } : undefined}
                    >
                      {k.text}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Zeitraster */}
        <div className="relative mx-1 mt-1" style={{ height: 24 * PX }}>
          {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
            <div key={h} className="pointer-events-none absolute inset-x-0" style={{ top: h * PX }}>
              <span className="tnum absolute left-0 -translate-y-1/2 text-[9.5px] text-ink-faint">{String(h).padStart(2, "0")}</span>
              <span className="absolute left-[28px] right-0 border-t border-line" />
            </div>
          ))}
          <div className="absolute bottom-0 left-[28px] right-0 top-0 grid grid-cols-7 gap-x-0.5">
            {woche.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => onTag(iso)}
                aria-label={`${Number(iso.slice(8))}. öffnen`}
                className={cn("relative h-full rounded-[6px]", iso === heute && "bg-brand-500/[0.06]")}
              >
                {bloecke.get(iso)!.map((b) => (
                  <span
                    key={b.key}
                    className={cn("absolute inset-x-0 overflow-hidden rounded-[6px] px-0.5 text-left leading-tight", b.termin ? "border-l-2" : "")}
                    style={{
                      top: (b.von / 60) * PX,
                      height: Math.max(12, ((b.bis - b.von) / 60) * PX - 1),
                      backgroundColor: b.termin ? `${b.farbe}26` : b.farbe,
                      color: b.termin ? "rgb(var(--c-ink))" : textFarbe(b.farbe),
                      borderColor: b.termin ? b.farbe : undefined,
                      zIndex: b.termin ? 2 : 1,
                    }}
                  >
                    <span className="block truncate text-[10.5px] font-extrabold">{b.titel}</span>
                    {(b.bis - b.von) / 60 >= 2 ? <span className="block truncate text-[8.5px] font-medium opacity-90">{b.unter}</span> : null}
                  </span>
                ))}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="glas flex items-center justify-between gap-3 rounded-[18px] px-4 py-3" data-woche-summe>
        <span className="text-[14.5px] font-semibold">
          {schichten} {schichten === 1 ? "Schicht" : "Schichten"}
          {termine ? <span className="font-normal text-ink-muted"> · {termine} {termine === 1 ? "Termin" : "Termine"}</span> : null}
        </span>
        <span className="tnum text-[16px] font-bold">{std(stunden)} Std</span>
      </section>
    </div>
  );
}
