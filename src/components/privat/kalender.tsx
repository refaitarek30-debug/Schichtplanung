"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type React from "react";
import { ChevronLeft, ChevronRight, Pencil, Repeat } from "lucide-react";
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
import { terminLoeschenModus, terminSichernUeberall, type LoeschModus } from "@/lib/data/verbindungen";
import { fetchTodos, todoErledigt, todoLoeschen, todoSpeichern, todosAm, type Todo } from "@/lib/data/todos";
import { AnDiesemTag, AndereTags, WenSeheIch, useAndere, type Andere, type AndererEintrag } from "@/components/kalender/andere";
import { KalenderTeilen } from "@/components/kalender/teilen";
import { terminZeilen, useZellenHoehe } from "@/components/kalender/zellen";
import { PinselKnopf, PinselLeiste, useMonatWischen } from "@/components/kalender/pinsel";
import { TodoZaehler, offeneBisHeute } from "@/components/kalender/todo-zaehler";
import {
  fetchMeineTermine,
  speichereTermin,
} from "@/lib/data/partner";
import { addDays, formatDE, formatDEShort, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import {
  farbStil,
  ladeFeiertage,
  ladeTage,
  leereTage,
  setzeTage,
  type Ebene,
  type Schichtart,
  type TagEintrag,
} from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { Blatt } from "./blatt";
import { RotationBlatt } from "./rotation";
import { AnsichtMenue, type Ansicht } from "./ansicht-menue";

/**
 * Schichtkalender für Privatkonten: Woche, Monat, Jahr. Eintragen per
 * Antippen (Tagesblatt), per Pinsel (mehrere Tage nacheinander) oder als
 * Schichtfolge (Rotation).
 *
 * Je Tag bis zu zwei Einträge: die Schicht (Ebene 1) und ein Zusatz wie
 * Urlaub (Ebene 2). Die Schicht bleibt stehen, bis sie jemand entfernt.
 */


const ANSICHT_SCHLUESSEL = "schichtplan.privat-ansicht";
const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WT_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const LEER: TagEintrag = { schicht: null, zusatz: null };

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
  if (!e) return [];
  return [e.schicht, e.zusatz].map((id) => (id ? artNach.get(id) : undefined)).filter((a): a is Schichtart => !!a);
}

