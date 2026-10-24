"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { fetchPersonen, fetchPersonenTage, type PartnerCode } from "@/lib/data/partner";
import { fetchVerbindungen, fetchVerbundeneTage } from "@/lib/data/verbindungen";
import { addDays, formatDEShort, fromISO, heuteInBerlin, isSameMonth, monthGrid, monthName, toISO } from "@/lib/dates";
import { ladeTage, type TagEintrag } from "@/lib/privat/daten";
import {
  andereFreiheit,
  ganzeWochenenden,
  gemeinsameTage,
  hatPlan,
  meineFreiheit,
  vergleiche,
  type FreiTag,
} from "@/lib/privat/gemeinsam";
import { cn } from "@/lib/utils";
import { usePrivat } from "./kontext";
import { PrivatKarte, PrivatKopf, RundKnopf } from "./rahmen";

/**
 * Gemeinsam frei: Wann habt ihr beide nicht gearbeitet? Monat mit zwei Balken
 * je Tag, Jahr als zwölf kleine Monate. Gerechnet wird nur auf diesem Gerät.
 */

interface Gegenueber {
  key: string;
  name: string;
}

const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const ICH_FARBE = "#2f5bea";
const ER_FARBE = "#d6409f";

export function PrivatGemeinsam() {
  const { konto, artNach } = usePrivat();
  const heute = heuteInBerlin();
  const [ansicht, setAnsicht] = useState<"monat" | "jahr">("monat");
  const [anker, setAnker] = useState(heute);
  const [gegenueber, setGegenueber] = useState<Gegenueber[] | null>(null);
  const [wahl, setWahl] = useState<string | null>(null);
  const [meine, setMeine] = useState<Record<string, TagEintrag> | null>(null);
  const [andere, setAndere] = useState<Record<string, Record<string, PartnerCode>> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const jahr = fromISO(anker).getFullYear();
  const monat = fromISO(anker).getMonth();

  // Wer kommt in Frage: Personen mit Link und verbundene Konten.
  useEffect(() => {
    let aus = false;
    void (async () => {
      try {
        const [personen, verbunden] = await Promise.all([fetchPersonen(), fetchVerbindungen().catch(() => [])]);
        if (aus) return;
        const liste: Gegenueber[] = [
          ...verbunden.map((v) => ({ key: `v:${v.partner}`, name: v.name || "Verbunden" })),
          ...personen.filter((p) => p.darfEintragen).map((p) => ({ key: p.id, name: p.name })),
        ];
        setGegenueber(liste);
        setWahl((alt) => alt ?? liste[0]?.key ?? null);
      } catch (e) {
        if (!aus) {
          setGegenueber([]);
          setFehler(e instanceof Error ? e.message : "Die Personen konnten nicht geladen werden.");
        }
      }
    })();
    return () => {
      aus = true;
    };
  }, []);

  // Alle Tage des Jahres: meine und die der anderen.
  useEffect(() => {
    if (!gegenueber?.length) return;
    let aus = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeine(null);
    setAndere(null);
    void (async () => {
      try {
        const von = `${jahr}-01-01`;
        const bis = `${jahr}-12-31`;
        const [mein, personenTage] = await Promise.all([ladeTage(von, bis), fetchPersonenTage(von, bis)]);
        const alle: Record<string, Record<string, PartnerCode>> = { ...personenTage };
        if (gegenueber.some((g) => g.key.startsWith("v:"))) {
          // Verbundene Konten liefern höchstens 62 Tage je Abruf.
          for (let t = von; t <= bis; t = addDays(t, 62)) {
            const n = Math.min(62, Math.round((fromISO(bis).getTime() - fromISO(t).getTime()) / 864e5) + 1);
            const teil = await fetchVerbundeneTage(t, n);
            for (const [id, d] of Object.entries(teil)) alle[`v:${id}`] = { ...(alle[`v:${id}`] ?? {}), ...d.tage };
          }
        }
        if (aus) return;
        setMeine(mein);
        setAndere(alle);
        setFehler(null);
      } catch (e) {
        if (!aus) setFehler(e instanceof Error ? e.message : "Die Tage konnten nicht geladen werden.");
      }
    })();
    return () => {
      aus = true;
    };
  }, [gegenueber, jahr]);

  const person = gegenueber?.find((g) => g.key === wahl) ?? null;
  const karte = useMemo(() => {
    if (!meine || !andere || !person) return null;
    const ich = meineFreiheit(meine, artNach);
    const er = andereFreiheit(andere[person.key]);
    return { karte: vergleiche(`${jahr}-01-01`, `${jahr}-12-31`, ich, er), ich, er };
  }, [meine, andere, person, artNach, jahr]);

  const monatVon = toISO(new Date(jahr, monat, 1));
  const monatBis = toISO(new Date(jahr, monat + 1, 0));
  const von = ansicht === "jahr" ? `${jahr}-01-01` : monatVon;
  const bis = ansicht === "jahr" ? `${jahr}-12-31` : monatBis;
  const gemeinsam = karte ? gemeinsameTage(karte.karte, von, bis) : [];
  const wochenenden = karte ? ganzeWochenenden(karte.karte, von, bis) : [];
  const vorname = konto.name.split(/\s+/)[0] ?? konto.name;

  function springe(s: number) {
    setAnker(ansicht === "jahr" ? toISO(new Date(jahr + s, 0, 1)) : toISO(new Date(jahr, monat + s, 1)));
  }

  return (
    <div className="space-y-4">
      <PrivatKopf
        titel="Gemeinsam frei"
        unter={ansicht === "jahr" ? String(jahr) : `${monthName(monat)} ${jahr}`}
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

      {gegenueber && !gegenueber.length ? (
        <PrivatKarte>
          <div className="space-y-3 px-4 py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 text-brand-600">
              <Users className="h-6 w-6" />
            </span>
            <h2 className="text-[18px] font-bold">Wann habt ihr beide frei?</h2>
            <p className="text-[14px] leading-snug text-ink-muted">
              Lade deinen Partner oder deine Partnerin ein oder verbinde dich mit dem Konto. Sobald auch dort Schichten eingetragen sind,
              siehst du hier alle Tage und Wochenenden, an denen ihr beide frei habt.
            </p>
            <Link href="/privat/teilen" className="inline-block rounded-xl bg-brand-500 px-5 py-3 text-[15px] font-semibold text-white">
              Zu „Teilen“
            </Link>
          </div>
        </PrivatKarte>
      ) : null}

      {fehler ? <Alert tone="error">{fehler}</Alert> : null}

      {gegenueber?.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Zeitraum" className="glas inline-flex rounded-[14px] p-1">
              {(["monat", "jahr"] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  role="tab"
                  aria-selected={ansicht === z}
                  onClick={() => setAnsicht(z)}
                  className={cn("rounded-lg px-4 py-1.5 text-[13.5px] font-semibold", ansicht === z ? "bg-surface text-ink shadow-card" : "text-ink-muted")}
                >
                  {z === "monat" ? "Monat" : "Jahr"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ICH_FARBE }} />
                {vorname}
              </span>
              {gegenueber.length === 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: ER_FARBE }} />
                  {gegenueber[0]!.name}
                </span>
              ) : (
                <select
                  aria-label="Mit wem?"
                  value={wahl ?? ""}
                  onChange={(e) => setWahl(e.target.value)}
                  className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold"
                >
                  {gegenueber.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="rounded-[22px] bg-ok-bg px-4 py-3.5 text-ok-fg" aria-live="polite">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="tnum text-[32px] font-bold leading-none tracking-[-0.02em]">
                {karte ? `${gemeinsam.length} ${gemeinsam.length === 1 ? "Tag" : "Tage"}` : "…"}
              </span>
              <span className="text-[14px] font-semibold">
                gemeinsam frei {ansicht === "jahr" ? `in ${jahr}` : `im ${monthName(monat)}`}
              </span>
            </div>
            <p className="mt-1 text-[13.5px] leading-snug opacity-90">
              {karte
                ? wochenenden.length
                  ? `Darunter ${wochenenden.length} ${wochenenden.length === 1 ? "ganzes Wochenende" : "ganze Wochenenden"}.`
                  : "Kein ganzes Wochenende dabei."
                : "Wird berechnet …"}
            </p>
          </div>

          {karte && person && !hatPlan(karte.er, von, bis) ? (
            <Alert tone="warning">
              Für {person.name} ist {ansicht === "jahr" ? `in ${jahr}` : `im ${monthName(monat)}`} noch nichts eingetragen. Tage ohne Eintrag zählen
              erst, wenn für den Monat ein Plan da ist.
            </Alert>
          ) : null}

          {ansicht === "monat" ? (
            <MonatsKarte jahr={jahr} monat={monat} karte={karte?.karte ?? null} heute={heute} />
          ) : (
            <JahresKarte jahr={jahr} karte={karte?.karte ?? null} onMonat={(m) => { setAnker(toISO(new Date(jahr, m, 1))); setAnsicht("monat"); }} />
          )}

          {karte ? (
            <PrivatKarte titel={ansicht === "jahr" ? `Ganze Wochenenden ${jahr}` : "Gemeinsame freie Tage"}>
              <div className="flex flex-wrap gap-2 px-4 py-3.5">
                {(ansicht === "jahr"
                  ? wochenenden.map((w) => ({ key: w.sa, text: `${fromISO(w.sa).getDate()}.–${fromISO(w.so).getDate()}. ${fromISO(w.so).toLocaleDateString("de-DE", { month: "short" })}` }))
                  : gemeinsam.map((t) => ({ key: t, text: `${WT[(fromISO(t).getDay() + 6) % 7]}, ${formatDEShort(t)}` }))
                ).map((c) => (
                  <span key={c.key} className="rounded-full bg-surface px-3.5 py-2 text-[14px] font-semibold shadow-card">
                    {c.text}
                  </span>
                ))}
                {(ansicht === "jahr" ? wochenenden.length : gemeinsam.length) === 0 ? (
                  <span className="text-[14px] text-ink-muted">Nichts gefunden.</span>
                ) : null}
              </div>
            </PrivatKarte>
          ) : null}

          <p className="text-[12px] leading-snug text-ink-faint">
            Frei heißt: kein Arbeitstag (Frei und Urlaub). Tage ohne Eintrag zählen als frei, sobald für den Monat etwas eingetragen ist.
            Gerechnet wird nur auf deinem Gerät.
          </p>
        </>
      ) : null}
    </div>
  );
}

