"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/context/session";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { useAktualisierung } from "@/lib/live-refresh";
import { ausZwischenspeicher, inZwischenspeicher } from "@/lib/zwischenspeicher";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TerminBlatt, termineAm, useTermine, type Termin } from "./termine";

/**
 * Mein Kalender – der eigene Schichtplan als Monat.
 *
 * Dieselben Daten wie im Schichtplan (`schichtplan_kompakt()`), nur die
 * eigene Zeile. Damit gelten dieselben Regeln: Rotation, Tagesausnahmen,
 * Feiertage, Abwesenheiten und Anträge. Eine eigene Abfrage dafür gibt es
 * bewusst nicht – zwei Wege zum selben Plan laufen irgendwann auseinander.
 *
 * Tippen auf einen Tag öffnet eine Sprechblase mit Schicht, Uhrzeit und
 * Stunden. Von dort lässt sich ein eigener Termin eintragen (nur auf
 * diesem Gerät). Anträge laufen bewusst nicht über den Kalender – er ist
 * Übersicht und Terminkalender, beantragt wird im Schichtplan und unter
 * Urlaub.
 */

const WOCHENTAGE = ["M", "D", "M", "D", "F", "S", "S"];
const WOCHENTAG_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Farben wie im Schichtplan. */
const FARBE: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  V: "bg-shift-vtag text-shift-vtag-ink",
  AF: "bg-shift-altersfrei text-shift-altersfrei-ink",
  SU: "bg-shift-sonderurlaub text-shift-sonderurlaub-ink",
  BU: "bg-shift-bildungsurlaub text-shift-bildungsurlaub-ink",
  G: "bg-shift-gewerkschaft text-shift-gewerkschaft-ink",
  K: "bg-shift-krank text-shift-krank-ink",
  FB: "bg-shift-schulung text-shift-schulung-ink",
  A: "bg-surface-sunken text-ink-muted",
};

/** Beantragt: heller Grund mit Rahmen, wie im Schichtplan. */
const FARBE_BEANTRAGT: Record<string, string> = {
  U: "bg-shift-urlaub/40 text-shift-urlaub-ink ring-1 ring-inset ring-shift-urlaub-ink/40",
  V: "bg-shift-vtag/40 text-shift-vtag-ink ring-1 ring-inset ring-shift-vtag-ink/40",
  AF: "bg-shift-altersfrei/15 text-shift-altersfrei-offen ring-1 ring-inset ring-shift-altersfrei-offen/60",
  SU: "bg-shift-sonderurlaub/40 text-shift-sonderurlaub-ink ring-1 ring-inset ring-shift-sonderurlaub-ink/40",
  BU: "bg-shift-bildungsurlaub/40 text-shift-bildungsurlaub-ink ring-1 ring-inset ring-shift-bildungsurlaub-ink/40",
  G: "bg-shift-gewerkschaft/40 text-shift-gewerkschaft-ink ring-1 ring-inset ring-shift-gewerkschaft-ink/40",
};

const FREI = "bg-surface-sunken text-ink-faint";
const SONSTIGE_SCHICHT = "bg-brand-100 text-brand-700";

/** Kurz fürs Kästchen, lang für die Sprechblase. */
const ABWESENHEIT: Record<string, { kurz: string; lang: string }> = {
  U: { kurz: "Urlaub", lang: "Urlaub" },
  V: { kurz: "V-Tag", lang: "V-Tag" },
  AF: { kurz: "AF", lang: "Altersfreizeit" },
  SU: { kurz: "SU", lang: "Sonderurlaub" },
  BU: { kurz: "BU", lang: "Bildungsurlaub" },
  G: { kurz: "Gew.", lang: "Gewerkschaftstag" },
  K: { kurz: "Krank", lang: "Krank" },
  FB: { kurz: "Schul.", lang: "Schulung" },
  A: { kurz: "Abw.", lang: "Abwesend" },
};

/** "Frühschicht" -> "Früh", "Tagschicht" -> "Tag". */
function schichtKurz(name: string): string {
  const kurz = name.replace(/schicht$/i, "").trim();
  return kurz || name;
}

