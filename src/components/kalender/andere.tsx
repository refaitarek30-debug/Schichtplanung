"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import {
  PERSON_ARTEN,
  fetchPersonen,
  fetchPersonenTage,
  type PartnerCode,
  type Person,
  type Termin,
} from "@/lib/data/partner";
import { fetchGruppen, fetchGruppenAndere, type Gruppe, type GruppenAnderer } from "@/lib/data/gruppen";
import { fromISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PERSON_FARBEN, PersonAvatar, kuerzel, personFarbe } from "./teilen";
import { partnerText } from "./partner";

/**
 * Andere im eigenen Kalender: Personen, die über ihren Link selbst
 * eintragen (Partner, Familie, Freunde, Kollegen), und die Mitglieder der
 * eigenen Gruppen (mit eigenem Kalender). Oben rechts lässt sich
 * wie in einem Baum antippen, wessen Schichten und Termine man gerade
 * sieht. Die Auswahl gilt nur auf diesem Gerät und nur für die eigene
 * Ansicht – niemand sonst merkt etwas.
 */

/** [Schichten, Termine] */
type Schalter = [boolean, boolean];
type Sicht = Record<string, Schalter>;

export interface AndererEintrag {
  key: string;
  name: string;
  kurz: string;
  farbe: string;
  code: PartnerCode;
}

interface Knoten {
  key: string;
  name: string;
  farbe: string;
}

interface Zweig {
  key: string;
  titel: string;
  knoten: Knoten[];
  /** Gruppen teilen keine Termine – dort gibt es nur „Schichten“. */
  nurSchichten?: boolean;
}

const ICH = "ich";
const AN: Schalter = [true, true];

function speicherKey(benutzer: string) {
  return `schichtplan.sicht.${benutzer}`;
}