function MonatsKarte({ jahr, monat, karte, heute }: { jahr: number; monat: number; karte: ReadonlyMap<string, FreiTag> | null; heute: string }) {
  const tage = monthGrid(jahr, monat);
  return (
    <PrivatKarte>
      <div className="px-3 py-3">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-bold tracking-wide text-ink-muted">
          {WT.map((w) => (
            <span key={w}>{w.toUpperCase()}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {tage.map((iso) => {
            if (!isSameMonth(iso, jahr, monat)) return <span key={iso} />;
            const t = karte?.get(iso);
            const beide = !!t?.beide;
            return (
              <div
                key={iso}
                data-tag={iso}
                data-beide={beide ? "ja" : "nein"}
                aria-label={`${fromISO(iso).getDate()}. ${monthName(monat)}${beide ? ": ihr beide habt frei" : ""}`}
                className={cn(
                  "relative flex h-[58px] flex-col items-center rounded-[12px] px-1 pt-1.5",
                  beide ? "bg-ok-bg ring-1 ring-ok-dot/50" : "bg-ink/[0.04]",
                  iso === heute && "outline outline-2 outline-brand-500",
                )}
              >
                <span className="text-[12px] font-semibold leading-none">{fromISO(iso).getDate()}</span>
                <span className="mt-1.5 flex w-full flex-col gap-[3px]" aria-hidden>
                  <span className="h-[5px] rounded-full" style={{ background: t?.ich ? ICH_FARBE : "rgb(var(--c-ink) / 0.12)" }} />
                  <span className="h-[5px] rounded-full" style={{ background: t?.er ? ER_FARBE : "rgb(var(--c-ink) / 0.12)" }} />
                </span>
                {beide ? <Check className="absolute bottom-0.5 right-1 h-3 w-3 text-ok-fg" strokeWidth={3} aria-hidden /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </PrivatKarte>
  );
}

function JahresKarte({ jahr, karte, onMonat }: { jahr: number; karte: ReadonlyMap<string, FreiTag> | null; onMonat: (m: number) => void }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 12 }, (_, m) => {
          const tage = monthGrid(jahr, m);
          const zahl = karte ? tage.filter((t) => isSameMonth(t, jahr, m) && karte.get(t)?.beide).length : 0;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onMonat(m)}
              aria-label={`${monthName(m)} ${jahr}: ${zahl} gemeinsame freie Tage`}
              className="glas rounded-[16px] p-2.5 text-left"
            >
              <span className="mb-1.5 flex items-center justify-between">
                <span className="text-[12.5px] font-bold">{monthName(m).slice(0, 3)}</span>
                <span className={cn("min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold", zahl ? "bg-ok-bg text-ok-fg" : "bg-ink/[0.06] text-ink-muted")}>{zahl}</span>
              </span>
              <span className="grid grid-cols-7 gap-[2px]">
                {tage.slice(0, 35 + (tage.slice(35).some((t) => isSameMonth(t, jahr, m)) ? 7 : 0)).map((t) => {
                  const im = isSameMonth(t, jahr, m);
                  const f = karte?.get(t);
                  return (
                    <span
                      key={t}
                      className="aspect-square rounded-[2px]"
                      style={{ background: !im ? "transparent" : f?.beide ? "#1c9a5b" : f?.ich ? "#c4d2f7" : "rgb(var(--c-ink) / 0.1)" }}
                    />
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] font-semibold text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-[#1c9a5b]" />Beide frei</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-[#c4d2f7]" />Nur du frei</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-ink/10" />Sonst</span>
      </div>
    </div>
  );
}
