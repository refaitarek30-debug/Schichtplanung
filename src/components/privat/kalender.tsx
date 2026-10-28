"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";
import { ChevronLeft, ChevronRight, Pencil, Repeat, Upload, X } from "lucide-react";
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
} from "@/components/kalender/tag";
import { useVorlieben } from "@/components/kalender/vorschlaege";
import { useAnzeige } from "@/lib/anzeige";
import { terminLoeschenModus, terminSichernUeberall, type LoeschModus } from "@/lib/data/verbindungen";
import { fetchTodos, todoErledigt, todoLoeschen, todoSpeichern, todosAm, type Todo } from "@/lib/data/todos";
import { AnDiesemTag, AndereTags, WenSeheIch, useAndere, type Andere, type AndererEintrag } from "@/components/kalender/andere";
import { KalenderTeilen } from "@/components/kalender/teilen";
import { terminZeilen, useZellenHoehe } from "@/components/kalender/zellen";
import { PinselKnopf, PinselLeiste, useMonatKarussell, usePinselStrich } from "@/components/kalender/pinsel";
import { useLoeschFrage } from "@/components/kalender/loesch-frage";
import { TodoZaehler, offeneBisHeute } from "@/components/kalender/todo-zaehler";
import {
  fetchMeineTermine,
  speichereTermin,
} from "@/lib/data/partner";
import { addDays, formatDE, formatDEShort, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import {
  MAX_JE_TAG,
  eintragAus,
  farbStil,
  idsVon,
  ladeFeiertage,
  ladeTage,
  leereTage,
  speichereTage,
  type Schichtart,
  type TagEintrag,
} from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { Blatt } from "./blatt";
import { RotationBlatt } from "./rotation";
import { merkeImportDateien } from "@/lib/privat/import-dateien";
import { AnsichtMenue, type Ansicht } from "./ansicht-menue";
import { mitBetrieb, useBetriebsschichten } from "./betrieb";
import { PrivatNeuigkeiten } from "./neuigkeiten";
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
  const [hinweisZu, setHinweisZu] = useState<{ upload: boolean; los: boolean }>({ upload: true, los: true });
  useEffect(() => {
    let v = { upload: false, los: false };
    try {
      const g = JSON.parse(window.localStorage.getItem(hinweisKey) ?? "{}") as Partial<typeof v>;
      v = { upload: g.upload === true, los: g.los === true };
    } catch {
      // ohne Speicher: Hinweise zeigen
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHinweisZu(v);
  }, [hinweisKey]);
  function hinweisSchliessen(welcher: "upload" | "los") {
    const v = { ...hinweisZu, [welcher]: true };
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
  /** Zuletzt geänderte Tage – für „Rückgängig“. */
  const [rueck, setRueck] = useState<{ text: string; vorlage: string; vorher: Record<string, TagEintrag | undefined> } | null>(null);
  const rueckUhr = useRef<number | null>(null);

  const [tagBlatt, setTagBlatt] = useState<string | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null; startZeit?: string } | null>(null);
  /** Tagesansicht mit Zeitleiste */
  const [tagAnsicht, setTagAnsicht] = useState<string | null>(null);
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

  // Mit Betriebszugang (Migration 0194): die eigenen Betriebsschichten, nur zum Ansehen.
  const betriebSchichten = useBetriebsschichten(konto.userId, !!betrieb, bereich.von, bereich.bis);
  const anzeigeTage = useMemo(() => mitBetrieb(tage, betriebSchichten), [tage, betriebSchichten]);
  const anzeigeArtNach = useMemo(
    () => (betriebSchichten.arten.size ? new Map([...artNach, ...betriebSchichten.arten]) : artNach),
    [artNach, betriebSchichten.arten],
  );

  const ladeJahre = useCallback(async (jahre: number[], erneut = false) => {
    const fehlend = jahre.filter((j) => erneut || !geladen.current.has(j));
    if (!fehlend.length) return;
    setLaedt(true);
    if (!erneut) {
      // Gleich nach dem Öffnen: der zuletzt gemerkte Stand dieses Geräts, bis die frischen Daten da sind.
      for (const j of fehlend) {
        const g = ausGeraet<{ t: Record<string, TagEintrag>; f: Record<string, string> }>(`${konto.userId}:privat:jahr:${j}`);
        if (!g?.t || !g.f) continue;
        setTage((alt) => (Object.keys(alt).some((k) => k.startsWith(`${j}-`)) ? alt : { ...alt, ...g.t }));
        setFeiertage((alt) => ({ ...g.f, ...alt }));
      }
    }
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
      for (const { j } of ergebnisse) geladen.current.add(j);
      setFehler(null);
    } catch (e) {
      // Ohne Netz zeigt der Kalender den gemerkten Stand (Banner „Offline“) – keine Fehlermeldung.
      if (!istOffline()) setFehler(e instanceof Error ? e.message : "Der Kalender konnte nicht geladen werden.");
    } finally {
      setLaedt(false);
    }
  }, [konto.userId]);

  // Den aktuellen Stand je Jahr auf dem Gerät merken (eigene Schichten und Feiertage, siehe geraete-speicher.ts).
  useEffect(() => {
    if (laedt) return;
    for (const j of geladen.current) {
      const t: Record<string, TagEintrag> = {};
      for (const [k, v] of Object.entries(tage)) if (k.startsWith(`${j}-`)) t[k] = v;
      const f: Record<string, string> = {};
      for (const [k, v] of Object.entries(feiertage)) if (k.startsWith(`${j}-`)) f[k] = v;
      aufGeraet(`${konto.userId}:privat:jahr:${j}`, { t, f });
    }
  }, [tage, feiertage, laedt, konto.userId]);

  useEffect(() => {
    // Im Monat auch die Nachbarmonate vorladen, damit sie beim Wischen schon da sind.
    const rand = ansicht === "monat" ? 35 : 0;
    const jahre = new Set([fromISO(addDays(bereich.von, -rand)).getFullYear(), fromISO(addDays(bereich.bis, rand)).getFullYear()]);
    void ladeJahre([...jahre]);
  }, [bereich, ansicht, ladeJahre]);

  const ladeTermine = useCallback(async () => {
    try {
      const neu = await fetchMeineTermine();
      setTermine(neu);
      aufGeraet(`${konto.userId}:privat:termine`, neu);
    } catch {
      // Termine sind Beiwerk – der Kalender bleibt nutzbar. Ohne Netz: der gemerkte Stand dieses Geräts.
      const gemerkt = ausGeraet<Termin[]>(`${konto.userId}:privat:termine`);
      if (gemerkt) setTermine((alt) => (alt.length ? alt : gemerkt));
    }
  }, [konto.userId]);
  useEffect(() => {
    void ladeTermine();
  }, [ladeTermine]);

  const ladeTodos = useCallback(async () => {
    try {
      const neu = await fetchTodos();
      setTodos(neu);
      aufGeraet(`${konto.userId}:privat:todos`, neu);
    } catch {
      // To-dos sind Beiwerk. Ohne Netz: der gemerkte Stand dieses Geräts.
      const gemerkt = ausGeraet<Todo[]>(`${konto.userId}:privat:todos`);
      if (gemerkt) setTodos((alt) => (alt.length ? alt : gemerkt));
    }
  }, [konto.userId]);
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

  async function terminVerschieben(t: Termin, von: string, bis: string) {
    if (istWartend(t)) {
      offline.merken({ ...t, von, bis }, t);
      return;
    }
    if (istOffline()) {
      setFehler(OHNE_NETZ);
      return;
    }
    setTermine((alt) => alt.map((x) => (x.id === t.id ? { ...x, von, bis } : x)));
    try {
      await speichereTermin({ ...t, von, bis });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht verschoben werden.");
    }
    void ladeTermine();
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
      void ladeTermine();
      void ladeTodos();
      void andere.neuLaden();
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
  const darfTerminLoeschen = (t: Termin) => (t.inhaber ? t.vonUser === konto.userId : !(t.vonPartner && !t.vonUser));
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
   * Pinsel: ein Strich über einen oder mehrere Tage. Steht die gewählte
   * Schicht am ersten Tag schon, nimmt der Strich sie überall weg (nochmal
   * tippen = weg). Sonst kommt sie dazu – bis zu drei Einträge je Tag, volle
   * Tage bleiben, wie sie sind. „Leeren“ fragt vorher nach.
   */
  function pinselStrich(liste: string[]) {
    if (!pinselAn || !pinsel) return;
    if (pinsel === "leer") {
      const voll = liste.filter((t) => tage[t]);
      if (!voll.length) return;
      loesch.frage({
        titel: voll.length === 1 ? "Schicht löschen?" : `${voll.length} Tage leeren?`,
        text:
          voll.length === 1
            ? `Der Eintrag am ${formatDE(voll[0]!)} wird gelöscht.`
            : "Die Schichten an diesen Tagen werden gelöscht.",
        onJa: () => {
          merke(voll, "{n} geleert");
          void leeren(voll);
        },
      });
      return;
    }
    const name = artNach.get(pinsel)?.name ?? "neu";
    const weg = idsVon(tage[liste[0]!]).includes(pinsel);
    const neu: Record<string, TagEintrag | undefined> = {};
    let voll = 0;
    for (const t of liste) {
      const ids = idsVon(tage[t]);
      if (weg) {
        if (ids.includes(pinsel)) neu[t] = eintragAus(ids.filter((id) => id !== pinsel));
      } else if (!ids.includes(pinsel)) {
        if (ids.length >= MAX_JE_TAG) voll++;
        else neu[t] = eintragAus([...ids, pinsel]);
      }
    }
    const geaendert = Object.keys(neu);
    if (!geaendert.length) {
      if (voll) setFehler(`An ${voll === 1 ? "diesem Tag" : "diesen Tagen"} stehen schon ${MAX_JE_TAG} Einträge.`);
      return;
    }
    setFehler(voll ? `An ${voll} ${voll === 1 ? "Tag" : "Tagen"} stehen schon ${MAX_JE_TAG} Einträge – dort nichts geändert.` : null);
    merke(geaendert, weg ? `${name} entfernt · {n}` : `${name} eingetragen · {n}`);
    void aendern(neu);
  }

  function tagAntippen(iso: string) {
    if (pinselAn && pinsel) return pinselStrich([iso]);
    setTagBlatt(iso);
  }

  // ---- Navigation ------------------------------------------------------------
  function springe(schritt: number) {
    if (ansicht === "woche") setAnker(addDays(anker, 7 * schritt));
    else if (ansicht === "jahr") setAnker(toISO(new Date(ankerD.getFullYear() + schritt, ankerD.getMonth(), 1)));
    else setAnker(toISO(new Date(ankerD.getFullYear(), ankerD.getMonth() + schritt, 1)));
  }
  function waehleAnsicht(a: Ansicht) {
    setAnsicht(a);
    // Der Pinsel gehört zum Monat.
    if (a !== "monat") setPinselAn(false);
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
      if (ansicht === "woche") setAnker(addDays(anker, dx < 0 ? 1 : -1));
      else springe(dx < 0 ? 1 : -1);
    }
  }
  // Im Monat: seitlich oder nach oben/unten wischen – Vor- und Folgemonat folgen dem Finger.
  const { flaeche: monatFlaeche, seite: monatSeite, griffe: monatGriffe, gewischt: monatGewischt } = useMonatKarussell(springe);
  // Lange auf einen Tag drücken: neuer Termin für diesen Tag.
  const langDruck = useLangDruck((iso) => {
    if (pinselAn) return;
    setTerminBlatt({ datum: iso, termin: null });
  });
  // Pinsel: kurz halten und über mehrere Tage wischen; normales Wischen blättert weiter.
  const strich = usePinselStrich(pinselStrich, monatGriffe);
  function tippen(iso: string) {
    if (langDruck.geschluckt() || gewischt.current || monatGewischt.current) return;
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

  // Plan hochladen: Dateien gleich hier wählen, die Import-Seite liest sie danach.
  const hochladeFeld = useRef<HTMLInputElement>(null);
  function hochgeladen(dateien: File[]) {
    if (!dateien.length) return;
    merkeImportDateien(dateien);
    router.push("/privat/import");
  }

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
  };

  return (
    <div
      className={cn(
        // Genau ein Bildschirm: zwischen Statusleiste und schwebender Leiste.
        "fixed inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col px-0 pt-[max(0.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(0.75rem,env(safe-area-inset-top))]",
        "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.6rem)]",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-1.5 sm:px-0 sm:pb-2.5 sm:pt-0">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold leading-[1.05] tracking-[-0.02em] [@media(max-width:360px)]:text-[21px]">{titel}</h1>
          <p className="tnum mt-0.5 truncate text-[13px] font-medium leading-none text-ink-muted">
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
          <TodoZaehler anzahl={offeneBisHeute(todos, heute)} onClick={() => setTodoBlatt({ datum: heute })} />
          <WenSeheIch andere={andere} glas onVerwalten={() => setTeilen(true)} />
          <span className="hidden gap-2 sm:flex">
            <GlasKnopf label="Vorher" onClick={() => springe(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </GlasKnopf>
            <GlasKnopf label="Weiter" onClick={() => springe(1)}>
              <ChevronRight className="h-5 w-5" />
            </GlasKnopf>
          </span>
          <AnsichtMenue ansicht={ansicht} onWahl={waehleAnsicht} onHochladen={() => hochladeFeld.current?.click()} />
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

      {leer && !hinweisZu.upload ? (
        <div className="relative mx-3.5 mb-2.5 rounded-[22px] bg-gradient-to-br from-brand-500 to-[#4a3fd6] p-4 text-white shadow-[0_12px_28px_rgba(47,91,234,0.3)] sm:mx-0">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/20">
              <Upload className="h-5 w-5" />
            </span>
            <div className="min-w-0 pr-7">
              <h2 className="text-[16.5px] font-bold leading-tight">Schon einen Plan in einer anderen App?</h2>
              <p className="mt-1 text-[13px] leading-snug text-white/85">
                Screenshot der Monatsansicht hochladen – ShiftNexo erkennt Monat, Schichten und Termine.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => hinweisSchliessen("upload")}
            aria-label="Hinweis schließen"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-white/80 active:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => hochladeFeld.current?.click()}
              className="h-11 rounded-[14px] bg-white text-[14.5px] font-bold text-brand-700"
            >
              Screenshot hochladen
            </button>
            <button
              type="button"
              onClick={() => hochladeFeld.current?.click()}
              className="h-11 rounded-[14px] border-2 border-white/45 px-3.5 text-[13.5px] font-semibold"
            >
              .ics wählen
            </button>
          </div>
        </div>
      ) : null}

      {leer && !hinweisZu.los ? (
        <div className="glas relative mx-3.5 mb-2.5 flex items-center rounded-[18px] sm:mx-0">
          <button type="button" onClick={() => setRotation(true)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 pr-1 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <Repeat className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[13.5px] leading-snug">
              <b className="font-semibold">Los geht&apos;s:</b> Trag deine Schichtfolge einmal ein – der Kalender füllt
              sich von selbst.
            </span>
          </button>
          <button
            type="button"
            onClick={() => hinweisSchliessen("los")}
            aria-label="Hinweis schließen"
            className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted active:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "relative min-h-0 flex-1 select-none",
          ansicht === "monat" ? "-m-2 touch-none overflow-hidden p-2" : "touch-pan-y px-3.5 sm:px-0",
        )}
        {...(ansicht === "monat"
          ? pinselAn
            ? strich.griffe
            : monatGriffe
          : { onPointerDown: wischStart, onPointerUp: wischEnde, onPointerCancel: () => (wisch.current = null) })}
        aria-busy={laedt || !schichtarten}
      >
        {ansicht === "monat" ? (
          <div ref={monatFlaeche} className="relative h-full">
            {([-1, 0, 1] as const).map((o) => {
              const m = new Date(ankerD.getFullYear(), ankerD.getMonth() + o, 1);
              const mitte = o === 0;
              return (
                <div key={o} ref={monatSeite(o)} className={cn("absolute inset-0 will-change-transform", !mitte && "invisible")} aria-hidden={!mitte}>
                  <MonatsAnsicht
                    jahr={m.getFullYear()}
                    monat={m.getMonth()}
                    heute={heute}
                    tage={anzeigeTage}
                    artNach={anzeigeArtNach}
                    feiertagVon={feiertagVon}
                    termine={sichtbareTermine}
                    andere={andere}
                    onTag={mitte ? tippen : () => undefined}
                    zelle={mitte ? langDruck.zelle : undefined}
                    markiert={mitte ? strich.markiert : undefined}
                  />
                </div>
              );
            })}
          </div>
        ) : ansicht === "woche" ? (
          <Tagesansicht
            eingebettet
            iso={anker}
            {...tagesProps}
            onIso={setAnker}
            onTermin={(t, startZeit) => setTerminBlatt({ datum: anker, termin: t, startZeit })}
            onTodos={() => setTodoBlatt({ datum: anker })}
            onSchicht={() => setTagBlatt(anker)}
            onClose={() => undefined}
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
        {ansicht === "monat" && !pinselAn && schichtarten?.length ? (
          <PinselKnopf
            onClick={() => {
              setPinselAn(true);
              if (!pinsel && schichtarten?.length) setPinsel(schichtarten[0]!.id);
            }}
          />
        ) : null}
      </div>

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
              ? terminBlatt.termin.vonUser !== konto.userId
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

      {rotation && schichtarten ? (
        <RotationBlatt
          arten={schichtarten}
          heute={heute}
          onFertig={() => {
            setRotation(false);
            void ladeJahre([...geladen.current], true);
          }}
          onClose={() => setRotation(false)}
        />
      ) : null}
    </div>
  );
}

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
      className="glas grid h-full grid-cols-7 overflow-hidden rounded-none sm:rounded-[22px]"
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
  const gesetzt = ids.map((id) => artNach.get(id)).filter((a): a is Schichtart => !!a);
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
