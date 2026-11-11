"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { termineAm, type Termin } from "@/components/kalender/termine";
import { fetchMeineTermine } from "@/lib/data/partner";
import { addDays, fromISO, toISO } from "@/lib/dates";
import { idsVon, ladeFeiertage, ladeTage, textFarbe, type Schichtart, type TagEintrag } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { mitBetrieb, useBetriebsschichten } from "./betrieb";
import { usePrivat } from "./kontext";

/**
 * Kalender als PDF: Jahreskalender in drei Darstellungen und eine Monatsansicht,
 * je ein Blatt A4 quer. Ohne zusätzliche Bibliothek – die Seite wird über den
 * Druckdialog des Geräts gedruckt oder als PDF gesichert. Nur eigene Daten
 * (eigene Schichten, eigene Termine, Feiertage).
 */

type Art = "a" | "b" | "c" | "monat";
const ARTEN: [Art, string, string][] = [
  ["a", "Jahr · schlicht", "Farbpunkt und Name, Wochenende grau"],
  ["b", "Jahr · farbig", "Jeder Tag in der Schichtfarbe"],
  ["c", "Jahr · kompakt", "Monate als Zeilen, mit Summen"],
  ["monat", "Monat", "Ein Monat groß, mit Terminen"],
];
const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MON_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_MO = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
/** Bedruckbare Fläche: A4 quer mit 10 mm Rand. */
const BLATT_MM = { b: 277, h: 190 };
const MM = 96 / 25.4;

interface Tag {
  iso: string;
  d: number;
  wt: number;
  we: boolean;
  feiertag?: string;
  arten: Schichtart[];
  termine: Termin[];
}