/** Stunden zwischen zwei Uhrzeiten, über Mitternacht hinweg. */
function stunden(von: string, bis: string): string | null {
  if (!von || !bis) return null;
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  if ([vh, vm, bh, bm].some((n) => n === undefined || Number.isNaN(n))) return null;
  let minuten = bh! * 60 + bm! - (vh! * 60 + vm!);
  if (minuten <= 0) minuten += 24 * 60;
  const h = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

interface TagInfo {
  /** Kürzel der Schicht (F, S, N, T …) oder null bei frei. */
  schichtCode: string | null;
  schichtName: string | null;
  /** Abwesenheit groß (genehmigt/eingetragen) oder klein (beantragt). */
  abwesenheit: string | null;
}

function tagInfo(zelle: LiveShiftPlanCell | undefined): TagInfo {
  return {
    schichtCode: zelle?.shiftCode ?? null,
    schichtName: zelle?.shiftName ?? null,
    abwesenheit: zelle?.absenceCode ?? null,
  };
}

/** Erster Tag des Rasters (Montag) und Zahl der Wochen eines Monats. */
function raster(jahr: number, monat: number) {
  const erster = new Date(jahr, monat, 1);
  const versatz = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const wochen = Math.ceil((versatz + tage) / 7);
  return { start: toISO(new Date(jahr, monat, 1 - versatz)), wochen };
}

interface Stand {
  /** Für welchen Ausschnitt dieser Stand gilt. */
  schluessel: string;
  tage: Map<string, LiveShiftPlanCell>;
  /** Steht die eigene Person überhaupt im Plan? */
  imPlan: boolean;
}

export function MeinKalender() {
  const { profile, company } = useSession();
  const heute = heuteInBerlin();
  const [monat, setMonat] = useState(() => {
    const d = fromISO(heute);
    return { jahr: d.getFullYear(), monat: d.getMonth() };
  });
  const { start, wochen } = raster(monat.jahr, monat.monat);
  const tageImRaster = wochen * 7;

  const schluessel = useCallback(
    (s: string, n: number) => `${profile.id}:kalender:${company.id}:${s}:${n}`,
    [profile.id, company.id],
  );

  const [stand, setStand] = useState<Stand | null>(
    () => ausZwischenspeicher<Stand>(schluessel(start, tageImRaster)) ?? null,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [schichten, setSchichten] = useState<ShiftDetail[]>([]);
  const ladeNr = useRef(0);

  const holen = useCallback(
    async (s: string, n: number): Promise<Stand> => {
      const zellen = await fetchShiftPlanGrid(company.id, s, n);
      const tage = new Map<string, LiveShiftPlanCell>();
      for (const z of zellen) if (z.isMe) tage.set(z.day, z);
      const ergebnis: Stand = { schluessel: schluessel(s, n), tage, imPlan: tage.size > 0 };
      inZwischenspeicher(schluessel(s, n), ergebnis);
      return ergebnis;
    },
    [company.id, schluessel],
  );

  const laden = useCallback(async () => {
    const nr = ++ladeNr.current;
    const s = start;
    const n = tageImRaster;
    const gespeichert = ausZwischenspeicher<Stand>(schluessel(s, n));
    if (gespeichert) setStand(gespeichert);
    // Eine kurze Störung soll nicht gleich als Fehler auf dem Schirm landen:
    // einmal still nachfassen, dann erst melden.
    for (let versuch = 0; versuch < 2; versuch++) {
      try {
        const neu = await holen(s, n);
        if (nr !== ladeNr.current) return;
        setStand(neu);
        setFehler(null);
        // Nachbarmonate vorab holen, damit das Wischen sofort etwas zeigt.
        const d = fromISO(addDays(s, 10));
        for (const schritt of [-1, 1]) {
          const r = raster(d.getFullYear(), d.getMonth() + schritt);
          if (!ausZwischenspeicher(schluessel(r.start, r.wochen * 7))) {
            void holen(r.start, r.wochen * 7).catch(() => undefined);
          }
        }
        return;
      } catch (err) {
        if (versuch === 0) {
          await new Promise((ok) => setTimeout(ok, 1500));
          if (nr !== ladeNr.current) return;
          continue;
        }
        if (nr !== ladeNr.current) return;
        setFehler(
          err instanceof DataError || err instanceof Error
            ? err.message
            : "Der Kalender konnte nicht geladen werden.",
        );
      }
    }
  }, [start, tageImRaster, schluessel, holen]);

  useEffect(() => {
    // Laden beim Monatswechsel – der Zustand kommt aus dem Netz, nicht aus React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  useAktualisierung(["plan", "abwesenheiten", "antraege"], () => void laden());

  useEffect(() => {
    let aus = false;
    fetchShiftDetails()
      .then((liste) => !aus && setSchichten(liste))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, []);

  const uhrzeit = useMemo(() => {
    const m = new Map<string, ShiftDetail>();
    for (const s of schichten) m.set(s.name, s);
    return m;
  }, [schichten]);

  // ---- Termine (nur auf diesem Gerät) ---------------------------------
  const { termine, speichern, loeschen } = useTermine(profile.id);

  // ---- Auswahl, Sprechblase, Blätter ------------------------------------
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [blase, setBlase] = useState<{ oben: number; pfeil: number; unten: boolean } | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null } | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const blaseRef = useRef<HTMLDivElement>(null);
  const gewischt = useRef(false);
  const blaseZelle = useRef<{ oben: number; unten: number } | null>(null);

  function springe(schritt: number) {
    setGewaehlt(null);
    setBlase(null);
    setMonat((m) => {
      const d = new Date(m.jahr, m.monat + schritt, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });
  }

  function zuHeute() {
    const d = fromISO(heute);
    setGewaehlt(null);
    setBlase(null);
    setMonat({ jahr: d.getFullYear(), monat: d.getMonth() });
  }

  // Wischen links/rechts wechselt den Monat.
  const wisch = useRef<{ x: number; y: number } | null>(null);
  function wischStart(e: React.PointerEvent) {
    gewischt.current = false;
    wisch.current = { x: e.clientX, y: e.clientY };
  }
  function wischEnde(e: React.PointerEvent) {
    const s = wisch.current;
    wisch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      gewischt.current = true;
      springe(dx < 0 ? 1 : -1);
    }
  }

  function tagAntippen(iso: string, knopf: HTMLElement) {
    if (gewischt.current) {
      gewischt.current = false;
      return;
    }
    setGewaehlt(iso);
    const box = flaeche.current?.getBoundingClientRect();
    const zelle = knopf.getBoundingClientRect();
    if (!box) return;
    setBlase({
      // Erst unterhalb messen; die Lage über dem Tag folgt im Effekt unten,
      // sobald die Höhe der Blase bekannt ist.
      oben: zelle.bottom - box.top + 12,
      pfeil: Math.max(28, Math.min(box.width - 28, zelle.left - box.left + zelle.width / 2)),
      unten: true,
    });
    blaseZelle.current = { oben: zelle.top - box.top, unten: zelle.bottom - box.top };
  }

  // Unter dem Tag, wenn sie dort ganz zu sehen ist – sonst darüber. Gemessen
  // wird am sichtbaren Bildschirm, nicht an der Fläche: die kann unten
  // hinter der Navigation weiterlaufen.
  useEffect(() => {
    if (!blase || !blaseRef.current || !blaseZelle.current || !flaeche.current) return;
    const hoehe = blaseRef.current.offsetHeight;
    const box = flaeche.current.getBoundingClientRect();
    const navigation = window.innerWidth >= 1024 ? 0 : 72;
    const sichtOben = Math.max(box.top, 0);
    const sichtUnten = Math.min(box.bottom, window.innerHeight - navigation);
    const zOben = box.top + blaseZelle.current.oben;
    const zUnten = box.top + blaseZelle.current.unten;
    const platzUnten = sichtUnten - (zUnten + 12);
    const platzOben = zOben - 12 - sichtOben;
    let neu: { oben: number; unten: boolean };
    if (platzUnten >= hoehe || platzUnten >= platzOben) {
      const vp = Math.max(sichtOben, Math.min(zUnten + 12, sichtUnten - hoehe));
      neu = { oben: Math.round(vp - box.top), unten: true };
    } else {
      const vp = Math.max(sichtOben, zOben - 12 - hoehe);
      neu = { oben: Math.round(vp - box.top), unten: false };
    }
    if (neu.oben !== blase.oben || neu.unten !== blase.unten) {
      setBlase({ ...blase, ...neu });
    }
  }, [blase, termine]);

  function blaseZu() {
    setGewaehlt(null);
    setBlase(null);
  }

  // ---- Darstellung ------------------------------------------------------
  const tage = useMemo(
    () => Array.from({ length: tageImRaster }, (_, i) => addDays(start, i)),
    [start, tageImRaster],
  );
  // Nur den Stand des angezeigten Monats zeigen – beim Blättern sonst kurz
  // die Tage des vorigen Monats unter neuen Daten.
  const aktuellerSchluessel = schluessel(start, tageImRaster);
  const sichtbar =
    stand?.schluessel === aktuellerSchluessel
      ? stand
      : (ausZwischenspeicher<Stand>(aktuellerSchluessel) ?? null);
  const zellen = sichtbar?.tage ?? new Map<string, LiveShiftPlanCell>();
  const imMonat = (iso: string) => fromISO(iso).getMonth() === monat.monat;
  const istAktuellerMonat = (() => {
    const d = fromISO(heute);
    return d.getFullYear() === monat.jahr && d.getMonth() === monat.monat;
  })();

  function kaestchen(info: TagInfo) {
    const liste: { text: string; klasse: string }[] = [];
    const abw = info.abwesenheit;
    const gross = abw?.toUpperCase() ?? null;
    const beantragt = abw !== null && abw !== gross;
    if (abw && !beantragt) {
      liste.push({ text: ABWESENHEIT[abw]?.kurz ?? abw, klasse: FARBE[abw] ?? FARBE.A! });
      return liste;
    }
    if (info.schichtName) {
      liste.push({
        text: schichtKurz(info.schichtName),
        klasse: (info.schichtCode && FARBE[info.schichtCode]) || SONSTIGE_SCHICHT,
      });
    } else {
      liste.push({ text: "Frei", klasse: FREI });
    }
    if (abw && beantragt && gross) {
      liste.push({
        text: `${ABWESENHEIT[gross]?.kurz ?? gross}?`,
        klasse: FARBE_BEANTRAGT[gross] ?? FARBE_BEANTRAGT.U!,
      });
    }
    return liste;
  }

  const gewaehltInfo = gewaehlt ? tagInfo(zellen.get(gewaehlt)) : null;
  const gewaehltTermine = gewaehlt ? termineAm(termine, gewaehlt) : [];

  return (
    <div
      className={cn(
        // Randlos auf dem Handy: die Seitenränder des Rahmens zurücknehmen
        // und die Höhe bis zur Navigation unten ausfüllen.
        "-mx-4 -mt-6 flex flex-col sm:-mx-6 lg:mx-0 lg:mt-0",
        "h-[calc(100dvh-4rem-3.75rem-env(safe-area-inset-bottom))] min-h-[520px] lg:h-[calc(100dvh-7rem)]",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 lg:px-0">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">
            {monthName(monat.monat)}
          </h1>
          <p className="tnum text-[13px] font-medium text-ink-muted">{monat.jahr}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!istAktuellerMonat ? (
            <button
              type="button"
              onClick={zuHeute}
              className="h-11 rounded-full bg-surface-muted px-4 text-[14px] font-semibold text-brand-600"
            >
              Heute
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => springe(-1)}
            aria-label="Vorheriger Monat"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => springe(1)}
            aria-label="Nächster Monat"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {fehler ? (
        <div className="px-4 pb-2 sm:px-6 lg:px-0">
          <Alert tone="error">{fehler}</Alert>
          <button
            type="button"
            className="mt-1 text-[13px] font-semibold text-brand-600 underline"
            onClick={() => void laden()}
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}
      {sichtbar && !sichtbar.imPlan ? (
        <p className="px-4 pb-2 text-[13px] text-ink-muted sm:px-6 lg:px-0">
          Für dein Konto ist im Schichtplan keine Person hinterlegt – deshalb bleibt der Kalender leer.
        </p>
      ) : null}

      <div
        ref={flaeche}
        className="relative grid min-h-0 flex-1 touch-pan-y select-none grid-cols-7 overflow-hidden bg-surface lg:rounded-2xl lg:border lg:border-line"
        style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
        onPointerDown={wischStart}
        onPointerUp={wischEnde}
        onPointerCancel={() => (wisch.current = null)}
        aria-busy={!sichtbar}
      >
        {WOCHENTAGE.map((w, i) => (
          <span
            key={i}
            className="py-1.5 text-center text-[12px] font-semibold text-ink-faint"
            aria-hidden
          >
            {w}
          </span>
        ))}
        {tage.map((iso, i) => {
          const info = tagInfo(zellen.get(iso));
          const d = fromISO(iso);
          const imM = imMonat(iso);
          const istHeute = iso === heute;
          const wochenende = i % 7 >= 5;
          const ts = termineAm(termine, iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={(e) => tagAntippen(iso, e.currentTarget)}
              aria-label={`${WOCHENTAG_LANG[d.getDay()]}, ${formatDE(iso)}: ${beschreibung(info)}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
              className={cn(
                "flex min-h-0 flex-col items-stretch gap-[3px] overflow-hidden border-t border-line px-[2px] pb-1 pt-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                i % 7 !== 0 && "border-l",
                wochenende && "bg-surface-muted/70",
                istHeute && "bg-ink/[0.07]",
                gewaehlt === iso && "ring-2 ring-inset ring-brand-500",
              )}
            >
              <span
                className={cn(
                  "tnum mx-auto flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[16px] leading-none",
                  istHeute ? "bg-ink font-bold text-surface" : imM ? "font-medium" : "text-ink-faint",
                )}
              >
                {d.getDate()}
              </span>
              {sichtbar
                ? kaestchen(info).map((k, j) => (
                    <span
                      key={j}
                      className={cn(
                        "truncate rounded-md px-0.5 py-[3px] text-[12.5px] font-medium leading-tight",
                        k.klasse,
                        !imM && "opacity-45",
                      )}
                    >
                      {k.text}
                    </span>
                  ))
                : (
                    <span className="h-5 animate-pulse rounded-md bg-surface-sunken" />
                  )}
              {ts.length ? (
                <span
                  className={cn(
                    "truncate text-left text-[11px] leading-tight text-ink-muted",
                    !imM && "opacity-45",
                  )}
                >
                  <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-ink-faint align-middle" />
                  {ts[0]!.titel || "Termin"}
                  {ts.length > 1 ? ` +${ts.length - 1}` : ""}
                </span>
              ) : null}
            </button>
          );
        })}

        {gewaehlt && blase && gewaehltInfo ? (
          <>
            {/* Tipp daneben schließt die Blase. */}
            <button
              type="button"
              aria-label="Schließen"
              className="fixed inset-0 z-40 cursor-default"
              onClick={blaseZu}
            />
            <div
              ref={blaseRef}
              role="dialog"
              aria-label={formatDE(gewaehlt)}
              className="absolute inset-x-2 z-50 rounded-3xl border border-line bg-surface px-4 pb-1 pt-3 shadow-pop"
              style={{ top: blase.oben }}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute h-4 w-4 -translate-x-1/2 rotate-45 border-line bg-surface",
                  blase.unten ? "-top-2 border-l border-t" : "-bottom-2 border-b border-r",
                )}
                style={{ left: blase.pfeil - 8 }}
              />
              <Sprechblase
                iso={gewaehlt}
                info={gewaehltInfo}
                schicht={gewaehltInfo.schichtName ? uhrzeit.get(gewaehltInfo.schichtName) : undefined}
                termine={gewaehltTermine}
                onTermin={(t) => {
                  setTerminBlatt({ datum: gewaehlt, termin: t });
                  blaseZu();
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      {terminBlatt ? (
        <TerminBlatt
          datum={terminBlatt.datum}
          termin={terminBlatt.termin}
          onSpeichern={(t) => {
            speichern(t);
            setTerminBlatt(null);
          }}
          onLoeschen={(id) => {
            loeschen(id);
            setTerminBlatt(null);
          }}
          onClose={() => setTerminBlatt(null)}
        />
      ) : null}

    </div>
  );
}

function beschreibung(info: TagInfo): string {
  const abw = info.abwesenheit;
  if (abw && abw === abw.toUpperCase()) return ABWESENHEIT[abw]?.lang ?? "Abwesend";
  const teil = info.schichtName ?? "Frei";
  if (abw) return `${teil}, ${ABWESENHEIT[abw.toUpperCase()]?.lang ?? "Antrag"} beantragt`;
  return teil;
}

function Sprechblase({
  iso,
  info,
  schicht,
  termine,
  onTermin,
}: {
  iso: string;
  info: TagInfo;
  schicht: ShiftDetail | undefined;
  termine: Termin[];
  onTermin: (t: Termin | null) => void;
}) {
  const d = fromISO(iso);
  const abw = info.abwesenheit;
  const gross = abw?.toUpperCase() ?? null;
  const beantragt = abw !== null && abw !== gross;

  let titel: string;
  let unterzeile: string | null = null;
  let farbe: string;
  let zeichen: string;
  let dauer: string | null = null;

  if (abw && !beantragt) {
    titel = ABWESENHEIT[abw]?.lang ?? "Abwesend";
    farbe = FARBE[abw] ?? FARBE.A!;
    zeichen = abw.slice(0, 2);
    if (info.schichtName) unterzeile = `statt ${info.schichtName}`;
  } else if (info.schichtName) {
    titel = info.schichtName;
    farbe = (info.schichtCode && FARBE[info.schichtCode]) || SONSTIGE_SCHICHT;
    zeichen = info.schichtCode ?? info.schichtName.slice(0, 1);
    if (schicht?.startTime && schicht.endTime) {
      unterzeile = `${schicht.startTime} – ${schicht.endTime} Uhr`;
      dauer = stunden(schicht.startTime, schicht.endTime);
    }
  } else {
    titel = "Frei";
    farbe = FREI;
    zeichen = "–";
  }

  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {WOCHENTAG_LANG[d.getDay()]}, {formatDE(iso)}
      </p>
      <div className="flex items-center gap-3 py-2">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
            farbe,
          )}
          aria-hidden
        >
          {zeichen}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-semibold leading-tight">{titel}</p>
          {unterzeile ? <p className="tnum text-[14px] text-ink-muted">{unterzeile}</p> : null}
        </div>
        {dauer ? <span className="tnum shrink-0 self-start text-[14px] text-ink-muted">{dauer}</span> : null}
      </div>
      {beantragt && gross ? (
        <p className="pb-2 text-[13px] text-ink-muted">
          {ABWESENHEIT[gross]?.lang ?? "Antrag"} beantragt – noch nicht genehmigt.
        </p>
      ) : null}

      {termine.length ? (
        <ul className="border-t border-line py-1">
          {termine.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTermin(t)}
                className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-[15px]"
              >
                <span className="min-w-0 truncate">{t.titel || "Ohne Titel"}</span>
                <span className="tnum shrink-0 text-[13px] text-ink-muted">
                  {t.ganztaegig ? "Ganztägig" : `${t.von} – ${t.bis}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="-mx-4 border-t border-line">
        <button
          type="button"
          onClick={() => onTermin(null)}
          className="flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-semibold text-ink-muted"
        >
          <Plus className="h-5 w-5 text-ink" strokeWidth={2} />
          Termin
        </button>
      </div>
    </div>
  );
}
