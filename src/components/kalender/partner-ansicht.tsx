"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useWischZu } from "@/components/privat/blatt";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import {
  LINK_UNGUELTIG,
  fetchPartnerKalender,
  partnerTageSetzen,
  partnerTerminLoeschen,
  partnerTerminSpeichern,
  type Termin,
  type TerminEingabe,
  type FarbenCodes,
  type PartnerCode,
} from "@/lib/data/partner";
import { cn } from "@/lib/utils";
import {
  PartnerBlatt,
  TERMIN_FARBE_GAST,
  TERMIN_FARBE_INHABER,
  VOLL_FARBE,
  codeStil,
  partnerText,
  terminKarteStil,
} from "./partner";
import { TerminBlatt, termineAm } from "./termine";

const WOCHENTAG_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/**
 * Ansicht für den Partner – ohne Anmeldung, nur mit dem Einladungslink.
 *
 * Oben gefüllt: die Schicht der Person, die eingeladen hat (Früh, Spät,
 * Nacht, Arbeit oder Frei – Urlaub und Krankheit erscheinen als Frei).
 * Darunter als Umriss: die eigenen Arbeitstage, per Tipp auf den Tag.
 */

const WOCHENTAGE = ["M", "D", "M", "D", "F", "S", "S"];

function raster(jahr: number, monat: number) {
  const erster = new Date(jahr, monat, 1);
  const versatz = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const wochen = Math.ceil((versatz + tage) / 7);
  return { start: toISO(new Date(jahr, monat, 1 - versatz)), wochen };
}

interface Stand {
  schluessel: string;
  name: string;
  farben: FarbenCodes;
  tage: Map<string, [PartnerCode | null, PartnerCode | null]>;
  termine: Termin[];
}

