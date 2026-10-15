"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Eraser, Layers, Paintbrush, Repeat, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { TerminBlatt, termineAm, type Termin, type TerminEingabe } from "@/components/kalender/termine";
import { PARTNER_FARBE, partnerText, type PartnerSchicht } from "@/components/kalender/partner";
import {
  fetchMeinePartnerTage,
  fetchMeineTermine,
  loescheTermin,
  speichereTermin,
} from "@/lib/data/partner";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import {
  farbStil,
  istAbwesenheit,
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

/**
 * Schichtkalender für Privatkonten: Woche, Monat, Jahr. Eintragen per
 * Antippen (Tagesblatt), per Pinsel (mehrere Tage nacheinander) oder als
 * Schichtfolge (Rotation).
 *
 * Je Tag bis zu zwei Einträge: die Schicht (Ebene 1) und ein Zusatz wie
 * Urlaub (Ebene 2). Die Schicht bleibt stehen, bis sie jemand entfernt.
 */

type Ansicht = "woche" | "monat" | "jahr";

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
  const [partner, setPartner] = useState<Record<string, PartnerSchicht>>({});

  const [tagBlatt, setTagBlatt] = useState<string | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null } | null>(null);
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

  useEffect(() => {
    if (ansicht === "jahr") return;
    let aus = false;
    fetchMeinePartnerTage(bereich.von, bereich.bis)
      .then((p) => !aus && setPartner((alt) => ({ ...alt, ...p })))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, [ansicht, bereich]);

  // ---- Schreiben -----------------------------------------------------------
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
      setTage(vorher);
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
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
      setTage(vorher);
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
    }
  }

  /**
   * Wohin ein neuer Eintrag gehört: Ist der Tag leer, wird es die Schicht.
   * Steht schon eine Schicht da, kommt der neue Eintrag als Zusatz dazu –
   * außer beide sind Arbeitsschichten im Pinsel: dann wird ersetzt.
   */
  function hinzufuegen(iso: string, artId: string, ersetzenWennArbeit: boolean) {
    const e = tage[iso] ?? LEER;
    const neu = artNach.get(artId);
    if (!e.schicht) return void setzen([iso], artId, 1);
    if (e.schicht === artId) return;
    const alt = artNach.get(e.schicht);
    if (ersetzenWennArbeit && !istAbwesenheit(neu) && !istAbwesenheit(alt)) return void setzen([iso], artId, 1);
    void setzen([iso], artId, 2);
  }

  function tagAntippen(iso: string) {
    if (pinselAn && pinsel) {
      if (pinsel === "leer") {
        if (tage[iso]) void leeren([iso]);
        return;
      }
      hinzufuegen(iso, pinsel, true);
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
        ? `${formatDE(bereich.von)} – ${formatDE(bereich.bis)}`
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
      springe(dx < 0 ? 1 : -1);
    }
  }
  function tippen(iso: string) {
    if (gewischt.current) return;
    tagAntippen(iso);
  }

  const leer = schichtarten && !laedt && Object.keys(tage).length === 0;

  return (
    <div
      className={cn(
        // Genau ein Bildschirm: zwischen Statusleiste und schwebender Leiste.
        "fixed inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6",
        pinselAn
          ? "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+10.2rem)]"
          : "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.6rem)]",
      )}
    >
      <header className="flex items-center justify-between gap-2 pb-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.02em]">{titel}</h1>
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
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden gap-2 sm:flex">
            <GlasKnopf label="Vorher" onClick={() => springe(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </GlasKnopf>
            <GlasKnopf label="Weiter" onClick={() => springe(1)}>
              <ChevronRight className="h-5 w-5" />
            </GlasKnopf>
          </span>
          <GlasKnopf label="Schichtfolge eintragen" onClick={() => setRotation(true)}>
            <Repeat className="h-[18px] w-[18px]" />
          </GlasKnopf>
          <GlasKnopf
            label="Mit dem Pinsel eintragen"
            aktiv={pinselAn}
            onClick={() => {
              setPinselAn(!pinselAn);
              if (!pinsel && schichtarten?.length) setPinsel(schichtarten[0]!.id);
            }}
          >
            <Paintbrush className="h-[18px] w-[18px]" />
          </GlasKnopf>
        </div>
      </header>

      <div role="tablist" aria-label="Ansicht" className="glas mb-2.5 grid grid-cols-3 rounded-[14px] p-[3px]">
        {(["woche", "monat", "jahr"] as const).map((a) => (
          <button
            key={a}
            role="tab"
            type="button"
            aria-selected={ansicht === a}
            onClick={() => waehleAnsicht(a)}
            className={cn(
              "rounded-[11px] py-1.5 text-[13px] font-semibold transition-all",
              ansicht === a ? "bg-surface text-ink shadow-[0_2px_8px_rgba(0,0,0,0.1)]" : "text-ink-muted",
            )}
          >
            {a === "woche" ? "Woche" : a === "monat" ? "Monat" : "Jahr"}
          </button>
        ))}
      </div>

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
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={wischStart}
        onPointerUp={wischEnde}
        onPointerCancel={() => (wisch.current = null)}
        aria-busy={laedt || !schichtarten}
      >
        {ansicht === "monat" ? (
          <MonatsAnsicht
            jahr={ankerD.getFullYear()}
            monat={ankerD.getMonth()}
            heute={heute}
            tage={tage}
            artNach={artNach}
            feiertagVon={feiertagVon}
            termine={termine}
            partner={partner}
            onTag={tippen}
          />
        ) : ansicht === "woche" ? (
          <WochenAnsicht
            von={bereich.von}
            heute={heute}
            tage={tage}
            artNach={artNach}
            feiertagVon={feiertagVon}
            termine={termine}
            partner={partner}
            onTag={tippen}
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
      </div>

      {pinselAn && schichtarten ? (
        <div className="glas fixed inset-x-3 bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.6rem)] z-20 mx-auto flex h-[5.2rem] max-w-3xl touch-none flex-col justify-center overflow-hidden rounded-[24px] px-2.5">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 touch-pan-x gap-1.5 overflow-x-auto overflow-y-hidden overscroll-contain px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {schichtarten.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPinsel(a.id)}
                  aria-pressed={pinsel === a.id}
                  className={cn(
                    "h-10 shrink-0 rounded-[13px] px-3.5 text-[13.5px] font-semibold transition-transform",
                    pinsel === a.id ? "ring-2 ring-inset ring-ink/80 shadow-md" : "opacity-80",
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
                  "flex h-10 shrink-0 items-center gap-1 rounded-[13px] bg-ink/[0.07] px-3.5 text-[13.5px] font-semibold text-ink-muted",
                  pinsel === "leer" && "ring-2 ring-inset ring-ink/80",
                )}
              >
                <Eraser className="h-4 w-4" /> Leeren
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPinselAn(false)}
              aria-label="Pinsel beenden"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-ink-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="truncate px-1 pt-0.5 text-[11.5px] text-ink-muted">
            Tage antippen · Urlaub und Krank kommen zur Schicht dazu
          </p>
        </div>
      ) : null}

      {tagBlatt ? (
        <TagBlatt
          iso={tagBlatt}
          eintrag={tage[tagBlatt] ?? LEER}
          arten={schichtarten ?? []}
          artNach={artNach}
          feiertag={feiertagVon(tagBlatt)}
          termine={termineAm(termine, tagBlatt)}
          partner={partner[tagBlatt] ?? null}
          onHinzufuegen={(id) => hinzufuegen(tagBlatt, id, false)}
          onEntfernen={(ebene) => void setzen([tagBlatt], null, ebene)}
          onErsetzen={(ebene, id) => void setzen([tagBlatt], id, ebene)}
          onTermin={(t) => {
            setTerminBlatt({ datum: tagBlatt, termin: t });
            setTagBlatt(null);
          }}
          onClose={() => setTagBlatt(null)}
        />
      ) : null}

      {terminBlatt ? (
        <TerminBlatt
          glas
          datum={terminBlatt.datum}
          termin={terminBlatt.termin}
          hinweis={
            terminBlatt.termin?.vonPartner
              ? "Von deinem Partner eingetragen."
              : "Dein Partner sieht deine Termine nur, wenn du sie beim Teilen freigibst."
          }
          nurLesen={terminBlatt.termin?.vonPartner === true}
          onSpeichern={(t: TerminEingabe) => {
            setTerminBlatt(null);
            void speichereTermin(t)
              .then(ladeTermine)
              .catch((e: unknown) => setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht gespeichert werden."));
          }}
          onLoeschen={(id) => {
            setTerminBlatt(null);
            void loescheTermin(id)
              .then(ladeTermine)
              .catch((e: unknown) => setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht gelöscht werden."));
          }}
          onClose={() => setTerminBlatt(null)}
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
        "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
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
        "shrink-0 truncate rounded-[7px] px-0.5 font-semibold leading-tight",
        klein ? "py-px text-[10.5px] [@media(max-height:750px)]:py-0 [@media(max-height:750px)]:text-[10px]" : "py-[2px] text-[11.5px]",
      )}
      style={farbStil(art.farbe)}
    >
      {art.name}
    </span>
  );
}

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
  partner,
  onTag,
}: AnsichtProps & {
  jahr: number;
  monat: number;
  termine: Termin[];
  partner: Record<string, PartnerSchicht>;
  onTag: (iso: string) => void;
}) {
  const { start, wochen } = monatRaster(jahr, monat);
  const liste = Array.from({ length: wochen * 7 }, (_, i) => addDays(start, i));
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
        const p = partner[iso];
        // Höchstens so viele Terminzeilen, wie sicher ganz in die Zelle passen.
        const zeilen = Math.max(0, 2 - (p ? 1 : 0) - (zwei ? 1 : 0));
        const zeigen = ts.length > zeilen ? ts.slice(0, Math.max(0, zeilen - 1)) : ts;
        const rest = ts.length - zeigen.length;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onTag(iso)}
            aria-label={`${WT_LANG[i % 7]}, ${formatDE(iso)}${eintraege.length ? `: ${eintraege.map((a) => a.name).join(" und ")}` : ""}${fei ? `, ${fei}` : ""}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
            className={cn(
              // Feste Zellgröße: Inhalt wird abgeschnitten, nie gestreckt.
              "glas-linie flex min-h-0 flex-col items-stretch gap-[2px] overflow-hidden border-t px-[2px] pb-0.5 pt-[3px] text-center outline-none transition-colors active:bg-ink/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
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
            {p ? (
              <span className={cn("shrink-0 truncate rounded-[7px] px-0.5 py-px text-[10.5px] font-semibold leading-tight ring-[1.5px] ring-inset", PARTNER_FARBE[p])}>
                {partnerText(p)}
              </span>
            ) : null}
            {fei ? <span className="shrink-0 truncate text-[9.5px] leading-tight text-[#e5484d]">{fei}</span> : null}
            {zeigen.map((t) => (
              <span key={t.id} className="shrink-0 truncate text-left text-[10px] leading-[1.25] text-ink-muted [@media(max-height:750px)]:hidden">
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
  );
}

function WochenAnsicht({
  von,
  heute,
  tage,
  artNach,
  feiertagVon,
  termine,
  partner,
  onTag,
}: AnsichtProps & {
  von: string;
  termine: Termin[];
  partner: Record<string, PartnerSchicht>;
  onTag: (iso: string) => void;
}) {
  return (
    <ul className="glas grid h-full grid-rows-7 overflow-hidden rounded-[22px]">
      {Array.from({ length: 7 }, (_, i) => addDays(von, i)).map((iso, i) => {
        const eintraege = arten(tage[iso], artNach);
        const fei = feiertagVon(iso);
        const ts = termineAm(termine, iso);
        const p = partner[iso];
        return (
          <li key={iso} className={cn("min-h-0", i > 0 && "glas-linie border-t")}>
            <button
              type="button"
              onClick={() => onTag(iso)}
              className={cn("flex h-full w-full items-center gap-3 overflow-hidden px-3 text-left active:bg-ink/[0.06]", iso === heute && "bg-[#ff3b30]/[0.06]")}
            >
              <span className="flex w-10 shrink-0 flex-col items-center">
                <span className={cn("text-[11px] font-semibold uppercase", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>{WT[i]}</span>
                <span
                  className={cn(
                    "tnum flex h-8 min-w-8 items-center justify-center rounded-full text-[18px] font-semibold",
                    iso === heute ? "bg-[#ff3b30] text-white" : fei ? "text-[#e5484d]" : "",
                  )}
                >
                  {fromISO(iso).getDate()}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                {eintraege.length ? (
                  <span className="flex min-w-0 gap-1.5">
                    {eintraege.map((a) => (
                      <span key={a.id} className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[12px] px-2.5 py-1.5" style={farbStil(a.farbe)}>
                        <span className="truncate text-[14px] font-semibold">{a.name}</span>
                        {zeitText(a) && eintraege.length === 1 ? (
                          <span className="tnum shrink-0 text-[12px] font-medium opacity-90">{zeitText(a)}</span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-faint">Nichts eingetragen</span>
                )}
                {fei || p || ts.length ? (
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-ink-muted">
                    {fei ? <span className="shrink-0 font-medium text-[#e5484d]">{fei}</span> : null}
                    {p ? (
                      <span className={cn("shrink-0 rounded-[7px] px-1.5 py-px text-[11px] font-semibold ring-[1.5px] ring-inset", PARTNER_FARBE[p])}>
                        {partnerText(p)}
                      </span>
                    ) : null}
                    {ts.length ? (
                      <span className="truncate">
                        {ts.map((t) => `${!t.ganztaegig && t.von ? `${t.von} ` : ""}${t.titel || "Termin"}`).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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

/** Stunden, z. B. 8 oder 7,5 */
const h = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

/**
 * Tagesblatt wie bei iOS: oben die Einträge des Tages (je eine Zeile mit
 * Entfernen), dann zwei große Knöpfe „Schicht“ und „Termin“, darunter die
 * Termine.
 */
function TagBlatt({
  iso,
  eintrag,
  arten: alleArten,
  artNach,
  feiertag,
  termine,
  partner,
  onHinzufuegen,
  onEntfernen,
  onErsetzen,
  onTermin,
  onClose,
}: {
  iso: string;
  eintrag: TagEintrag;
  arten: Schichtart[];
  artNach: Map<string, Schichtart>;
  feiertag?: string;
  termine: Termin[];
  partner: PartnerSchicht | null;
  onHinzufuegen: (id: string) => void;
  onEntfernen: (ebene: Ebene) => void;
  onErsetzen: (ebene: Ebene, id: string) => void;
  onTermin: (t: Termin | null) => void;
  onClose: () => void;
}) {
  const zeilen: { ebene: Ebene; art: Schichtart }[] = [];
  const s = eintrag.schicht ? artNach.get(eintrag.schicht) : undefined;
  const z = eintrag.zusatz ? artNach.get(eintrag.zusatz) : undefined;
  if (s) zeilen.push({ ebene: 1, art: s });
  if (z) zeilen.push({ ebene: 2, art: z });
  const voll = zeilen.length === 2;
  const [auswahl, setAuswahl] = useState(zeilen.length === 0);
  /** Welche Zeile gerade getauscht wird (bei zwei Einträgen). */
  const [tauschen, setTauschen] = useState<Ebene | null>(null);

  const d = fromISO(iso);
  return (
    <Blatt
      titel={`${WT_LANG[wochentag(iso)]}, ${d.getDate()}. ${monthName(d.getMonth())}`}
      unter={
        feiertag || partner ? (
          <>
            {feiertag ? <span className="font-medium text-[#e5484d]">{feiertag}</span> : null}
            {feiertag && partner ? " · " : null}
            {partner ? <>Partner: {partnerText(partner, true)}</> : null}
          </>
        ) : undefined
      }
      onClose={onClose}
    >
      {zeilen.length ? (
        <ul className="space-y-2">
          {zeilen.map(({ ebene, art }) => (
            <li key={ebene} className="flex items-center gap-3 rounded-[16px] px-3.5 py-2.5" style={farbStil(art.farbe)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{art.name}</span>
                <span className="tnum block text-[12.5px] opacity-90">
                  {zeitText(art) || (art.art === "arbeit" ? "ohne Uhrzeit" : art.art === "frei" ? "frei" : "ganztägig")}
                  {art.stunden ? ` · ${h(art.stunden)} h` : ""}
                </span>
              </span>
              {voll ? (
                <button
                  type="button"
                  onClick={() => {
                    setTauschen(ebene);
                    setAuswahl(true);
                  }}
                  className="shrink-0 rounded-full bg-black/15 px-3 py-1.5 text-[13px] font-semibold"
                >
                  Tauschen
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onEntfernen(ebene)}
                aria-label={`${art.name} entfernen`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/15"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setTauschen(voll ? 2 : null);
            setAuswahl(!auswahl);
          }}
          aria-expanded={auswahl}
          className={cn(
            "flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[15px] font-semibold transition-colors",
            auswahl ? "bg-brand-500 text-white" : "bg-ink/[0.07] text-ink",
          )}
        >
          <Layers className="h-5 w-5" /> {zeilen.length ? "Schicht dazu" : "Schicht"}
        </button>
        <button
          type="button"
          onClick={() => onTermin(null)}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-ink/[0.07] text-[15px] font-semibold text-ink"
        >
          <CalendarPlus className="h-5 w-5" /> Termin
        </button>
      </div>

      {auswahl ? (
        <div className="mt-3">
          <p className="mb-2 text-[12.5px] text-ink-muted">
            {tauschen
              ? `Ersetzt „${(tauschen === 1 ? s : z)?.name ?? ""}“.`
              : zeilen.length
                ? "Kommt zur Schicht dazu – die Schicht bleibt stehen."
                : "Was steht an diesem Tag an?"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {alleArten.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  if (tauschen) onErsetzen(tauschen, a.id);
                  else onHinzufuegen(a.id);
                  setAuswahl(false);
                  setTauschen(null);
                }}
                className="h-11 truncate rounded-[13px] px-2 text-[14px] font-semibold active:scale-[0.97]"
                style={farbStil(a.farbe)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
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