export function PrivatKalender() {
  const router = useRouter();
  const { konto, schichtarten, artNach, artenFehler } = usePrivat();
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

  const [tage, setTage] = useState<Record<string, TagEintrag>>({});
  const [feiertage, setFeiertage] = useState<Record<string, string>>({});
  const geladen = useRef(new Set<number>());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const [termine, setTermine] = useState<Termin[]>([]);
  const [teilen, setTeilen] = useState(false);
  /** Zuletzt geänderte Tage – für „Rückgängig“. */
  const [rueck, setRueck] = useState<{ text: string; vorher: Record<string, TagEintrag | undefined> } | null>(null);
  const rueckUhr = useRef<number | null>(null);

  const [tagBlatt, setTagBlatt] = useState<string | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null; startZeit?: string } | null>(null);
  /** Tagesansicht mit Zeitleiste */
  const [tagAnsicht, setTagAnsicht] = useState<string | null>(null);
  /** To-do-Liste; datum = vorgeschlagener Tag für neue */
  const [todoBlatt, setTodoBlatt] = useState<{ datum: string | null } | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const { vorlieben } = useVorlieben();
  const [rotation, setRotation] = useState(false);
  /** Pinsel: Schichtart-Id oder "leer" zum Löschen */
  const [pinsel, setPinsel] = useState<string | null>(null);
  const [pinselAn, setPinselAn] = useState(false);

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

  const ladeJahre = useCallback(async (jahre: number[], erneut = false) => {
    const fehlend = jahre.filter((j) => erneut || !geladen.current.has(j));
    if (!fehlend.length) return;
    setLaedt(true);
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
      setFehler(e instanceof Error ? e.message : "Der Kalender konnte nicht geladen werden.");
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    const jahre = new Set([fromISO(bereich.von).getFullYear(), fromISO(bereich.bis).getFullYear()]);
    void ladeJahre([...jahre]);
  }, [bereich, ladeJahre]);

  const ladeTermine = useCallback(async () => {
    try {
      setTermine(await fetchMeineTermine());
    } catch {
      // Termine sind Beiwerk – der Kalender bleibt nutzbar.
    }
  }, []);
  useEffect(() => {
    void ladeTermine();
  }, [ladeTermine]);

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

  async function terminVerschieben(t: Termin, von: string, bis: string) {
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
  const sichtbareTermine = useMemo(
    () => [...termine, ...andere.fremdeTermine].filter(andere.terminSichtbar),
    [termine, andere.fremdeTermine, andere.terminSichtbar],
  );
  /** Eigene Termine und Einträge bei Verbundenen darf man löschen – Termine anderer nur ansehen. */
  const darfTerminLoeschen = (t: Termin) => (t.inhaber ? t.vonUser === konto.userId : !(t.vonPartner && !t.vonUser));
  async function terminWeg(t: Termin, modus: LoeschModus, datum: string) {
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
      const vorher: Record<string, TagEintrag | undefined> = { ...(alt && rueckUhr.current ? alt.vorher : {}) };
      for (const t of liste) if (!(t in vorher)) vorher[t] = tage[t];
      const n = Object.keys(vorher).length;
      return { text: text.replace("{n}", n === 1 ? "1 Tag" : `${n} Tage`), vorher };
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
    const leerTage = Object.entries(r.vorher).filter(([, e]) => !e).map(([t]) => t);
    const mitInhalt = Object.entries(r.vorher).filter((x): x is [string, TagEintrag] => !!x[1]);
    setTage((alt) => {
      const neu = { ...alt };
      for (const t of leerTage) delete neu[t];
      for (const [t, e] of mitInhalt) neu[t] = e;
      return neu;
    });
    try {
      if (leerTage.length) await leereTage(leerTage);
      for (const [t, e] of mitInhalt) {
        await setzeTage([t], e.schicht, 1);
        await setzeTage([t], e.zusatz, 2);
      }
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

  /** Eine Ebene setzen (null = diese Ebene leeren); optimistisch. */
  async function setzen(liste: string[], artId: string | null, ebene: Ebene) {
    const vorher = tage;
    setTage((alt) => {
      const neu = { ...alt };
      for (const t of liste) {
        const e = { ...(neu[t] ?? LEER) };
        if (ebene === 1) e.schicht = artId;
        else e.zusatz = artId;
        if (!e.schicht && !e.zusatz) delete neu[t];
        else neu[t] = e;
      }
      return neu;
    });
    try {
      await setzeTage(liste, artId, ebene);
    } catch (e) {
      await nachFehler(liste, vorher, e);
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

  /** Beide Einträge eines Tages auf einmal setzen; optimistisch. */
  async function tagSetzen(iso: string, schicht: string | null, zusatz: string | null) {
    const vorher = tage;
    setTage((alt) => {
      const neu = { ...alt };
      if (!schicht && !zusatz) delete neu[iso];
      else neu[iso] = { schicht, zusatz };
      return neu;
    });
    try {
      if (!schicht && !zusatz) await leereTage([iso]);
      else {
        await setzeTage([iso], schicht, 1);
        await setzeTage([iso], zusatz, 2);
      }
    } catch (e) {
      await nachFehler([iso], vorher, e);
    }
  }

  /**
   * Wohin ein neuer Eintrag gehört: Ist der Tag leer, wird es die Schicht.
   * Steht schon eine Schicht da, kommt der neue Eintrag als zweiter dazu und
   * ersetzt nichts. Sind beide Plätze belegt, tauscht er den zweiten. Zum
   * Ersetzen gibt es „Leeren“ oder das Tagesblatt.
   */
  function hinzufuegen(iso: string, artId: string) {
    const e = tage[iso] ?? LEER;
    if (!e.schicht) return void setzen([iso], artId, 1);
    if (e.schicht === artId || e.zusatz === artId) return;
    void setzen([iso], artId, 2);
  }

  function tagAntippen(iso: string) {
    if (pinselAn && pinsel) {
      if (pinsel === "leer") {
        if (tage[iso]) {
          merke([iso], "{n} geleert");
          void leeren([iso]);
        }
        return;
      }
      const dabei = !!tage[iso]?.schicht && tage[iso]?.schicht !== pinsel;
      merke([iso], `{n} ${dabei ? "mit" : "auf"} ${artNach.get(pinsel)?.name ?? "neu"} ${dabei ? "ergänzt" : "gesetzt"}`);
      hinzufuegen(iso, pinsel);
      return;
    }
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
  // Im Monat: nach oben/unten wischen, mit Bewegung (wie „Mein Kalender“).
  const { flaeche: monatFlaeche, griffe: monatGriffe, gewischt: monatGewischt } = useMonatWischen(springe);
  // Lange auf einen Tag drücken: neuer Termin für diesen Tag.
  const langDruck = useLangDruck((iso) => {
    if (pinselAn) return;
    setTerminBlatt({ datum: iso, termin: null });
  });
  function tippen(iso: string) {
    if (langDruck.geschluckt() || gewischt.current || monatGewischt.current) return;
    tagAntippen(iso);
  }

  const leer = schichtarten && !laedt && Object.keys(tage).length === 0;

  /** Was die Tagesansicht braucht – als Vollbild und als „Woche“. */
  const tagesProps = {
    heute,
    baender: (iso: string) =>
      arten(tage[iso], artNach)
        .filter((a) => a.beginn && a.ende)
        .map((a) => ({ name: a.name, beginn: a.beginn, ende: a.ende, farbe: a.farbe })),
    ganztaegig: (iso: string) => [
      ...arten(tage[iso], artNach)
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
        "fixed inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6",
        "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.6rem)]",
      )}
    >
      <header className="flex items-center justify-between gap-2 pb-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.02em] [@media(max-width:360px)]:text-[23px]">{titel}</h1>
          <p className="tnum truncate text-[14px] font-medium text-ink-muted">
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
        <div className="flex shrink-0 items-center gap-2 [@media(max-width:360px)]:gap-1.5">
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
          <AnsichtMenue ansicht={ansicht} onWahl={waehleAnsicht} />
        </div>
      </header>

      {fehler || artenFehler ? (
        <div className="mb-2">
          <Alert tone="error">{fehler ?? artenFehler}</Alert>
        </div>
      ) : null}

      {leer ? (
        <button type="button" onClick={() => setRotation(true)} className="glas mb-2.5 flex w-full items-center gap-3 rounded-[18px] px-3.5 py-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <Repeat className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[13.5px] leading-snug">
            <b className="font-semibold">Los geht&apos;s:</b> Trag deine Schichtfolge einmal ein – der Kalender füllt
            sich von selbst.
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          "relative min-h-0 flex-1 select-none",
          ansicht === "monat" ? "-m-2 touch-none overflow-hidden p-2" : "touch-pan-y",
        )}
        {...(ansicht === "monat"
          ? monatGriffe
          : { onPointerDown: wischStart, onPointerUp: wischEnde, onPointerCancel: () => (wisch.current = null) })}
        aria-busy={laedt || !schichtarten}
      >
        {ansicht === "monat" ? (
          <div ref={monatFlaeche} className="h-full will-change-transform">
          <MonatsAnsicht
            jahr={ankerD.getFullYear()}
            monat={ankerD.getMonth()}
            heute={heute}
            tage={tage}
            artNach={artNach}
            feiertagVon={feiertagVon}
            termine={sichtbareTermine}
            andere={andere}
            onTag={tippen}
            zelle={langDruck.zelle}
          />
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
            tage={tage}
            artNach={artNach}
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
          arten={schichtarten ?? []}
          artNach={artNach}
          feiertag={feiertagVon(tagBlatt)}
          termine={termineAm(sichtbareTermine, tagBlatt)}
          todos={todosAm(todos, tagBlatt)}
          andere={andere.amTag(tagBlatt)}
          terminVon={andere.terminVon}
          onSetzen={(schicht, zusatz, text) => {
            merke([tagBlatt], text);
            void tagSetzen(tagBlatt, schicht, zusatz);
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
}: AnsichtProps & {
  jahr: number;
  monat: number;
  termine: Termin[];
  andere: Andere;
  onTag: (iso: string) => void;
  zelle?: ZellGriffe;
}) {
  const { start, wochen } = monatRaster(jahr, monat);
  const liste = Array.from({ length: wochen * 7 }, (_, i) => addDays(start, i));
  const { ref: zellenRef, hoehe: zellenHoehe } = useZellenHoehe();
  return (
    <div
      className="glas grid h-full grid-cols-7 overflow-hidden rounded-[22px]"
      style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
    >
      {WT.map((w, i) => (
        <span key={w} className={cn("pb-1 pt-1.5 text-center text-[11px] font-semibold uppercase", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>
          {w}
        </span>
      ))}
      {liste.map((iso, i) => {
        const d = fromISO(iso);
        const imMonat = d.getMonth() === monat;
        const eintraege = arten(tage[iso], artNach);
        const zwei = eintraege.length === 2;
        const fei = feiertagVon(iso);
        const ts = termineAm(termine, iso);
        const andereAm = andere.amTag(iso);
        // Termine stehen untereinander – so viele, wie in die Zelle passen.
        const zeilen = terminZeilen(zellenHoehe, {
          kaestchen: eintraege.length,
          klein: zwei,
          eingeladene: andereAm.length > 0,
          extraZeilen: fei ? 1 : 0,
        });
        const zeigen = ts.length > zeilen ? ts.slice(0, Math.max(0, zeilen - 1)) : ts;
        const rest = ts.length - zeigen.length;
        return (
          <button
            key={iso}
            ref={i === 7 ? zellenRef : undefined}
            type="button"
            {...zelle?.(iso)}
            onClick={() => onTag(iso)}
            aria-label={`${WT_LANG[i % 7]}, ${formatDE(iso)}${eintraege.length ? `: ${eintraege.map((a) => a.name).join(" und ")}` : ""}${fei ? `, ${fei}` : ""}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
            className={cn(
              // Feste Zellgröße: Inhalt wird abgeschnitten, nie gestreckt.
              "glas-linie flex min-h-0 flex-col items-stretch gap-[2px] overflow-hidden border-t px-[2px] pb-0.5 pt-[3px] text-center outline-none transition-colors [-webkit-touch-callout:none] active:bg-ink/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
              i % 7 !== 0 && "border-l",
              i % 7 >= 5 && "bg-ink/[0.025]",
              !imMonat && "opacity-35",
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
            <AndereTags eintraege={andereAm} />
            {fei ? <span className="shrink-0 truncate text-[9.5px] leading-tight text-[#e5484d]">{fei}</span> : null}
            {zeigen.map((t) => (
              <span key={t.id} className="shrink-0 truncate text-left text-[10px] leading-[1.25] text-ink-muted [@media(max-height:750px)]:hidden">
                <span className={cn("mr-0.5 inline-block h-[5px] w-[5px] rounded-full align-middle", t.vonPartner ? "bg-brand-500" : "bg-ink-faint")} />
                {t.titel || "Termin"}
              </span>
            ))}
            {rest > 0 && zeilen > 0 ? (
              <span className="shrink-0 truncate whitespace-nowrap text-left text-[10px] font-semibold leading-[1.25] text-ink-faint [@media(max-height:750px)]:hidden">
                +{rest} {zeigen.length ? "weitere" : rest === 1 ? "Termin" : "Termine"}
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
                  const [a1, a2] = arten(tage[iso], artNach);
                  const fei = feiertagVon(iso);
                  // Zwei Einträge: diagonal geteilt.
                  const stil = a1
                    ? a2
                      ? {
                          backgroundImage: `linear-gradient(135deg, ${a1.farbe} 50%, ${a2.farbe} 50%)`,
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
  arten: Schichtart[];
  artNach: Map<string, Schichtart>;
  feiertag?: string;
  termine: Termin[];
  todos: Todo[];
  andere: AndererEintrag[];
  terminVon: (t: Termin) => { name: string; farbe: string } | null;
  /** Beide Einträge setzen; text für „Rückgängig“ */
  onSetzen: (schicht: string | null, zusatz: string | null, text: string) => void;
  onTermin: (t: Termin | null) => void;
  onTerminLoeschen: (t: Termin, modus: LoeschModus, datum: string) => void;
  darfLoeschen: (t: Termin) => boolean;
  onTodo: (id: string, an: boolean) => void;
  onTag: () => void;
  onClose: () => void;
}) {
  const s = eintrag.schicht ? artNach.get(eintrag.schicht) : undefined;
  const z = eintrag.zusatz ? artNach.get(eintrag.zusatz) : undefined;
  const erster = s ?? z;
  const zweiter = s && z ? z : undefined;
  const [aendern, setAendern] = useState(false);
  const [nachricht, setNachricht] = useState(
    erster ? "Tippen = 2. Eintrag · nochmal tippen = nur diese Schicht" : "Was steht an diesem Tag an?",
  );

  function tipp(id: string) {
    const neu = artNach.get(id);
    if (!neu) return;
    if (!erster) {
      onSetzen(id, null, "{n} geändert");
      setNachricht(`${neu.name} eingetragen.`);
    } else if (erster.id !== id && zweiter?.id !== id) {
      onSetzen(erster.id, id, "{n} geändert");
      setNachricht(`${neu.name} als 2. Eintrag · nochmal tippen = nur ${neu.name}.`);
    } else if (zweiter) {
      const weg = erster.id === id ? zweiter : erster;
      onSetzen(id, null, "{n} geändert");
      setNachricht(`Nur noch ${neu.name} – ${weg.name} ist weg.`);
    } else {
      setNachricht(`${neu.name} ist schon eingetragen.`);
    }
  }

  function entfernen(id: string) {
    const rest = [erster, zweiter].filter((a): a is Schichtart => !!a && a.id !== id);
    onSetzen(rest[0]?.id ?? null, null, "Eintrag entfernt");
    setNachricht("Eintrag entfernt.");
  }

  const d = fromISO(iso);
  const zeit = (a: Schichtart) => zeitText(a) || (a.art === "arbeit" ? null : a.art === "frei" ? "frei" : "ganztägig");
  const nichts = !erster && !feiertag && !termine.length && !todos.length && !andere.length;
  return (
    <Blatt
      wischZu
      titel={`${WT_LANG[wochentag(iso)]}, ${d.getDate()}. ${monthName(d.getMonth())}`}
      unter={
        feiertag || erster ? (
        <span className="mt-1 flex flex-wrap gap-1.5">
          {feiertag ? <span className="font-medium text-[#e5484d]">{feiertag}</span> : null}
          {[erster, zweiter].map((a) =>
            a ? (
              <EintragPille
                key={a.id}
                name={a.name}
                zeit={zeit(a)}
                farbe={a.farbe}
                onEntfernen={aendern ? () => entfernen(a.id) : undefined}
              />
            ) : null,
          )}
        </span>
        ) : undefined
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
      <AnDiesemTag eintraege={andere} className="mt-3" />

      {aendern ? (
        <div className="mt-3">
          <SchichtLeiste
            eintraege={alleArten.map((a) => ({
              id: a.id,
              name: a.name,
              farbe: a.farbe,
              rang: erster?.id === a.id ? 1 : zweiter?.id === a.id ? 2 : 0,
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