export function PartnerAnsicht({ token }: { token: string }) {
  const heute = heuteInBerlin();
  const [monat, setMonat] = useState(() => {
    const d = fromISO(heute);
    return { jahr: d.getFullYear(), monat: d.getMonth() };
  });
  const { start, wochen } = raster(monat.jahr, monat.monat);
  const anzahl = wochen * 7;
  const schluessel = `${start}:${anzahl}`;

  const [stand, setStand] = useState<Stand | null>(null);
  const [name, setName] = useState("");
  /** Nur ansehen oder auch eintragen – legt die einladende Person fest. */
  const [darf, setDarf] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ungueltig, setUngueltig] = useState(false);
  /** Tag, dessen Übersicht offen ist. */
  const [tag, setTag] = useState<string | null>(null);
  /** Auswahl der eigenen Schicht für diesen Tag. */
  const [blatt, setBlatt] = useState<string | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null } | null>(null);
  const ladeNr = useRef(0);

  const laden = useCallback(async () => {
    const nr = ++ladeNr.current;
    try {
      const k = await fetchPartnerKalender(token, start, anzahl);
      if (nr !== ladeNr.current) return;
      setStand({ schluessel: `${start}:${anzahl}`, name: k.name, farben: k.farben, tage: k.tage, termine: k.termine });
      setName(k.name);
      setDarf(k.darfEintragen);
      setFehler(null);
    } catch (e) {
      if (nr !== ladeNr.current) return;
      const text = e instanceof Error ? e.message : "Der Kalender konnte nicht geladen werden.";
      if (text === LINK_UNGUELTIG) setUngueltig(true);
      setFehler(text);
    }
  }, [token, start, anzahl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
    // Was der Inhaber einträgt, soll ohne Neuladen erscheinen: beim
    // Zurückkehren und alle 20 Sekunden, solange die Seite sichtbar ist.
    const sichtbar = () => {
      if (document.visibilityState === "visible") void laden();
    };
    document.addEventListener("visibilitychange", sichtbar);
    const takt = window.setInterval(sichtbar, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", sichtbar);
      window.clearInterval(takt);
    };
  }, [laden]);

  // Seite fest wie eine App – kein Scrollen dahinter.
  useEffect(() => {
    const html = document.documentElement;
    const vorher = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = vorher.html;
      document.body.style.overflow = vorher.body;
    };
  }, []);

  function springe(schritt: number) {
    setMonat((m) => {
      const d = new Date(m.jahr, m.monat + schritt, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });
  }

  const wisch = useRef<{ x: number; y: number } | null>(null);
  const gewischt = useRef(false);

  const tage = useMemo(() => Array.from({ length: anzahl }, (_, i) => addDays(start, i)), [start, anzahl]);
  const sichtbar = stand?.schluessel === schluessel ? stand : null;

  async function setzen(code: PartnerCode | null, n: number) {
    if (!blatt) return;
    const von = blatt;
    setBlatt(null);
    try {
      await partnerTageSetzen(token, von, n, code);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das konnte nicht gespeichert werden.");
    }
    void laden();
  }

  async function terminSpeichern(t: TerminEingabe) {
    setTerminBlatt(null);
    try {
      await partnerTerminSpeichern(token, t);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht gespeichert werden.");
    }
    void laden();
  }

  async function terminLoeschen(id: string) {
    setTerminBlatt(null);
    try {
      await partnerTerminLoeschen(token, id);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Der Termin konnte nicht gelöscht werden.");
    }
    void laden();
  }

  const termine = sichtbar?.termine ?? [];

  if (ungueltig) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-6">
        <div className="max-w-sm space-y-2 text-center">
          <p className="text-[18px] font-semibold">Dieser Link gilt nicht mehr.</p>
          <p className="text-[14px] text-ink-muted">
            Die Person, die dich eingeladen hat, hat ihn beendet oder einen neuen erstellt. Frag
            sie nach dem aktuellen Link.
          </p>
        </div>
      </main>
    );
  }

  const istAktuell = (() => {
    const d = fromISO(heute);
    return d.getFullYear() === monat.jahr && d.getMonth() === monat.monat;
  })();

  return (
    <main className="privat privat-schrift fixed inset-0 flex flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {name ? `Schichtplan von ${name}` : "Schichtplan"}
            </p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight">{monthName(monat.monat)}</h1>
            <p className="tnum text-[13px] font-medium text-ink-muted">
              {monat.jahr}
              {darf ? (
                <span className="ml-2 text-[12px] text-ink-faint">
                  Oben: {name || "Plan"} · darunter: du
                </span>
              ) : null}
              {!istAktuell ? (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="font-semibold text-brand-600"
                    onClick={() => {
                      const d = fromISO(heute);
                      setMonat({ jahr: d.getFullYear(), monat: d.getMonth() });
                    }}
                  >
                    Heute
                  </button>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => springe(-1)}
              aria-label="Vorheriger Monat"
              className="glas flex h-10 w-10 items-center justify-center rounded-full text-ink-muted"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => springe(1)}
              aria-label="Nächster Monat"
              className="glas flex h-10 w-10 items-center justify-center rounded-full text-ink-muted"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {fehler ? <p className="mx-4 mb-2 rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}

        <div
          className="glas mx-3 mb-3 grid min-h-0 flex-1 touch-pan-y select-none grid-cols-7 overflow-hidden rounded-[22px]"
          style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
          aria-busy={!sichtbar}
          onPointerDown={(e) => {
            gewischt.current = false;
            wisch.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = wisch.current;
            wisch.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) {
              gewischt.current = true;
              springe(dx < 0 ? 1 : -1);
            }
          }}
          onPointerCancel={() => (wisch.current = null)}
        >
          {WOCHENTAGE.map((w, i) => (
            <span key={i} aria-hidden className="py-1.5 text-center text-[12px] font-semibold text-ink-faint">
              {w}
            </span>
          ))}
          {tage.map((iso, i) => {
            const d = fromISO(iso);
            const imMonat = d.getMonth() === monat.monat;
            const [eigen, partner] = sichtbar?.tage.get(iso) ?? [null, null];
            const ts = termineAm(termine, iso);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  if (gewischt.current) {
                    gewischt.current = false;
                    return;
                  }
                  setTag(iso);
                }}
                aria-label={`${d.getDate()}. ${monthName(d.getMonth())}: ${name || "Plan"} ${eigen ? partnerText(eigen, true) : "–"}${partner ? `, du: ${partnerText(partner, true)}` : ""}`}
                className={cn(
                  "glas-linie flex min-h-0 flex-col items-stretch gap-[3px] overflow-hidden border-t px-[2px] pb-1 pt-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                  i % 7 !== 0 && "border-l",
                  i % 7 >= 5 && "bg-surface-muted/70",
                  iso === heute && "bg-ink/[0.07]",
                )}
              >
                <span
                  className={cn(
                    "tnum mx-auto flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-[16px] leading-none",
                    iso === heute ? "bg-ink font-bold text-surface" : imMonat ? "font-medium" : "text-ink-faint",
                  )}
                >
                  {d.getDate()}
                </span>
                {/* Wie beim Inhaber: die eigenen Einträge gefüllt, die der anderen
                    Person als Umriss. So steht der eingetragene Urlaub groß da und
                    nicht die Schicht des Inhabers. */}
                {!sichtbar ? (
                  <span className="h-5 animate-pulse rounded-md bg-surface-sunken" />
                ) : null}
                {sichtbar && eigen ? (
                  <span
                    className={cn(
                      "shrink-0 truncate rounded-[8px] px-0.5 py-[3px] text-[12.5px] font-semibold leading-tight",
                      !imMonat && "opacity-45",
                    )}
                    style={codeStil(eigen, sichtbar.farben)}
                  >
                    {partnerText(eigen)}
                  </span>
                ) : null}
                {sichtbar && partner ? (
                  <span
                    className={cn(
                      "shrink-0 truncate rounded-md px-0.5 py-px text-[11px] font-semibold leading-tight",
                      VOLL_FARBE[partner],
                      !imMonat && "opacity-45",
                    )}
                  >
                    {partnerText(partner)}
                  </span>
                ) : null}
                {ts.slice(0, 3).map((t, j) => (
                  <span
                    key={t.id}
                    className={cn("shrink-0 truncate text-left text-[11px] leading-tight text-ink-muted", !imMonat && "opacity-45")}
                  >
                    <span
                      className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ backgroundColor: t.vonPartner ? TERMIN_FARBE_GAST : TERMIN_FARBE_INHABER }}
                    />
                    {t.titel || "Termin"}
                    {j === 2 && ts.length > 3 ? ` +${ts.length - 3}` : ""}
                  </span>
                ))}
              </button>
            );
          })}
        </div>

      </div>

      {tag ? (
        <TagBlatt
          iso={tag}
          name={name}
          darf={darf}
          eigen={sichtbar?.tage.get(tag)?.[0] ?? null}
          farben={sichtbar?.farben ?? {}}
          partner={sichtbar?.tage.get(tag)?.[1] ?? null}
          termine={termineAm(termine, tag)}
          onClose={() => setTag(null)}
          onSchicht={() => {
            setBlatt(tag);
            setTag(null);
          }}
          onTermin={(t) => {
            setTerminBlatt({ datum: tag, termin: t });
            setTag(null);
          }}
        />
      ) : null}

      {blatt && darf ? (
        <PartnerBlatt
          datum={blatt}
          aktuell={sichtbar?.tage.get(blatt)?.[1] ?? null}
          hinweis={`Das sehen nur du und ${name || "die Person, die dich eingeladen hat"}.`}
          onWahl={(code, n) => void setzen(code, n)}
          onClose={() => setBlatt(null)}
        />
      ) : null}

      {terminBlatt ? (
        <TerminBlatt
          datum={terminBlatt.datum}
          termin={terminBlatt.termin}
          nurLesen={!darf || (!!terminBlatt.termin && !terminBlatt.termin.vonPartner)}
          hinweis={
            terminBlatt.termin && !terminBlatt.termin.vonPartner
              ? `Termin von ${name || "deinem Partner"} – nur zum Ansehen.`
              : `Den Termin sehen du und ${name || "die Person, die dich eingeladen hat"}.`
          }
          onSpeichern={(t) => void terminSpeichern(t)}
          onLoeschen={(id) => void terminLoeschen(id)}
          onClose={() => setTerminBlatt(null)}
        />
      ) : null}
    </main>
  );
}

