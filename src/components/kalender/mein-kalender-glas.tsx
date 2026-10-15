"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Layers,
  Paintbrush,
  Plus,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Blatt } from "@/components/privat/blatt";
import { useSession } from "@/context/session";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import {
  fetchMeinePartnerTage,
  fetchMeineTermine,
  loescheTermin,
  setzeMeinePartnerTage,
  speichereTermin,
} from "@/lib/data/partner";
import {
  ladeEigeneArten,
  ladeEigeneTage,
  ladeFarben,
  setzeEigeneTage,
  setzeFarbe,
  type EigeneArt,
  type EigeneArtEingabe,
} from "@/lib/data/kalender-eigene";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { useAktualisierung } from "@/lib/live-refresh";
import { FARBEN, farbStil } from "@/lib/privat/daten";
import { ausZwischenspeicher, inZwischenspeicher } from "@/lib/zwischenspeicher";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";
import { neuGesehenSchluessel } from "@/components/layout/neu-marke";
import { TerminBlatt, termineAm, type Termin, type TerminEingabe } from "./termine";
import { KalenderTeilen } from "./teilen";
import { PARTNER_FARBE, PartnerBlatt, partnerText, type PartnerSchicht } from "./partner";
import { setzeLokal, useLokaleEinstellung, useLokalNachLaden } from "./lokal";
import { KalenderEinfuehrung } from "./einfuehrung";
import { EigeneArtBlatt } from "./eigene-art";

/**
 * Mein Kalender im Stil des Privatkalenders (Glas, Tagesfenster) – zunächst
 * nur für freigeschaltete Personen (funktion 'kalender_neu').
 *
 * Die Schichten kommen unverändert aus dem Schichtplan
 * (`schichtplan_kompakt()`, nur die eigene Zeile) – wie im bisherigen
 * Kalender. Dazu kommen, nur für die Person selbst sichtbar:
 *  - eigene Farben für Schichten und Abwesenheiten,
 *  - eigene Einträge (selbst angelegt, z. B. „Nebenjob“), auch mit Pinsel.
 * Der echte Schichtplan wird davon nie verändert.
 */

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WOCHENTAG_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Kurz fürs Kästchen, lang fürs Tagesfenster – wie im bisherigen Kalender. */
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

/**
 * Standardfarben – kräftig, im Farbton wie im Schichtplan. Jede Person kann
 * sie für sich ändern (Kalender anpassen).
 */
const STANDARD_FARBE: Record<string, string> = {
  "schicht:F": "#F5A524",
  "schicht:S": "#46A758",
  "schicht:N": "#2F6FDE",
  "abw:U": "#F2C200",
  "abw:V": "#8E4EC6",
  "abw:K": "#E5484D",
  "abw:AF": "#18794E",
  "abw:SU": "#D6409F",
  "abw:BU": "#8D8D86",
  "abw:G": "#A18072",
  "abw:FB": "#6E56CF",
  "abw:A": "#5B6472",
};
/** Andere Schichten (z. B. Tagschicht) ohne eigene Standardfarbe. */
const SONSTIGE_SCHICHT_FARBE = "#12A594";

/** Abwesenheiten, deren Farbe sich ändern lässt (Reihenfolge der Liste). */
const ABW_IN_EINSTELLUNGEN = ["U", "V", "K", "AF", "SU", "BU", "G", "FB"];

const schichtSchluessel = (code: string | null, name: string | null) =>
  `schicht:${(code || name || "?").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30) || "X"}`;

function farbeFuer(schluessel: string, farben: Record<string, string>): string | null {
  if (farben[schluessel]) return farben[schluessel]!;
  if (STANDARD_FARBE[schluessel]) return STANDARD_FARBE[schluessel]!;
  if (schluessel.startsWith("schicht:")) return SONSTIGE_SCHICHT_FARBE;
  return null; // Frei: neutral
}

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

/** Erster Tag des Rasters (Montag) und Zahl der Wochen eines Monats. */
function raster(jahr: number, monat: number) {
  const erster = new Date(jahr, monat, 1);
  const versatz = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const wochen = Math.ceil((versatz + tage) / 7);
  return { start: toISO(new Date(jahr, monat, 1 - versatz)), wochen };
}