function leseSicht(benutzer: string): Sicht {
  try {
    const roh = window.localStorage.getItem(speicherKey(benutzer));
    const s = roh ? (JSON.parse(roh) as Sicht) : {};
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}

export function useAndere({ benutzer, von, bis, aktiv = true }: { benutzer: string; von: string; bis: string; aktiv?: boolean }) {
  const [personen, setPersonen] = useState<Person[] | null>(null);
  const [tage, setTage] = useState<Record<string, Record<string, PartnerCode>>>({});
  const [sicht, setSichtState] = useState<Sicht>({});
  const geladen = useRef(new Set<string>());
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [gruppenAndere, setGruppenAndere] = useState<GruppenAnderer[]>([]);
  const tageAnzahl = Math.round((fromISO(bis).getTime() - fromISO(von).getTime()) / 864e5) + 1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSichtState(leseSicht(benutzer));
  }, [benutzer]);

  const ladePersonen = useCallback(async () => {
    try {
      setPersonen(await fetchPersonen());
    } catch {
      setPersonen((a) => a ?? []);
    }
    try {
      setGruppen(await fetchGruppen());
    } catch {
      // Gruppen sind Beiwerk
    }
  }, []);

  const ladeGruppenTage = useCallback(async () => {
    if (tageAnzahl < 1 || tageAnzahl > 62) return;
    try {
      setGruppenAndere(await fetchGruppenAndere(von, tageAnzahl));
    } catch {
      // Gruppen sind Beiwerk
    }
  }, [von, tageAnzahl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aktiv && gruppen.length) void ladeGruppenTage();
  }, [aktiv, gruppen.length, ladeGruppenTage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladePersonen();
  }, [ladePersonen]);

  const ladeTage = useCallback(
    async (erneut = false) => {
      const k = `${von}:${bis}`;
      if (!erneut && geladen.current.has(k)) return;
      try {
        const t = await fetchPersonenTage(von, bis);
        geladen.current.add(k);
        setTage((alt) => {
          const neu: Record<string, Record<string, PartnerCode>> = { ...alt };
          // Zeitraum ersetzen, damit Entferntes auch verschwindet.
          for (const id of Object.keys(neu)) {
            const kopie = { ...neu[id] };
            for (const tag of Object.keys(kopie)) if (tag >= von && tag <= bis) delete kopie[tag];
            neu[id] = kopie;
          }
          for (const [id, werte] of Object.entries(t)) neu[id] = { ...(neu[id] ?? {}), ...werte };
          return neu;
        });
      } catch {
        // Andere sind Beiwerk – der eigene Kalender bleibt nutzbar.
      }
    },
    [von, bis],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aktiv) void ladeTage();
  }, [aktiv, ladeTage]);

  /** Nur wer eintragen darf oder schon Tage hat, erscheint im Kalender. */
  const sichtbarePersonen = useMemo(
    () => (personen ?? []).filter((p) => p.darfEintragen || tage[p.id]),
    [personen, tage],
  );

  const personenZweige: Zweig[] = useMemo(
    () =>
      PERSON_ARTEN.map((a) => ({
        key: `art:${a.art}`,
        titel: a.mehrzahl,
        knoten: sichtbarePersonen
          .filter((p) => p.art === a.art)
          .map((p) => ({ key: p.id, name: p.name, farbe: personFarbe(personen ?? [], p.id) })),
      })).filter((z) => z.knoten.length > 0),
    [sichtbarePersonen, personen],
  );

  /** Mitglieder der Gruppen – Farben nach den Personen weitergezählt. */
  const gruppenFarbe = useMemo(() => {
    const versatz = (personen ?? []).length;
    const m = new Map<string, string>();
    gruppenAndere.forEach((g, i) => m.set(g.id, PERSON_FARBEN[(versatz + i) % PERSON_FARBEN.length]));
    return m;
  }, [gruppenAndere, personen]);

  const gruppenTage = useMemo(() => new Map(gruppenAndere.map((g) => [`u:${g.id}`, g.tage])), [gruppenAndere]);

  const zweige: Zweig[] = useMemo(
    () => [
      ...personenZweige,
      ...gruppen
        .map((g) => ({
          key: `gruppe:${g.id}`,
          titel: g.name,
          nurSchichten: true,
          knoten: gruppenAndere
            .filter((a) => a.gruppen.includes(g.id))
            .map((a) => ({ key: `u:${a.id}`, name: a.name || "Ohne Namen", farbe: gruppenFarbe.get(a.id) ?? PERSON_FARBEN[0] })),
        }))
        .filter((z) => z.knoten.length > 0),
    ],
    [personenZweige, gruppen, gruppenAndere, gruppenFarbe],
  );

  const schalter = useCallback((key: string): Schalter => sicht[key] ?? AN, [sicht]);

  const speichern = useCallback(
    (neu: Sicht) => {
      setSichtState(neu);
      try {
        window.localStorage.setItem(speicherKey(benutzer), JSON.stringify(neu));
      } catch {
        // ohne Speicher gilt die Auswahl nur bis zum Neuladen
      }
    },
    [benutzer],
  );

  const setze = useCallback(
    (keys: string[], i: 0 | 1, wert: boolean) => {
      const neu = { ...sicht };
      for (const k of keys) {
        const s: Schalter = [...(neu[k] ?? AN)] as Schalter;
        s[i] = wert;
        neu[k] = s;
      }
      speichern(neu);
    },
    [sicht, speichern],
  );

  const alleKeys = useMemo(() => [ICH, ...new Set(zweige.flatMap((z) => z.knoten.map((k) => k.key)))], [zweige]);

  const amTag = useCallback(
    (iso: string): AndererEintrag[] => {
      const liste: AndererEintrag[] = [];
      const schon = new Set<string>();
      for (const z of zweige) {
        for (const k of z.knoten) {
          if (schon.has(k.key) || !schalter(k.key)[0]) continue;
          schon.add(k.key);
          const code = k.key.startsWith("u:") ? gruppenTage.get(k.key)?.[iso] : tage[k.key]?.[iso];
          if (code) liste.push({ key: k.key, name: k.name, kurz: kuerzel(k.name), farbe: k.farbe, code });
        }
      }
      return liste;
    },
    [zweige, schalter, tage, gruppenTage],
  );

  /** Eigener Termin oder Termin einer Person – je nach Auswahl. */
  const terminSichtbar = useCallback(
    (t: Termin) => {
      if (!t.vonPartner) return schalter(ICH)[1];
      return t.personId ? schalter(t.personId)[1] : true;
    },
    [schalter],
  );

  const terminVon = useCallback(
    (t: Termin): { name: string; farbe: string } | null => {
      if (!t.vonPartner || !t.personId) return null;
      const p = personen?.find((x) => x.id === t.personId);
      return p ? { name: p.name, farbe: personFarbe(personen ?? [], p.id) } : null;
    },
    [personen],
  );

  return {
    personen,
    zweige,
    /** Eingeladene Personen (ohne Gruppen) – für die Auswahl beim Eintragen. */
    knoten: personenZweige.flatMap((z) => z.knoten),
    /** Eintrag einer Person an einem Tag – unabhängig von der Auswahl. */
    rohTag: (key: string, iso: string): PartnerCode | null => tage[key]?.[iso] ?? null,
    schalter,
    setze,
    alleAn: () => speichern({}),
    nurIch: () => speichern(Object.fromEntries(alleKeys.map((k) => [k, k === ICH ? AN : ([false, false] as Schalter)]))),
    amTag,
    terminSichtbar,
    terminVon,
    /** Nach Änderungen (Einladen, Eintragen) neu laden. */
    neuLaden: async () => {
      geladen.current.clear();
      await Promise.all([ladePersonen(), ladeTage(true), ladeGruppenTage()]);
    },
    /** Wer gerade eingeblendet ist (jede Person einmal). */
    eingeblendet: [...new Map(zweige.flatMap((z) => z.knoten).map((k) => [k.key, k])).values()].filter(
      (k) => schalter(k.key)[0] || schalter(k.key)[1],
    ),
  };
}

