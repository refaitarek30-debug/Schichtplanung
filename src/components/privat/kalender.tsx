"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";
import { ChevronLeft, ChevronRight, Clock, Pencil, Repeat, Upload, X } from "lucide-react";
import { aufGeraet, ausGeraet } from "@/lib/geraete-speicher";
import { istOffline } from "@/lib/netz";
import { istWartend, useOfflineTermine } from "@/lib/offline-termine";
import { OfflinePille } from "@/components/kalender/offline-pille";
import { Alert } from "@/components/ui/alert";
import { TerminBlatt, termineAm, type Termin, type TerminEingabe } from "@/components/kalender/termine";
import {
  AmTag,
  EintragPille,
  SchichtLeiste,
  TagKnoepfe,
  Tagesansicht,
  TodoBlatt,
  useLangDruck,
  type LeisteDaten,
} from "@/components/kalender/tag";
import { useFremdeSchichten } from "@/components/kalender/fuer-andere";
import { VerbundenHinweisStreifen } from "@/components/kalender/verbunden-hinweis";
import { useVorlieben } from "@/components/kalender/vorschlaege";
import { useAnzeige } from "@/lib/anzeige";
import { terminLoeschenModus, terminSichernUeberall, type LoeschModus } from "@/lib/data/verbindungen";
import type { PartnerCode } from "@/lib/data/partner";
import { fetchTodos, todoErledigt, todoLoeschen, todoSpeichern, todosAm, type Todo } from "@/lib/data/todos";
import { AnDiesemTag, AndereTags, WenSeheIch, useAndere, type Andere, type AndererEintrag } from "@/components/kalender/andere";
import { KalenderTeilen } from "@/components/kalender/teilen";
import { terminZeilen, useZellenHoehe } from "@/components/kalender/zellen";
import { PinselKnopf, PinselLeiste, usePinselStrich } from "@/components/kalender/pinsel";
import { MonatsScroller, type MonatsScrollerGriff } from "@/components/kalender/monats-scroller";
import { useLoeschFrage } from "@/components/kalender/loesch-frage";
import {
  fetchMeineTermine,
  speichereTermin,
} from "@/lib/data/partner";
import { addDays, tageAbstand, formatDE, formatDEShort, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import {
  MAX_JE_TAG,
  eintragAus,
  farbStil,
  idsVon,
  ladeFeiertage,
  ladePrivatStand,
  ladeTage,
  ladeTagZeiten,
  leereTage,
  setzeTagZeit,
  speichereTage,
  tagZeitSchluessel,
  type Schichtart,
  type TagEintrag,
  type TagZeit,
} from "@/lib/privat/daten";
import { schichtAmTag } from "@/lib/privat/gehalt";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { Blatt } from "./blatt";
import { RotationBlatt } from "./rotation";
import { EinstiegKarte, FertigBlatt, TeilenKarte } from "./einstieg";
import type { PersonArt } from "@/lib/data/partner";
import { merkeImportDateien } from "@/lib/privat/import-dateien";
import type { Ansicht } from "./ansicht-menue";
import { KALENDER_HEUTE } from "./rahmen";
import { WochenSpalten } from "./woche-spalten";
import { mitBetrieb, useBetriebsschichten } from "./betrieb";
import { PrivatNeuigkeiten } from "./neuigkeiten";
import { PrivatProfilKnopf } from "./profil-knopf";
import { Willkommen, useWillkommenFertig } from "./willkommen";
import { meldeBereichBereit } from "@/lib/bereich";

/**
 * Schichtkalender für Privatkonten: Woche, Monat, Jahr. Eintragen per
 * Antippen (Tagesblatt), per Pinsel (mehrere Tage nacheinander) oder als
 * Schichtfolge (Rotation).
 *
 * Je Tag bis zu drei Einträge (z. B. Schicht und Urlaub). Ein Eintrag
 * bleibt stehen, bis ihn jemand entfernt.
 */


const ANSICHT_SCHLUESSEL = "schichtplan.privat-ansicht";
const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WT_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const LEER: TagEintrag = { schicht: null, zusatz: null, dritte: null };

/** 0 = Montag … 6 = Sonntag */
const wochentag = (iso: string) => (fromISO(iso).getDay() + 6) % 7;
const montagVon = (iso: string) => addDays(iso, -wochentag(iso));

function monatRaster(jahr: number, monat: number) {
  const erster = toISO(new Date(jahr, monat, 1));
  const start = montagVon(erster);
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const wochen = Math.ceil((wochentag(erster) + tage) / 7);
  return { start, wochen };
}

/** Kalenderwoche nach ISO 8601. */
function kw(iso: string): number {
  const d = fromISO(iso);
  const donnerstag = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const ersterDo = new Date(donnerstag.getFullYear(), 0, 4);
  return 1 + Math.round(((donnerstag.getTime() - ersterDo.getTime()) / 864e5 - 3 + ((ersterDo.getDay() + 6) % 7)) / 7);
}

function zeitText(a: Schichtart): string {
  return a.beginn && a.ende ? `${a.beginn}–${a.ende}` : "";
}

/** Die Einträge eines Tages als Schichtarten, in Anzeige-Reihenfolge. */
function arten(e: TagEintrag | undefined, artNach: Map<string, Schichtart>): Schichtart[] {
  return idsVon(e)
    .map((id) => artNach.get(id))
    .filter((a): a is Schichtart => !!a);
}

const OHNE_NETZ = "Ohne Netz kannst du nur neue Termine anlegen – Ändern und Löschen geht wieder mit Netz.";

const EIN_TAG = 24 * 3600_000;
/** Ein Jahr auf dem Gerät: Schichten, Feiertage – und wann (z) bzw. bei welchem Änderungsstand (s) vom Server geladen. */
type JahrGemerkt = { t: Record<string, TagEintrag>; f: Record<string, string>; z?: number; s?: number | null };
/** Bei welchem Änderungsstand Termine bzw. To-dos zuletzt geladen wurden. */
type StandGemerkt = { s: number; z: number } | null;
/** Gleicher Stand und höchstens einen Tag alt (Sicherheitsnetz): dann reicht das Gemerkte. */
function unveraendert(g: StandGemerkt | undefined, stand: number): boolean {
  return !!g && g.s === stand && Date.now() - g.z < EIN_TAG;
}

export function PrivatKalender() {
  const router = useRouter();
  const { konto, betrieb, schichtarten, artNach, artenFehler } = usePrivat();
  const heute = heuteInBerlin();
  const [ansicht, setAnsicht] = useState<Ansicht>("monat");
  // Zuletzt gewählte Ansicht – nur auf diesem Gerät gemerkt.
  useEffect(() => {
    try {
      const g = window.localStorage.getItem(ANSICHT_SCHLUESSEL);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (g === "woche" || g === "jahr") setAnsicht(g);
    } catch {
      // ohne Speicher: Monat
    }
  }, []);
  const [anker, setAnker] = useState(heute);

  // Hinweise im leeren Kalender lassen sich wegklicken – pro Gerät gemerkt. Bis zum Lesen bleiben sie zu.
  const hinweisKey = `sp_hinweis:${konto.userId}`;
  // einstieg: wie oft „Wie arbeitest du?“ mit „Später“ zu ging (ab 2: nur noch der Streifen).
  // teilen: die Karte „Zeig deinen Plan jemandem“ ist für immer zu.
  const [hinweisZu, setHinweisZu] = useState<{ upload: boolean; los: boolean; einstieg: number; teilen: boolean }>({
    upload: true,
    los: true,
    einstieg: 2,
    teilen: true,
  });
  useEffect(() => {
    let v = { upload: false, los: false, einstieg: 0, teilen: false };
    try {
      const g = JSON.parse(window.localStorage.getItem(hinweisKey) ?? "{}") as Partial<typeof v>;
      v = {
        upload: g.upload === true,
        los: g.los === true,
        einstieg: typeof g.einstieg === "number" ? g.einstieg : 0,
        teilen: g.teilen === true,
      };
    } catch {
      // ohne Speicher: Hinweise zeigen
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHinweisZu(v);
  }, [hinweisKey]);
  function hinweisSchliessen(welcher: "upload" | "los" | "teilen" | "einstieg") {
    const v = welcher === "einstieg" ? { ...hinweisZu, einstieg: hinweisZu.einstieg + 1 } : { ...hinweisZu, [welcher]: true };
    setHinweisZu(v);
    try {
      window.localStorage.setItem(hinweisKey, JSON.stringify(v));
    } catch {
      // egal
    }
  }

  const [tage, setTage] = useState<Record<string, TagEintrag>>({});
  const [feiertage, setFeiertage] = useState<Record<string, string>>({});
  const geladen = useRef(new Set<number>());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const [termine, setTermine] = useState<Termin[]>([]);
  const [teilen, setTeilen] = useState(false);
  /** Teilen-Karte: gleich das Formular mit dieser Art öffnen. */
  const [teilenNeu, setTeilenNeu] = useState<PersonArt | null>(null);
  /** „Wie arbeitest du?“ in dieser Sitzung weggeklickt. */
  const [einstiegZu, setEinstiegZu] = useState(false);
  /** Nach dem ersten Plan: „Fertig!“ mit der Frage nach der Erinnerung. */
  const [fertig, setFertig] = useState<{ tage: number; bis: string } | null>(null);
  const ersterPlan = useRef(false);
  /** Zuletzt geänderte Tage – für „Rückgängig“. */
  const [rueck, setRueck] = useState<{ text: string; vorlage: string; vorher: Record<string, TagEintrag | undefined> } | null>(null);
  const rueckUhr = useRef<number | null>(null);

  const [tagBlatt, setTagBlatt] = useState<string | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null; startZeit?: string } | null>(null);
  /** Tagesansicht mit Zeitleiste */
  const [tagAnsicht, setTagAnsicht] = useState<string | null>(null);
  /** Wessen Schichten die Tagesansicht setzt: „ich“ oder das Konto einer verbundenen Person. */
  const [leistePerson, setLeistePerson] = useState("ich");

  // Unten noch mal „Kalender“ getippt: zurück zu heute (offene Tagesansicht zu).
  useEffect(() => {
    const zuHeute = () => {
      setTagAnsicht(null);
      setAnker(heuteInBerlin());
    };
    window.addEventListener(KALENDER_HEUTE, zuHeute);
    return () => window.removeEventListener(KALENDER_HEUTE, zuHeute);
  }, []);
  /** To-do-Liste; datum = vorgeschlagener Tag für neue */
  const [todoBlatt, setTodoBlatt] = useState<{ datum: string | null } | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const { vorlieben } = useVorlieben();
  // Lädt die eigene Wochenend-Einstellung aus dem Konto (wirkt über globals.css).
  useAnzeige();
  const [rotation, setRotation] = useState(false);
  /** Pinsel: Schichtart-Id oder "leer" zum Löschen */
  const [pinsel, setPinsel] = useState<string | null>(null);
  const [pinselAn, setPinselAn] = useState(false);
  // Rückfrage vor dem Löschen von Schichten
  const loesch = useLoeschFrage();

  // ---- sichtbarer Zeitraum ----------------------------------------------
  const ankerD = fromISO(anker);
  const bereich = useMemo(() => {
    const d = fromISO(anker);
    if (ansicht === "jahr") {
      const j = d.getFullYear();
      return { von: `${j}-01-01`, bis: `${j}-12-31` };
    }
    if (ansicht === "woche") {
      const von = montagVon(anker);
      return { von, bis: addDays(von, 6) };
    }
    const { start, wochen } = monatRaster(d.getFullYear(), d.getMonth());
    return { von: start, bis: addDays(start, wochen * 7 - 1) };
  }, [ansicht, anker]);

  // Woche: andere Uhrzeiten an einzelnen Tagen (auch nach dem Schließen eines Tages neu laden).
  const [wochenZeiten, setWochenZeiten] = useState<Record<string, TagZeit>>({});
  const [zeitenStand, setZeitenStand] = useState(0);
  useEffect(() => {
    if (ansicht !== "woche" || tagBlatt || tagAnsicht) return;
    let aus = false;
    void ladeTagZeiten(addDays(bereich.von, -1), bereich.bis).then((z) => !aus && setWochenZeiten(z));
    return () => {
      aus = true;
    };
  }, [ansicht, bereich.von, bereich.bis, zeitenStand, tagBlatt, tagAnsicht]);

  // Mit Betriebszugang (Migration 0194): die eigenen Betriebsschichten, nur zum Ansehen.
  const betriebSchichten = useBetriebsschichten(konto.userId, !!betrieb, bereich.von, bereich.bis);
  const anzeigeTage = useMemo(() => mitBetrieb(tage, betriebSchichten), [tage, betriebSchichten]);
  const anzeigeArtNach = useMemo(
    () => (betriebSchichten.arten.size ? new Map([...artNach, ...betriebSchichten.arten]) : artNach),
    [artNach, betriebSchichten.arten],
  );

  // Änderungsstand der eigenen Daten (Migration 0249): eine kleine Zahl statt aller Daten.
  // Höchstens alle 15 Sekunden gefragt; null = unbekannt, dann wird wie früher geladen.
  const standCache = useRef<{ wert: number | null; zeit: number; laeuft: Promise<number | null> | null }>({ wert: null, zeit: 0, laeuft: null });
  const holeStand = useCallback((frisch = false): Promise<number | null> => {
    const c = standCache.current;
    if (c.laeuft) return c.laeuft;
    if (!frisch && c.zeit && Date.now() - c.zeit < 15_000) return Promise.resolve(c.wert);
    c.laeuft = ladePrivatStand()
      .catch(() => null)
      .then((w) => {
        c.wert = w;
        c.zeit = Date.now();
        c.laeuft = null;
        return w;
      });
    return c.laeuft;
  }, []);
  /** Wann und bei welchem Stand jedes Jahr zuletzt vom Server kam (für den Gerätespeicher). */
  const jahrInfo = useRef(new Map<number, { z: number; s: number | null }>());

  const ladeJahre = useCallback(async (jahre: number[], erneut = false, still = false) => {
    let fehlend = jahre.filter((j) => erneut || !geladen.current.has(j));
    if (!fehlend.length) return;
    const gemerkt = new Map<number, JahrGemerkt>();
    if (!erneut) {
      // Gleich nach dem Öffnen: der zuletzt gemerkte Stand dieses Geräts, bis die frischen Daten da sind.
      for (const j of fehlend) {
        const g = ausGeraet<JahrGemerkt>(`${konto.userId}:privat:jahr:${j}`);
        if (!g?.t || !g.f) continue;
        gemerkt.set(j, g);
        setTage((alt) => (Object.keys(alt).some((k) => k.startsWith(`${j}-`)) ? alt : { ...alt, ...g.t }));
        setFeiertage((alt) => ({ ...g.f, ...alt }));
      }
    }
    // Erst den Stand, dann die Daten: so ist der gemerkte Stand nie neuer als die Daten.
    const stand = await holeStand(erneut);
    if (!erneut) {
      const jetzt = Date.now();
      const dieses = new Date().getFullYear();
      fehlend = fehlend.filter((j) => {
        const g = gemerkt.get(j);
        if (!g?.z) return true;
        const alter = jetzt - g.z;
        const nah = Math.abs(j - dieses) <= 1;
        // Sicherheitsnetz: nahe Jahre spätestens nach einem Tag frisch, ferne nach einer Woche.
        if (alter > (nah ? EIN_TAG : 7 * EIN_TAG)) return true;
        // Nichts geändert seit dem gemerkten Stand: das Handy hat schon alles.
        if (stand !== null && g.s === stand) {
          geladen.current.add(j);
          jahrInfo.current.set(j, { z: g.z, s: g.s });
          return false;
        }
        // Ferner Vorrat im Hintergrund: höchstens einmal am Tag.
        return !(still && !nah && alter < EIN_TAG);
      });
      if (!fehlend.length) return;
    }
    // Vorrat im Hintergrund: keine Ladeanzeige, nichts verschiebt sich.
    if (!still) setLaedt(true);
    try {
      const ergebnisse = await Promise.all(
        fehlend.map(async (j) => {
          const [t, f] = await Promise.all([ladeTage(`${j}-01-01`, `${j}-12-31`), ladeFeiertage(j)]);
          return { j, t, f };
        }),
      );
      setTage((alt) => {
        const neu = { ...alt };
        for (const { j, t } of ergebnisse) {
          for (const k of Object.keys(neu)) if (k.startsWith(`${j}-`)) delete neu[k];
          Object.assign(neu, t);
        }
        return neu;
      });
      setFeiertage((alt) => {
        const neu = { ...alt };
        for (const { f } of ergebnisse) for (const h of f) neu[h.tag] = h.name;
        return neu;
      });
      for (const { j } of ergebnisse) {
        geladen.current.add(j);
        jahrInfo.current.set(j, { z: Date.now(), s: stand });
      }
      setFehler(null);
    } catch (e) {
      // Ohne Netz zeigt der Kalender den gemerkten Stand (Banner „Offline“) – keine Fehlermeldung.
      if (!still && !istOffline()) setFehler(e instanceof Error ? e.message : "Der Kalender konnte nicht geladen werden.");
    } finally {
      if (!still) setLaedt(false);
    }
  }, [konto.userId, holeStand]);

  // Den aktuellen Stand je Jahr auf dem Gerät merken (eigene Schichten und Feiertage, siehe geraete-speicher.ts).
  // Nur Jahre schreiben, die sich geändert haben (es sind bis zu 7 Jahre gemerkt).
  const zuletztGemerkt = useRef(new Map<number, string>());
  useEffect(() => {
    if (laedt) return;
    for (const j of geladen.current) {
      const t: Record<string, TagEintrag> = {};
      for (const [k, v] of Object.entries(tage)) if (k.startsWith(`${j}-`)) t[k] = v;
      const f: Record<string, string> = {};
      for (const [k, v] of Object.entries(feiertage)) if (k.startsWith(`${j}-`)) f[k] = v;
      const info = jahrInfo.current.get(j);
      const wert = JSON.stringify({ t, f, z: info?.z, s: info?.s });
      if (zuletztGemerkt.current.get(j) === wert) continue;
      zuletztGemerkt.current.set(j, wert);
      aufGeraet(`${konto.userId}:privat:jahr:${j}`, { t, f, z: info?.z ?? Date.now(), s: info?.s ?? null } satisfies JahrGemerkt);
    }
  }, [tage, feiertage, laedt, konto.userId]);

  // Vorrat: das Vorjahr und bis 5 Jahre voraus im Hintergrund holen und auf dem Gerät merken –
  // so steht beim Wischen alles sofort da, auch ohne Netz.
  useEffect(() => {
    const uhr = window.setTimeout(() => {
      if (istOffline()) return;
      const j = new Date().getFullYear();
      void ladeJahre([j - 1, j, j + 1, j + 2, j + 3, j + 4, j + 5], false, true);
    }, 3000);
    return () => window.clearTimeout(uhr);
  }, [ladeJahre]);

  // Der Kalender erscheint erst, wenn der gemerkte Stand eingesetzt ist – nie leer und dann bunt.
  const [bereit, setBereit] = useState(false);
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBereit(true);
  }, []);

  // Layout-Effekt: der gemerkte Stand (Schichten, Feiertage) steht schon im ersten Bild.
  useLayoutEffect(() => {
    // Im Monat auch die Nachbarmonate vorladen, damit sie beim Wischen schon da sind.
    const rand = ansicht === "monat" ? 35 : 0;
    const jahre = new Set([fromISO(addDays(bereich.von, -rand)).getFullYear(), fromISO(addDays(bereich.bis, rand)).getFullYear()]);
    void ladeJahre([...jahre]);
  }, [bereich, ansicht, ladeJahre]);

  /**
   * Termine laden. `nurWennGeaendert` (Öffnen, Zurückkommen): mit gleichem Stand wie beim
   * letzten Mal bleiben die gemerkten Termine – ohne Abfrage. Nach eigenen Änderungen immer laden.
   */
  const ladeTermine = useCallback(async (nurWennGeaendert = false) => {
    const standSchluessel = `${konto.userId}:privat:stand:termine`;
    const stand = nurWennGeaendert ? await holeStand() : null;
    if (stand !== null && unveraendert(ausGeraet<StandGemerkt>(standSchluessel), stand) && ausGeraet(`${konto.userId}:privat:termine`)) return;
    try {
      const neu = await fetchMeineTermine();
      setTermine(neu);
      aufGeraet(`${konto.userId}:privat:termine`, neu);
      aufGeraet(standSchluessel, stand !== null ? ({ s: stand, z: Date.now() } satisfies StandGemerkt) : null);
    } catch {
      // Termine sind Beiwerk – der Kalender bleibt nutzbar. Ohne Netz: der gemerkte Stand dieses Geräts.
      const gemerkt = ausGeraet<Termin[]>(`${konto.userId}:privat:termine`);
      if (gemerkt) setTermine((alt) => (alt.length ? alt : gemerkt));
    }
  }, [konto.userId, holeStand]);
  useLayoutEffect(() => {
    // Gleich nach dem Öffnen (vor dem ersten Bild): die gemerkten eigenen Termine und To-dos dieses Geräts, bis die frischen da sind.
    const t = ausGeraet<Termin[]>(`${konto.userId}:privat:termine`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Array.isArray(t)) setTermine((alt) => (alt.length ? alt : t));
    const d = ausGeraet<Todo[]>(`${konto.userId}:privat:todos`);
    if (Array.isArray(d)) setTodos((alt) => (alt.length ? alt : d));
  }, [konto.userId]);
  useEffect(() => {
    void ladeTermine(true);
  }, [ladeTermine]);

  const ladeTodos = useCallback(async (nurWennGeaendert = false) => {
    const standSchluessel = `${konto.userId}:privat:stand:todos`;
    const stand = nurWennGeaendert ? await holeStand() : null;
    if (stand !== null && unveraendert(ausGeraet<StandGemerkt>(standSchluessel), stand) && ausGeraet(`${konto.userId}:privat:todos`)) return;
    try {
      const neu = await fetchTodos();
      setTodos(neu);
      aufGeraet(`${konto.userId}:privat:todos`, neu);
      aufGeraet(standSchluessel, stand !== null ? ({ s: stand, z: Date.now() } satisfies StandGemerkt) : null);
    } catch {
      // To-dos sind Beiwerk. Ohne Netz: der gemerkte Stand dieses Geräts.
      const gemerkt = ausGeraet<Todo[]>(`${konto.userId}:privat:todos`);
      if (gemerkt) setTodos((alt) => (alt.length ? alt : gemerkt));
    }
  }, [konto.userId, holeStand]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladeTodos(true);
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

  async function terminVerschieben(t: Termin, von: string, bis: string, datum = t.datum, ganztaegig = t.ganztaegig) {
    // Mehrtägig: das Ende wandert um dieselben Tage mit.
    const bisDatum = t.bisDatum ? addDays(t.bisDatum, tageAbstand(t.datum, datum)) : t.bisDatum;
    if (istWartend(t)) {
      offline.merken({ ...t, datum, bisDatum, von, bis, ganztaegig }, t);
      return;
    }
    if (istOffline()) {
      setFehler(OHNE_NETZ);
      return;
    }
    setTermine((alt) => alt.map((x) => (x.id === t.id ? { ...x, datum, bisDatum, von, bis, ganztaegig } : x)));
    try {
      // Termin bei einer verbundenen Person: über deren Freigabe speichern.
      if (t.inhaber) await terminSichernUeberall({ ...t, datum, bisDatum, von, bis, ganztaegig, ziel: null }, t);
      else await speichereTermin({ ...t, datum, bisDatum, von, bis, ganztaegig });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht verschoben werden.");
    }
    void ladeTermine();
    if (t.inhaber) void andere.neuLaden();
  }

  // Partner, Familie, Freunde – was sie eintragen, und wen man gerade sieht.
  const andere = useAndere({ benutzer: konto.userId, von: bereich.von, bis: bereich.bis, aktiv: ansicht !== "jahr" });
  // Ohne Netz angelegte Termine: warten auf dem Gerät und gehen hoch, sobald wieder Netz da ist.
  const offline = useOfflineTermine(konto.userId, speichereTermin, () => void ladeTermine());
  // Kommt die App nach einer Weile wieder nach vorn, die Beiwerk-Daten auffrischen: was Partner, Familie oder ein
  // zweites Gerät inzwischen eingetragen haben. Kein Dauer-Abfragen – nur beim Zurückkehren, höchstens alle 90 Sekunden.
  const auffrischen = useRef<() => void>(() => undefined);
  useEffect(() => {
    auffrischen.current = () => {
      void ladeTermine(true);
      void ladeTodos(true);
      void andere.neuLaden();
      // Eigene Schichten: nur wenn sich seit dem Laden etwas geändert hat (z. B. eine verbundene Person).
      void holeStand(true).then((stand) => {
        const jahre = [...geladen.current];
        if (stand === null || jahre.every((j) => jahrInfo.current.get(j)?.s === stand)) return;
        void ladeJahre(jahre, true, true);
      });
    };
  });
  useEffect(() => {
    let zuletzt = Date.now();
    const zurueck = () => {
      if (document.visibilityState !== "visible" || Date.now() - zuletzt < 90_000) return;
      zuletzt = Date.now();
      auffrischen.current();
    };
    document.addEventListener("visibilitychange", zurueck);
    window.addEventListener("focus", zurueck);
    window.addEventListener("pageshow", zurueck);
    return () => {
      document.removeEventListener("visibilitychange", zurueck);
      window.removeEventListener("focus", zurueck);
      window.removeEventListener("pageshow", zurueck);
    };
  }, []);
  const sichtbareTermine = useMemo(
    () => [...termine, ...offline.termine, ...andere.fremdeTermine].filter(andere.terminSichtbar),
    [termine, offline.termine, andere.fremdeTermine, andere.terminSichtbar],
  );
  /** Eigene Termine und Einträge bei Verbundenen darf man löschen – Termine anderer nur ansehen. */
  const darfTerminLoeschen = (t: Termin) =>
    t.inhaber
      ? t.vonUser === konto.userId || !!andere.verbindungen.find((v) => v.partner === t.inhaber)?.erDarf
      : !(t.vonPartner && !t.vonUser);
  async function terminWeg(t: Termin, modus: LoeschModus, datum: string) {
    if (istWartend(t)) {
      offline.entfernen(t.id);
      return;
    }
    if (istOffline()) {
      setFehler(OHNE_NETZ);
      return;
    }
    try {
      await terminLoeschenModus(t, modus, datum);
      setFehler(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht gelöscht werden.");
    }
    await Promise.all([ladeTermine(), andere.neuLaden()]);
  }
  /** Verbundene Konten, bei denen ich eintragen darf. */
  const ziele = andere.verbindungen.filter((v) => v.erDarf).map((v) => ({ id: v.partner, name: v.name || "Verbunden" }));

  /** Vor einer Änderung den Stand merken – danach erscheint „Rückgängig“. */
  function merke(liste: string[], text: string) {
    setRueck((alt) => {
      // Gleiche Art von Änderung kurz hintereinander (z. B. Tag für Tag
      // antippen) nimmt „Rückgängig“ zusammen zurück, sonst nur die letzte.
      const weiter = !!alt && !!rueckUhr.current && alt.vorlage === text;
      const vorher: Record<string, TagEintrag | undefined> = { ...(weiter ? alt.vorher : {}) };
      for (const t of liste) if (!(t in vorher)) vorher[t] = tage[t];
      const n = Object.keys(vorher).length;
      return { text: text.replace("{n}", n === 1 ? "1 Tag" : `${n} Tage`), vorlage: text, vorher };
    });
    if (rueckUhr.current) window.clearTimeout(rueckUhr.current);
    rueckUhr.current = window.setTimeout(() => {
      rueckUhr.current = null;
      setRueck(null);
    }, 7000);
  }

  async function rueckgaengig() {
    const r = rueck;
    if (!r) return;
    if (rueckUhr.current) window.clearTimeout(rueckUhr.current);
    rueckUhr.current = null;
    setRueck(null);
    setTage((alt) => {
      const neu = { ...alt };
      for (const [t, e] of Object.entries(r.vorher)) {
        if (e) neu[t] = e;
        else delete neu[t];
      }
      return neu;
    });
    try {
      await speichereTage(r.vorher);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Rückgängig hat nicht geklappt.");
      void ladeJahre([...geladen.current], true);
    }
  }

  // ---- Schreiben -----------------------------------------------------------
  /**
   * Speichern ging schief: nur die betroffenen Tage zurück wie vorher (andere,
   * inzwischen gespeicherte Tage bleiben), dann den Stand frisch vom Server
   * holen – falls ein Teil doch gespeichert wurde. Der Hinweis bleibt stehen.
   */
  async function nachFehler(liste: string[], vorher: Record<string, TagEintrag>, e: unknown) {
    setTage((alt) => {
      const neu = { ...alt };
      for (const t of liste) {
        if (vorher[t]) neu[t] = vorher[t];
        else delete neu[t];
      }
      return neu;
    });
    await ladeJahre([...geladen.current], true);
    setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
  }

  /** Tage genau so setzen, wie sie in `neu` stehen (undefined = leer); optimistisch. */
  async function aendern(neu: Record<string, TagEintrag | undefined>) {
    const vorher = tage;
    setTage((alt) => {
      const n = { ...alt };
      for (const [t, e] of Object.entries(neu)) {
        if (e) n[t] = e;
        else delete n[t];
      }
      return n;
    });
    try {
      await speichereTage(neu);
    } catch (e) {
      await nachFehler(Object.keys(neu), vorher, e);
    }
  }

  async function leeren(liste: string[]) {
    const vorher = tage;
    setTage((alt) => {
      const neu = { ...alt };
      for (const t of liste) delete neu[t];
      return neu;
    });
    try {
      await leereTage(liste);
    } catch (e) {
      await nachFehler(liste, vorher, e);
    }
  }

  /**
   * Pinsel: ein Strich über einen oder mehrere Tage. Je Tag gilt:
   *  - weniger als drei Schichten ohne sie → sie kommt dazu (bis zu drei)
   *  - drei Schichten ohne sie → sie ersetzt die erste
   *  - sie steht schon mit anderen → nur noch sie
   *  - sie steht allein → Tag leer
   * „Leeren“ löscht sofort (mit „Rückgängig“).
   */
  function pinselStrich(liste: string[]) {
    if (!pinselAn || !pinsel) return;
    if (pinsel === "leer") {
      // Sofort weg – oben steht „Rückgängig“.
      const voll = liste.filter((t) => tage[t]);
      if (!voll.length) return;
      merke(voll, "{n} geleert");
      void leeren(voll);
      return;
    }
    const name = artNach.get(pinsel)?.name ?? "neu";
    const neu: Record<string, TagEintrag | undefined> = {};
    let entfernt = 0;
    for (const t of liste) {
      const ids = idsVon(tage[t]);
      const danach = pinselNaechste(ids, pinsel);
      if (danach.join("|") === ids.join("|")) continue;
      if (!danach.includes(pinsel)) entfernt++;
      neu[t] = eintragAus(danach);
    }
    const geaendert = Object.keys(neu);
    if (!geaendert.length) return;
    setFehler(null);
    merke(geaendert, entfernt === geaendert.length ? `${name} entfernt · {n}` : `${name} eingetragen · {n}`);
    void aendern(neu);
  }

  /**
   * Woche: eigene Schicht halten und auf einen anderen Tag / eine andere Uhrzeit
   * ziehen. Die Uhrzeit gilt nur für diesen Tag (wie „Andere Uhrzeit“ im Tag).
   */
  async function schichtVerschieben(id: string, von: string, nach: string, zeit?: TagZeit) {
    const art = artNach.get(id);
    const alt = wochenZeiten[tagZeitSchluessel(von, id)];
    let neueZeit: TagZeit | null = zeit ?? alt ?? null;
    // Zurück auf die normale Uhrzeit der Schicht: keine Ausnahme mehr nötig.
    if (neueZeit && art && neueZeit.beginn === art.beginn && neueZeit.ende === art.ende) neueZeit = null;
    setFehler(null);
    setWochenZeiten((z) => {
      const n = { ...z };
      delete n[tagZeitSchluessel(von, id)];
      if (neueZeit) n[tagZeitSchluessel(nach, id)] = neueZeit;
      return n;
    });
    if (von !== nach) {
      const ziel = idsVon(tage[nach]).filter((x) => x !== id);
      merke([von, nach], `${art?.name ?? "Schicht"} verschoben`);
      await aendern({
        [von]: eintragAus(idsVon(tage[von]).filter((x) => x !== id)),
        [nach]: eintragAus([...ziel, id].slice(-3)),
      });
    }
    try {
      if (von !== nach && alt) await setzeTagZeit(von, id, null);
      if (neueZeit || alt) await setzeTagZeit(nach, id, neueZeit);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Uhrzeit konnte nicht gespeichert werden.");
    }
    setZeitenStand((n) => n + 1);
  }

  function tagAntippen(iso: string) {
    if (pinselAn && pinsel) return pinselStrich([iso]);
    // Ein Tag öffnet die Tagesansicht; alles Weitere über „i“ (das bisherige Tagesblatt).
    setTagAnsicht(iso);
  }

  /** Eigene Schicht in der Tagesansicht an- oder abwählen (höchstens drei je Tag). */
  function eigeneWahl(iso: string, id: string) {
    const ids = idsVon(tage[iso]);
    const a = artNach.get(id);
    if (!a) return;
    if (ids.includes(id)) {
      merke([iso], `${a.name} entfernt`);
      void aendern({ [iso]: eintragAus(ids.filter((x) => x !== id)) });
    } else if (ids.length >= MAX_JE_TAG) {
      setFehler(`Höchstens ${MAX_JE_TAG} Einträge am Tag – tippe erst einen weg.`);
    } else {
      merke([iso], "{n} geändert");
      void aendern({ [iso]: eintragAus([...ids, id]) });
    }
  }

  // ---- Navigation ------------------------------------------------------------
  function springe(schritt: number) {
    if (ansicht === "woche") setAnker(addDays(anker, 7 * schritt));
    else if (ansicht === "jahr") setAnker(toISO(new Date(ankerD.getFullYear() + schritt, ankerD.getMonth(), 1)));
    else setAnker(toISO(new Date(ankerD.getFullYear(), ankerD.getMonth() + schritt, 1)));
  }
  function waehleAnsicht(a: Ansicht) {
    setAnsicht(a);
    // Der Pinsel gehört zu Monat und Woche.
    if (a === "jahr") setPinselAn(false);
    try {
      window.localStorage.setItem(ANSICHT_SCHLUESSEL, a);
    } catch {
      // egal
    }
  }

  const feiertagVon = (iso: string) => (konto.feiertageZeigen ? feiertage[iso] : undefined);

  const titel =
    ansicht === "jahr"
      ? String(ankerD.getFullYear())
      : ansicht === "woche"
        ? `KW ${kw(anker)}`
        : monthName(ankerD.getMonth());
  const unter =
    ansicht === "jahr"
      ? null
      : ansicht === "woche"
        ? `${formatDEShort(bereich.von)} – ${formatDE(bereich.bis)}`
        : String(ankerD.getFullYear());
  const heuteSichtbar = heute >= bereich.von && heute <= bereich.bis;

  // ---- Wischen: links = weiter, rechts = zurück --------------------------------
  const wisch = useRef<{ x: number; y: number; t: number } | null>(null);
  const gewischt = useRef(false);
  function wischStart(e: React.PointerEvent) {
    wisch.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function wischEnde(e: React.PointerEvent) {
    const w = wisch.current;
    wisch.current = null;
    if (!w) return;
    const dx = e.clientX - w.x;
    const dy = e.clientY - w.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - w.t < 800) {
      gewischt.current = true;
      window.setTimeout(() => (gewischt.current = false), 80);
      if (ansicht === "woche") setAnker(addDays(anker, dx < 0 ? 7 : -7));
      else springe(dx < 0 ? 1 : -1);
    }
  }
  // Im Monat: die Monate stehen untereinander in einer nativen Scroll-Liste (MonatsScroller) –
  // hoch/runter mit Schwung, jeder Monat rastet ein.
  const scroller = useRef<MonatsScrollerGriff>(null);
  // Mit offenem Pinsel scrollt die Liste nicht (der Finger malt); kurz hoch/runter
  // wischen blättert dann per Knopfdruck-Bewegung.
  const pinselWisch = useRef<{ x: number; y: number; t: number } | null>(null);
  const karussellGriffe = {
    onPointerDown: (e: React.PointerEvent) => {
      pinselWisch.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    onPointerMove: () => undefined,
    onPointerUp: (e: React.PointerEvent) => {
      const w = pinselWisch.current;
      pinselWisch.current = null;
      if (!w) return;
      const dy = e.clientY - w.y;
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(e.clientX - w.x) * 1.5 && Date.now() - w.t < 800) {
        gewischt.current = true;
        window.setTimeout(() => (gewischt.current = false), 80);
        scroller.current?.blaettern(dy < 0 ? 1 : -1);
      }
    },
    onPointerCancel: () => {
      pinselWisch.current = null;
    },
  };
  // Vom rechten Rand nach links ziehen: „Wen sehe ich?“ kommt als Seitenblatt herein –
  // überall am rechten Bildschirmrand, solange kein anderes Fenster offen ist.
  const monatGriffe = karussellGriffe;
  const randFrei = ansicht === "monat" && !pinselAn && !tagBlatt && !terminBlatt && !todoBlatt;
  // Lange auf einen Tag drücken: neuer Termin für diesen Tag.
  const langDruck = useLangDruck((iso) => {
    if (pinselAn) return;
    setTerminBlatt({ datum: iso, termin: null });
  });
  // Pinsel: kurz halten und über mehrere Tage wischen; normales Wischen blättert weiter.
  const strich = usePinselStrich(pinselStrich, monatGriffe);
  // In der Woche genauso: halten und über die Spalten ziehen; sonst wischt man zur nächsten Woche.
  const wocheGriffe = {
    onPointerDown: wischStart,
    onPointerMove: () => undefined,
    onPointerUp: wischEnde,
    onPointerCancel: () => {
      wisch.current = null;
    },
  };
  const wocheStrich = usePinselStrich(pinselStrich, wocheGriffe);
  function tippen(iso: string) {
    if (langDruck.geschluckt() || gewischt.current || scroller.current?.bewegt()) return;
    if (pinselAn && strich.geschluckt()) return;
    tagAntippen(iso);
  }

  // Wechsel aus dem Betrieb: erst umschalten, wenn der Kalender dasteht.
  const geladenGemeldet = useRef(false);
  const kalenderDa = !!schichtarten && (!laedt || Object.keys(tage).length > 0);
  useEffect(() => {
    if (!kalenderDa || geladenGemeldet.current) return;
    geladenGemeldet.current = true;
    meldeBereichBereit();
  }, [kalenderDa]);

  // Mit Betriebszugang stehen schon die Betriebsschichten drin – dann keine Einstiegs-Hinweise.
  const leer = !betrieb && schichtarten && !laedt && Object.keys(tage).length === 0;
  // Erst nach dem ersten Start (Darstellung + Rundgang) kommt „Wie arbeitest du?“.
  const willkommenFertig = useWillkommenFertig();
  const einstieg = !!leer && willkommenFertig && hinweisZu.einstieg < 2 && !einstiegZu && !rotation && !pinselAn;
  // Erst wenn ein Plan steht und noch nichts geteilt ist.
  const teilenKarte =
    !betrieb &&
    !laedt &&
    !hinweisZu.teilen &&
    !pinselAn &&
    ansicht !== "jahr" &&
    Object.keys(tage).length > 0 &&
    andere.personen !== null &&
    andere.personen.length === 0 &&
    andere.verbindungen.length === 0;
  function folgeOeffnen() {
    ersterPlan.current = !!leer;
    setRotation(true);
  }

  // Plan hochladen: Dateien gleich hier wählen, die Import-Seite liest sie danach.
  const hochladeFeld = useRef<HTMLInputElement>(null);
  function hochgeladen(dateien: File[]) {
    if (!dateien.length) return;
    merkeImportDateien(dateien);
    router.push("/privat/import");
  }

  // Tagesansicht: Schichten setzen – eigene oder die einer Person, die es erlaubt (Migration 0246).
  const schichtZiele = andere.verbindungen.filter((v) => v.erSchichten);
  const leisteKey = leistePerson !== "ich" && schichtZiele.some((v) => v.partner === leistePerson) ? leistePerson : "ich";
  const fremde = useFremdeSchichten(tagAnsicht && leisteKey !== "ich" ? leisteKey : null, tagAnsicht ?? heute, () => void andere.neuLaden());
  const leisteName = schichtZiele.find((v) => v.partner === leisteKey)?.name || "Verbunden";
  const leiste: LeisteDaten | null =
    tagAnsicht && schichtarten
      ? {
          personen: [{ key: "ich", name: "Ich" }, ...schichtZiele.map((v) => ({ key: v.partner, name: v.name || "Verbunden" }))],
          person: leisteKey,
          onPerson: setLeistePerson,
          ...(leisteKey === "ich"
            ? {
                eintraege: schichtarten.map((a) => ({ id: a.id, name: a.name, farbe: a.farbe })),
                aktiv: idsVon(tage[tagAnsicht]),
                onWahl: (id: string) => eigeneWahl(tagAnsicht, id),
                hinweis: betriebSchichten.am(tagAnsicht).length
                  ? `Betrieb · nur ansehen: ${betriebSchichten.am(tagAnsicht).map((a) => a.name).join(", ")}`
                  : undefined,
              }
            : {
                eintraege: fremde.eintraege,
                aktiv: fremde.aktiv,
                onWahl: fremde.waehle,
                laedt: fremde.laedt,
                hinweis: fremde.fehler ?? `Schichten von ${leisteName} – ${leisteName} bekommt kurz Bescheid.`,
              }),
        }
      : null;

  /** Was die Tagesansicht braucht – als Vollbild und als „Woche“. */
  const tagesProps = {
    heute,
    baender: (iso: string) =>
      arten(anzeigeTage[iso], anzeigeArtNach)
        .filter((a) => a.beginn && a.ende)
        .map((a) => ({ name: a.name, beginn: a.beginn, ende: a.ende, farbe: a.farbe })),
    ganztaegig: (iso: string) => [
      ...arten(anzeigeTage[iso], anzeigeArtNach)
        .filter((a) => !a.beginn || !a.ende)
        .map((a) => ({ name: a.name, farbe: a.farbe })),
      ...(feiertagVon(iso) ? [{ name: `🎉 ${feiertagVon(iso)}`, farbe: "#FCE7D6" }] : []),
    ],
    termineAm: (iso: string) => termineAm(sichtbareTermine, iso),
    todos,
    terminVon: andere.terminVon,
    onVerschieben: (t: Termin, von: string, bis: string) => void terminVerschieben(t, von, bis),
    onLoeschen: (t: Termin, modus: LoeschModus, datum: string) => void terminWeg(t, modus, datum),
    darfLoeschen: darfTerminLoeschen,
    onTodo: (id: string, an: boolean) => void todoSetzen(id, an),
    darfVerschieben: (t: Termin) => t.wiederholung === "nie" && darfTerminLoeschen(t),
    andere: (iso: string) =>
      andere.amTag(iso).map((e) => ({ key: e.key, kurz: e.kurz, farbe: e.farbe, text: `${e.name} · ${CODE_NAME[e.code]}` })),
  };

  return (
    <div
      className={cn(
        // Genau ein Bildschirm: zwischen Statusleiste und schwebender Leiste.
        "fixed inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col px-0 pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(0.75rem,env(safe-area-inset-top))]",
        "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.6rem)]",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-2 sm:px-0 sm:pb-2.5 sm:pt-0">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-bold leading-[1.05] tracking-[-0.02em] [@media(max-width:360px)]:text-[22px]">{titel}</h1>
          <p className="tnum mt-0.5 truncate text-[13px] font-medium leading-tight text-ink-muted">
            {unter}
            {!heuteSichtbar ? (
              <>
                {unter ? " · " : ""}
                <button type="button" onClick={() => setAnker(heute)} className="font-semibold text-brand-600">
                  Heute
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 [@media(max-width:360px)]:gap-1">
          {/* Glühbirne nur hier – der Kalender ist die Startseite des Privatbereichs. */}
          <PrivatNeuigkeiten />
          <WenSeheIch andere={andere} glas onVerwalten={() => setTeilen(true)} randWischen={randFrei}
            onEigeneFarben={() => router.push("/privat/schichten?reiter=liste")}
            onExport={() => router.push("/privat/export")}
            ansicht={{ wert: ansicht, optionen: ["woche", "monat", "jahr"], onWahl: waehleAnsicht }}
            onHochladen={() => hochladeFeld.current?.click()}
          />
          <span className="hidden gap-2 sm:flex">
            <GlasKnopf label="Vorher" onClick={() => springe(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </GlasKnopf>
            <GlasKnopf label="Weiter" onClick={() => springe(1)}>
              <ChevronRight className="h-5 w-5" />
            </GlasKnopf>
          </span>
          <PrivatProfilKnopf />
        </div>
      </header>
      <OfflinePille wartend={offline.anzahl} />


      {fehler || (!istOffline() && artenFehler) ? (
        <div className="mb-2 px-3.5 sm:px-0">
          <Alert tone="error">{fehler ?? artenFehler}</Alert>
        </div>
      ) : null}

      <input
        ref={hochladeFeld}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Plan hochladen: Screenshots oder Kalender-Datei"
        onChange={(e) => {
          hochgeladen(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <VerbundenHinweisStreifen />

      {/* Neues Konto: ein schmaler Streifen statt großer Karten – der Kalender bleibt groß.
          Erst „Plan übernehmen“; ist der zu, kommt „Schichtfolge eintragen“. */}
      {leer && !einstieg && (hinweisZu.einstieg >= 2 || einstiegZu) && (!hinweisZu.upload || !hinweisZu.los) ? (
        <div data-hinweis-streifen className="glas mx-3.5 mb-2 flex h-11 items-center rounded-[14px] sm:mx-0">
          <button
            type="button"
            onClick={() => (!hinweisZu.upload ? hochladeFeld.current?.click() : folgeOeffnen())}
            className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-3 text-left text-[14px] font-semibold text-brand-600"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              {!hinweisZu.upload ? <Upload className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </span>
            <span className="min-w-0 truncate">{!hinweisZu.upload ? "Plan aus anderer App übernehmen" : "Schichtfolge eintragen"}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
          </button>
          <button
            type="button"
            onClick={() => hinweisSchliessen(!hinweisZu.upload ? "upload" : "los")}
            aria-label="Hinweis schließen"
            className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted active:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div
        data-rundgang="kalender"
        className={cn(
          "relative min-h-0 flex-1 select-none transition-opacity duration-150",
          !bereit && "opacity-0",
          ansicht === "monat" ? "overflow-hidden sm:-m-2 sm:p-2" : "touch-pan-y px-3.5 sm:px-0",
        )}
        {...(ansicht === "monat"
          ? pinselAn
            ? strich.griffe
            : {}
          : ansicht === "woche"
            ? pinselAn
              ? wocheStrich.griffe
              : {}
            : { onPointerDown: wischStart, onPointerUp: wischEnde, onPointerCancel: () => (wisch.current = null) })}
        aria-busy={laedt || !schichtarten}
      >
        {einstieg ? (
          <EinstiegKarte
            onFolge={folgeOeffnen}
            onFoto={() => hochladeFeld.current?.click()}
            onSelbst={() => {
              setPinselAn(true);
              const erste = schichtarten?.find((a) => a.art === "arbeit") ?? schichtarten?.[0];
              if (!pinsel && erste) setPinsel(erste.id);
            }}
            onSpaeter={() => {
              setEinstiegZu(true);
              hinweisSchliessen("einstieg");
            }}
          />
        ) : null}
        {ansicht === "monat" ? (
          <MonatsScroller
            ref={scroller}
            monat={{ jahr: ankerD.getFullYear(), monat: ankerD.getMonth() }}
            onMonat={(m) => setAnker(toISO(new Date(m.jahr, m.monat, 1)))}
            gesperrt={pinselAn}
            className="sm:rounded-[24px]"
            seite={(m, sichtbar) => (
              <MonatsAnsicht
                jahr={m.jahr}
                monat={m.monat}
                heute={heute}
                tage={andere.eigeneSchichten ? anzeigeTage : KEINE_TAGE}
                artNach={anzeigeArtNach}
                feiertagVon={feiertagVon}
                termine={sichtbareTermine}
                andere={andere}
                onTag={tippen}
                zelle={langDruck.zelle}
                markiert={sichtbar ? strich.markiert : undefined}
              />
            )}
          />
        ) : ansicht === "woche" ? (
          <WochenSpalten
            von={bereich.von}
            heute={heute}
            tage={anzeigeTage}
            zeiten={wochenZeiten}
            artNach={anzeigeArtNach}
            termineAm={(iso) => termineAm(sichtbareTermine, iso)}
            feiertagVon={feiertagVon}
            markiert={wocheStrich.markiert}
            pinsel={pinselAn}
            darfVerschieben={(t) => t.wiederholung === "nie" && darfTerminLoeschen(t)}
            onTag={(iso) => {
              if (gewischt.current) return;
              if (pinselAn) {
                if (!wocheStrich.geschluckt()) tagAntippen(iso);
                return;
              }
              setAnker(iso);
              setTagAnsicht(iso);
            }}
            onNeu={(iso, zeit) => setTerminBlatt({ datum: iso, termin: null, startZeit: zeit })}
            onVerschieben={(t, datum, von, bis, ganz) => void terminVerschieben(t, von, bis, datum, ganz)}
            onSchichtVerschieben={(id, von, nach, zeit) => void schichtVerschieben(id, von, nach, zeit)}
            onWoche={(r) => setAnker(addDays(anker, 7 * r))}
          />
        ) : (
          <JahresAnsicht
            jahr={ankerD.getFullYear()}
            heute={heute}
            tage={anzeigeTage}
            artNach={anzeigeArtNach}
            feiertagVon={feiertagVon}
            onMonat={(m) => {
              if (gewischt.current) return;
              setAnker(toISO(new Date(ankerD.getFullYear(), m, 1)));
              waehleAnsicht("monat");
            }}
          />
        )}
        {(ansicht === "monat" || ansicht === "woche") && !pinselAn && schichtarten?.length ? (
          <PinselKnopf
            onClick={() => {
              setPinselAn(true);
              if (!pinsel && schichtarten?.length) setPinsel(schichtarten[0]!.id);
            }}
          />
        ) : null}
      </div>

      {teilenKarte ? (
        <TeilenKarte onWahl={setTeilenNeu} onWeg={() => hinweisSchliessen("teilen")} />
      ) : null}

      {pinselAn && schichtarten ? (
        <PinselLeiste
          eintraege={schichtarten}
          aktiv={pinsel}
          onWahl={setPinsel}
          onNeu={() => router.push("/privat/schichten?reiter=liste")}
          onClose={() => setPinselAn(false)}
        />
      ) : null}

      {loesch.fenster}

      {rueck ? (
        <div
          role="status"
          className="fixed inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+0.25rem)] z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-[16px] bg-[#1F294D] px-4 py-3 text-[14px] text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
        >
          <span className="min-w-0 truncate">{rueck.text}</span>
          <button type="button" onClick={() => void rueckgaengig()} className="shrink-0 font-bold text-[#8fb0ff]">
            Rückgängig
          </button>
        </div>
      ) : null}

      {tagBlatt ? (
        <TagBlatt
          key={tagBlatt}
          iso={tagBlatt}
          eintrag={tage[tagBlatt] ?? LEER}
          betrieb={betriebSchichten.am(tagBlatt)}
          arten={schichtarten ?? []}
          artNach={artNach}
          feiertag={feiertagVon(tagBlatt)}
          termine={termineAm(sichtbareTermine, tagBlatt)}
          todos={todosAm(todos, tagBlatt)}
          andere={andere.amTag(tagBlatt)}
          terminVon={andere.terminVon}
          onSetzen={(ids, text) => {
            merke([tagBlatt], text);
            void aendern({ [tagBlatt]: eintragAus(ids) });
          }}
          onTermin={(t) => {
            setTerminBlatt({ datum: tagBlatt, termin: t });
            setTagBlatt(null);
          }}
          onTerminLoeschen={(t, modus, datum) => void terminWeg(t, modus, datum)}
          darfLoeschen={darfTerminLoeschen}
          onTodo={(id, an) => void todoSetzen(id, an)}
          onTag={() => {
            setTagAnsicht(tagBlatt);
            setTagBlatt(null);
          }}
          onClose={() => setTagBlatt(null)}
        />
      ) : null}

      {tagAnsicht ? (
        <Tagesansicht
          iso={tagAnsicht}
          {...tagesProps}
          onIso={(iso) => {
            setTagAnsicht(iso);
            const j = fromISO(iso).getFullYear();
            if (!geladen.current.has(j)) void ladeJahre([j]);
          }}
          onTermin={(t, startZeit) => setTerminBlatt({ datum: tagAnsicht, termin: t, startZeit })}
          onTodos={() => setTodoBlatt({ datum: tagAnsicht })}
          onClose={() => setTagAnsicht(null)}
          leiste={leiste}
          onDetails={() => {
            setTagBlatt(tagAnsicht);
            setTagAnsicht(null);
          }}
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
                ? `Von ${andere.terminVon(terminBlatt.termin)?.name ?? "einer eingeladenen Person"} eingetragen.`
                : "Eingeladene sehen deine Termine nur, wenn du es beim Teilen erlaubst."
          }
          nurLesen={
            terminBlatt.termin?.inhaber
              ? !darfTerminLoeschen(terminBlatt.termin)
              : terminBlatt.termin?.vonPartner === true && !terminBlatt.termin.vonUser
          }
          onSpeichern={(t: TerminEingabe) => {
            const alt = terminBlatt.termin;
            setTerminBlatt(null);
            // Ohne Netz: neue eigene Termine warten auf dem Gerät; Ändern bestehender braucht Netz.
            if (istWartend(alt) || (istOffline() && !alt && !t.ziel)) {
              offline.merken(t, alt);
              return;
            }
            if (istOffline()) {
              setFehler(OHNE_NETZ);
              return;
            }
            void terminSichernUeberall(t, alt)
              .then(() => Promise.all([ladeTermine(), andere.neuLaden()]))
              .catch((e: unknown) => setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht gespeichert werden."));
          }}
          serieLoeschen
          onLoeschen={(_id, modus, datum) => {
            const alt = terminBlatt.termin;
            const tag = datum ?? terminBlatt.datum;
            setTerminBlatt(null);
            if (alt) void terminWeg(alt, modus ?? "alle", tag);
          }}
          onClose={() => setTerminBlatt(null)}
        />
      ) : null}

      {teilen ? (
        <KalenderTeilen
          vorname={konto.name.split(/\s+/)[0] ?? konto.name}
          onGeaendert={() => void andere.neuLaden()}
          onClose={() => setTeilen(false)}
        />
      ) : null}

      {teilenNeu ? (
        <KalenderTeilen
          vorname={konto.name.split(/\s+/)[0] ?? konto.name}
          start="neu"
          neueArt={teilenNeu}
          onGeaendert={() => void andere.neuLaden()}
          onClose={() => setTeilenNeu(null)}
        />
      ) : null}

      {fertig ? (
        <FertigBlatt tage={fertig.tage} bis={fertig.bis} userId={konto.userId} onClose={() => setFertig(null)} />
      ) : null}

      {rotation && schichtarten ? (
        <RotationBlatt
          arten={schichtarten}
          heute={heute}
          onFertig={(e) => {
            setRotation(false);
            if (ersterPlan.current) setFertig(e);
            ersterPlan.current = false;
            void ladeJahre([...geladen.current], true);
          }}
          onClose={() => setRotation(false)}
        />
      ) : null}
      {/* Erster Start: Darstellung und kurzer Rundgang (einmal pro Gerät). */}
      {kalenderDa ? <Willkommen /> : null}
    </div>
  );
}

/** Schichtkürzel verbundener Personen in Worten. */
const CODE_NAME: Record<PartnerCode, string> = { F: "Früh", S: "Spät", N: "Nacht", T: "Tag", U: "Urlaub", X: "Frei" };

// ---------------------------------------------------------------------------

/** Runder Knopf im Glas-Stil. */
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
        "flex h-11 w-11 items-center justify-center rounded-full transition-colors [@media(max-width:360px)]:h-9 [@media(max-width:360px)]:w-9",
        aktiv ? "bg-brand-500 text-white shadow-[0_6px_18px_rgba(47,91,234,0.4)]" : "glas text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Kleines Kästchen für einen Eintrag in einer Zelle. */
function Chip({ art, klein }: { art: Schichtart; klein?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 truncate rounded-[7px] px-0.5 font-semibold",
        klein ? "py-px text-[10.5px] [@media(max-height:750px)]:py-0 [@media(max-height:750px)]:text-[10px]" : "py-[2px] text-[11.5px]",
        // Nach der Schriftgröße – sonst verwirft cn() die Zeilenhöhe.
        "leading-tight",
      )}
      style={farbStil(art.farbe)}
    >
      {art.name}
    </span>
  );
}

type ZellGriffe = (iso: string) => Pick<
  React.HTMLAttributes<HTMLElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onContextMenu"
>;

interface AnsichtProps {
  heute: string;
  tage: Record<string, TagEintrag>;
  artNach: Map<string, Schichtart>;
  feiertagVon: (iso: string) => string | undefined;
}

/** Eigene Schichten ausgeblendet („Wen sehe ich?“ → Ich · Schichten). */
const KEINE_TAGE: Record<string, TagEintrag> = {};

function MonatsAnsicht({
  jahr,
  monat,
  heute,
  tage,
  artNach,
  feiertagVon,
  termine,
  andere,
  onTag,
  zelle,
  markiert,
}: AnsichtProps & {
  jahr: number;
  monat: number;
  termine: Termin[];
  andere: Andere;
  onTag: (iso: string) => void;
  zelle?: ZellGriffe;
  /** Tage im laufenden Pinsel-Strich */
  markiert?: ReadonlySet<string>;
}) {
  const { start, wochen } = monatRaster(jahr, monat);
  const liste = Array.from({ length: wochen * 7 }, (_, i) => addDays(start, i));
  const { ref: zellenRef, hoehe: zellenHoehe } = useZellenHoehe();
  return (
    <div
      className="glas grid h-full grid-cols-7 overflow-hidden rounded-none border-x-0 border-b-0 sm:rounded-[24px] sm:border-x sm:border-b"
      style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
    >
      {WT.map((w, i) => (
        <span key={w} className={cn("pb-1 pt-1.5 text-center text-[11px] font-semibold uppercase", i >= 5 ? "we-kopf rounded-t-lg text-ink-faint" : "text-ink-muted")}>
          {w}
        </span>
      ))}
      {liste.map((iso, i) => {
        const d = fromISO(iso);
        const imMonat = d.getMonth() === monat;
        const eintraege = arten(tage[iso], artNach);
        const zwei = eintraege.length >= 2;
        const fei = feiertagVon(iso);
        const ts = termineAm(termine, iso);
        const andereAm = andere.amTag(iso);
        // Termine stehen untereinander – so viele, wie in die Zelle passen.
        const zeilen = terminZeilen(zellenHoehe, {
          kaestchen: eintraege.length,
          klein: zwei,
          eingeladene: andereAm.length > 0,
        });
        const zeigen = ts.length > zeilen ? ts.slice(0, Math.max(0, zeilen - 1)) : ts;
        const rest = ts.length - zeigen.length;
        return (
          <button
            key={iso}
            ref={i === 7 ? zellenRef : undefined}
            type="button"
            data-iso={iso}
            {...zelle?.(iso)}
            onClick={() => onTag(iso)}
            aria-label={`${WT_LANG[i % 7]}, ${formatDE(iso)}${eintraege.length ? `: ${eintraege.map((a) => a.name).join(" und ")}` : ""}${fei ? `, ${fei}` : ""}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
            className={cn(
              // Feste Zellgröße: Inhalt wird abgeschnitten, nie gestreckt.
              "glas-linie flex min-h-0 flex-col items-stretch gap-[2px] overflow-hidden border-t px-[2px] pb-0.5 pt-[3px] text-center outline-none transition-colors [-webkit-touch-callout:none] active:bg-ink/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
              i % 7 !== 0 && "border-l",
              i % 7 >= 5 && "we-zelle",
              fei && "feiertag-zelle",
              !imMonat && "opacity-35",
              markiert?.has(iso) && "pinsel-strich",
            )}
          >
            <span className="relative mx-auto shrink-0">
              <span
                className={cn(
                  "tnum flex h-[24px] min-w-[24px] items-center justify-center rounded-full px-1 text-[14.5px] leading-none [@media(max-height:750px)]:h-[21px] [@media(max-height:750px)]:min-w-[21px] [@media(max-height:750px)]:text-[13.5px]",
                  iso === heute
                    ? "bg-[#ff3b30] font-bold text-white shadow-[0_2px_8px_rgba(255,59,48,0.45)]"
                    : fei
                      ? "font-semibold text-[#e5484d]"
                      : "font-medium",
                )}
              >
                {d.getDate()}
              </span>
              {ts.length ? (
                <span aria-hidden className="absolute -right-2.5 top-0.5 hidden gap-px [@media(max-height:750px)]:flex">
                  {ts.slice(0, 3).map((t) => (
                    <span key={t.id} className={cn("h-[5px] w-[5px] rounded-full", t.vonPartner ? "bg-brand-500" : "bg-ink-muted")} />
                  ))}
                </span>
              ) : null}
            </span>
            {eintraege.map((a) => (
              <Chip key={a.id} art={a} klein={zwei} />
            ))}
            <AndereTags eintraege={andereAm} anzeige={andere.anzeige} />
            {zeigen.map((t) => (
              <span key={t.id} className="shrink-0 truncate text-left text-[10px] leading-[1.25] text-ink-muted [@media(max-height:750px)]:hidden">
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
  );
}

function JahresAnsicht({
  jahr,
  heute,
  tage,
  artNach,
  feiertagVon,
  onMonat,
}: AnsichtProps & { jahr: number; onMonat: (m: number) => void }) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain pb-2">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 12 }, (_, m) => {
          const { start, wochen } = monatRaster(jahr, m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => onMonat(m)}
              className="glas flex flex-col justify-start rounded-[18px] p-2 text-left"
              aria-label={`${monthName(m)} ${jahr} öffnen`}
            >
              <span className="mb-1 block text-[13px] font-semibold">{monthName(m)}</span>
              <span className="grid grid-cols-7 gap-[2px]">
                {Array.from({ length: wochen * 7 }, (_, i) => {
                  const iso = addDays(start, i);
                  if (fromISO(iso).getMonth() !== m) return <span key={iso} className="aspect-square" />;
                  const [a1, a2, a3] = arten(tage[iso], artNach);
                  const fei = feiertagVon(iso);
                  // Zwei Einträge: diagonal geteilt, drei: in drei Streifen.
                  const stil = a1
                    ? a2
                      ? {
                          backgroundImage: a3
                            ? `linear-gradient(135deg, ${a1.farbe} 33.3%, ${a2.farbe} 33.3% 66.6%, ${a3.farbe} 66.6%)`
                            : `linear-gradient(135deg, ${a1.farbe} 50%, ${a2.farbe} 50%)`,
                          color: farbStil(a2.farbe).color,
                        }
                      : farbStil(a1.farbe)
                    : undefined;
                  return (
                    <span
                      key={iso}
                      title={`${formatDE(iso)}${a1 ? `: ${[a1, a2].filter(Boolean).map((a) => a!.name).join(" + ")}` : ""}${fei ? ` · ${fei}` : ""}`}
                      className={cn(
                        "tnum flex aspect-square items-center justify-center rounded-[5px] text-[8.5px] font-semibold leading-none",
                        !a1 && "bg-ink/[0.06] text-ink-faint",
                        iso === heute && "ring-2 ring-[#ff3b30]",
                        fei && !a1 && "text-[#e5484d]",
                      )}
                      style={stil}
                    >
                      {fromISO(iso).getDate()}
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Tagesblatt zum Ansehen: was an dem Tag geplant ist – Schichten, Termine,
 * To-dos und was die anderen haben. Nach unten wischen schließt es. Eine
 * Schicht ändert man hier über „Schicht ändern“ (Antippen = 2. Eintrag,
 * dieselbe Schicht nochmal = nur noch diese); schneller geht es mit dem Pinsel.
 */
function TagBlatt({
  iso,
  eintrag,
  betrieb = [],
  arten: alleArten,
  artNach,
  feiertag,
  termine,
  todos,
  andere,
  terminVon,
  onSetzen,
  onTermin,
  onTerminLoeschen,
  darfLoeschen,
  onTodo,
  onTag,
  onClose,
}: {
  iso: string;
  eintrag: TagEintrag;
  /** Schicht aus dem Betrieb – nur zum Ansehen. */
  betrieb?: Schichtart[];
  arten: Schichtart[];
  artNach: Map<string, Schichtart>;
  feiertag?: string;
  termine: Termin[];
  todos: Todo[];
  andere: AndererEintrag[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  /** Die Einträge des Tages setzen (Reihenfolge = Anzeige); text für „Rückgängig“ */
  onSetzen: (ids: string[], text: string) => void;
  onTermin: (t: Termin | null) => void;
  onTerminLoeschen: (t: Termin, modus: LoeschModus, datum: string) => void;
  darfLoeschen: (t: Termin) => boolean;
  onTodo: (id: string, an: boolean) => void;
  onTag: () => void;
  onClose: () => void;
}) {
  const ids = idsVon(eintrag);
  const [tagZeiten, setTagZeiten] = useState<Record<string, TagZeit>>({});
  useEffect(() => {
    let aus = false;
    void ladeTagZeiten(iso, iso).then((z) => !aus && setTagZeiten(z));
    return () => {
      aus = true;
    };
  }, [iso]);
  const gesetzt = ids
    .map((id) => artNach.get(id))
    .filter((a): a is Schichtart => !!a)
    .map((a) => schichtAmTag(a, tagZeiten[tagZeitSchluessel(iso, a.id)]));
  const [aendern, setAendern] = useState(false);
  const [nachricht, setNachricht] = useState(
    gesetzt.length ? "Tippen = dazu · nochmal tippen = weg" : "Was steht an diesem Tag an?",
  );
  const loesch = useLoeschFrage();

  /** Tippen = dazu (bis zu drei), nochmal tippen = weg (mit „Rückgängig“). */
  function tipp(id: string) {
    const a = artNach.get(id);
    if (!a) return;
    if (ids.includes(id)) {
      onSetzen(
        ids.filter((x) => x !== id),
        `${a.name} entfernt`,
      );
      setNachricht(`${a.name} ist weg.`);
    } else if (ids.length >= MAX_JE_TAG) {
      setNachricht(`Höchstens ${MAX_JE_TAG} Einträge – tippe erst einen weg.`);
    } else {
      onSetzen([...ids, id], "{n} geändert");
      setNachricht(ids.length ? `${a.name} dazu · nochmal tippen = weg.` : `${a.name} eingetragen.`);
    }
  }

  function entfernen(id: string) {
    loesch.frage({
      titel: `${artNach.get(id)?.name ?? "Eintrag"} löschen?`,
      text: "Der Eintrag wird von diesem Tag entfernt.",
      onJa: () => {
        onSetzen(
          ids.filter((x) => x !== id),
          "Eintrag entfernt",
        );
        setNachricht("Eintrag entfernt.");
      },
    });
  }

  const d = fromISO(iso);
  const zeit = (a: Schichtart) => zeitText(a) || (a.art === "arbeit" ? null : a.art === "frei" ? "frei" : "ganztägig");
  const nichts = !gesetzt.length && !betrieb.length && !feiertag && !termine.length && !todos.length && !andere.length;
  return (
    <Blatt
      wischZu
      titel={`${WT_LANG[wochentag(iso)]}, ${d.getDate()}. ${monthName(d.getMonth())}`}
      unter={
        feiertag || gesetzt.length || betrieb.length ? (
        <span className="mt-1 flex flex-wrap gap-1.5">
          {feiertag ? <span className="font-medium text-[#e5484d]">{feiertag}</span> : null}
          {betrieb.map((a) => (
            <EintragPille key={a.id} name={`🏢 ${a.name}`} zeit="Betrieb · nur ansehen" farbe={a.farbe} />
          ))}
          {gesetzt.map((a) => (
            <EintragPille
              key={a.id}
              name={a.name}
              zeit={zeit(a)}
              farbe={a.farbe}
              onEntfernen={aendern ? () => entfernen(a.id) : undefined}
            />
          ))}
        </span>
        ) : undefined
      }
      onClose={onClose}
    >
      {loesch.fenster}
      {nichts ? <p className="px-1 py-2 text-[14.5px] text-ink-muted">An diesem Tag ist nichts geplant.</p> : null}
      <AndereUhrzeit
        iso={iso}
        schichten={ids.map((id) => artNach.get(id)).filter((a): a is Schichtart => !!a && a.art === "arbeit")}
        zeiten={tagZeiten}
        onGeaendert={(id, z) =>
          setTagZeiten((alt) => {
            const neu = { ...alt };
            if (z) neu[tagZeitSchluessel(iso, id)] = z;
            else delete neu[tagZeitSchluessel(iso, id)];
            return neu;
          })
        }
      />
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
      <AnDiesemTag eintraege={andere} className="mt-3" />

      {aendern ? (
        <div className="mt-3">
          <SchichtLeiste
            eintraege={alleArten.map((a) => ({
              id: a.id,
              name: a.name,
              farbe: a.farbe,
              rang: (ids.indexOf(a.id) + 1) as 0 | 1 | 2 | 3,
            }))}
            onTipp={tipp}
            nachricht={nachricht}
          />
        </div>
      ) : null}
      <TagKnoepfe onTermin={() => onTermin(null)} onTag={onTag} />
      <button
        type="button"
        aria-expanded={aendern}
        onClick={() => setAendern((a) => !a)}
        className="mx-auto mt-2 flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-muted"
      >
        <Pencil className="h-4 w-4" /> {aendern ? "Fertig" : "Schicht ändern"}
      </button>
    </Blatt>
  );
}

/**
 * Andere Uhrzeit nur an diesem Tag (z. B. Spätschicht heute 17:00–23:30).
 * Stunden, Zuschläge und Geld rechnen dann mit dieser Zeit.
 */
function AndereUhrzeit({
  iso,
  schichten,
  zeiten,
  onGeaendert,
}: {
  iso: string;
  schichten: Schichtart[];
  zeiten: Record<string, TagZeit>;
  onGeaendert: (schichtartId: string, z: TagZeit | null) => void;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  const [beginn, setBeginn] = useState("");
  const [ende, setEnde] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (!schichten.length) return null;

  async function speichern(id: string, z: TagZeit | null) {
    setLaeuft(true);
    setFehler(null);
    try {
      await setzeTagZeit(iso, id, z);
      onGeaendert(id, z);
      setOffen(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <ul className="mb-2 space-y-1.5" data-andere-uhrzeit>
      {schichten.map((a) => {
        const z = zeiten[tagZeitSchluessel(iso, a.id)];
        const geplant = zeitText(a);
        const jetzt = z ? `${z.beginn}–${z.ende}` : geplant;
        return (
          <li key={a.id} className="rounded-[14px] bg-ink/[0.05] px-3 py-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1 text-[13.5px]">
                <b className="font-semibold">{a.name}</b> <span className="tnum">{jetzt || "ohne Uhrzeit"}</span>
                {z ? <span className="text-ink-muted"> · heute anders{geplant ? ` (sonst ${geplant})` : ""}</span> : null}
              </span>
              {offen === a.id ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setOffen(a.id);
                    setBeginn(z?.beginn ?? a.beginn ?? "");
                    setEnde(z?.ende ?? a.ende ?? "");
                    setFehler(null);
                  }}
                  className="shrink-0 text-[13px] font-semibold text-brand-600"
                >
                  {z ? "Ändern" : "Andere Zeit"}
                </button>
              )}
            </div>
            {offen === a.id ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label="Beginn"
                    value={beginn}
                    onChange={(e) => setBeginn(e.target.value)}
                    className="tnum h-10 min-w-0 flex-1 rounded-[10px] border-2 border-ink/10 bg-surface px-2 text-[15px] font-semibold"
                  />
                  <span className="text-ink-muted">–</span>
                  <input
                    type="time"
                    aria-label="Ende"
                    value={ende}
                    onChange={(e) => setEnde(e.target.value)}
                    className="tnum h-10 min-w-0 flex-1 rounded-[10px] border-2 border-ink/10 bg-surface px-2 text-[15px] font-semibold"
                  />
                </div>
                {fehler ? <p className="text-[12.5px] text-crit-fg">{fehler}</p> : null}
                <div className="flex gap-2">
                  {z ? (
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() => void speichern(a.id, null)}
                      className="h-9 flex-1 rounded-[10px] bg-surface text-[13px] font-semibold"
                    >
                      Wie geplant
                    </button>
                  ) : (
                    <button type="button" onClick={() => setOffen(null)} className="h-9 flex-1 rounded-[10px] bg-surface text-[13px] font-semibold">
                      Abbrechen
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => void speichern(a.id, { beginn: beginn.slice(0, 5), ende: ende.slice(0, 5) })}
                    className="h-9 flex-1 rounded-[10px] bg-brand-600 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Pinsel-Regel für einen Tag (siehe pinselStrich). */
export function pinselNaechste(ids: string[], x: string): string[] {
  if (!ids.length) return [x];
  if (!ids.includes(x)) return ids.length < MAX_JE_TAG ? [...ids, x] : [x, ...ids.slice(1)];
  if (ids.length > 1) return [x];
  return [];
}
