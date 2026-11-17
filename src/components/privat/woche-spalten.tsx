"use client";

import { useRef, useState } from "react";
import type { Termin } from "@/components/kalender/termine";
import { addDays, tageAbstand } from "@/lib/dates";
import { idsVon, istAbwesenheit, tagZeitSchluessel, textFarbe, type Schichtart, type TagEintrag, type TagZeit } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";

/**
 * Woche als Zeitraster: 7 Spalten, 0–24 Uhr, füllt die ganze Höhe. Schichten
 * als farbige Blöcke an ihrer Uhrzeit (Nachtschichten laufen in den nächsten
 * Tag), Termine als kleine Blöcke; was sich überschneidet, steht nebeneinander.
 * Was keine Uhrzeit hat (Frei, Urlaub, ganztägige Termine), steht als Block
 * von 8 bis 16 Uhr im Raster.
 *
 * - Tippen: Tag öffnen (mit Pinsel: Schicht eintragen; halten und ziehen: mehrere Tage)
 * - Lange in ein freies Feld drücken: neuer Termin zu dieser Uhrzeit
 * - Termin oder eigene Schicht halten und ziehen: anderer Tag / andere Uhrzeit
 *   (Schichten ohne Uhrzeit nur auf einen anderen Tag)
 */

/** Uhrzeit für Ereignisse (außerhalb des Renderns). */
const jetzt = () => Date.now();
const KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const HALTEN_MS = 450;
const minuten = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const uhr = (t: string) => (t.endsWith(":00") ? t.slice(0, 2) : t.slice(0, 5));
/** Standardzeit für Ganztägiges im Raster: 8–16 Uhr. */
const GANZ_VON = 8 * 60;
const GANZ_BIS = 16 * 60;

type Zug =
  | { art: "termin"; termin: Termin; titel: string; farbe: string; iso: string; quelle: string; von: number; dauer: number; griff: number }
  | { art: "schicht"; schicht: Eigen; titel: string; farbe: string; iso: string; von: number; dauer: number; start: number; griff: number };

/** Eigene Schicht (nicht aus dem Betrieb): Id, der Tag, an dem sie steht, und ob sie eine Uhrzeit hat. */
interface Eigen {
  id: string;
  tag: string;
  zeitbar: boolean;
}

interface Block {
  key: string;
  von: number;
  bis: number;
  farbe: string;
  titel: string;
  unter: string;
  termin: Termin | null;
  schicht: Eigen | null;
  /** ohne Uhrzeit – steht als 8–16 Uhr im Raster */
  ganz: boolean;
  /** Frei: nur umrandet */
  leer?: boolean;
  /** ganztägiger Termin über einer Schicht – deckend obenauf */
  vorn?: boolean;
  /** Lage in der Spalte in Prozent und Ebene (Ganztägiges hinten, Termine vorn). */
  links: number;
  breite: number;
  ebene: number;
}

type Roh = Omit<Block, "links" | "breite" | "ebene">;
const ueberlappt = (a: { von: number; bis: number }, b: { von: number; bis: number }) => a.von < b.bis && b.von < a.bis;

/**
 * Anordnung in einer Tagesspalte (Entwurf A):
 * - Ganztägiges (Frei, Urlaub, ganztägige Termine) liegt als zarter
 *   Hintergrund über die volle Breite und nimmt keinen Platz weg.
 * - Schichten nutzen die volle Breite; nur wenn sich zwei Schichten
 *   überschneiden (Nacht vom Vortag + Früh), teilen sie sich die Spalte.
 * - Termine legen sich darüber – über einer Schicht leicht nach rechts
 *   versetzt, mehrere Termine stufenweise, so bleibt alles lesbar.
 */
