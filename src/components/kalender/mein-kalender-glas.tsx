"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Blatt } from "@/components/privat/blatt";
import { useSession } from "@/context/session";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import {
  fetchMeineTermine,
  personTageSetzen,
  setzeMeinePartnerTage,
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
import { holeEigeneTage, merkeEigeneTage } from "./stand-geraet";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";
import { neuGesehenSchluessel } from "@/components/layout/neu-marke";
import { TerminBlatt, termineAm, type Termin, type TerminEingabe } from "./termine";
import { useZellenHoehe, terminZeilen } from "./zellen";
import { AmTag, EintragPille, SchichtLeiste, TagKnoepfe, Tagesansicht, TodoBlatt, useLangDruck, type Band } from "./tag";
import { useVorlieben } from "./vorschlaege";
import { terminLoeschenModus, terminSichernUeberall, type LoeschModus } from "@/lib/data/verbindungen";
import { fetchTodos, todoErledigt, todoLoeschen, todoSpeichern, todosAm, type Todo } from "@/lib/data/todos";
import { KalenderTeilen } from "./teilen";
import { PartnerBlatt, type PartnerSchicht } from "./partner";
import { AnDiesemTag, AndereTags, WenSeheIch, useAndere, type AndererEintrag } from "./andere";
import { setzeLokal, useLokalNachLaden } from "./lokal";
import { KalenderEinfuehrung } from "./einfuehrung";
import { EigeneArtBlatt } from "./eigene-art";
import { PinselKnopf, PinselLeiste, useMonatWischen } from "./pinsel";
import { TodoZaehler, offeneBisHeute } from "./todo-zaehler";
import { ProfilBlatt, useBenachrichtigungen } from "./profil-blatt";
import { Avatar } from "@/components/ui/avatar";

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
      const zellen = await fetchShiftPlanGrid(company.id, s, n);
      const tage = new Map<string, LiveShiftPlanCell>();
      for (const z of zellen) if (z.isMe) tage.set(z.day, z);
      const ergebnis: Stand = { schluessel: schluessel(s, n), tage, imPlan: tage.size > 0 };
      inZwischenspeicher(schluessel(s, n), ergebnis);
      merkeEigeneTage(schluessel(s, n), tage, tage.size > 0);
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
    else {
      // Gleich nach dem Öffnen der App: der letzte Stand vom Gerät, bis die frischen Daten da sind.
      const vomGeraet = holeEigeneTage(schluessel(s, n));
      if (vomGeraet) setStand({ schluessel: schluessel(s, n), ...vomGeraet });
    }
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

  // Partner, Familie, Freunde – was sie eintragen, und wen man gerade sieht.
  const andere = useAndere({ benutzer: profile.id, von: start, bis: ende });
  const neuLadenAndere = andere.neuLaden;
  // Was Eingeladene eintragen, alle 20 Sekunden frisch, solange sichtbar.
  useEffect(() => {
    const takt = window.setInterval(() => {
      if (document.visibilityState === "visible") void neuLadenAndere();
    }, 20_000);
    return () => window.clearInterval(takt);
    // Nur einmal einrichten – neuLaden bleibt aktuell genug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, ende]);

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
  async function terminSpeichern(t: TerminEingabe, alt: Termin | null = null) {
    try {
      await terminSichernUeberall(t, alt);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gespeichert werden.");
    }
    void ladeTermine();
  }
  async function terminLoeschen(t: Termin, modus: LoeschModus, datum: string) {
    try {
      await terminLoeschenModus(t, modus, datum);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gelöscht werden.");
    }
    void ladeTermine();
    void andere.neuLaden();
  }

  const sichtbareTermine = useMemo(
    () => [...termine, ...andere.fremdeTermine].filter(andere.terminSichtbar),
    [termine, andere.fremdeTermine, andere.terminSichtbar],
  );
  /** Verbundene Konten, bei denen ich eintragen darf. */
  const ziele = andere.verbindungen.filter((v) => v.erDarf).map((v) => ({ id: v.partner, name: v.name || "Verbunden" }));

  /** Eigene Termine und Einträge bei Verbundenen darf man löschen, fremde nicht. */
  const darfTerminLoeschen = (t: Termin) => (t.inhaber ? t.vonUser === profile.id : true);

  async function terminVerschieben(t: Termin, von: string, bis: string) {
    setTermine((alt) => alt.map((x) => (x.id === t.id ? { ...x, von, bis } : x)));
    await terminSpeichern({ ...t, von, bis }, t.inhaber ? t : null);
  }

  // ---- To-dos (nur für mich) ----------------------------------------------
  const [todos, setTodos] = useState<Todo[]>([]);
  const { vorlieben } = useVorlieben();
  const ladeTodos = useCallback(async () => {
    try {
      setTodos(await fetchTodos());
    } catch {
      // To-dos sind Beiwerk.
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladeTodos();
  }, [ladeTodos]);
  async function todoSetzen(id: string, an: boolean) {
    setTodos((alt) => alt.map((t) => (t.id === id ? { ...t, erledigt: an } : t)));
    try {
      await todoErledigt(id, an);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      void ladeTodos();
    }
  }

  // ---- Teilen ------------------------------------------------------------
  const [einladen, setEinladen] = useState(false);
  useEffect(() => {
    setzeLokal(neuGesehenSchluessel("kalender-partner"), true);
  }, []);
  const einfuehrungGesehen = useLokalNachLaden(`schichtplan.kalender-einfuehrung-2.${profile.id}`, false, true);
  /** Tag einer eingeladenen Person selbst eintragen (ohne Personen: „Partner“). */
  async function partnerSetzen(person: string | null, von: string, anzahl: number, code: PartnerSchicht | null) {
    try {
      if (person) await personTageSetzen(person, von, anzahl, code);
      else await setzeMeinePartnerTage(von, anzahl, code);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das konnte nicht gespeichert werden.");
    }
    void andere.neuLaden();
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

  // ---- Rückgängig (eigene Einträge) ---------------------------------------
  const [rueck, setRueck] = useState<{ text: string; vorher: Record<string, string | undefined> } | null>(null);
  const rueckUhr = useRef<number | null>(null);
  function merke(liste: string[], text: string) {
    setRueck((alt) => {
      const vorher: Record<string, string | undefined> = { ...(alt && rueckUhr.current ? alt.vorher : {}) };
      for (const t of liste) if (!(t in vorher)) vorher[t] = eigene[t];
      const n = Object.keys(vorher).length;
      return { text: text.replace("{n}", n === 1 ? "1 Tag" : `${n} Tage`), vorher };
    });
    if (rueckUhr.current) window.clearTimeout(rueckUhr.current);
    rueckUhr.current = window.setTimeout(() => {
      rueckUhr.current = null;
      setRueck(null);
    }, 7000);
  }
  function rueckgaengig() {
    const r = rueck;
    if (!r) return;
    if (rueckUhr.current) window.clearTimeout(rueckUhr.current);
    rueckUhr.current = null;
    setRueck(null);
    const nachWert = new Map<string | null, string[]>();
    for (const [tag, id] of Object.entries(r.vorher)) {
      const k = id ?? null;
      nachWert.set(k, [...(nachWert.get(k) ?? []), tag]);
    }
    for (const [id, liste] of nachWert) void eigenSetzen(liste, id);
  }

  // ---- Blätter -----------------------------------------------------------
  const [tagBlatt, setTagBlatt] = useState<{ iso: string; auswahl: boolean } | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null; startZeit?: string } | null>(null);
  const [tagAnsicht, setTagAnsicht] = useState<string | null>(null);
  const [todoBlatt, setTodoBlatt] = useState<{ datum: string | null } | null>(null);
  const [partnerBlatt, setPartnerBlatt] = useState<{ iso: string; person: string | null } | null>(null);
  const [anpassen, setAnpassen] = useState(false);
  const [profilOffen, setProfilOffen] = useState(false);
  const { items: meldungen, setItems: setMeldungen } = useBenachrichtigungen();
  const ungelesen = (meldungen ?? []).some((n) => !n.readAt);
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
  const { flaeche, griffe, blaettern, gewischt } = useMonatWischen(springe);
  const { ref: zellenRef, hoehe: zellenHoehe } = useZellenHoehe();

  // Lange auf einen Tag drücken: neuer Termin für diesen Tag.
  const langDruck = useLangDruck((iso) => {
    if (pinselAn) return;
    setTerminBlatt({ datum: iso, termin: null });
  });
  function tippen(iso: string) {
    if (langDruck.geschluckt()) return;
    if (gewischt.current) return;
    if (pinselAn && pinsel && (pinsel === "leer" || artNach.has(pinsel))) {
      if (pinsel === "leer" && !eigene[iso]) return;
      merke([iso], pinsel === "leer" ? "{n} geleert" : `{n} auf ${artNach.get(pinsel)?.name ?? "neu"} gesetzt`);
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
        "privat fixed inset-0 z-10 flex flex-col px-0 pb-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.5rem)] pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-6",
        "lg:static lg:z-auto lg:h-[calc(100dvh-7rem)] lg:min-h-[520px] lg:rounded-[28px] lg:px-4 lg:pb-4 lg:pt-0",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-1.5 sm:px-0 sm:pb-2.5 sm:pt-3">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-bold leading-[1.05] tracking-[-0.02em] [@media(max-width:360px)]:text-[22px]">
            {monthName(monat.monat)}
          </h1>
          <p className="tnum mt-0.5 truncate text-[13px] font-medium leading-none text-ink-muted">
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
        <div className="flex shrink-0 items-center gap-2 [@media(max-width:360px)]:gap-1.5">
          <span className="hidden gap-2 sm:flex">
            <GlasKnopf label="Vorheriger Monat" onClick={() => blaettern(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </GlasKnopf>
            <GlasKnopf label="Nächster Monat" onClick={() => blaettern(1)}>
              <ChevronRight className="h-5 w-5" />
            </GlasKnopf>
          </span>
          <TodoZaehler anzahl={offeneBisHeute(todos, heute)} onClick={() => setTodoBlatt({ datum: heute })} />
          <WenSeheIch andere={andere} glas onVerwalten={() => setEinladen(true)} />
          {/* Auf dem Handy fehlt hier die Kopfleiste: Profil, Meldungen, Abmelden. */}
          <span className="relative lg:hidden">
            <GlasKnopf
              label={ungelesen ? "Profil, ungelesene Benachrichtigungen" : "Profil"}
              onClick={() => setProfilOffen(true)}
            >
              <Avatar employee={profile} className="h-7 w-7 bg-ink/[0.08] text-[11px]" />
            </GlasKnopf>
            {ungelesen ? (
              <span aria-hidden className="absolute right-0 top-0 h-3 w-3 rounded-full bg-crit-dot ring-2 ring-white/80" />
            ) : null}
          </span>
        </div>
      </header>

      {fehler ? (
        <div className="px-3.5 pb-2 sm:px-0">
          <Alert tone="error">{fehler}</Alert>
          <button type="button" className="mt-1 text-[13px] font-semibold text-brand-600 underline" onClick={() => void laden()}>
            Erneut versuchen
          </button>
        </div>
      ) : null}
      {sichtbar && !sichtbar.imPlan ? (
        <p className="px-3.5 pb-2 text-[13px] text-ink-muted sm:px-0">
          Für dein Konto ist im Schichtplan keine Person hinterlegt – deshalb bleibt der Kalender leer.
        </p>
      ) : null}

      {/* Rahmen, der die Fläche beim Blättern beschneidet (mit Platz für den Schatten). */}
      <div className="relative -m-2 flex min-h-0 flex-1 flex-col overflow-hidden p-2">
      <div
        ref={flaeche}
        className="glas relative grid min-h-0 flex-1 touch-none select-none grid-cols-7 overflow-hidden rounded-none will-change-transform sm:rounded-[22px]"
        style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
        {...griffe}
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
          const andereAm = andere.amTag(iso);
          const partner = andereAm.length > 0;
          const ts = termineAm(sichtbareTermine, iso);
          // Wird es eng (Schicht + Antrag + eigener Eintrag, oder dazu
          // Eingeladene), steht der eigene Eintrag als Punkt an der Tageszahl.
          const eigenAlsPunkt = !!eigen && plan.length + 1 + (partner ? 1 : 0) >= 3;
          const kaestchen = plan.length + (eigen && !eigenAlsPunkt ? 1 : 0);
          const klein = kaestchen >= 2;
          // Termine stehen untereinander – so viele, wie in die Zelle passen.
          const zeilen = terminZeilen(zellenHoehe, { kaestchen, klein, eingeladene: partner });
          const zeigen = ts.length > zeilen ? ts.slice(0, Math.max(0, zeilen - 1)) : ts;
          const rest = ts.length - zeigen.length;
          return (
            <button
              key={iso}
              ref={i === 7 ? zellenRef : undefined}
              type="button"
              {...langDruck.zelle(iso)}
              onClick={() => tippen(iso)}
              aria-label={`${WOCHENTAG_LANG[d.getDay()]}, ${formatDE(iso)}: ${beschreibung(info)}${eigen ? `, eigener Eintrag: ${eigen.name}` : ""}${andereAm.map((e) => `, ${e.name}: ${e.code}`).join("")}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
              className={cn(
                "glas-linie flex min-h-0 flex-col items-stretch gap-[2px] overflow-hidden border-t px-[2px] pb-0.5 pt-[3px] text-center outline-none transition-colors [-webkit-touch-callout:none] active:bg-ink/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
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
              <AndereTags eintraege={andereAm} />
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
                <span className="shrink-0 truncate whitespace-nowrap text-left text-[10px] font-semibold leading-[1.25] text-ink-faint [@media(max-height:750px)]:hidden">
                  +{rest} {zeigen.length ? "mehr" : rest === 1 ? "Termin" : "Termine"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

        {!pinselAn ? (
          <PinselKnopf
            onClick={() => {
              setPinselAn(true);
              if ((!pinsel || (pinsel !== "leer" && !artNach.has(pinsel))) && arten?.length) setPinsel(arten[0]!.id);
            }}
          />
        ) : null}
      </div>

      {pinselAn ? (
        <PinselLeiste
          eintraege={arten ?? []}
          aktiv={pinsel}
          onWahl={setPinsel}
          onNeu={() => neueArt(null)}
          onMehr={() => setAnpassen(true)}
          onClose={() => setPinselAn(false)}
          nurHandy
        />
      ) : null}

      {tagBlatt ? (
        <TagBlatt
          key={tagBlatt.iso}
          iso={tagBlatt.iso}
          info={tagInfo(zellen.get(tagBlatt.iso))}
          geladen={!!sichtbar}
          farben={farben}
          schicht={(() => {
            const n = zellen.get(tagBlatt.iso)?.shiftName;
            return n ? uhrzeit.get(n) : undefined;
          })()}
          eigen={eigene[tagBlatt.iso] ? artNach.get(eigene[tagBlatt.iso]!) : undefined}
          arten={arten ?? []}
          termine={termineAm(sichtbareTermine, tagBlatt.iso)}
          todos={todosAm(todos, tagBlatt.iso)}
          andere={andere.amTag(tagBlatt.iso)}
          terminVon={andere.terminVon}
          onTodo={(id, an) => void todoSetzen(id, an)}
          onTag={() => {
            setTagAnsicht(tagBlatt.iso);
            setTagBlatt(null);
          }}
          onEigen={(id) => {
            merke([tagBlatt.iso], id ? "{n} geändert" : "Eintrag entfernt");
            void eigenSetzen([tagBlatt.iso], id);
          }}
          onNeueArt={() => {
            const iso = tagBlatt.iso;
            setTagBlatt(null);
            neueArt(iso);
          }}
          onTermin={(t) => {
            setTerminBlatt({ datum: tagBlatt.iso, termin: t });
            setTagBlatt(null);
          }}
          onTerminLoeschen={(t, modus, datum) => void terminLoeschen(t, modus, datum)}
          darfLoeschen={darfTerminLoeschen}
          onPartner={(key) => {
            setPartnerBlatt({ iso: tagBlatt.iso, person: key ?? andere.knoten[0]?.key ?? null });
            setTagBlatt(null);
          }}
          onClose={() => setTagBlatt(null)}
          offen={tagBlatt.auswahl}
        />
      ) : null}

      {tagAnsicht ? (
        <Tagesansicht
          iso={tagAnsicht}
          heute={heute}
          onIso={(iso) => {
            setTagAnsicht(iso);
            const d = fromISO(iso);
            if (d.getFullYear() !== monat.jahr || d.getMonth() !== monat.monat) setMonat({ jahr: d.getFullYear(), monat: d.getMonth() });
          }}
          baender={(iso) => {
            const liste: Band[] = [];
            const z = zellen.get(iso);
            const info = tagInfo(z);
            const det = z?.shiftName ? uhrzeit.get(z.shiftName) : undefined;
            const abw = info.abwesenheit;
            if (info.schichtName && det?.startTime && det.endTime && !(abw && abw === abw.toUpperCase())) {
              liste.push({
                name: info.schichtName,
                beginn: det.startTime,
                ende: det.endTime,
                farbe: farbeFuer(schichtSchluessel(info.schichtCode, info.schichtName), farben) ?? SONSTIGE_SCHICHT_FARBE,
              });
            }
            const e = eigene[iso] ? artNach.get(eigene[iso]!) : undefined;
            if (e?.beginn && e.ende) liste.push({ name: e.name, beginn: e.beginn, ende: e.ende, farbe: e.farbe });
            return liste;
          }}
          ganztaegig={(iso) => {
            const info = tagInfo(zellen.get(iso));
            const abw = info.abwesenheit;
            const liste: { name: string; farbe: string }[] = [];
            if (abw && abw === abw.toUpperCase()) {
              liste.push({ name: ABWESENHEIT[abw]?.lang ?? "Abwesend", farbe: farbeFuer(`abw:${abw}`, farben) ?? STANDARD_FARBE["abw:A"]! });
            }
            const e = eigene[iso] ? artNach.get(eigene[iso]!) : undefined;
            if (e && (!e.beginn || !e.ende)) liste.push({ name: e.name, farbe: e.farbe });
            return liste;
          }}
          termineAm={(iso) => termineAm(sichtbareTermine, iso)}
          todos={todos}
          terminVon={andere.terminVon}
          onTermin={(t, startZeit) => setTerminBlatt({ datum: tagAnsicht, termin: t, startZeit })}
          onVerschieben={(t, von, bis) => void terminVerschieben(t, von, bis)}
          onLoeschen={(t, modus, datum) => void terminLoeschen(t, modus, datum)}
          darfLoeschen={darfTerminLoeschen}
          onTodo={(id, an) => void todoSetzen(id, an)}
          onTodos={() => setTodoBlatt({ datum: tagAnsicht })}
          onClose={() => setTagAnsicht(null)}
        />
      ) : null}

      {todoBlatt ? (
        <TodoBlatt
          todos={todos}
          heute={heute}
          datum={todoBlatt.datum}
          rollen={vorlieben?.rollen ?? []}
          onNeu={async (t) => {
            await todoSpeichern({ id: null, ...t });
            await ladeTodos();
          }}
          onErledigt={(id, an) => void todoSetzen(id, an)}
          onLoeschen={(id) => {
            setTodos((alt) => alt.filter((t) => t.id !== id));
            void todoLoeschen(id).catch((e: unknown) => {
              setFehler(e instanceof Error ? e.message : "Das To-do konnte nicht gelöscht werden.");
              void ladeTodos();
            });
          }}
          onClose={() => setTodoBlatt(null)}
        />
      ) : null}

      {anpassen ? (
        <AnpassenBlatt
          schichten={schichten}
          farben={farben}
          arten={arten}
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

      {profilOffen ? (
        <ProfilBlatt items={meldungen} setItems={setMeldungen} onClose={() => setProfilOffen(false)} />
      ) : null}

      {editor ? (
        <EigeneArtBlatt
          wert={editor.wert}
          vergeben={(arten ?? []).filter((x) => x.id !== editor.wert.id).map((x) => x.kuerzel)}
          onClose={() => editorZu(false)}
          onFertig={() => editorZu(true)}
        />
      ) : null}

      {terminBlatt ? (
        <TerminBlatt
          glas
          vorschlaege
          startZeit={terminBlatt.startZeit}
          datum={terminBlatt.datum}
          termin={terminBlatt.termin}
          ziele={ziele}
          hinweis={
            terminBlatt.termin?.inhaber
              ? `Aus dem Kalender von ${andere.terminVon(terminBlatt.termin)?.name ?? "einer verbundenen Person"}.`
              : terminBlatt.termin?.vonPartner
                ? `Von ${andere.terminVon(terminBlatt.termin)?.name ?? "einer eingeladenen Person"} eingetragen. Ihr seht ihn beide.`
                : "Eingeladene sehen deine Termine nur, wenn du es beim Teilen erlaubst."
          }
          nurLesen={terminBlatt.termin?.inhaber ? terminBlatt.termin.vonUser !== profile.id : false}
          onSpeichern={(t) => {
            void terminSpeichern(t, terminBlatt.termin);
            setTerminBlatt(null);
          }}
          serieLoeschen
          onLoeschen={(_id, modus, datum) => {
            if (terminBlatt.termin) void terminLoeschen(terminBlatt.termin, modus ?? "alle", datum ?? terminBlatt.datum);
            setTerminBlatt(null);
          }}
          onClose={() => setTerminBlatt(null)}
        />
      ) : null}

      {partnerBlatt ? (
        <PartnerBlatt
          glas
          datum={partnerBlatt.iso}
          aktuell={partnerBlatt.person ? andere.rohTag(partnerBlatt.person, partnerBlatt.iso) : null}
          hinweis="Das siehst du – und die Person, wenn sie eingeladen ist."
          personen={andere.knoten}
          person={partnerBlatt.person}
          onPerson={(key) => setPartnerBlatt({ ...partnerBlatt, person: key })}
          onWahl={(code, anzahl) => {
            void partnerSetzen(partnerBlatt.person, partnerBlatt.iso, anzahl, code);
            setPartnerBlatt(null);
          }}
          onClose={() => setPartnerBlatt(null)}
          onEinladen={() => {
            setPartnerBlatt(null);
            setEinladen(true);
          }}
        />
      ) : null}

      {einladen ? (
        <KalenderTeilen vorname={profile.firstName} onGeaendert={() => void andere.neuLaden()} onClose={() => setEinladen(false)} />
      ) : null}

      {rueck ? (
        <div
          role="status"
          className="fixed inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+0.25rem)] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-[16px] bg-[#1F294D] px-4 py-3 text-[14px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
        >
          <span className="min-w-0 truncate">{rueck.text}</span>
          <button type="button" onClick={rueckgaengig} className="shrink-0 font-bold text-[#8fb0ff]">
            Rückgängig
          </button>
        </div>
      ) : null}

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
        "flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-11 sm:w-11 [@media(max-width:360px)]:h-9 [@media(max-width:360px)]:w-9",
        aktiv ? "bg-brand-500 text-white shadow-[0_6px_18px_rgba(47,91,234,0.4)]" : "glas text-ink",
      )}
    >
      {children}
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

/**
 * Tagesfenster: oben klein der Plan und der eigene Eintrag, darunter die
 * eigenen Einträge als Leiste (nur für mich – der Schichtplan bleibt), dann
 * was am Tag ansteht und die Knöpfe Termin, To-do und Tag.
 */
function TagBlatt({
  iso,
  info,
  geladen,
  farben,
  schicht,
  eigen,
  arten,
  termine,
  todos,
  andere,
  terminVon,
  onEigen,
  onNeueArt,
  onTermin,
  onTerminLoeschen,
  darfLoeschen,
  onTodo,
  onTag,
  onPartner,
  onClose,
  offen = false,
}: {
  iso: string;
  info: TagInfo;
  geladen: boolean;
  farben: Record<string, string>;
  schicht: ShiftDetail | undefined;
  eigen: EigeneArt | undefined;
  arten: EigeneArt[];
  termine: Termin[];
  todos: Todo[];
  andere: AndererEintrag[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  onEigen: (id: string | null) => void;
  onNeueArt: () => void;
  onTermin: (t: Termin | null) => void;
  onTerminLoeschen: (t: Termin, modus: LoeschModus, datum: string) => void;
  darfLoeschen: (t: Termin) => boolean;
  onTodo: (id: string, an: boolean) => void;
  onTag: () => void;
  /** Tag einer Person selbst eintragen (ohne Angabe: die erste). */
  onPartner: (key?: string) => void;
  onClose: () => void;
  /** Die Auswahl für den eigenen Eintrag gleich offen (nach „Neu“). */
  offen?: boolean;
}) {
  const d = fromISO(iso);
  const abw = info.abwesenheit;
  const gross = abw?.toUpperCase() ?? null;
  const beantragt = abw !== null && abw !== gross;
  const [aendern, setAendern] = useState(offen);
  const [nachricht, setNachricht] = useState(
    arten.length ? "Antippen = dein eigener Eintrag dazu · der Schichtplan bleibt" : "Leg eigene Einträge an, z. B. Nebenjob oder Sport.",
  );

  // Der Eintrag aus dem Schichtplan – fest, nur zum Ansehen.
  let plan: { name: string; zeit: string | null; farbe: string } | null = null;
  if (geladen) {
    if (abw && !beantragt) {
      plan = {
        name: ABWESENHEIT[abw]?.lang ?? "Abwesend",
        zeit: info.schichtName ? `statt ${info.schichtName}` : null,
        farbe: farbeFuer(`abw:${abw}`, farben) ?? STANDARD_FARBE["abw:A"]!,
      };
    } else if (info.schichtName) {
      plan = {
        name: info.schichtName,
        zeit: schicht?.startTime && schicht.endTime ? `${schicht.startTime}–${schicht.endTime}` : null,
        farbe: farbeFuer(schichtSchluessel(info.schichtCode, info.schichtName), farben) ?? SONSTIGE_SCHICHT_FARBE,
      };
    } else {
      plan = { name: "Frei", zeit: null, farbe: farbeFuer("frei", farben) ?? "#C9CDD4" };
    }
  }

  function tipp(id: string) {
    const a = arten.find((x) => x.id === id);
    if (!a) return;
    if (eigen?.id === id) {
      setNachricht(`${a.name} ist schon eingetragen – der Schichtplan selbst bleibt immer.`);
      return;
    }
    onEigen(id);
    setNachricht(eigen ? `${a.name} statt ${eigen.name} · nur für dich` : `${a.name} als 2. Eintrag · nur für dich`);
  }

  const nichts = !plan && !eigen && !beantragt && !termine.length && !todos.length && !andere.length;
  return (
    <Blatt
      wischZu
      titel={`${WOCHENTAG_LANG[d.getDay()]}, ${d.getDate()}. ${monthName(d.getMonth())}`}
      unter={
        <span className="mt-1 flex flex-wrap gap-1.5">
          {plan ? <EintragPille name={plan.name} zeit={plan.zeit} farbe={plan.farbe} marke="Plan" /> : null}
          {beantragt && gross ? (
            <EintragPille
              name={`${ABWESENHEIT[gross]?.lang ?? "Antrag"} beantragt`}
              farbe={farbeFuer(`abw:${gross}`, farben) ?? "#5B6472"}
            />
          ) : null}
          {eigen ? (
            <EintragPille
              name={eigen.name}
              zeit={eigen.beginn && eigen.ende ? `${eigen.beginn}–${eigen.ende}` : null}
              farbe={eigen.farbe}
              onEntfernen={
                aendern
                  ? () => {
                      onEigen(null);
                      setNachricht("Eintrag entfernt.");
                    }
                  : undefined
              }
            />
          ) : null}
        </span>
      }
      onClose={onClose}
    >
      {nichts ? <p className="px-1 py-2 text-[14.5px] text-ink-muted">An diesem Tag ist nichts geplant.</p> : null}
      <AmTag
        termine={termine}
        todos={todos}
        terminVon={terminVon}
        onTermin={onTermin}
        onTodo={onTodo}
        datum={iso}
        onLoeschen={onTerminLoeschen}
        darfLoeschen={darfLoeschen}
      />
      <AnDiesemTag eintraege={andere} onPerson={(key) => onPartner(key)} className="mt-3" />

      {aendern ? (
        <div className="mt-3">
          <SchichtLeiste
            eintraege={arten.map((a) => ({ id: a.id, name: a.name, farbe: a.farbe, rang: eigen?.id === a.id ? 2 : 0 }))}
            onTipp={tipp}
            nachricht={nachricht}
            ende={
              <button
                type="button"
                onClick={onNeueArt}
                className="flex h-11 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-dashed border-ink/25 px-4 text-[14px] font-semibold text-ink-muted"
              >
                <Plus className="h-4 w-4" /> {arten.length ? "Neu" : "Eigenen Eintrag anlegen"}
              </button>
            }
          />
        </div>
      ) : null}
      <TagKnoepfe onTermin={() => onTermin(null)} onTag={onTag} />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <button
          type="button"
          aria-expanded={aendern}
          onClick={() => setAendern((a) => !a)}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-muted"
        >
          <Pencil className="h-4 w-4" /> {aendern ? "Fertig" : "Eigenen Eintrag ändern"}
        </button>
        <button
          type="button"
          onClick={() => onPartner()}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-muted"
        >
          <Users className="h-4 w-4" /> Für Partner oder Familie eintragen
        </button>
      </div>
    </Blatt>
  );
}

function AnpassenBlatt({
  schichten,
  farben,
  arten,
  onFarbe,
  onArt,
  onNeueArt,
  onClose,
}: {
  schichten: ShiftDetail[];
  farben: Record<string, string>;
  arten: EigeneArt[] | null;
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