export type Andere = ReturnType<typeof useAndere>;

/**
 * Unter dem eigenen Eintrag: bis zwei Personen als Umriss „L·S“, ab drei als
 * kleine Kreise mit dem Kürzel der Schicht. Frei ist blasser.
 */
export function AndereTags({ eintraege, max = 2, className }: { eintraege: AndererEintrag[]; max?: number; className?: string }) {
  if (!eintraege.length) return null;
  if (eintraege.length > max) {
    return (
      <span className={cn("flex w-full shrink-0 flex-wrap justify-center gap-[2px]", className)}>
        {eintraege.map((e) => (
          <span
            key={e.key}
            title={`${e.name}: ${partnerText(e.code, true)}`}
            className={cn(
              "flex h-[13px] w-[13px] items-center justify-center rounded-full text-[8px] font-bold leading-none text-white",
              e.code === "X" && "opacity-40",
            )}
            style={{ backgroundColor: e.farbe }}
          >
            {e.code === "X" ? "" : e.code === "T" ? "A" : e.code}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={cn("flex w-full shrink-0 gap-[2px]", className)}>
      {eintraege.map((e) => (
        <span
          key={e.key}
          title={`${e.name}: ${partnerText(e.code, true)}`}
          className={cn(
            "min-w-0 flex-1 overflow-hidden whitespace-nowrap rounded-[5px] text-center text-[9px] font-bold leading-[14px]",
            e.code === "X" && "opacity-45",
          )}
          style={{ boxShadow: `inset 0 0 0 1.5px ${e.farbe}`, color: e.farbe }}
        >
          {e.kurz.slice(0, 1)}·{e.code === "X" ? "–" : e.code === "T" ? "A" : e.code}
        </span>
      ))}
    </span>
  );
}

/** Zeilen für das Tagesblatt: wer an diesem Tag arbeitet oder frei hat. */
export function AnDiesemTag({
  eintraege,
  onPerson,
  className,
}: {
  eintraege: AndererEintrag[];
  /** Antippen: Tag dieser Person selbst eintragen. */
  onPerson?: (key: string) => void;
  className?: string;
}) {
  if (!eintraege.length) return null;
  return (
    <div className={cn("space-y-1.5 rounded-[16px] bg-ink/[0.04] px-3.5 py-3", className)}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-faint">An diesem Tag</p>
      {eintraege.map((e) => {
        const innen = (
          <>
            <PersonAvatar name={e.name} farbe={e.farbe} klein />
            <span className="min-w-0 flex-1 truncate text-[14.5px]">{e.name}</span>
            <span
              className="shrink-0 rounded-[8px] px-2 py-0.5 text-[12.5px] font-semibold"
              style={{ boxShadow: `inset 0 0 0 1.5px ${e.farbe}`, color: e.farbe }}
            >
              {partnerText(e.code, true)}
            </span>
          </>
        );
        return onPerson ? (
          <button key={e.key} type="button" onClick={() => onPerson(e.key)} className="flex w-full items-center gap-2.5 text-left">
            {innen}
          </button>
        ) : (
          <div key={e.key} className="flex items-center gap-2.5">
            {innen}
          </div>
        );
      })}
    </div>
  );
}

function Pille({
  an,
  teil = false,
  onClick,
  children,
}: {
  an: boolean;
  teil?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={an}
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full px-2.5 text-[12px] font-semibold transition-colors",
        an ? "bg-brand-500 text-white" : teil ? "bg-brand-500/10 text-brand-700 ring-1 ring-inset ring-brand-500/50" : "bg-ink/[0.06] text-ink-faint",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Knopf oben rechts: die eingeblendeten Personen als kleine Kreise. Antippen
 * öffnet den Baum. Ohne Personen: Einladen.
 */
export function WenSeheIch({ andere, onVerwalten, glas = false }: { andere: Andere; onVerwalten: () => void; glas?: boolean }) {
  const [offen, setOffen] = useState(false);
  const [zu, setZu] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen]);
  const alle = [...new Map(andere.zweige.flatMap((z) => z.knoten).map((k) => [k.key, k])).values()];

  if (andere.personen === null) return null;

  const knopfKlasse = cn(
    "flex h-10 shrink-0 items-center rounded-full [@media(max-width:360px)]:h-9",
    glas ? "glas" : "bg-surface shadow-sm ring-1 ring-line",
  );

  if (!alle.length) {
    return (
      <button type="button" onClick={onVerwalten} aria-label="Partner, Familie oder Freunde einladen" className={cn(knopfKlasse, "w-10 justify-center")}>
        <UserPlus className="h-[18px] w-[18px]" />
      </button>
    );
  }

  const sichtbar = andere.eingeblendet;
  const ich = andere.schalter(ICH);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label={`Wen sehe ich? ${sichtbar.length} von ${alle.length} eingeblendet`}
        aria-expanded={offen}
        className={cn(knopfKlasse, "gap-0 pl-1 pr-2.5")}
      >
        {sichtbar.length ? (
          sichtbar.slice(0, 2).map((k, i) => (
            <span
              key={k.key}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-bold text-white ring-2 ring-surface",
                i > 0 && "-ml-1.5 [@media(max-width:360px)]:hidden",
              )}
              style={{ backgroundColor: k.farbe }}
            >
              {kuerzel(k.name)}
            </span>
          ))
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/[0.08]">
            <Users className="h-4 w-4 text-ink-muted" />
          </span>
        )}
        <span className="tnum pl-1.5 text-[13px] font-bold text-brand-600">{sichtbar.length}</span>
      </button>

      {offen
        ? createPortal(
            <div className="privat-schrift fixed inset-0 z-50">
              <button type="button" aria-label="Schließen" className="absolute inset-0 cursor-default bg-black/20" onClick={() => setOffen(false)} />
              <div
                role="dialog"
                aria-label="Wen sehe ich?"
                className="glas-dicht absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.2rem)] max-h-[75dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[24px] p-3"
              >
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                  <span className="text-[17px] font-bold">Wen sehe ich?</span>
                  <span className="flex gap-1.5">
                    <button type="button" onClick={andere.alleAn} className="h-8 rounded-full bg-ink/[0.06] px-3 text-[12.5px] font-semibold">
                      Alle
                    </button>
                    <button type="button" onClick={andere.nurIch} className="h-8 rounded-full bg-ink/[0.06] px-3 text-[12.5px] font-semibold">
                      Nur ich
                    </button>
                  </span>
                </div>

                <div className="flex items-center gap-2.5 rounded-[16px] px-2 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-surface">Ich</span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold">Meine Termine</span>
                  <Pille an={ich[1]} onClick={() => andere.setze([ICH], 1, !ich[1])}>
                    Termine
                  </Pille>
                </div>

                {andere.zweige.map((z) => {
                  const keys = z.knoten.map((k) => k.key);
                  const s = keys.map((k) => andere.schalter(k));
                  const alleS = s.every((x) => x[0]);
                  const keineS = s.every((x) => !x[0]);
                  const alleT = s.every((x) => x[1]);
                  const keineT = s.every((x) => !x[1]);
                  const einzeln = z.knoten.length === 1;
                  const aufgeklappt = !zu[z.key];
                  return (
                    <div key={z.key} className="mt-1 rounded-[16px] bg-ink/[0.03]">
                      <div className="flex items-center gap-2 px-2 py-2">
                        {einzeln ? (
                          <PersonAvatar name={z.knoten[0].name} farbe={z.knoten[0].farbe} klein />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setZu((a) => ({ ...a, [z.key]: aufgeklappt }))}
                            aria-label={aufgeklappt ? `${z.titel} zuklappen` : `${z.titel} aufklappen`}
                            aria-expanded={aufgeklappt}
                            className="flex h-7 w-7 shrink-0 items-center justify-center"
                          >
                            <ChevronRight className={cn("h-4 w-4 text-ink-muted transition-transform", aufgeklappt && "rotate-90")} />
                          </button>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{einzeln ? z.knoten[0].name : z.titel}</span>
                          <span className="block truncate text-[11.5px] text-ink-muted">
                            {einzeln ? z.titel : `${z.knoten.length} Personen`}
                            {z.nurSchichten ? " · Gruppe" : ""}
                          </span>
                        </span>
                        <Pille an={alleS} teil={!alleS && !keineS} onClick={() => andere.setze(keys, 0, !alleS)}>
                          Schichten
                        </Pille>
                        {z.nurSchichten ? null : (
                          <Pille an={alleT} teil={!alleT && !keineT} onClick={() => andere.setze(keys, 1, !alleT)}>
                            Termine
                          </Pille>
                        )}
                      </div>
                      {!einzeln && aufgeklappt ? (
                        <div className="mb-1.5 ml-[1.3rem] border-l-2 border-ink/10">
                          {z.knoten.map((k) => {
                            const ks = andere.schalter(k.key);
                            return (
                              <div key={k.key} className="flex items-center gap-2 py-1.5 pl-0 pr-2">
                                <span className="h-0.5 w-3 shrink-0 bg-ink/10" />
                                <PersonAvatar name={k.name} farbe={k.farbe} klein />
                                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{k.name}</span>
                                <Pille an={ks[0]} onClick={() => andere.setze([k.key], 0, !ks[0])}>
                                  Schichten
                                </Pille>
                                {z.nurSchichten ? null : (
                                  <Pille an={ks[1]} onClick={() => andere.setze([k.key], 1, !ks[1])}>
                                    Termine
                                  </Pille>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <p className="px-2 pt-2 text-[12px] leading-snug text-ink-muted">
                  Antippen blendet ein oder aus. Gilt nur für deine Ansicht – niemand merkt etwas.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOffen(false);
                    onVerwalten();
                  }}
                  className="mt-2 flex w-full items-center justify-between rounded-[14px] bg-ink/[0.05] px-3 py-2.5 text-[14px] font-semibold text-brand-600"
                >
                  Personen einladen oder verwalten
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