/** Übersicht eines Tages: beide Schichten, Termine, Eintragen. */
function TagBlatt({
  iso,
  name,
  darf,
  eigen,
  farben,
  partner,
  termine,
  onClose,
  onSchicht,
  onTermin,
}: {
  iso: string;
  name: string;
  /** Darf eintragen – sonst nur die Übersicht. */
  darf: boolean;
  eigen: PartnerCode | null;
  farben: FarbenCodes;
  partner: PartnerCode | null;
  termine: Termin[];
  onClose: () => void;
  onSchicht: () => void;
  onTermin: (t: Termin | null) => void;
}) {
  const d = fromISO(iso);
  const wisch = useRef<HTMLDivElement>(null);
  useWischZu(wisch, true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Schließen" className="absolute inset-0 cursor-default bg-black/40" onClick={onClose} />
      <div ref={wisch} role="dialog" aria-label={formatDE(iso)} className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:rounded-3xl">
        <div className="bg-surface-sunken px-5 py-4">
          <p className="text-[17px] font-semibold">
            {WOCHENTAG_LANG[d.getDay()]}, {formatDE(iso)}
          </p>
        </div>
        <div className="space-y-2 px-5 py-4">
          {darf ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] text-ink-muted">Du</span>
            {partner ? (
              <span className={cn("rounded-lg px-3 py-1 text-[14px] font-semibold", VOLL_FARBE[partner])}>
                {partnerText(partner, true)}
              </span>
            ) : (
              <span className="text-[14px] text-ink-faint">nichts eingetragen</span>
            )}
          </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] text-ink-muted">{name || "Plan"}</span>
            <span className="rounded-lg px-3 py-1 text-[14px] font-semibold" style={codeStil(eigen ?? "X", farben)}>
              {partnerText(eigen ?? "X", true)}
            </span>
          </div>
          {termine.length ? (
            <ul className="space-y-1.5 border-t border-line pt-2">
              {termine.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onTermin(t)}
                    style={terminKarteStil(t.vonPartner ? TERMIN_FARBE_GAST : TERMIN_FARBE_INHABER)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-[14px] px-3.5 py-2.5 text-left text-[15px]"
                  >
                    <span className="min-w-0 truncate">
                      {t.titel || "Ohne Titel"}
                      {!t.vonPartner ? (
                        <span className="ml-1.5 rounded bg-surface-sunken px-1 py-px text-[11px] font-semibold text-ink-muted">
                          {name || "Partner"}
                        </span>
                      ) : null}
                    </span>
                    <span className="tnum shrink-0 text-[13px] text-ink-muted">
                      {t.ganztaegig ? "Ganztägig" : `${t.von} – ${t.bis}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {darf ? (
        <div className="grid grid-cols-2 border-t border-line">
          <button
            type="button"
            onClick={() => onTermin(null)}
            className="flex items-center justify-center gap-2 py-4 text-[15px] font-semibold text-ink-muted"
          >
            <Plus className="h-5 w-5 text-ink" strokeWidth={2} />
            Termin
          </button>
          <button
            type="button"
            onClick={onSchicht}
            className="flex items-center justify-center gap-2 border-l border-line py-4 text-[15px] font-semibold text-ink-muted"
          >
            <Plus className="h-5 w-5 text-ink" strokeWidth={2} />
            Schicht / Urlaub
          </button>
        </div>
        ) : null}
        <div className="border-t border-line pb-[env(safe-area-inset-bottom)] text-center">
          <Link href="/datenschutz" className="inline-block py-3 text-[12px] text-ink-faint underline">
            Datenschutz
          </Link>
        </div>
      </div>
    </div>
  );
}
