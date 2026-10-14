"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import {
  LINK_UNGUELTIG,
  fetchPartnerKalender,
  partnerTageSetzen,
  type PartnerCode,
} from "@/lib/data/partner";
import { cn } from "@/lib/utils";
import { PARTNER_FARBE, PartnerBlatt, VOLL_FARBE, partnerText } from "./partner";

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
  tage: Map<string, [PartnerCode | null, PartnerCode | null]>;
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
  const [fehler, setFehler] = useState<string | null>(null);
  const [ungueltig, setUngueltig] = useState(false);
  const [blatt, setBlatt] = useState<string | null>(null);
  const ladeNr = useRef(0);

  const laden = useCallback(async () => {
    const nr = ++ladeNr.current;
    try {
      const k = await fetchPartnerKalender(token, start, anzahl);
      if (nr !== ladeNr.current) return;
      setStand({ schluessel: `${start}:${anzahl}`, name: k.name, tage: k.tage });
      setName(k.name);
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
    <main className="fixed inset-0 flex flex-col bg-surface-muted pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {name ? `Schichtplan von ${name}` : "Schichtplan"}
            </p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight">{monthName(monat.monat)}</h1>
            <p className="tnum text-[13px] font-medium text-ink-muted">
              {monat.jahr}
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-inset ring-line"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => springe(1)}
              aria-label="Nächster Monat"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-inset ring-line"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {fehler ? <p className="mx-4 mb-2 rounded-xl bg-crit-bg px-3 py-2 text-[13px] text-crit-fg">{fehler}</p> : null}

        <div
          className="grid min-h-0 flex-1 touch-pan-y select-none grid-cols-7 overflow-hidden bg-surface sm:rounded-2xl sm:border sm:border-line"
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
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  if (gewischt.current) {
                    gewischt.current = false;
                    return;
                  }
                  setBlatt(iso);
                }}
                aria-label={`${d.getDate()}. ${monthName(d.getMonth())}: ${name || "Plan"} ${eigen ? partnerText(eigen, true) : "–"}${partner ? `, du: ${partnerText(partner, true)}` : ""}`}
                className={cn(
                  "flex min-h-0 flex-col items-stretch gap-[3px] overflow-hidden border-t border-line px-[2px] pb-1 pt-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
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
                {sichtbar ? (
                  <span
                    className={cn(
                      "shrink-0 truncate rounded-md px-0.5 py-[3px] text-[12.5px] font-medium leading-tight",
                      VOLL_FARBE[eigen ?? "X"],
                      !imMonat && "opacity-45",
                    )}
                  >
                    {partnerText(eigen ?? "X")}
                  </span>
                ) : (
                  <span className="h-5 animate-pulse rounded-md bg-surface-sunken" />
                )}
                {partner ? (
                  <span
                    className={cn(
                      "shrink-0 truncate rounded-md px-0.5 py-px text-[11px] font-semibold leading-tight ring-[1.5px] ring-inset",
                      PARTNER_FARBE[partner],
                      !imMonat && "opacity-45",
                    )}
                  >
                    {partnerText(partner)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="px-4 py-2 text-center text-[12px] text-ink-muted">
          Gefüllt: {name || "Plan"} · Umriss: du – Tag antippen, um deine Arbeit einzutragen.{" "}
          <Link href="/datenschutz" className="underline">
            Datenschutz
          </Link>
        </p>
      </div>

      {blatt ? (
        <PartnerBlatt
          datum={blatt}
          aktuell={sichtbar?.tage.get(blatt)?.[1] ?? null}
          hinweis={`Das sehen nur du und ${name || "die Person, die dich eingeladen hat"}.`}
          onWahl={(code, n) => void setzen(code, n)}
          onClose={() => setBlatt(null)}
        />
      ) : null}
    </main>
  );
}