function anordnen(liste: Roh[]): Block[] {
  const aus: Block[] = [];
  const ganz = liste.filter((b) => b.ganz);
  const schichten = liste.filter((b) => !b.ganz && !b.termin).sort((a, b) => a.von - b.von || b.bis - a.bis);
  const termine = liste.filter((b) => !b.ganz && b.termin).sort((a, b) => a.von - b.von || b.bis - a.bis);
  // Mehrere ganztägige Einträge teilen sich das 8–16-Uhr-Band übereinander –
  // so liegt keine Schrift auf der anderen. Feste Reihenfolge, damit ein
  // mehrtägiger Termin an jedem Tag an derselben Stelle steht.
  ganz.sort((a, b) => Number(!!a.termin) - Number(!!b.termin) || (a.termin?.datum ?? "").localeCompare(b.termin?.datum ?? "") || a.titel.localeCompare(b.titel));
  const scheibe = (GANZ_BIS - GANZ_VON) / Math.max(1, ganz.length);
  ganz.forEach((g, k) => {
    const lage = { von: Math.round(GANZ_VON + k * scheibe), bis: Math.round(GANZ_VON + (k + 1) * scheibe) };
    // Ganztägige Termine dürfen nicht hinter einer Schicht verschwinden:
    // dann liegen sie wie ein Termin leicht versetzt obenauf.
    const vorn = !!g.termin && schichten.some((sch) => ueberlappt(sch, lage));
    aus.push({ ...g, ...lage, links: vorn ? 30 : 0, breite: vorn ? 70 : 100, ebene: vorn ? 2 : 0, vorn });
  });
  // Schichten: Spuren nur bei echter Überschneidung.
  const spurVon: { b: Roh; spur: number }[] = [];
  for (const sch of schichten) {
    const belegt = new Set(spurVon.filter((x) => ueberlappt(x.b, sch)).map((x) => x.spur));
    let spur = 0;
    while (belegt.has(spur)) spur++;
    spurVon.push({ b: sch, spur });
  }
  for (const { b: sch, spur } of spurVon) {
    const n = Math.max(1, ...spurVon.filter((x) => ueberlappt(x.b, sch)).map((x) => x.spur + 1));
    aus.push({ ...sch, links: (spur / n) * 100, breite: 100 / n, ebene: 1 });
  }
  const gesetzt: Roh[] = [];
  for (const t of termine) {
    const ueberSchicht = schichten.some((sch) => ueberlappt(sch, t));
    const stufe = gesetzt.filter((x) => ueberlappt(x, t)).length;
    const links = Math.min((ueberSchicht ? 30 : 0) + stufe * 18, 62);
    aus.push({ ...t, links, breite: 100 - links, ebene: 2 + stufe });
    gesetzt.push(t);
  }
  return aus;
}

