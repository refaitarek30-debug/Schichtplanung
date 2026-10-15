"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { ChevronLeft, ChevronRight, Eraser, Paintbrush, Repeat, X } from "lucide-react";
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
import { farbStil, ladeFeiertage, ladeTage, setzeTage, type Schichtart } from "@/lib/privat/daten";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { Blatt } from "./blatt";
import { RotationBlatt } from "./rotation";

/**
 * Schichtkalender für Privatkonten: Woche, Monat, Jahr. Eintragen per
 * Antippen (Tagesblatt), per Pinsel (mehrere Tage nacheinander) oder als
 * Schichtfolge (Rotation).
 */

type Ansicht = "woche" | "monat" | "jahr";

const ANSICHT_SCHLUESSEL = "schichtplan.privat-ansicht";
const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WT_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

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

  const [tage, setTage] = useState<Record<string, string>>({});
  const [feiertage, setFeiertage] = useState<Record<string, string>>({});
  const geladen = useRef(new Set<number>());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const [termine, setTermine] = useState<Termin[]>([]);
  const [partner, setPartner] = useState<Record<string, PartnerSchicht>>({});

  const [tagBlatt, setTagBlatt] = useState<string | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null } | null>(null);
  const [rotation, setRotation] = useState(false);
  /** Pinsel: Schichtart-Id, "leer" zum Löschen, null = aus */
  const [pinsel, setPinsel] = useState<string | null>(null);
  const [pinselAn, setPinselAn] = useState(false);

  // ---- sichtbarer Zeitraum ----------------------------------------------
  const ankerD = fromISO(anker);
  const bereich = useMemo(() => {
    if (ansicht === "jahr") {
      const j = ankerD.getFullYear();
      return { von: `${j}-01-01`, bis: `${j}-12-31` };
    }
    if (ansicht === "woche") {
      const von = montagVon(anker);
      return { von, bis: addDays(von, 6) };
    }
    const { start, wochen } = monatRaster(ankerD.getFullYear(), ankerD.getMonth());
    return { von: start, bis: addDays(start, wochen * 7 - 1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ansicht, anker]);

  const ladeJahre = useCallback(
    async (jahre: number[], erneut = false) => {
      const fehlend = jahre.filter((j) => erneut || !geladen.current.has(j));
      if (!fehlend.length) return;
      setLaedt(true);
      try {
        const ergebnisse = await Promise.all(
          fehlend.map(async (j) => {
            const [t, f] = await Promise.all([
              ladeTage(`${j}-01-01`, `${j}-12-31`),
              ladeFeiertage(j),
            ]);
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
    },
    [],
  );

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
  async function setzen(liste: string[], artId: string | null) {
    const vorher = { ...tage };
    setTage((alt) => {
      const neu = { ...alt };
      for (const t of liste) {
        if (artId) neu[t] = artId;
        else delete neu[t];
      }
      return neu;
    });
    try {
      await setzeTage(liste, artId);
    } catch (e) {
      setTage(vorher);
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
    }
  }

  function tagAntippen(iso: string) {
    if (pinselAn && pinsel) {
      const ziel = pinsel === "leer" ? null : pinsel;
      if ((tage[iso] ?? null) === ziel) return;
      void setzen([iso], ziel);
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

  const zeigeFeiertage = konto.feiertageZeigen;
  const feiertagVon = (iso: string) => (zeigeFeiertage ? feiertage[iso] : undefined);

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
        "fixed inset-x-0 top-0 z-10 mx-auto flex max-w-3xl flex-col bg-surface-muted px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6",
        pinselAn
          ? "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+9.4rem)]"
          : "bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.4rem)]",
      )}
    >
      <header className="flex items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{titel}</h1>
          <p className="tnum truncate text-[13px] font-medium text-ink-muted">
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
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden gap-1.5 sm:flex">
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

      <div role="tablist" aria-label="Ansicht" className="mb-2 grid grid-cols-3 rounded-[12px] bg-ink/[0.06] p-[3px]">
        {(["woche", "monat", "jahr"] as const).map((a) => (
          <button
            key={a}
            role="tab"
            type="button"
            aria-selected={ansicht === a}
            onClick={() => waehleAnsicht(a)}
            className={cn(
              "rounded-[9px] py-1 text-[13px] font-semibold transition-colors",
              ansicht === a ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-muted",
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
        <button
          type="button"
          onClick={() => setRotation(true)}
          className="mb-2 flex w-full items-center gap-2.5 rounded-[14px] bg-brand-500/10 px-3 py-2.5 text-left"
        >
          <Repeat className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="text-[13px] leading-snug">
            <b className="font-semibold">Los geht&apos;s:</b> Schichtfolge einmal eintragen – der Kalender füllt sich
            von selbst.
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
        <div className="fixed inset-x-3 bottom-[calc(max(0.6rem,env(safe-area-inset-bottom))+4.4rem)] z-20 mx-auto max-w-3xl rounded-[22px] border border-line/60 bg-surface/75 px-2.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {schichtarten.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPinsel(a.id)}
                  aria-pressed={pinsel === a.id}
                  className={cn(
                    "h-9 shrink-0 rounded-[11px] px-3 text-[13px] font-semibold",
                    pinsel === a.id && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
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
                  "flex h-9 shrink-0 items-center gap-1 rounded-[11px] bg-ink/[0.06] px-3 text-[13px] font-semibold text-ink-muted",
                  pinsel === "leer" && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                )}
              >
                <Eraser className="h-4 w-4" /> Leeren
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPinselAn(false)}
              aria-label="Pinsel beenden"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="px-1 pt-1 text-[11.5px] text-ink-faint">Tippe die Tage an, die du eintragen willst.</p>
        </div>
      ) : null}

      {tagBlatt ? (
        <TagBlatt
          iso={tagBlatt}
          artId={tage[tagBlatt] ?? null}
          arten={schichtarten ?? []}
          feiertag={feiertagVon(tagBlatt)}
          termine={termineAm(termine, tagBlatt)}
          partner={partner[tagBlatt] ?? null}
          onWahl={(id) => void setzen([tagBlatt], id)}
          onSchnellTermin={async (t) => {
            await speichereTermin(t);
            await ladeTermine();
          }}
          onTermin={(t) => {
            setTerminBlatt({ datum: tagBlatt, termin: t });
            setTagBlatt(null);
          }}
          onClose={() => setTagBlatt(null)}
        />
      ) : null}

      {terminBlatt ? (
        <TerminBlatt
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
        "flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_2px_10px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors",
        aktiv ? "border-brand-500 bg-brand-500 text-white" : "border-line/60 bg-surface/80 text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

interface AnsichtProps {
  heute: string;
  tage: Record<string, string>;
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
      className="grid h-full grid-cols-7 overflow-hidden rounded-[18px] border border-line/70 bg-surface"
      style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
    >
      {WT.map((w, i) => (
        <span key={w} className={cn("py-1 text-center text-[11px] font-semibold", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>
          {w}
        </span>
      ))}
      {liste.map((iso, i) => {
        const d = fromISO(iso);
        const imMonat = d.getMonth() === monat;
        const art = tage[iso] ? artNach.get(tage[iso]!) : undefined;
        const fei = feiertagVon(iso);
        const ts = termineAm(termine, iso);
        const p = partner[iso];
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onTag(iso)}
            aria-label={`${WT_LANG[i % 7]}, ${formatDE(iso)}${art ? `: ${art.name}` : ""}${fei ? `, ${fei}` : ""}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
            className={cn(
              // Feste Zellgröße: Inhalt wird abgeschnitten, nie gestreckt.
              "flex min-h-0 flex-col items-stretch gap-[2px] overflow-hidden border-t border-line/70 px-[2px] pb-0.5 pt-[3px] text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
              i % 7 !== 0 && "border-l",
              i % 7 >= 5 && "bg-ink/[0.025]",
              !imMonat && "opacity-40",
            )}
          >
            <span className="relative mx-auto shrink-0">
              <span
                className={cn(
                  "tnum flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[14px] leading-none",
                  iso === heute ? "bg-ink font-bold text-surface" : fei ? "font-semibold text-crit-fg" : "font-medium",
                )}
              >
                {d.getDate()}
              </span>
              {/* Kleine Handys: Punkte statt Terminzeilen. */}
              {ts.length ? (
                <span aria-hidden className="absolute -right-2.5 top-0.5 hidden gap-px [@media(max-height:750px)]:flex">
                  {ts.slice(0, 3).map((t) => (
                    <span key={t.id} className={cn("h-[5px] w-[5px] rounded-full", t.vonPartner ? "bg-brand-500" : "bg-ink-muted")} />
                  ))}
                </span>
              ) : null}
            </span>
            {art ? (
              <span className="shrink-0 truncate rounded-[6px] px-0.5 py-[2px] text-[11.5px] font-semibold leading-tight" style={farbStil(art.farbe)}>
                {art.name}
              </span>
            ) : null}
            {p ? (
              <span className={cn("shrink-0 truncate rounded-[6px] px-0.5 py-px text-[10.5px] font-semibold leading-tight ring-[1.5px] ring-inset", PARTNER_FARBE[p])}>
                {partnerText(p)}
              </span>
            ) : null}
            {fei ? <span className="shrink-0 truncate text-[9.5px] leading-tight text-crit-fg">{fei}</span> : null}
            {(() => {
              // Höchstens so viele Zeilen, wie sicher ganz in die Zelle passen –
              // nie eine halb abgeschnittene.
              const zeilen = Math.max(0, 2 - (p ? 1 : 0));
              if (!ts.length || !zeilen) return null;
              const zeigen = ts.length > zeilen ? ts.slice(0, zeilen - 1) : ts;
              const rest = ts.length - zeigen.length;
              return (
                <>
                  {zeigen.map((t) => (
                    <span key={t.id} className="shrink-0 truncate text-left text-[10px] leading-[1.25] text-ink-muted [@media(max-height:750px)]:hidden">
                      <span className={cn("mr-0.5 inline-block h-[5px] w-[5px] rounded-full align-middle", t.vonPartner ? "bg-brand-500" : "bg-ink-faint")} />
                      {t.titel || "Termin"}
                    </span>
                  ))}
                  {rest > 0 ? (
                    <span className="shrink-0 text-left text-[10px] font-semibold leading-[1.25] text-ink-faint [@media(max-height:750px)]:hidden">
                      +{rest} {zeigen.length ? "weitere" : rest === 1 ? "Termin" : "Termine"}
                    </span>
                  ) : null}
                </>
              );
            })()}
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
    <ul className="grid h-full grid-rows-7 divide-y divide-line/70 overflow-hidden rounded-[18px] border border-line/70 bg-surface">
      {Array.from({ length: 7 }, (_, i) => addDays(von, i)).map((iso, i) => {
        const art = tage[iso] ? artNach.get(tage[iso]!) : undefined;
        const fei = feiertagVon(iso);
        const ts = termineAm(termine, iso);
        const p = partner[iso];
        return (
          <li key={iso} className="min-h-0">
            <button
              type="button"
              onClick={() => onTag(iso)}
              className={cn("flex h-full w-full items-center gap-3 overflow-hidden px-3 text-left", iso === heute && "bg-brand-500/[0.07]")}
            >
              <span className="flex w-10 shrink-0 flex-col items-center">
                <span className={cn("text-[11px] font-semibold", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>{WT[i]}</span>
                <span
                  className={cn(
                    "tnum flex h-7 min-w-7 items-center justify-center rounded-full text-[17px] font-semibold",
                    iso === heute ? "bg-ink text-surface" : fei ? "text-crit-fg" : "",
                  )}
                >
                  {fromISO(iso).getDate()}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                {art ? (
                  <span className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5" style={farbStil(art.farbe)}>
                    <span className="truncate text-[14px] font-semibold">{art.name}</span>
                    <span className="tnum shrink-0 text-[12px] font-medium opacity-90">{zeitText(art)}</span>
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-faint">Nichts eingetragen</span>
                )}
                {fei || p || ts.length ? (
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-ink-muted">
                    {fei ? <span className="shrink-0 font-medium text-crit-fg">{fei}</span> : null}
                    {p ? (
                      <span className={cn("shrink-0 rounded-[6px] px-1.5 py-px text-[11px] font-semibold ring-[1.5px] ring-inset", PARTNER_FARBE[p])}>
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
              className="flex flex-col justify-start rounded-[16px] border border-line/70 bg-surface p-2 text-left"
              aria-label={`${monthName(m)} ${jahr} öffnen`}
            >
              <span className="mb-1 block text-[13px] font-semibold">{monthName(m)}</span>
              <span className="grid grid-cols-7 gap-[2px]">
                {Array.from({ length: wochen * 7 }, (_, i) => {
                  const iso = addDays(start, i);
                  if (fromISO(iso).getMonth() !== m) return <span key={iso} className="aspect-square" />;
                  const art = tage[iso] ? artNach.get(tage[iso]!) : undefined;
                  const fei = feiertagVon(iso);
                  return (
                    <span
                      key={iso}
                      title={`${formatDE(iso)}${art ? `: ${art.name}` : ""}${fei ? ` · ${fei}` : ""}`}
                      className={cn(
                        "tnum flex aspect-square items-center justify-center rounded-[4px] text-[8.5px] font-semibold leading-none",
                        !art && "bg-ink/[0.05] text-ink-faint",
                        iso === heute && "ring-2 ring-ink",
                        fei && !art && "text-crit-fg",
                      )}
                      style={art ? farbStil(art.farbe) : undefined}
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

function plusStunde(hhmm: string): string {
  const [st, mi] = hhmm.split(":").map(Number);
  return `${String(((st ?? 0) + 1) % 24).padStart(2, "0")}:${String(mi ?? 0).padStart(2, "0")}`;
}

/**
 * Tagesblatt: oben die Schicht (kompakt – eingetragen ist sie nur eine
 * Zeile), darunter das große Feld für einen neuen Termin und die Termine.
 */
function TagBlatt({
  iso,
  artId,
  arten,
  feiertag,
  termine,
  partner,
  onWahl,
  onSchnellTermin,
  onTermin,
  onClose,
}: {
  iso: string;
  artId: string | null;
  arten: Schichtart[];
  feiertag?: string;
  termine: Termin[];
  partner: PartnerSchicht | null;
  onWahl: (id: string | null) => void;
  onSchnellTermin: (t: TerminEingabe) => Promise<void>;
  onTermin: (t: Termin | null) => void;
  onClose: () => void;
}) {
  const art = artId ? arten.find((a) => a.id === artId) : undefined;
  const [aendern, setAendern] = useState(!art);
  const [titel, setTitel] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function hinzufuegen(e: React.FormEvent) {
    e.preventDefault();
    if (!titel.trim()) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const mitZeit = /^\d{2}:\d{2}$/.test(von);
      await onSchnellTermin({
        id: null,
        datum: iso,
        titel: titel.trim().slice(0, 80),
        ganztaegig: !mitZeit,
        von: mitZeit ? von : "",
        bis: mitZeit ? (/^\d{2}:\d{2}$/.test(bis) ? bis : plusStunde(von)) : "",
        wiederholung: "nie",
        notiz: "",
        ort: "",
      });
      setTitel("");
      setVon("");
      setBis("");
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gespeichert werden.");
    } finally {
      setLaeuft(false);
    }
  }

  const d = fromISO(iso);
  return (
    <Blatt
      titel={`${WT_LANG[wochentag(iso)]}, ${d.getDate()}. ${monthName(d.getMonth())}`}
      unter={
        feiertag || partner ? (
          <>
            {feiertag ? <span className="font-medium text-crit-fg">{feiertag}</span> : null}
            {feiertag && partner ? " · " : null}
            {partner ? <>Partner: {partnerText(partner, true)}</> : null}
          </>
        ) : undefined
      }
      onClose={onClose}
    >
      {/* Schicht */}
      {art && !aendern ? (
        <div className="flex items-center gap-3 rounded-[14px] px-3 py-2.5" style={farbStil(art.farbe)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold">{art.name}</span>
            <span className="tnum block text-[12.5px] opacity-90">
              {zeitText(art) || "ohne Uhrzeit"}
              {art.stunden ? ` · ${h(art.stunden)} h` : ""}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setAendern(true)}
            className="shrink-0 rounded-full bg-black/15 px-3 py-1.5 text-[13px] font-semibold"
          >
            Ändern
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Schicht</p>
          <div className="flex flex-wrap gap-1.5">
            {arten.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onWahl(a.id === artId ? null : a.id);
                  setAendern(false);
                }}
                aria-pressed={a.id === artId}
                className={cn(
                  "h-9 rounded-[11px] px-3 text-[13.5px] font-semibold",
                  a.id === artId && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                )}
                style={farbStil(a.farbe)}
              >
                {a.name}
              </button>
            ))}
            {artId ? (
              <button
                type="button"
                onClick={() => {
                  onWahl(null);
                  setAendern(true);
                }}
                className="flex h-9 items-center gap-1 rounded-[11px] bg-ink/[0.06] px-3 text-[13.5px] font-semibold text-ink-muted"
              >
                <Eraser className="h-4 w-4" /> Leeren
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Termin: großes Feld */}
      <form onSubmit={hinzufuegen} className="mt-5">
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Termin</p>
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface-muted focus-within:border-brand-500">
          <input
            id="tag-termin"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            maxLength={80}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Neuer Termin, z. B. Zahnarzt"
            className="block h-14 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-ink-faint"
          />
          <div className="flex items-center gap-2 border-t border-line/70 px-3 py-2">
            <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
              von
              <input
                type="time"
                value={von}
                onChange={(e) => setVon(e.target.value)}
                className="rounded-lg bg-surface px-2 py-1 text-[14px] text-ink"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[13px] text-ink-muted">
              bis
              <input
                type="time"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                className="rounded-lg bg-surface px-2 py-1 text-[14px] text-ink"
              />
            </label>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-ink-faint">Ohne Uhrzeit ist der Termin ganztägig.</p>
        {fehler ? (
          <div className="mt-2">
            <Alert tone="error">{fehler}</Alert>
          </div>
        ) : null}
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={laeuft || !titel.trim()}
            className="h-11 flex-1 rounded-[12px] bg-brand-500 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {laeuft ? "Speichert …" : "Hinzufügen"}
          </button>
          <button
            type="button"
            onClick={() => onTermin(null)}
            className="h-11 rounded-[12px] bg-ink/[0.06] px-4 text-[14px] font-semibold text-ink-muted"
          >
            Mehr Optionen
          </button>
        </div>
      </form>

      {termine.length ? (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[14px] border border-line">
          {termine.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTermin(t)}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-surface-muted"
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
      ) : null}
    </Blatt>
  );
}
