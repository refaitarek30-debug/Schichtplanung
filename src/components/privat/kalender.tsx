"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Paintbrush, Plus, Repeat, X } from "lucide-react";
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
import { PrivatKopf, RundKnopf } from "./rahmen";
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

  return (
    <div className={cn(pinselAn && "pb-28")}>
      <PrivatKopf
        titel={titel}
        unter={
          <span className="tnum">
            {unter}
            {!heuteSichtbar ? (
              <>
                {unter ? " · " : ""}
                <button type="button" onClick={() => setAnker(heute)} className="font-semibold text-brand-600">
                  Heute
                </button>
              </>
            ) : null}
          </span>
        }
        rechts={
          <>
            <RundKnopf label="Vorher" onClick={() => springe(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </RundKnopf>
            <RundKnopf label="Weiter" onClick={() => springe(1)}>
              <ChevronRight className="h-5 w-5" />
            </RundKnopf>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Ansicht" className="inline-flex rounded-xl bg-surface-sunken p-1">
          {(["woche", "monat", "jahr"] as const).map((a) => (
            <button
              key={a}
              role="tab"
              type="button"
              aria-selected={ansicht === a}
              onClick={() => waehleAnsicht(a)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold",
                ansicht === a ? "bg-surface text-ink shadow-card" : "text-ink-muted",
              )}
            >
              {a === "woche" ? "Woche" : a === "monat" ? "Monat" : "Jahr"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <RundKnopf label="Schichtfolge eintragen" onClick={() => setRotation(true)}>
            <Repeat className="h-[18px] w-[18px]" />
          </RundKnopf>
          <RundKnopf
            label="Mit dem Pinsel eintragen"
            aktiv={pinselAn}
            onClick={() => {
              setPinselAn(!pinselAn);
              if (!pinsel && schichtarten?.length) setPinsel(schichtarten[0]!.id);
            }}
          >
            <Paintbrush className="h-[18px] w-[18px]" />
          </RundKnopf>
          <RundKnopf label="Termin hinzufügen" onClick={() => setTerminBlatt({ datum: heuteSichtbar ? heute : bereich.von, termin: null })}>
            <Plus className="h-5 w-5" />
          </RundKnopf>
        </div>
      </div>

      {fehler || artenFehler ? (
        <div className="mb-3">
          <Alert tone="error">{fehler ?? artenFehler}</Alert>
        </div>
      ) : null}

      {schichtarten && !laedt && Object.keys(tage).length === 0 && ansicht !== "jahr" ? (
        <button
          type="button"
          onClick={() => setRotation(true)}
          className="mb-3 flex w-full items-center gap-3 rounded-card border border-dashed border-brand-500/50 bg-brand-50 px-4 py-3 text-left"
        >
          <Repeat className="h-5 w-5 shrink-0 text-brand-600" />
          <span className="text-[14px]">
            <b className="font-semibold">Los geht&apos;s:</b> Trag deine Schichtfolge einmal ein – der Kalender füllt
            sich dann von selbst. Einzelne Tage änderst du per Antippen.
          </span>
        </button>
      ) : null}

      <div aria-busy={laedt || !schichtarten}>
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
            onTag={tagAntippen}
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
            onTag={tagAntippen}
          />
        ) : (
          <JahresAnsicht
            jahr={ankerD.getFullYear()}
            heute={heute}
            tage={tage}
            artNach={artNach}
            feiertagVon={feiertagVon}
            onMonat={(m) => {
              setAnker(toISO(new Date(ankerD.getFullYear(), m, 1)));
              waehleAnsicht("monat");
            }}
          />
        )}
      </div>

      {schichtarten?.length ? <Legende arten={schichtarten} /> : null}

      {pinselAn && schichtarten ? (
        <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
              {schichtarten.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setPinsel(a.id)}
                  aria-pressed={pinsel === a.id}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold",
                    pinsel === a.id ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "",
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
                  "flex shrink-0 items-center gap-1 rounded-lg bg-surface-sunken px-3 py-2 text-[13px] font-semibold text-ink-muted",
                  pinsel === "leer" ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "",
                )}
              >
                <Eraser className="h-4 w-4" /> Leeren
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPinselAn(false)}
              aria-label="Pinsel beenden"
              className="shrink-0 rounded-full p-2 text-ink-muted hover:bg-surface-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mx-auto max-w-3xl px-1 pt-1 text-[12px] text-ink-faint">Tippe auf die Tage, die du eintragen willst.</p>
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
          onWahl={(id) => {
            void setzen([tagBlatt], id);
            setTagBlatt(null);
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
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line">
        {WT.map((w, i) => (
          <span key={w} className={cn("py-1.5 text-center text-[12px] font-semibold", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
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
                "flex min-h-[78px] flex-col items-stretch gap-[3px] border-line px-[3px] pb-1 pt-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:min-h-[92px]",
                i % 7 !== 0 && "border-l",
                i >= 7 && "border-t",
                i % 7 >= 5 && "bg-surface-muted/60",
                !imMonat && "opacity-40",
              )}
            >
              <span className="mx-auto flex items-center gap-0.5">
                <span
                  className={cn(
                    "tnum flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[15px] leading-none",
                    iso === heute ? "bg-ink font-bold text-surface" : fei ? "font-semibold text-crit-fg" : "font-medium",
                  )}
                >
                  {d.getDate()}
                </span>
              </span>
              {art ? (
                <span className="truncate rounded-md px-0.5 py-[3px] text-[12px] font-semibold leading-tight" style={farbStil(art.farbe)}>
                  {art.name}
                </span>
              ) : null}
              {p ? (
                <span className={cn("truncate rounded-md px-0.5 py-px text-[11px] font-semibold leading-tight ring-[1.5px] ring-inset", PARTNER_FARBE[p])}>
                  {partnerText(p)}
                </span>
              ) : null}
              {fei ? <span className="truncate text-[10.5px] leading-tight text-crit-fg">{fei}</span> : null}
              {ts.slice(0, 2).map((t) => (
                <span key={t.id} className="truncate text-left text-[11px] leading-tight text-ink-muted">
                  <span className={cn("mr-0.5 inline-block h-1.5 w-1.5 rounded-full align-middle", t.vonPartner ? "bg-brand-500" : "bg-ink-faint")} />
                  {t.titel || "Termin"}
                </span>
              ))}
              {ts.length > 2 ? <span className="text-[10.5px] text-ink-faint">+{ts.length - 2}</span> : null}
            </button>
          );
        })}
      </div>
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
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {Array.from({ length: 7 }, (_, i) => addDays(von, i)).map((iso, i) => {
        const art = tage[iso] ? artNach.get(tage[iso]!) : undefined;
        const fei = feiertagVon(iso);
        const ts = termineAm(termine, iso);
        const p = partner[iso];
        return (
          <li key={iso}>
            <button
              type="button"
              onClick={() => onTag(iso)}
              className={cn(
                "flex w-full items-stretch gap-3 px-3 py-3 text-left hover:bg-surface-muted",
                iso === heute && "bg-brand-50/60",
              )}
            >
              <span className="flex w-12 shrink-0 flex-col items-center">
                <span className={cn("text-[12px] font-semibold", i >= 5 ? "text-ink-faint" : "text-ink-muted")}>{WT[i]}</span>
                <span
                  className={cn(
                    "tnum mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-full text-[18px] font-semibold",
                    iso === heute ? "bg-ink text-surface" : fei ? "text-crit-fg" : "",
                  )}
                >
                  {fromISO(iso).getDate()}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                {art ? (
                  <span className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={farbStil(art.farbe)}>
                    <span className="truncate text-[15px] font-semibold">{art.name}</span>
                    <span className="tnum shrink-0 text-[13px] font-medium opacity-90">{zeitText(art)}</span>
                  </span>
                ) : (
                  <span className="text-[14px] text-ink-faint">Nichts eingetragen</span>
                )}
                {fei || p ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    {fei ? <span className="font-medium text-crit-fg">{fei}</span> : null}
                    {p ? (
                      <span className={cn("rounded-md px-1.5 py-px font-semibold ring-[1.5px] ring-inset", PARTNER_FARBE[p])}>
                        Partner: {partnerText(p, true)}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {ts.map((t) => (
                  <span key={t.id} className="truncate text-[13px] text-ink-muted">
                    <span className={cn("mr-1 inline-block h-2 w-2 rounded-full align-middle", t.vonPartner ? "bg-brand-500" : "bg-ink-faint")} />
                    {!t.ganztaegig && t.von ? <span className="tnum">{t.von} </span> : null}
                    {t.titel || "Termin"}
                  </span>
                ))}
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 12 }, (_, m) => {
        const { start, wochen } = monatRaster(jahr, m);
        return (
          <button
            key={m}
            type="button"
            onClick={() => onMonat(m)}
            className="flex flex-col justify-start rounded-card border border-line bg-surface p-2.5 text-left hover:border-brand-500/50"
            aria-label={`${monthName(m)} ${jahr} öffnen`}
          >
            <span className="mb-1.5 block text-[14px] font-semibold">{monthName(m)}</span>
            <span className="grid grid-cols-7 gap-[2px]">
              {Array.from({ length: wochen * 7 }, (_, i) => {
                const iso = addDays(start, i);
                const imMonat = fromISO(iso).getMonth() === m;
                if (!imMonat) return <span key={iso} className="aspect-square" />;
                const art = tage[iso] ? artNach.get(tage[iso]!) : undefined;
                const fei = feiertagVon(iso);
                return (
                  <span
                    key={iso}
                    title={`${formatDE(iso)}${art ? `: ${art.name}` : ""}${fei ? ` · ${fei}` : ""}`}
                    className={cn(
                      "tnum flex aspect-square items-center justify-center rounded-[4px] text-[9px] font-semibold leading-none",
                      !art && "bg-surface-sunken text-ink-faint",
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
  );
}

function Legende({ arten }: { arten: Schichtart[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-ink-muted">
      {arten.map((a) => (
        <li key={a.id} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: a.farbe }} />
          {a.name}
          {a.beginn && a.ende ? <span className="tnum text-ink-faint">{zeitText(a)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function TagBlatt({
  iso,
  artId,
  arten,
  feiertag,
  termine,
  partner,
  onWahl,
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
  onTermin: (t: Termin | null) => void;
  onClose: () => void;
}) {
  return (
    <Blatt
      titel={`${WT_LANG[wochentag(iso)]}, ${formatDE(iso)}`}
      unter={
        <>
          {feiertag ? <span className="font-medium text-crit-fg">{feiertag}</span> : null}
          {feiertag && partner ? " · " : null}
          {partner ? <>Partner: {partnerText(partner, true)}</> : null}
        </>
      }
      onClose={onClose}
    >
      <p className="mb-2 text-[13px] font-semibold text-ink-muted">Schicht</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {arten.map((a) => {
          const aktiv = a.id === artId;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onWahl(aktiv ? null : a.id)}
              aria-pressed={aktiv}
              className={cn(
                "flex flex-col items-start rounded-xl px-3 py-2.5 text-left",
                aktiv && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
              )}
              style={farbStil(a.farbe)}
            >
              <span className="text-[15px] font-semibold">{a.name}</span>
              <span className="tnum text-[12px] opacity-90">{zeitText(a) || (a.art === "arbeit" ? "ohne Uhrzeit" : "")}&nbsp;</span>
            </button>
          );
        })}
      </div>
      {artId ? (
        <button
          type="button"
          onClick={() => onWahl(null)}
          className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink"
        >
          <Eraser className="h-4 w-4" /> Eintrag entfernen
        </button>
      ) : null}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink-muted">Termine</p>
        <button
          type="button"
          onClick={() => onTermin(null)}
          className="flex items-center gap-1 text-[13px] font-semibold text-brand-600"
        >
          <Plus className="h-4 w-4" /> Termin
        </button>
      </div>
      {termine.length ? (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {termine.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTermin(t)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-muted"
              >
                <span className="truncate text-[14px]">
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
      ) : (
        <p className="mt-1 text-[13px] text-ink-faint">Keine Termine.</p>
      )}
    </Blatt>
  );
}