export function KalenderExport() {
  const router = useRouter();
  const { konto, betrieb, artNach, schichtarten } = usePrivat();
  const heute = new Date();
  const [jahr, setJahr] = useState(heute.getFullYear());
  const [monat, setMonat] = useState(heute.getMonth());
  const [art, setArt] = useState<Art>("b");
  const [mitTerminen, setMitTerminen] = useState(true);
  const [tage, setTage] = useState<Record<string, TagEintrag> | null>(null);
  const [feiertage, setFeiertage] = useState<Record<string, string>>({});
  const [termine, setTermine] = useState<Termin[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;
  const betriebSchichten = useBetriebsschichten(konto.userId, !!betrieb, von, bis);

  useEffect(() => {
    let aktuell = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTage(null);
    Promise.all([ladeTage(von, bis), ladeFeiertage(jahr)])
      .then(([t, f]) => {
        if (!aktuell) return;
        setTage(t);
        setFeiertage(Object.fromEntries(f.map((h) => [h.tag, h.name])));
        setFehler(null);
      })
      .catch((e: unknown) => aktuell && setFehler(e instanceof Error ? e.message : "Der Kalender konnte nicht geladen werden."));
    return () => {
      aktuell = false;
    };
  }, [jahr, von, bis]);

  useEffect(() => {
    // Nur eigene Termine – nichts von Partner, Familie oder verbundenen Konten.
    fetchMeineTermine()
      .then((t) => setTermine(t.filter((x) => !x.vonPartner && !x.inhaber)))
      .catch(() => undefined);
  }, []);

  // Vorschau passt sich der Bildschirmbreite an; gedruckt wird immer in voller Größe.
  useEffect(() => {
    const messen = () => setZoom(Math.min(1, (window.innerWidth - 24) / (BLATT_MM.b * MM)));
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  const alleTage = useMemo(() => mitBetrieb(tage ?? {}, betriebSchichten), [tage, betriebSchichten]);
  const alleArten = useMemo(
    () => (betriebSchichten.arten.size ? new Map([...artNach, ...betriebSchichten.arten]) : artNach),
    [artNach, betriebSchichten.arten],
  );

  const tag = (m: number, d: number): Tag | null => {
    const dt = new Date(jahr, m, d);
    if (dt.getMonth() !== m) return null;
    const iso = toISO(dt);
    return {
      iso,
      d,
      wt: dt.getDay(),
      we: dt.getDay() % 6 === 0,
      feiertag: konto.feiertageZeigen ? feiertage[iso] : undefined,
      arten: idsVon(alleTage[iso])
        .map((id) => alleArten.get(id))
        .filter((a): a is Schichtart => !!a),
      termine: mitTerminen ? termineAm(termine, iso) : [],
    };
  };

  /** Schichtarten, die im Zeitraum vorkommen – für die Legende. */
  const legende = useMemo(() => {
    const ids = new Set<string>();
    for (const [iso, e] of Object.entries(alleTage)) {
      if (!iso.startsWith(`${jahr}-`)) continue;
      if (art === "monat" && fromISO(iso).getMonth() !== monat) continue;
      for (const id of idsVon(e)) ids.add(id);
    }
    return [...ids].map((id) => alleArten.get(id)).filter((a): a is Schichtart => !!a);
  }, [alleTage, alleArten, jahr, art, monat]);

  const titel = art === "monat" ? `${MON_LANG[monat]} ${jahr}` : String(jahr);
  const bereit = tage !== null && schichtarten !== null;

  return (
    <div className="druck-seite fixed inset-0 z-[70] flex flex-col bg-[#eef0f4] text-[#111]">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .druck-blatt, .druck-blatt * { visibility: visible !important; }
          .druck-seite { position: static !important; background: #fff !important; }
          .druck-rahmen { overflow: visible !important; padding: 0 !important; }
          .druck-blatt { position: fixed !important; left: 0; top: 0; zoom: 1 !important; box-shadow: none !important; margin: 0 !important; }
        }
        .druck-blatt { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="flex shrink-0 flex-col gap-2 border-b border-black/10 bg-white px-3 pb-2.5 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()} aria-label="Zurück" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06]">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">Kalender als PDF</h1>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!bereit}
            data-export-drucken
            className="flex h-10 items-center gap-1.5 rounded-full bg-[#2F5BEA] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> Drucken / PDF
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {ARTEN.map(([id, name]) => (
            <button
              key={id}
              type="button"
              aria-pressed={art === id}
              onClick={() => setArt(id)}
              className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold", art === id ? "bg-[#111] text-white" : "bg-black/[0.06]")}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
          <label className="flex items-center gap-1.5">
            Jahr
            <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))} className="h-9 rounded-lg bg-black/[0.06] px-2 font-semibold">
              {[-1, 0, 1, 2].map((v) => (
                <option key={v}>{heute.getFullYear() + v}</option>
              ))}
            </select>
          </label>
          {art === "monat" ? (
            <label className="flex items-center gap-1.5">
              Monat
              <select value={monat} onChange={(e) => setMonat(Number(e.target.value))} className="h-9 rounded-lg bg-black/[0.06] px-2 font-semibold">
                {MON_LANG.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={mitTerminen} onChange={(e) => setMitTerminen(e.target.checked)} className="h-4 w-4" />
            Eigene Termine
          </label>
          <span className="text-black/50">{ARTEN.find((a) => a[0] === art)?.[2]}</span>
        </div>
      </div>

      <div className="druck-rahmen min-h-0 flex-1 overflow-auto p-3">
        {fehler ? <p className="text-[14px] text-red-700">{fehler}</p> : null}
        {!bereit && !fehler ? <p className="text-[14px] text-black/60">Kalender wird geladen …</p> : null}
        {bereit ? (
          <div
            className="druck-blatt mx-auto flex flex-col bg-white shadow-[0_6px_30px_rgba(0,0,0,0.15)]"
            data-export-blatt={art}
            style={{ width: `${BLATT_MM.b}mm`, height: `${BLATT_MM.h}mm`, zoom, font: "9px system-ui, -apple-system, Arial, sans-serif" }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{titel}</span>
              <span style={{ fontSize: 12, color: "#555", flex: 1 }}>{konto.name}</span>
              <span style={{ fontSize: 11, color: "#999" }}>ShiftNexo</span>
            </div>
            {art === "monat" ? <MonatBlatt jahr={jahr} monat={monat} tag={tag} /> : art === "c" ? <JahrKompakt tag={tag} legende={legende} /> : <JahrSpalten farbig={art === "b"} tag={tag} />}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, fontSize: 9.5, color: "#333" }}>
              {legende.map((a) => (
                <span key={a.id}>
                  <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: a.farbe, marginRight: 3, verticalAlign: -1 }} />
                  {a.name}
                </span>
              ))}
              {mitTerminen && art !== "monat" ? <span style={{ color: "#c0392b" }}>● Termin</span> : null}
            </div>
          </div>
        ) : null}
        <p className="mx-auto mt-3 max-w-md text-center text-[12.5px] text-black/55">
          Im Druckfenster „Als PDF sichern“ wählen – auf dem iPhone: Drucken antippen, dann die Vorschau mit zwei Fingern aufziehen und teilen.
        </p>
      </div>
    </div>
  );
}

/** Montag der ersten Woche und Anzahl der Wochen eines Monats. */
function monatRaster(jahr: number, monat: number) {
  const erster = new Date(jahr, monat, 1);
  const versatz = (erster.getDay() + 6) % 7;
  const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
  return { start: toISO(new Date(jahr, monat, 1 - versatz)), wochen: Math.ceil((versatz + tageImMonat) / 7) };
}

type TagVon = (m: number, d: number) => Tag | null;
const TAGE31 = Array.from({ length: 31 }, (_, i) => i + 1);

/** Entwurf A (schlicht) und B (farbig): zwölf Spalten, je Tag eine Zeile. */
function JahrSpalten({ farbig, tag }: { farbig: boolean; tag: TagVon }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6, flex: 1, minHeight: 0 }}>
      {MON.map((name, m) => (
        <div key={name} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, borderBottom: "1.5px solid #111", paddingBottom: 1, marginBottom: 2 }}>{name}</div>
          {TAGE31.map((d) => {
            const t = tag(m, d);
            if (!t) return <div key={d} style={{ flex: 1 }} />;
            const a = t.arten[0];
            const frei = t.we || !!t.feiertag;
            const bg = farbig && a ? a.farbe : !farbig && frei ? "#ececec" : farbig ? "#f6f6f7" : undefined;
            return (
              <div
                key={d}
                title={t.feiertag}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "0 3px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  background: bg,
                  color: farbig && a ? textFarbe(a.farbe) : "#111",
                  borderBottom: farbig ? "1.5px solid #fff" : "1px solid #d4d4d4",
                  borderRadius: farbig ? 3 : 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, width: 12, textDecoration: farbig && frei ? "underline" : undefined, color: !farbig && t.feiertag ? "#c0392b" : undefined }}>{t.d}</span>
                <span style={{ fontSize: 6.5, opacity: 0.65, width: 9 }}>{WT[t.wt]}</span>
                {!farbig && a ? <i style={{ width: 7, height: 7, borderRadius: "50%", background: a.farbe, flex: "none" }} /> : null}
                <span style={{ fontSize: 8, fontWeight: farbig ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.arten.map((x) => x.name).join(" + ")}
                </span>
                {t.termine.length ? <span style={{ fontSize: 7, color: "#c0392b" }}>●</span> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Entwurf C: Monate als Zeilen, Tage als Spalten, rechts die Summen je Schicht. */
function JahrKompakt({ tag, legende }: { tag: TagVon; legende: Schichtart[] }) {
  const zelle: React.CSSProperties = { borderRadius: 3, textAlign: "center", fontWeight: 700, fontSize: 10 };
  return (
    <table style={{ borderCollapse: "separate", borderSpacing: 2, width: "100%", flex: 1, tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ width: 34 }} />
          {TAGE31.map((d) => (
            <th key={d} style={{ fontSize: 9, fontWeight: 600, color: "#555" }}>
              {d}
            </th>
          ))}
          <th style={{ width: 150, fontSize: 9, fontWeight: 600, color: "#555", textAlign: "left" }}>Summe</th>
        </tr>
      </thead>
      <tbody>
        {MON.map((name, m) => {
          const zahl = new Map<string, number>();
          return (
            <tr key={name}>
              <th style={{ textAlign: "left", fontSize: 12 }}>{name}</th>
              {TAGE31.map((d) => {
                const t = tag(m, d);
                if (!t) return <td key={d} style={{ ...zelle, background: "repeating-linear-gradient(45deg,#f1f1f1 0 3px,#fff 3px 6px)" }} />;
                for (const a of t.arten) zahl.set(a.id, (zahl.get(a.id) ?? 0) + 1);
                const a = t.arten[0];
                return (
                  <td
                    key={d}
                    style={{
                      ...zelle,
                      background: a?.farbe ?? "#f4f4f5",
                      color: a ? textFarbe(a.farbe) : "#111",
                      boxShadow: t.we || t.feiertag ? "inset 0 -3px 0 rgba(0,0,0,.35)" : undefined,
                      outline: t.termine.length ? "1.5px solid #c0392b" : undefined,
                      outlineOffset: -1.5,
                    }}
                  >
                    {a?.kuerzel ?? ""}
                  </td>
                );
              })}
              <td style={{ fontSize: 9, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden" }}>
                {legende
                  .filter((a) => zahl.get(a.id))
                  .map((a) => (
                    <span key={a.id} style={{ marginRight: 6 }}>
                      <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: a.farbe, marginRight: 2, verticalAlign: -1 }} />
                      {zahl.get(a.id)}
                    </span>
                  ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Monatsansicht: ein Monat groß, mit Schichten und Terminen. */
function MonatBlatt({ jahr, monat, tag }: { jahr: number; monat: number; tag: TagVon }) {
  const { start, wochen } = monatRaster(jahr, monat);
  const liste = Array.from({ length: wochen * 7 }, (_, i) => fromISO(addDays(start, i)));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `auto repeat(${wochen}, 1fr)`, flex: 1, minHeight: 0, border: "1px solid #bbb", borderRadius: 6, overflow: "hidden" }}>
      {WT_MO.map((w, i) => (
        <div key={w} style={{ fontSize: 11, fontWeight: 700, padding: "3px 6px", background: i >= 5 ? "#e9e9ec" : "#f4f4f6", borderBottom: "1px solid #bbb" }}>
          {w}
        </div>
      ))}
      {liste.map((dt, i) => {
        const t = dt.getMonth() === monat ? tag(monat, dt.getDate()) : null;
        return (
          <div
            key={i}
            style={{
              borderTop: i >= 7 ? "1px solid #ccc" : undefined,
              borderLeft: i % 7 ? "1px solid #ccc" : undefined,
              padding: 4,
              minHeight: 0,
              overflow: "hidden",
              background: !t ? "#fafafa" : t.we || t.feiertag ? "#f3f3f5" : undefined,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: !t ? "#bbb" : t.feiertag ? "#c0392b" : "#111" }}>{dt.getDate()}</span>
              {t?.feiertag ? <span style={{ fontSize: 7.5, color: "#c0392b", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.feiertag}</span> : null}
            </div>
            {t?.arten.map((a) => (
              <div key={a.id} style={{ background: a.farbe, color: textFarbe(a.farbe), borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.name}
                {a.beginn && a.ende ? <span style={{ fontWeight: 400, marginLeft: 4, fontSize: 8.5 }}>{a.beginn}–{a.ende}</span> : null}
              </div>
            ))}
            {t?.termine.slice(0, 3).map((x) => (
              <div key={x.id} style={{ fontSize: 8.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#333" }}>
                <span style={{ color: "#c0392b" }}>● </span>
                {!x.ganztaegig && x.von ? `${x.von} ` : ""}
                {x.titel || "Termin"}
              </div>
            ))}
            {t && t.termine.length > 3 ? <div style={{ fontSize: 8, color: "#777" }}>+{t.termine.length - 3} mehr</div> : null}
          </div>
        );
      })}
    </div>
  );
}