export function WochenSpalten({
  von,
  heute,
  tage,
  zeiten,
  artNach,
  termineAm,
  feiertagVon,
  markiert,
  pinsel = false,
  darfVerschieben,
  onTag,
  onNeu,
  onVerschieben,
  onSchichtVerschieben,
  onWoche,
}: {
  /** Montag der Woche */
  von: string;
  heute: string;
  tage: Record<string, TagEintrag>;
  /** andere Uhrzeit an einzelnen Tagen (Schlüssel tag|schichtartId) */
  zeiten: Record<string, TagZeit>;
  artNach: Map<string, Schichtart>;
  termineAm: (iso: string) => Termin[];
  feiertagVon: (iso: string) => string | undefined;
  /** Tage im laufenden Pinsel-Strich */
  markiert?: ReadonlySet<string>;
  /** Pinsel an: Halten malt (siehe Kalender), keine Termine per Halten. */
  pinsel?: boolean;
  darfVerschieben: (t: Termin) => boolean;
  onTag: (iso: string) => void;
  onNeu: (iso: string, zeit: string) => void;
  onVerschieben: (t: Termin, datum: string, von: string, bis: string, ganztaegig: boolean) => void;
  /** Eigene Schicht auf einen anderen Tag legen; zeit = neue Uhrzeit an dem Tag (undefined = wie bisher). */
  onSchichtVerschieben: (id: string, von: string, nach: string, zeit?: TagZeit) => void;
  /** Zur Seite wischen: +1 nächste Woche, -1 vorherige. Ohne: kein Wischen hier. */
  onWoche?: (richtung: 1 | -1) => void;
}) {
  const raster = useRef<HTMLDivElement>(null);
  const druck = useRef<{ uhr: number | null; x: number; y: number; id: number } | null>(null);
  // Was gerade gezogen wird – als Ref (Fingerbewegung kommt schneller als das Neuzeichnen) und als State (Anzeige).
  const zug = useRef<Zug | null>(null);
  const [ziehen, setZiehenState] = useState<Zug | null>(null);
  const setZiehen = (z: Zug | null) => {
    zug.current = z;
    setZiehenState(z);
  };
  const schlucken = useRef(0);

  // Wischen zur nächsten Woche: Tage und Spalten folgen dem Finger, dann gleitet
  // die neue Woche von der Seite herein. Die Stundenleiste bleibt stehen.
  const kopf = useRef<HTMLDivElement>(null);
  const wisch = useRef<{ x: number; y: number; t: number; aktiv: boolean; id: number } | null>(null);
  const verschieben = (x: number, dauer: number, mitBlende = true) => {
    for (const el of [kopf.current, raster.current]) {
      if (!el) continue;
      el.style.transition = dauer ? `transform ${dauer}ms cubic-bezier(0.22, 0.8, 0.3, 1), opacity ${dauer}ms ease-out` : "none";
      el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
      el.style.opacity = mitBlende && x ? String(Math.max(0.35, 1 - Math.abs(x) / (el.offsetWidth * 1.4))) : "";
    }
  };
  const wischGriffe = {
        onPointerDown: (e: React.PointerEvent) => {
          if (!onWoche || (e.pointerType === "mouse" && e.button !== 0)) return;
          wisch.current = { x: e.clientX, y: e.clientY, t: jetzt(), aktiv: false, id: e.pointerId };
        },
        onPointerMove: (e: React.PointerEvent) => {
          const w = wisch.current;
          if (!w || zug.current) return;
          // Kein Finger/keine Taste mehr unten (das Loslassen ging an das Ziehen): vergessen.
          if (e.pointerId !== w.id || (e.pointerType === "mouse" && e.buttons === 0)) {
            wisch.current = null;
            return;
          }
          const dx = e.clientX - w.x;
          const dy = e.clientY - w.y;
          if (!w.aktiv) {
            if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
            w.aktiv = true;
            loslassen();
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              // egal
            }
          }
          verschieben(dx, 0);
        },
        onPointerUp: (e: React.PointerEvent) => {
          const w = wisch.current;
          wisch.current = null;
          if (!w?.aktiv || !onWoche) return;
          e.stopPropagation();
          schlucken.current = jetzt();
          const breite = raster.current?.offsetWidth ?? 300;
          const dx = e.clientX - w.x;
          const tempo = Math.abs(dx) / Math.max(1, jetzt() - w.t);
          if (Math.abs(dx) < breite * 0.22 && tempo < 0.45) {
            verschieben(0, 220);
            return;
          }
          const richtung: 1 | -1 = dx < 0 ? 1 : -1;
          verschieben(-richtung * breite, 170);
          window.setTimeout(() => {
            onWoche(richtung);
            // Neue Woche steht auf der anderen Seite bereit und gleitet herein.
            verschieben(richtung * breite * 0.6, 0);
            requestAnimationFrame(() => requestAnimationFrame(() => verschieben(0, 260)));
          }, 170);
        },
        onPointerCancel: () => {
          if (wisch.current?.aktiv) verschieben(0, 200);
          wisch.current = null;
        },
      };

  const woche = Array.from({ length: 7 }, (_, i) => addDays(von, i));
  const artenAm = (iso: string) =>
    idsVon(tage[iso])
      .map((id) => artNach.get(id))
      .filter((a): a is Schichtart => !!a);

  const roh = new Map<string, Roh[]>(woche.map((iso) => [iso, []]));
  const zeitVon = (iso: string, a: Schichtart) => zeiten[tagZeitSchluessel(iso, a.id)] ?? { beginn: a.beginn, ende: a.ende };

  // Vortag mitnehmen: eine Nachtschicht vom Sonntag davor reicht in den Montag.
  for (const iso of [addDays(von, -1), ...woche]) {
    const arten = artenAm(iso);
    const abwesend = arten.some((a) => istAbwesenheit(a));
    const imBereich = roh.has(iso);
    for (const a of arten) {
      const z = zeitVon(iso, a);
      const b = minuten(z.beginn);
      const e = minuten(z.ende);
      const eigen = !a.id.startsWith("betrieb:");
      const titel = a.kuerzel || a.name.slice(0, 1);
      // Urlaub/Krank ersetzen die Arbeitsschicht an dem Tag.
      if (abwesend && a.art === "arbeit") continue;
      if (b === null || e === null || a.art !== "arbeit") {
        if (imBereich) {
          roh.get(iso)!.push({
            key: `${a.id}-g`,
            von: GANZ_VON,
            bis: GANZ_BIS,
            farbe: a.farbe,
            titel: a.kuerzel || a.name,
            unter: a.name,
            termin: null,
            schicht: eigen ? { id: a.id, tag: iso, zeitbar: false } : null,
            ganz: true,
            leer: a.art === "frei",
          });
        }
        continue;
      }
      const ueber = e <= b;
      const schicht = eigen ? { id: a.id, tag: iso, zeitbar: true } : null;
      if (imBereich) roh.get(iso)!.push({ key: `${a.id}-a`, von: b, bis: ueber ? 1440 : e, farbe: a.farbe, titel, unter: `${uhr(z.beginn)}–${uhr(z.ende)}`, termin: null, schicht, ganz: false });
      const naechster = addDays(iso, 1);
      if (ueber && e > 0 && roh.has(naechster)) {
        roh.get(naechster)!.push({ key: `${a.id}-b-${iso}`, von: 0, bis: e, farbe: a.farbe, titel, unter: `–${uhr(z.ende)}`, termin: null, schicht, ganz: false });
      }
    }
  }
  for (const iso of woche) {
    for (const t of termineAm(iso)) {
      const b = minuten(t.von);
      const e = minuten(t.bis);
      if (t.ganztaegig || b === null) {
        roh.get(iso)!.push({ key: `${t.id}-${iso}`, von: GANZ_VON, bis: GANZ_BIS, farbe: "#6366f1", titel: t.titel, unter: "ganztägig", termin: t, schicht: null, ganz: true });
        continue;
      }
      roh.get(iso)!.push({ key: `${t.id}-${iso}`, von: b, bis: e !== null && e > b ? e : Math.min(1440, b + 60), farbe: "#6366f1", titel: t.titel, unter: t.von, termin: t, schicht: null, ganz: false });
    }
  }
  const bloecke = new Map(woche.map((iso) => [iso, anordnen(roh.get(iso)!)]));

  /** Tag und Uhrzeit (auf 15 Minuten) unter dem Finger. */
  function stelle(x: number, y: number): { iso: string; min: number } | null {
    const el = raster.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const spalte = Math.floor(((x - r.left) / r.width) * 7);
    if (spalte < 0 || spalte > 6) return null;
    const min = Math.round((Math.min(Math.max(0, y - r.top), r.height) / r.height) * 1440 / 15) * 15;
    return { iso: woche[spalte]!, min: Math.min(min, 1425) };
  }

  function loslassen() {
    const d = druck.current;
    if (d?.uhr) window.clearTimeout(d.uhr);
    druck.current = null;
  }

  const rasterGriffe = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const ziel = e.target as Element;
      const terminEl = ziel.closest<HTMLElement>("[data-termin-id]");
      const termin = terminEl ? (termineAm(terminEl.dataset.tag!).find((t) => t.id === terminEl.dataset.terminId) ?? null) : null;
      const schichtEl = terminEl ? null : ziel.closest<HTMLElement>("[data-schicht-block]");
      const schicht: Eigen | null = schichtEl?.dataset.schichtId ? { id: schichtEl.dataset.schichtId, tag: schichtEl.dataset.tag!, zeitbar: schichtEl.dataset.zeitbar === "1" } : null;
      const art = schicht ? artNach.get(schicht.id) : undefined;
      loslassen();
      const d = { uhr: null as number | null, x: e.clientX, y: e.clientY, id: e.pointerId };
      const flaeche = e.currentTarget as HTMLElement;
      d.uhr = window.setTimeout(() => {
        d.uhr = null;
        if (druck.current !== d) return;
        try {
          navigator.vibrate?.(10);
        } catch {
          // ohne Vibration
        }
        const s = stelle(d.x, d.y);
        if (!s) return;
        wisch.current = null;
        // Ab jetzt gehört der Finger dem Ziehen – auch wenn er die Spalte verlässt.
        try {
          flaeche.setPointerCapture(d.id);
        } catch {
          // egal
        }
        if (termin) {
          if (!darfVerschieben(termin)) return loslassen();
          const ganz = termin.ganztaegig || minuten(termin.von) === null;
          const b = ganz ? GANZ_VON : (minuten(termin.von) ?? 0);
          const ende = ganz ? GANZ_BIS : minuten(termin.bis);
          const quelle = terminEl!.dataset.tag!;
          setZiehen({ art: "termin", termin, titel: termin.titel, farbe: "#6366f1", iso: quelle, quelle, von: b, griff: s.min - b, dauer: ende !== null && ende > b ? ende - b : 60 });
        } else if (schicht && art) {
          const z = zeitVon(schicht.tag, art);
          const b = schicht.zeitbar ? (minuten(z.beginn) ?? 0) : GANZ_VON;
          const ende = schicht.zeitbar ? (minuten(z.ende) ?? b + 480) : GANZ_BIS;
          setZiehen({ art: "schicht", schicht, titel: art.kuerzel || art.name, farbe: art.farbe, iso: schicht.tag, von: b, start: b, griff: s.min - b, dauer: ende > b ? ende - b : ende + 1440 - b });
        } else if (!schichtEl) {
          druck.current = null;
          schlucken.current = jetzt();
          onNeu(s.iso, hhmm(Math.floor(s.min / 30) * 30));
        } else {
          loslassen();
        }
      }, HALTEN_MS);
      druck.current = d;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = druck.current;
      if (!d) return;
      const z = zug.current;
      if (z) {
        e.preventDefault();
        e.stopPropagation();
        const s = stelle(e.clientX, e.clientY);
        if (!s) return;
        // Schichten ohne Uhrzeit wechseln nur den Tag, alles andere auch die Uhrzeit.
        // Der Block bleibt dort am Finger, wo man ihn gepackt hat.
        const neuVon = Math.max(0, Math.min(Math.round((s.min - z.griff) / 15) * 15, 1440 - Math.min(z.dauer, 1440)));
        // Mehrtägige Termine und Schichten ohne Uhrzeit wechseln nur den Tag.
        const nurTag = (z.art === "schicht" && !z.schicht.zeitbar) || (z.art === "termin" && !!z.termin.bisDatum);
        if (z.iso === s.iso && (nurTag || z.von === neuVon)) return;
        setZiehen(nurTag ? { ...z, iso: s.iso } : { ...z, iso: s.iso, von: neuVon });
        return;
      }
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) loslassen();
    },
    onPointerUp: (e: React.PointerEvent) => {
      const z = zug.current;
      if (z) {
        // Nicht als Wischen zur nächsten Woche weiterreichen.
        e.stopPropagation();
        schlucken.current = jetzt();
        setZiehen(null);
        druck.current = null;
        if (z.art === "termin") {
          const neuVon = Math.max(0, Math.min(z.von, 1440 - 15));
          const warGanz = z.termin.ganztaegig || minuten(z.termin.von) === null;
          // Um so viele Tage verschieben, wie der Finger gewandert ist (zählt auch bei mehrtägigen).
          const datum = addDays(z.termin.datum, tageAbstand(z.quelle, z.iso));
          const gleich = datum === z.termin.datum && (warGanz ? neuVon === GANZ_VON : hhmm(neuVon) === z.termin.von.slice(0, 5));
          if (gleich) return;
          // Ganztägig bleibt ganztägig, solange nur der Tag wechselt.
          if (z.termin.bisDatum || (warGanz && neuVon === GANZ_VON)) onVerschieben(z.termin, datum, z.termin.von, z.termin.bis, z.termin.ganztaegig);
          else onVerschieben(z.termin, datum, hhmm(neuVon), hhmm(Math.min(1439, neuVon + z.dauer)), false);
        } else {
          const zeitNeu = z.schicht.zeitbar && z.von !== z.start ? { beginn: hhmm(z.von), ende: hhmm((z.von + z.dauer) % 1440) } : undefined;
          if (z.iso !== z.schicht.tag || zeitNeu) onSchichtVerschieben(z.schicht.id, z.schicht.tag, z.iso, zeitNeu);
        }
        return;
      }
      loslassen();
    },
    onPointerCancel: () => {
      loslassen();
      setZiehen(null);
    },
  };

  const antippen = (iso: string) => {
    if (jetzt() - schlucken.current < 600) return;
    onTag(iso);
  };

  return (
    // Am Handy bis fast an den Rand – jede Spalte bekommt so ein paar Pixel mehr.
    <div className="-mx-2.5 flex h-full min-h-0 select-none flex-col [-webkit-touch-callout:none] sm:mx-0" data-woche-spalten {...(pinsel ? {} : wischGriffe)}>
      <section className="glas flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] pb-1.5">
        {/* Kopf: Tag und Datum */}
        <div className="grid grid-cols-[18px_minmax(0,1fr)] pr-0.5 pt-2">
          <span />
          <div ref={kopf} className="grid grid-cols-7 gap-x-px will-change-transform">
          {woche.map((iso, i) => {
            const istHeute = iso === heute;
            const feiertag = feiertagVon(iso);
            return (
              <button key={iso} type="button" onClick={() => antippen(iso)} data-iso={iso} className="flex min-w-0 flex-col items-center gap-1" data-woche-tag={iso}>
                <span className={cn("w-full rounded-[10px] py-0.5 text-center transition-colors", istHeute && "bg-ink text-surface", markiert?.has(iso) && "bg-brand-500 text-white")}>
                  <span className={cn("block text-[10.5px] font-medium", istHeute ? "opacity-80" : feiertag ? "text-crit-fg" : "text-ink-muted")}>{KURZ[i]}</span>
                  <span className="tnum block text-[15px] font-bold leading-tight">{Number(iso.slice(8))}</span>
                </span>
              </button>
            );
          })}
          </div>
        </div>

        {/* Zeitraster – füllt die übrige Höhe */}
        <div className="relative mr-0.5 mt-1 min-h-[260px] flex-1">
          {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
            <div key={h} className="pointer-events-none absolute inset-x-0" style={{ top: `${(h / 24) * 100}%` }}>
              <span className="tnum absolute left-0.5 -translate-y-1/2 text-[8.5px] text-ink-faint">{String(h).padStart(2, "0")}</span>
              <span className="absolute left-[18px] right-0 border-t border-line/60" />
            </div>
          ))}
          <div ref={raster} className="absolute bottom-0 left-[18px] right-0 top-0 grid grid-cols-7 gap-x-px touch-none will-change-transform" {...(pinsel ? {} : rasterGriffe)}>
            {woche.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => antippen(iso)}
                data-iso={iso}
                aria-label={`${Number(iso.slice(8))}. öffnen`}
                className={cn(
                  "relative h-full rounded-[6px] transition-colors",
                  iso === heute && "bg-brand-500/[0.06]",
                  markiert?.has(iso) && "bg-brand-500/15",
                )}
              >
                {bloecke.get(iso)!.map((b) => {
                  const wirdGezogen =
                    !!ziehen &&
                    ((ziehen.art === "termin" && b.termin?.id === ziehen.termin.id) ||
                      (ziehen.art === "schicht" && b.schicht?.id === ziehen.schicht.id && b.schicht.tag === ziehen.schicht.tag));
                  return (
                    <span
                      key={b.key}
                      data-schicht-block={b.termin ? undefined : ""}
                      data-schicht-id={b.schicht?.id}
                      data-tag={b.termin ? iso : b.schicht?.tag}
                      data-zeitbar={b.schicht?.zeitbar ? "1" : undefined}
                      data-ganz={b.ganz ? "" : undefined}
                      data-termin-id={b.termin?.id}
                      className={cn(
                        "absolute overflow-hidden px-1 pt-0.5 text-left leading-tight transition-opacity",
                        b.ganz && !b.vorn
                          ? cn("rounded-[5px] pt-1", b.termin && "border-l-[3px]")
                          : b.termin
                            ? "rounded-[6px] border-l-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] ring-1 ring-surface"
                            : "rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]",
                        b.leer && "border border-dashed",
                        wirdGezogen && "opacity-30",
                      )}
                      style={{
                        top: `${(b.von / 1440) * 100}%`,
                        height: `calc(${((b.bis - b.von) / 1440) * 100}% - 1px)`,
                        minHeight: 14,
                        left: `${b.links}%`,
                        width: `calc(${b.breite}% - ${b.breite < 100 ? 1 : 0}px)`,
                        // Ganztägiges zart im Hintergrund, Termine deckend obenauf.
                        backgroundColor: b.leer
                          ? "transparent"
                          : b.ganz && !b.vorn
                            ? `${b.farbe}26`
                            : b.termin
                              ? `color-mix(in srgb, ${b.farbe} 18%, rgb(var(--c-surface)))`
                              : b.farbe,
                        color: b.ganz && !b.vorn ? "rgb(var(--c-ink) / 0.82)" : b.termin || b.leer ? "rgb(var(--c-ink))" : textFarbe(b.farbe),
                        borderColor: b.termin || b.leer ? b.farbe : undefined,
                        zIndex: b.ebene,
                      }}
                    >
                      <span
                        className={cn(
                          "block font-bold",
                          b.ganz
                            ? cn("line-clamp-3 break-words leading-[1.15] [hyphens:auto]", b.vorn ? "text-[9px]" : "text-[10px]")
                            : "truncate text-[11px] font-extrabold",
                        )}
                        lang="de"
                      >
                        {b.titel}
                      </span>
                      {(b.bis - b.von) / 60 >= 2 && b.breite >= 50 && !b.ganz ? <span className="block truncate text-[9.5px] font-medium opacity-90">{b.unter}</span> : null}
                    </span>
                  );
                })}
                {ziehen && ziehen.iso === iso ? (
                  <span
                    className="pointer-events-none absolute inset-x-0 z-10 scale-[1.04] rounded-[6px] border-2 px-0.5 text-left text-[10px] font-bold leading-tight text-ink shadow-lg transition-[top] duration-75"
                    style={{
                      top: `${(ziehen.von / 1440) * 100}%`,
                      height: `${(Math.min(ziehen.dauer, 1440 - ziehen.von) / 1440) * 100}%`,
                      minHeight: 14,
                      borderColor: ziehen.farbe,
                      backgroundColor: `${ziehen.farbe}40`,
                    }}
                  >
                    <span className="tnum block">{ziehen.art === "schicht" && !ziehen.schicht.zeitbar ? "ganzer Tag" : hhmm(ziehen.von)}</span>
                    <span className="block truncate">{ziehen.titel}</span>
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