interface TagInfo {
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

interface Stand {
  schluessel: string;
  tage: Map<string, LiveShiftPlanCell>;
  imPlan: boolean;
  partner: Record<string, PartnerSchicht>;
}

/** Aussehen eines Kästchens: gefüllt, beantragt (Umriss) oder eigener Eintrag (gestrichelt). */
type Stil = { klasse: string; style?: React.CSSProperties };

const NEUTRAL: Stil = { klasse: "bg-ink/[0.07] text-ink-muted" };

function gefuellt(farbe: string | null): Stil {
  return farbe ? { klasse: "", style: farbStil(farbe) } : NEUTRAL;
}

function beantragtStil(farbe: string | null): Stil {
  const f = farbe ?? "#5B6472";
  return { klasse: "text-ink", style: { backgroundColor: `${f}33`, boxShadow: `inset 0 0 0 1.5px ${f}` } };
}

function eigenStil(farbe: string): Stil {
  const s = farbStil(farbe);
  // Kontur statt Rahmen: braucht keinen Platz, die Zelle bleibt gleich hoch.
  return {
    klasse: "outline-dashed outline-[1.5px] outline-offset-[-1.5px]",
    style: { ...s, outlineColor: s.color === "#fff" ? "rgba(255,255,255,0.75)" : "rgba(22,24,29,0.45)" },
  };
}

interface Kaestchen {
  text: string;
  lang: string;
  stil: Stil;
}

/** Die Einträge aus dem Schichtplan für einen Tag – wie im bisherigen Kalender. */
function planKaestchen(info: TagInfo, farben: Record<string, string>): Kaestchen[] {
  const liste: Kaestchen[] = [];
  const abw = info.abwesenheit;
  const gross = abw?.toUpperCase() ?? null;
  const beantragt = abw !== null && abw !== gross;
  if (abw && !beantragt) {
    liste.push({
      text: ABWESENHEIT[abw]?.kurz ?? abw,
      lang: ABWESENHEIT[abw]?.lang ?? "Abwesend",
      stil: gefuellt(farbeFuer(`abw:${abw}`, farben) ?? STANDARD_FARBE["abw:A"]!),
    });
    return liste;
  }
  if (info.schichtName) {
    liste.push({
      text: schichtKurz(info.schichtName),
      lang: info.schichtName,
      stil: gefuellt(farbeFuer(schichtSchluessel(info.schichtCode, info.schichtName), farben)),
    });
  } else {
    liste.push({ text: "Frei", lang: "Frei", stil: gefuellt(farbeFuer("frei", farben)) });
  }
  if (abw && beantragt && gross) {
    liste.push({
      text: `${ABWESENHEIT[gross]?.kurz ?? gross}?`,
      lang: `${ABWESENHEIT[gross]?.lang ?? "Antrag"} beantragt`,
      stil: beantragtStil(farbeFuer(`abw:${gross}`, farben)),
    });
  }
  return liste;
}

function beschreibung(info: TagInfo): string {
  const abw = info.abwesenheit;
  if (abw && abw === abw.toUpperCase()) return ABWESENHEIT[abw]?.lang ?? "Abwesend";
  const teil = info.schichtName ?? "Frei";
  if (abw) return `${teil}, ${ABWESENHEIT[abw.toUpperCase()]?.lang ?? "Antrag"} beantragt`;
  return teil;
}

export function MeinKalenderGlas() {
  const { profile, company } = useSession();
  const heute = heuteInBerlin();
  const [monat, setMonat] = useState(() => {
    const d = fromISO(heute);
    return { jahr: d.getFullYear(), monat: d.getMonth() };
  });
  const { start, wochen } = raster(monat.jahr, monat.monat);
  const tageImRaster = wochen * 7;
  const ende = addDays(start, tageImRaster - 1);

  // ---- Schichtplan und Partnertage (wie im bisherigen Kalender) ---------
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
      const [zellen, partner] = await Promise.all([
        fetchShiftPlanGrid(company.id, s, n),
        fetchMeinePartnerTage(s, addDays(s, n - 1)).catch(() => ({})),
      ]);
      const tage = new Map<string, LiveShiftPlanCell>();
      for (const z of zellen) if (z.isMe) tage.set(z.day, z);
      const ergebnis: Stand = { schluessel: schluessel(s, n), tage, imPlan: tage.size > 0, partner };
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
    for (let versuch = 0; versuch < 2; versuch++) {
      try {
        const neu = await holen(s, n);
        if (nr !== ladeNr.current) return;
        setStand(neu);
        setFehler(null);
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
          err instanceof DataError || err instanceof Error ? err.message : "Der Kalender konnte nicht geladen werden.",
        );
      }
    }
  }, [start, tageImRaster, schluessel, holen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  useAktualisierung(["plan", "abwesenheiten", "antraege"], () => void laden());

  useEffect(() => {
    let zuletzt = 0;
    const auffrischen = () => {
      if (document.visibilityState !== "visible" || Date.now() - zuletzt < 15_000) return;
      zuletzt = Date.now();
      void laden();
    };
    document.addEventListener("visibilitychange", auffrischen);
    window.addEventListener("focus", auffrischen);
    return () => {
      document.removeEventListener("visibilitychange", auffrischen);
      window.removeEventListener("focus", auffrischen);
    };
  }, [laden]);

  // Partnertage alle 20 Sekunden frisch, solange sichtbar.
  useEffect(() => {
    const s = start;
    const n = tageImRaster;
    const k = schluessel(s, n);
    const takt = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const partner = await fetchMeinePartnerTage(s, addDays(s, n - 1));
        setStand((alt) => {
          if (!alt || alt.schluessel !== k) return alt;
          if (JSON.stringify(alt.partner) === JSON.stringify(partner)) return alt;
          const neu = { ...alt, partner };
          inZwischenspeicher(k, neu);
          return neu;
        });
      } catch {
        // nächster Takt
      }
    }, 20_000);
    return () => window.clearInterval(takt);
  }, [start, tageImRaster, schluessel]);

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

  // ---- Termine (wie im bisherigen Kalender) ------------------------------
  const [termine, setTermine] = useState<Termin[]>([]);
  const ladeTermine = useCallback(async () => {
    try {
      const neu = await fetchMeineTermine();
      setTermine((alt) => (JSON.stringify(alt) === JSON.stringify(neu) ? alt : neu));
    } catch {
      // Termine sind Beiwerk – der Kalender steht auch ohne sie.
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladeTermine();
    const sichtbar = () => {
      if (document.visibilityState === "visible") void ladeTermine();
    };
    document.addEventListener("visibilitychange", sichtbar);
    const takt = window.setInterval(() => {
      if (document.visibilityState === "visible") void ladeTermine();
    }, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", sichtbar);
      window.clearInterval(takt);
    };
  }, [ladeTermine]);
  async function terminSpeichern(t: TerminEingabe) {
    try {
      await speichereTermin(t);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gespeichert werden.");
    }
    void ladeTermine();
  }
  async function terminLoeschen(id: string) {
    try {
      await loescheTermin(id);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gelöscht werden.");
    }
    void ladeTermine();
  }

  // ---- Partner (wie im bisherigen Kalender) ------------------------------
  const [partnerZeigen, setPartnerZeigen] = useLokaleEinstellung(`schichtplan.partner-zeigen.${profile.id}`, true);
  const [einladen, setEinladen] = useState(false);
  useEffect(() => {
    setzeLokal(neuGesehenSchluessel("kalender-partner"), true);
  }, []);
  const einfuehrungGesehen = useLokalNachLaden(`schichtplan.kalender-einfuehrung-2.${profile.id}`, false, true);
  async function partnerSetzen(von: string, anzahl: number, code: PartnerSchicht | null) {
    try {
      await setzeMeinePartnerTage(von, anzahl, code);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das konnte nicht gespeichert werden.");
    }
    void laden();
  }

  // ---- Eigene Farben und eigene Einträge (nur für mich) ------------------
  const [farben, setFarben] = useState<Record<string, string>>({});
  const [arten, setArten] = useState<EigeneArt[] | null>(null);
  const [eigene, setEigene] = useState<Record<string, string>>({});

  const ladeArten = useCallback(async () => {
    try {
      setArten(await ladeEigeneArten());
    } catch (e) {
      setArten((alt) => alt ?? []);
      setFehler(e instanceof Error ? e.message : "Deine eigenen Einträge konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    let aus = false;
    ladeFarben()
      .then((f) => !aus && setFarben(f))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladeArten();
    return () => {
      aus = true;
    };
  }, [ladeArten]);

  const ladeEigene = useCallback(async (von: string, bis: string) => {
    try {
      const neu = await ladeEigeneTage(von, bis);
      setEigene((alt) => {
        const naechste: Record<string, string> = {};
        for (const [tag, id] of Object.entries(alt)) if (tag < von || tag > bis) naechste[tag] = id;
        return { ...naechste, ...neu };
      });
    } catch {
      // Eigene Einträge sind Beiwerk – der Plan steht auch ohne sie.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladeEigene(start, ende);
  }, [start, ende, ladeEigene]);

  const artNach = useMemo(() => new Map((arten ?? []).map((a) => [a.id, a])), [arten]);

  async function eigenSetzen(tage: string[], artId: string | null) {
    if (!tage.length) return;
    setEigene((alt) => {
      const neu = { ...alt };
      for (const t of tage) {
        if (artId) neu[t] = artId;
        else delete neu[t];
      }
      return neu;
    });
    try {
      await setzeEigeneTage(tage, artId);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
      void ladeEigene(start, ende);
    }
  }

  async function farbeSetzen(s: string, farbe: string | null) {
    const vorher = farben;
    setFarben((alt) => {
      const neu = { ...alt };
      if (farbe) neu[s] = farbe;
      else delete neu[s];
      return neu;
    });
    try {
      await setzeFarbe(s, farbe);
    } catch (e) {
      setFarben(vorher);
      setFehler(e instanceof Error ? e.message : "Die Farbe konnte nicht gespeichert werden.");
    }
  }

  // ---- Pinsel ------------------------------------------------------------
  const [pinselAn, setPinselAn] = useState(false);
  const [pinsel, setPinsel] = useState<string | null>(null);

  // ---- Blätter -----------------------------------------------------------
  const [tagBlatt, setTagBlatt] = useState<{ iso: string; auswahl: boolean } | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null } | null>(null);
  const [partnerBlatt, setPartnerBlatt] = useState<string | null>(null);
  const [anpassen, setAnpassen] = useState(false);
  /** Editor für eigene Einträge – und wohin es danach zurückgeht. */
  const [editor, setEditor] = useState<{ wert: EigeneArtEingabe; zurueck: "anpassen" | string | null } | null>(null);

  function neueArt(zurueck: "anpassen" | string | null) {
    const n = arten?.length ?? 0;
    setEditor({
      wert: { id: null, name: "", kuerzel: "", farbe: FARBEN[n % FARBEN.length]!, beginn: "", ende: "", reihenfolge: n + 1 },
      zurueck,
    });
  }

  function editorZu(gespeichert: boolean) {
    const zurueck = editor?.zurueck ?? null;
    setEditor(null);
    if (gespeichert) {
      void ladeArten();
      void ladeEigene(start, ende);
    }
    if (zurueck === "anpassen") setAnpassen(true);
    else if (zurueck) setTagBlatt({ iso: zurueck, auswahl: true });
  }

  // Auf dem Handy steht der Kalender fest – die Seite dahinter scrollt nicht.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const html = document.documentElement;
    const vorher = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = vorher.html;
      document.body.style.overflow = vorher.body;
    };
  }, []);

  // ---- Blättern und Wischen ----------------------------------------------
  const gewischt = useRef(false);
  const wisch = useRef<{ x: number; y: number } | null>(null);

  function springe(schritt: number) {
    setMonat((m) => {
      const d = new Date(m.jahr, m.monat + schritt, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });
  }
  function zuHeute() {
    const d = fromISO(heute);
    setMonat({ jahr: d.getFullYear(), monat: d.getMonth() });
  }
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

  function tippen(iso: string) {
    if (gewischt.current) {
      gewischt.current = false;
      return;
    }
    if (pinselAn && pinsel && (pinsel === "leer" || artNach.has(pinsel))) {
      void eigenSetzen([iso], pinsel === "leer" ? null : pinsel);
      return;
    }
    setTagBlatt({ iso, auswahl: false });
  }

  // ---- Darstellung -------------------------------------------------------
  const tage = useMemo(() => Array.from({ length: tageImRaster }, (_, i) => addDays(start, i)), [start, tageImRaster]);
  const aktuellerSchluessel = schluessel(start, tageImRaster);
  const sichtbar =
    stand?.schluessel === aktuellerSchluessel ? stand : (ausZwischenspeicher<Stand>(aktuellerSchluessel) ?? null);
  const zellen = sichtbar?.tage ?? new Map<string, LiveShiftPlanCell>();
  const partnerTage = sichtbar?.partner ?? {};
  const istAktuellerMonat = (() => {
    const d = fromISO(heute);
    return d.getFullYear() === monat.jahr && d.getMonth() === monat.monat;
  })();

  return (
    <div
      // Markiert die Seite: blendet auf dem Handy die Kopfleiste aus und
      // macht die untere Leiste zur schwebenden Glas-Leiste (globals.css).
      data-glas-seite
      className={cn(
        // Handy: der ganze Bildschirm, ohne Kopfleiste, bis über die
        // schwebende Leiste unten. Desktop: normal im Seitenrahmen.
        // Die Fläche reicht bis ganz nach unten (so läuft der Farbverlauf
        // hinter der schwebenden Leiste weiter); der Platz für die Leiste
        // kommt über den Innenabstand.
        "privat fixed inset-0 z-10 flex flex-col px-3 pb-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.5rem)] pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-6",
        "lg:static lg:z-auto lg:h-[calc(100dvh-7rem)] lg:min-h-[520px] lg:rounded-[28px] lg:px-4 lg:pb-4 lg:pt-0",
      )}
    >
      <header className="flex items-center justify-between gap-2 pb-2.5 pt-3 [@media(max-height:700px)]:pb-1.5 [@media(max-height:700px)]:pt-1.5">
        <div className="min-w-0">
          <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.02em] [@media(max-height:700px)]:text-[25px]">
            {monthName(monat.monat)}
          </h1>
          <p className="tnum truncate text-[14px] font-medium text-ink-muted">
            {monat.jahr}
            {!istAktuellerMonat ? (
              <>
                {" · "}
                <button type="button" onClick={zuHeute} className="font-semibold text-brand-600">
                  Heute
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden gap-2 sm:flex">
            <GlasKnopf label="Vorheriger Monat" onClick={() => springe(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </GlasKnopf>
            <GlasKnopf label="Nächster Monat" onClick={() => springe(1)}>
              <ChevronRight className="h-5 w-5" />
            </GlasKnopf>
          </span>
          <GlasKnopf
            label="Mit dem Pinsel eintragen"
            aktiv={pinselAn}
            onClick={() => {
              setPinselAn(!pinselAn);
              if ((!pinsel || (pinsel !== "leer" && !artNach.has(pinsel))) && arten?.length) setPinsel(arten[0]!.id);
            }}
          >
            <Paintbrush className="h-[18px] w-[18px]" />
          </GlasKnopf>
          <GlasKnopf label="Kalender anpassen" onClick={() => setAnpassen(true)}>
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </GlasKnopf>
          <GlasKnopf label="Partner einladen" onClick={() => setEinladen(true)}>
            <UserPlus className="h-[18px] w-[18px]" />
          </GlasKnopf>
        </div>
      </header>

      {fehler ? (
        <div className="pb-2">
          <Alert tone="error">{fehler}</Alert>
          <button type="button" className="mt-1 text-[13px] font-semibold text-brand-600 underline" onClick={() => void laden()}>
            Erneut versuchen
          </button>
        </div>
      ) : null}
      {sichtbar && !sichtbar.imPlan ? (
        <p className="pb-2 text-[13px] text-ink-muted">
          Für dein Konto ist im Schichtplan keine Person hinterlegt – deshalb bleibt der Kalender leer.
        </p>
      ) : null}

      <div
        className="glas relative grid min-h-0 flex-1 touch-pan-y select-none grid-cols-7 overflow-hidden rounded-[22px]"
        style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
        onPointerDown={wischStart}
        onPointerUp={wischEnde}
        onPointerCancel={() => (wisch.current = null)}
        aria-busy={!sichtbar}
      >
        {WT.map((w, i) => (
          <span
            key={w}
            aria-hidden
            className={cn("pb-1 pt-1.5 text-center text-[11px] font-semibold uppercase", i >= 5 ? "text-ink-faint" : "text-ink-muted")}
          >
            {w}
          </span>
        ))}
        {tage.map((iso, i) => {
          const info = tagInfo(zellen.get(iso));
          const d = fromISO(iso);
          const imM = d.getMonth() === monat.monat;
          const plan = sichtbar ? planKaestchen(info, farben) : [];
          const eigen = eigene[iso] ? artNach.get(eigene[iso]!) : undefined;
          const partner = partnerZeigen ? (partnerTage[iso] ?? null) : null;
          const ts = termineAm(termine, iso);
          // Wird es eng (Schicht + Antrag + eigener Eintrag, oder dazu der
          // Partner), steht der eigene Eintrag als Punkt an der Tageszahl.
          const eigenAlsPunkt = !!eigen && plan.length + 1 + (partner ? 1 : 0) >= 3;
          const kaestchen = plan.length + (eigen && !eigenAlsPunkt ? 1 : 0);
          const klein = kaestchen >= 2;
          // Höchstens so viele Terminzeilen, wie sicher in die Zelle passen.
          const zeilen = Math.max(0, 2 - (partner ? 1 : 0) - (kaestchen - 1));
          const zeigen = ts.length > zeilen ? ts.slice(0, Math.max(0, zeilen - 1)) : ts;
          const rest = ts.length - zeigen.length;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => tippen(iso)}
              aria-label={`${WOCHENTAG_LANG[d.getDay()]}, ${formatDE(iso)}: ${beschreibung(info)}${eigen ? `, eigener Eintrag: ${eigen.name}` : ""}${partner ? `, Partner: ${partnerText(partner, true)}` : ""}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
              className={cn(
                "glas-linie flex min-h-0 flex-col items-stretch gap-[2px] overflow-hidden border-t px-[2px] pb-0.5 pt-[3px] text-center outline-none transition-colors active:bg-ink/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                i % 7 !== 0 && "border-l",
                i % 7 >= 5 && "bg-ink/[0.025]",
                !imM && "opacity-35",
              )}
            >
              <span className="relative mx-auto shrink-0">
                <span
                  className={cn(
                    "tnum flex h-[24px] min-w-[24px] items-center justify-center rounded-full px-1 text-[14.5px] font-medium leading-none [@media(max-height:750px)]:h-[21px] [@media(max-height:750px)]:min-w-[21px] [@media(max-height:750px)]:text-[13.5px]",
                    iso === heute && "bg-[#ff3b30] font-bold text-white shadow-[0_2px_8px_rgba(255,59,48,0.45)]",
                  )}
                >
                  {d.getDate()}
                </span>
                {eigen && eigenAlsPunkt ? (
                  <span
                    aria-hidden
                    className="absolute -left-2.5 top-[8px] h-[7px] w-[7px] rounded-full ring-1 ring-inset ring-black/15"
                    style={{ backgroundColor: eigen.farbe }}
                  />
                ) : null}
                {ts.length ? (
                  <span aria-hidden className="absolute -right-2.5 top-0.5 hidden gap-px [@media(max-height:750px)]:flex">
                    {ts.slice(0, 3).map((t) => (
                      <span key={t.id} className={cn("h-[5px] w-[5px] rounded-full", t.vonPartner ? "bg-brand-500" : "bg-ink-muted")} />
                    ))}
                  </span>
                ) : null}
              </span>
              {sichtbar ? (
                plan.map((k, j) => <Chip key={j} text={k.text} stil={k.stil} klein={klein} />)
              ) : (
                <span className="h-5 shrink-0 animate-pulse rounded-[7px] bg-ink/[0.07]" />
              )}
              {eigen && !eigenAlsPunkt ? <Chip text={eigen.name} stil={eigenStil(eigen.farbe)} klein={klein} /> : null}
              {partner ? (
                <span
                  className={cn(
                    "shrink-0 truncate rounded-[7px] px-0.5 py-px text-[10.5px] font-semibold leading-tight ring-[1.5px] ring-inset",
                    PARTNER_FARBE[partner],
                  )}
                >
                  {partnerText(partner)}
                </span>
              ) : null}
              {zeigen.map((t) => (
                <span
                  key={t.id}
                  className="shrink-0 truncate text-left text-[10px] leading-[1.25] text-ink-muted [@media(max-height:750px)]:hidden"
                >
                  <span className={cn("mr-0.5 inline-block h-[5px] w-[5px] rounded-full align-middle", t.vonPartner ? "bg-brand-500" : "bg-ink-faint")} />
                  {t.titel || "Termin"}
                </span>
              ))}
              {rest > 0 && zeilen > 0 ? (
                <span className="shrink-0 text-left text-[10px] font-semibold leading-[1.25] text-ink-faint [@media(max-height:750px)]:hidden">
                  +{rest} {zeigen.length ? "weitere" : rest === 1 ? "Termin" : "Termine"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {pinselAn ? (
        <div className="glas mt-2 flex h-[5.2rem] shrink-0 touch-pan-x select-none flex-col justify-center overflow-hidden rounded-[24px] px-2.5 [@media(max-height:700px)]:h-[3.6rem]">
          {arten && arten.length ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 touch-pan-x snap-x gap-1.5 overflow-x-auto overflow-y-hidden overscroll-contain px-1 py-1 [-webkit-mask-image:linear-gradient(to_right,transparent,#000_10px,#000_calc(100%-14px),transparent)] [mask-image:linear-gradient(to_right,transparent,#000_10px,#000_calc(100%-14px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {arten.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setPinsel(a.id)}
                      aria-pressed={pinsel === a.id}
                      className={cn(
                        "h-10 shrink-0 snap-start rounded-[13px] px-3.5 text-[13.5px] font-semibold",
                        pinsel === a.id ? "shadow-md ring-2 ring-inset ring-ink/80" : "opacity-80",
                      )}
                      style={farbStil(a.farbe)}
                    >
                      {a.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPinsel("leer")}
                    aria-pressed={pinsel === "leer"}
                    className={cn(
                      "flex h-10 shrink-0 snap-start items-center gap-1 rounded-[13px] bg-ink/[0.07] px-3.5 text-[13.5px] font-semibold text-ink-muted",
                      pinsel === "leer" && "ring-2 ring-inset ring-ink/80",
                    )}
                  >
                    <Eraser className="h-4 w-4" /> Leeren
                  </button>
                </div>
                <PinselZu onClick={() => setPinselAn(false)} />
              </div>
              <p className="truncate px-1 pt-0.5 text-[11.5px] text-ink-muted [@media(max-height:700px)]:hidden">
                Tage antippen · nur für dich, der Schichtplan bleibt
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => neueArt(null)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand-500 text-[14px] font-semibold text-white"
              >
                <Plus className="h-[18px] w-[18px]" /> Eigenen Eintrag anlegen
              </button>
              <PinselZu onClick={() => setPinselAn(false)} />
            </div>
          )}
        </div>
      ) : null}

      {tagBlatt ? (
        <TagBlatt
          key={tagBlatt.iso}
          iso={tagBlatt.iso}
          auswahlOffen={tagBlatt.auswahl}
          info={tagInfo(zellen.get(tagBlatt.iso))}
          geladen={!!sichtbar}
          farben={farben}
          schicht={(() => {
            const n = zellen.get(tagBlatt.iso)?.shiftName;
            return n ? uhrzeit.get(n) : undefined;
          })()}
          eigen={eigene[tagBlatt.iso] ? artNach.get(eigene[tagBlatt.iso]!) : undefined}
          arten={arten ?? []}
          termine={termineAm(termine, tagBlatt.iso)}
          partner={partnerZeigen ? (partnerTage[tagBlatt.iso] ?? null) : null}
          onEigen={(id) => void eigenSetzen([tagBlatt.iso], id)}
          onNeueArt={() => {
            const iso = tagBlatt.iso;
            setTagBlatt(null);
            neueArt(iso);
          }}
          onTermin={(t) => {
            setTerminBlatt({ datum: tagBlatt.iso, termin: t });
            setTagBlatt(null);
          }}
          onPartner={() => {
            setPartnerBlatt(tagBlatt.iso);
            setTagBlatt(null);
          }}
          onClose={() => setTagBlatt(null)}
        />
      ) : null}

      {anpassen ? (
        <AnpassenBlatt
          schichten={schichten}
          farben={farben}
          arten={arten}
          partnerZeigen={partnerZeigen}
          onPartnerZeigen={setPartnerZeigen}
          onFarbe={(s, f) => void farbeSetzen(s, f)}
          onArt={(a) => {
            setAnpassen(false);
            setEditor({ wert: { ...a }, zurueck: "anpassen" });
          }}
          onNeueArt={() => {
            setAnpassen(false);
            neueArt("anpassen");
          }}
          onClose={() => setAnpassen(false)}
        />
      ) : null}

      {editor ? <EigeneArtBlatt wert={editor.wert} onClose={() => editorZu(false)} onFertig={() => editorZu(true)} /> : null}

      {terminBlatt ? (
        <TerminBlatt
          glas
          datum={terminBlatt.datum}
          termin={terminBlatt.termin}
          hinweis={
            terminBlatt.termin?.vonPartner
              ? "Von deinem Partner eingetragen. Ihr seht ihn beide."
              : "Dein Partner sieht deine Termine nur, wenn du sie beim Teilen freigibst."
          }
          onSpeichern={(t) => {
            void terminSpeichern(t);
            setTerminBlatt(null);
          }}
          onLoeschen={(id) => {
            void terminLoeschen(id);
            setTerminBlatt(null);
          }}
          onClose={() => setTerminBlatt(null)}
        />
      ) : null}

      {partnerBlatt ? (
        <PartnerBlatt
          glas
          datum={partnerBlatt}
          aktuell={partnerTage[partnerBlatt] ?? null}
          hinweis="Das siehst nur du – und dein Partner, wenn du ihn einlädst."
          onWahl={(code, anzahl) => {
            if (!partnerZeigen) setPartnerZeigen(true);
            void partnerSetzen(partnerBlatt, anzahl, code);
            setPartnerBlatt(null);
          }}
          onClose={() => setPartnerBlatt(null)}
          onEinladen={() => {
            setPartnerBlatt(null);
            setEinladen(true);
          }}
        />
      ) : null}

      {einladen ? <KalenderTeilen vorname={profile.firstName} onClose={() => setEinladen(false)} /> : null}

      {!einfuehrungGesehen ? (
        <KalenderEinfuehrung onFertig={() => setzeLokal(`schichtplan.kalender-einfuehrung-2.${profile.id}`, true)} />
      ) : null}
    </div>
  );
}

// ---- Bausteine -------------------------------------------------------------

function GlasKnopf({
  label,
  onClick,
  aktiv,
  children,
}: {
  label: string;
  onClick: () => void;
  aktiv?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={aktiv}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-11 sm:w-11",
        aktiv ? "bg-brand-500 text-white shadow-[0_6px_18px_rgba(47,91,234,0.4)]" : "glas text-ink",
      )}
    >
      {children}
    </button>
  );
}

function PinselZu({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Pinsel beenden"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-ink-muted"
    >
      <X className="h-5 w-5" />
    </button>
  );
}

function Chip({ text, stil, klein }: { text: string; stil: Stil; klein: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 truncate rounded-[7px] px-0.5 font-semibold",
        klein
          ? "py-px text-[10.5px] [@media(max-height:750px)]:py-0 [@media(max-height:750px)]:text-[10px]"
          : "py-[2px] text-[11.5px]",
        // Nach der Schriftgröße – sonst verwirft cn() die Zeilenhöhe.
        "leading-tight",
        stil.klasse,
      )}
      style={stil.style}
    >
      {text}
    </span>
  );
}

/** Eine Zeile im Tagesfenster. */
function Zeile({
  stil,
  titel,
  unter,
  marke,
  children,
}: {
  stil: Stil;
  titel: string;
  unter?: string | null;
  marke?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className={cn("flex items-center gap-3 rounded-[16px] px-3.5 py-2.5", stil.klasse)} style={stil.style}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{titel}</span>
        {unter ? <span className="tnum block text-[12.5px] opacity-90">{unter}</span> : null}
      </span>
      {marke ? (
        <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]">
          {marke}
        </span>
      ) : null}
      {children}
    </li>
  );
}

function TagBlatt({
  iso,
  auswahlOffen,
  info,
  geladen,
  farben,
  schicht,
  eigen,
  arten,
  termine,
  partner,
  onEigen,
  onNeueArt,
  onTermin,
  onPartner,
  onClose,
}: {
  iso: string;
  auswahlOffen: boolean;
  info: TagInfo;
  geladen: boolean;
  farben: Record<string, string>;
  schicht: ShiftDetail | undefined;
  eigen: EigeneArt | undefined;
  arten: EigeneArt[];
  termine: Termin[];
  partner: PartnerSchicht | null;
  onEigen: (id: string | null) => void;
  onNeueArt: () => void;
  onTermin: (t: Termin | null) => void;
  onPartner: () => void;
  onClose: () => void;
}) {
  const [auswahl, setAuswahl] = useState(auswahlOffen);
  const d = fromISO(iso);
  const abw = info.abwesenheit;
  const gross = abw?.toUpperCase() ?? null;
  const beantragt = abw !== null && abw !== gross;

  // Der Eintrag aus dem Schichtplan – fest, nur zum Ansehen.
  let planZeile: { stil: Stil; titel: string; unter: string | null } | null = null;
  if (geladen) {
    if (abw && !beantragt) {
      planZeile = {
        stil: gefuellt(farbeFuer(`abw:${abw}`, farben) ?? STANDARD_FARBE["abw:A"]!),
        titel: ABWESENHEIT[abw]?.lang ?? "Abwesend",
        unter: info.schichtName ? `statt ${info.schichtName}` : null,
      };
    } else if (info.schichtName) {
      const zeit = schicht?.startTime && schicht.endTime ? `${schicht.startTime}–${schicht.endTime} Uhr` : null;
      const dauer = schicht?.startTime && schicht.endTime ? stunden(schicht.startTime, schicht.endTime) : null;
      planZeile = {
        stil: gefuellt(farbeFuer(schichtSchluessel(info.schichtCode, info.schichtName), farben)),
        titel: info.schichtName,
        unter: [zeit, dauer].filter(Boolean).join(" · ") || null,
      };
    } else {
      planZeile = { stil: gefuellt(farbeFuer("frei", farben)), titel: "Frei", unter: null };
    }
  }

  return (
    <Blatt
      titel={`${WOCHENTAG_LANG[d.getDay()]}, ${d.getDate()}. ${monthName(d.getMonth())}`}
      unter={partner ? <>Partner: {partnerText(partner, true)}</> : undefined}
      onClose={onClose}
    >
      <ul className="space-y-2">
        {planZeile ? <Zeile stil={planZeile.stil} titel={planZeile.titel} unter={planZeile.unter} marke="Plan" /> : null}
        {beantragt && gross ? (
          <Zeile
            stil={beantragtStil(farbeFuer(`abw:${gross}`, farben))}
            titel={`${ABWESENHEIT[gross]?.lang ?? "Antrag"} beantragt`}
            unter="Noch nicht genehmigt."
          />
        ) : null}
        {eigen ? (
          <Zeile
            stil={eigenStil(eigen.farbe)}
            titel={eigen.name}
            unter={eigen.beginn && eigen.ende ? `${eigen.beginn}–${eigen.ende} Uhr · nur für dich` : "Nur für dich"}
          >
            <button
              type="button"
              onClick={() => setAuswahl(true)}
              className="shrink-0 rounded-full bg-black/15 px-3 py-1.5 text-[13px] font-semibold"
            >
              Tauschen
            </button>
            <button
              type="button"
              onClick={() => onEigen(null)}
              aria-label={`${eigen.name} entfernen`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/15"
            >
              <X className="h-4 w-4" />
            </button>
          </Zeile>
        ) : null}
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setAuswahl(!auswahl)}
          aria-expanded={auswahl}
          className={cn(
            "flex h-[52px] items-center justify-center gap-1.5 rounded-[16px] text-[14.5px] font-semibold transition-colors",
            auswahl ? "bg-brand-500 text-white" : "bg-ink/[0.07] text-ink",
          )}
        >
          <Layers className="h-5 w-5" /> Eintrag
        </button>
        <button
          type="button"
          onClick={() => onTermin(null)}
          className="flex h-[52px] items-center justify-center gap-1.5 rounded-[16px] bg-ink/[0.07] text-[14.5px] font-semibold text-ink"
        >
          <CalendarPlus className="h-5 w-5" /> Termin
        </button>
        <button
          type="button"
          onClick={onPartner}
          className="flex h-[52px] items-center justify-center gap-1.5 rounded-[16px] bg-ink/[0.07] text-[14.5px] font-semibold text-ink"
        >
          <Users className="h-5 w-5" /> Partner
        </button>
      </div>

      {auswahl ? (
        <div className="mt-3">
          <p className="mb-2 text-[12.5px] text-ink-muted">
            {eigen ? `Ersetzt „${eigen.name}“. ` : ""}Nur für dich sichtbar – der Schichtplan bleibt, wie er ist.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {arten.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onEigen(a.id);
                  setAuswahl(false);
                }}
                aria-pressed={eigen?.id === a.id}
                className="h-11 truncate rounded-[13px] px-2 text-[14px] font-semibold active:scale-[0.97]"
                style={farbStil(a.farbe)}
              >
                {a.name}
              </button>
            ))}
            <button
              type="button"
              onClick={onNeueArt}
              className={cn(
                "flex h-11 items-center justify-center gap-1 rounded-[13px] border border-dashed border-ink/25 px-2 text-[13.5px] font-semibold text-ink-muted",
                !arten.length && "col-span-3",
              )}
            >
              <Plus className="h-4 w-4" /> {arten.length ? "Neu" : "Eigenen Eintrag anlegen"}
            </button>
          </div>
        </div>
      ) : null}

      {partner ? (
        <button
          type="button"
          onClick={onPartner}
          className="mt-3 flex w-full items-center gap-3 rounded-[16px] bg-ink/[0.04] px-3.5 py-2.5 text-left text-[15px]"
        >
          <span className={cn("rounded-md px-2 py-0.5 text-[13px] font-semibold ring-[1.5px] ring-inset", PARTNER_FARBE[partner])}>
            {partnerText(partner)}
          </span>
          <span className="text-ink-muted">Partner: {partnerText(partner, true)}</span>
        </button>
      ) : null}

      {termine.length ? (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Termine</p>
          <ul className="overflow-hidden rounded-[16px] bg-ink/[0.04]">
            {termine.map((t, i) => (
              <li key={t.id} className={cn(i > 0 && "glas-linie border-t")}>
                <button
                  type="button"
                  onClick={() => onTermin(t)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left active:bg-ink/[0.05]"
                >
                  <span className="min-w-0 truncate text-[15px]">
                    <span className={cn("mr-2 inline-block h-2 w-2 rounded-full align-middle", t.vonPartner ? "bg-brand-500" : "bg-ink-faint")} />
                    {t.titel || "Termin"}
                    {t.vonPartner ? <span className="ml-1 text-[12px] text-brand-600">· Partner</span> : null}
                  </span>
                  <span className="tnum shrink-0 text-[13px] text-ink-muted">
                    {t.ganztaegig ? "ganztägig" : `${t.von}${t.bis ? `–${t.bis}` : ""}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Blatt>
  );
}

function AnpassenBlatt({
  schichten,
  farben,
  arten,
  partnerZeigen,
  onPartnerZeigen,
  onFarbe,
  onArt,
  onNeueArt,
  onClose,
}: {
  schichten: ShiftDetail[];
  farben: Record<string, string>;
  arten: EigeneArt[] | null;
  partnerZeigen: boolean;
  onPartnerZeigen: (an: boolean) => void;
  onFarbe: (schluessel: string, farbe: string | null) => void;
  onArt: (a: EigeneArt) => void;
  onNeueArt: () => void;
  onClose: () => void;
}) {
  const [offen, setOffen] = useState<string | null>(null);

  // Schichten der Firma (aktive), sonst Früh/Spät/Nacht.
  const aktive = schichten.filter((s) => s.active);
  const schichtZeilen = (
    aktive.length
      ? aktive.map((s) => ({ schluessel: schichtSchluessel(s.shortName, s.name), name: s.name }))
      : [
          { schluessel: "schicht:F", name: "Frühschicht" },
          { schluessel: "schicht:S", name: "Spätschicht" },
          { schluessel: "schicht:N", name: "Nachtschicht" },
        ]
  ).concat([{ schluessel: "frei", name: "Frei" }]);
  const abwZeilen = ABW_IN_EINSTELLUNGEN.map((c) => ({ schluessel: `abw:${c}`, name: ABWESENHEIT[c]!.lang }));

  return (
    <Blatt titel="Kalender anpassen" unter="Gilt nur für dich – der Schichtplan bleibt unverändert." onClose={onClose}>
      <p className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Farben der Schichten</p>
      <ul className="overflow-hidden rounded-[18px] bg-ink/[0.04]">
        {schichtZeilen.map((z) => (
          <FarbZeile key={z.schluessel} {...z} farben={farben} offen={offen} setOffen={setOffen} onFarbe={onFarbe} />
        ))}
      </ul>

      <p className="mb-1.5 mt-5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Farben der Abwesenheiten</p>
      <ul className="overflow-hidden rounded-[18px] bg-ink/[0.04]">
        {abwZeilen.map((z) => (
          <FarbZeile key={z.schluessel} {...z} farben={farben} offen={offen} setOffen={setOffen} onFarbe={onFarbe} />
        ))}
      </ul>

      <p className="mb-1.5 mt-5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Eigene Einträge</p>
      <ul className="overflow-hidden rounded-[18px] bg-ink/[0.04]">
        {(arten ?? []).map((a) => (
          <li key={a.id} className="glas-linie border-b">
            <button type="button" onClick={() => onArt(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                style={farbStil(a.farbe)}
              >
                {a.kuerzel}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15.5px]">{a.name}</span>
              <span className="tnum text-[13px] text-ink-muted">{a.beginn && a.ende ? `${a.beginn}–${a.ende}` : ""}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onNeueArt}
            className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] font-semibold text-brand-600"
          >
            <Plus className="h-[18px] w-[18px]" /> Eigener Eintrag
          </button>
        </li>
      </ul>
      <p className="mt-1.5 px-1 text-[12px] text-ink-faint">
        Zum Beispiel „Nebenjob“ oder „Schicht getauscht“ – im Kalender mit gestricheltem Rand, nur für dich sichtbar.
      </p>

      <p className="mb-1.5 mt-5 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Anzeige</p>
      <div className="flex items-center justify-between gap-3 rounded-[18px] bg-ink/[0.04] px-4 py-3">
        <span id="anpassen-partner" className="text-[15.5px]">
          Schichten des Partners zeigen
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={partnerZeigen}
          aria-labelledby="anpassen-partner"
          onClick={() => onPartnerZeigen(!partnerZeigen)}
          className={cn("relative h-8 w-[52px] shrink-0 rounded-full transition-colors", partnerZeigen ? "bg-brand-500" : "bg-ink/[0.12]")}
        >
          <span
            className={cn(
              "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
              partnerZeigen && "translate-x-5",
            )}
          />
        </button>
      </div>
    </Blatt>
  );
}

function FarbZeile({
  schluessel,
  name,
  farben,
  offen,
  setOffen,
  onFarbe,
}: {
  schluessel: string;
  name: string;
  farben: Record<string, string>;
  offen: string | null;
  setOffen: (s: string | null) => void;
  onFarbe: (schluessel: string, farbe: string | null) => void;
}) {
  const farbe = farbeFuer(schluessel, farben);
  const eigen = !!farben[schluessel];
  const auf = offen === schluessel;
  return (
    <li className="glas-linie border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOffen(auf ? null : schluessel)}
        aria-expanded={auf}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn("h-7 w-7 shrink-0 rounded-full", !farbe && "bg-ink/[0.1]")}
          style={farbe ? { backgroundColor: farbe } : undefined}
        />
        <span className="min-w-0 flex-1 truncate text-[15.5px]">{name}</span>
        <span className="text-[13px] text-ink-muted">{eigen ? "Eigene Farbe" : "Standard"}</span>
      </button>
      {auf ? (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {FARBEN.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFarbe(schluessel, f)}
              aria-label={`${name}: Farbe ${f}`}
              aria-pressed={farben[schluessel] === f}
              className={cn("h-9 w-9 rounded-full", farben[schluessel] === f && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              style={{ backgroundColor: f }}
            />
          ))}
          <button
            type="button"
            onClick={() => onFarbe(schluessel, null)}
            disabled={!eigen}
            className="h-9 rounded-full bg-ink/[0.07] px-3 text-[13px] font-semibold text-ink-muted disabled:opacity-40"
          >
            Standard
          </button>
        </div>
      ) : null}
    </li>
  );
}
