"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { Check, ChevronRight, UserPlus, Users, X } from "lucide-react";
import {
  PERSON_ARTEN,
  fetchPersonen,
  fetchPersonenTage,
  type FarbenCodes,
  type PartnerCode,
  type Person,
  type Termin,
} from "@/lib/data/partner";
import { fetchGruppen, fetchGruppenAndere, type Gruppe, type GruppenAnderer } from "@/lib/data/gruppen";
import { fetchVerbindungen, fetchVerbundeneTage, fetchVerbundeneTermine, type Verbindung } from "@/lib/data/verbindungen";
import { fromISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PERSON_FARBEN, PersonAvatar, kuerzel, personFarbe } from "./teilen";
import { codeFarbe, partnerText } from "./partner";
import { textFarbe } from "@/lib/privat/daten";

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
  /** Farbe der Person (Kreis, Name). */
  farbe: string;
  code: PartnerCode;
  /** Farbe der Schicht – in den Farben der Person selbst. */
  schichtFarbe: string;
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

/**
 * Wie die Schichten der anderen im Kalender aussehen – nur für die eigene
 * Ansicht, gemerkt auf diesem Gerät: Größe, Beschriftung („L·F“ oder „Früh“)
 * und je Person eine feste Farbe statt der eigenen Farben dieser Person.
 */
export type AnzeigeGroesse = "klein" | "mittel" | "gross";
export type AnzeigeText = "kurz" | "voll";
export interface Anzeige {
  groesse: AnzeigeGroesse;
  text: AnzeigeText;
  /** Person → feste Schichtfarbe. Fehlt der Eintrag, gelten die Farben der Person selbst. */
  farben: Record<string, string>;
}
export const ANZEIGE_STANDARD: Anzeige = { groesse: "mittel", text: "kurz", farben: {} };

/** Farben zur Wahl für die Schicht einer Person. */
export const SCHICHT_FARBEN = ["#F5A524", "#22A06B", "#2F6FDE", "#9B59D0", "#E5484D", "#F76B15", "#0E9F9F", "#D6409F", "#8D6E4E", "#7C8CF8"];

function anzeigeKey(benutzer: string) {
  return `schichtplan.anzeige.${benutzer}`;
}

function leseAnzeige(benutzer: string): Anzeige {
  try {
    const roh = window.localStorage.getItem(anzeigeKey(benutzer));
    const a = roh ? (JSON.parse(roh) as Partial<Anzeige>) : {};
    const farben = a.farben && typeof a.farben === "object" ? a.farben : {};
    return {
      groesse: a.groesse === "klein" || a.groesse === "gross" ? a.groesse : "mittel",
      text: a.text === "voll" ? "voll" : "kurz",
      farben: Object.fromEntries(Object.entries(farben).filter(([, f]) => typeof f === "string" && /^#[0-9a-f]{6}$/i.test(f))),
    };
  } catch {
    return ANZEIGE_STANDARD;
  }
}

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
  const [anzeige, setAnzeigeState] = useState<Anzeige>(ANZEIGE_STANDARD);
  const geladen = useRef(new Set<string>());
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [gruppenAndere, setGruppenAndere] = useState<GruppenAnderer[]>([]);
  /** Verbundene Konten (Migration 0157) – Schlüssel im Baum: "v:<Konto>". */
  const [verbindungen, setVerbindungen] = useState<Verbindung[]>([]);
  const [vTage, setVTage] = useState<Record<string, { tage: Record<string, PartnerCode>; farben: FarbenCodes }>>({});
  const [fremdeTermine, setFremdeTermine] = useState<Termin[]>([]);
  const tageAnzahl = Math.round((fromISO(bis).getTime() - fromISO(von).getTime()) / 864e5) + 1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSichtState(leseSicht(benutzer));
    setAnzeigeState(leseAnzeige(benutzer));
  }, [benutzer]);

  const setzeAnzeige = useCallback(
    (aender: (alt: Anzeige) => Anzeige) => {
      setAnzeigeState((alt) => {
        const neu = aender(alt);
        try {
          window.localStorage.setItem(anzeigeKey(benutzer), JSON.stringify(neu));
        } catch {
          // ohne Speicher gilt die Auswahl nur bis zum Neuladen
        }
        return neu;
      });
    },
    [benutzer],
  );

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
    try {
      setVerbindungen(await fetchVerbindungen());
    } catch {
      // Verbindungen sind Beiwerk
    }
  }, []);

  const ladeVerbunden = useCallback(async () => {
    if (tageAnzahl < 1 || tageAnzahl > 62) return;
    try {
      const [t, termine] = await Promise.all([fetchVerbundeneTage(von, tageAnzahl), fetchVerbundeneTermine()]);
      setVTage(t);
      setFremdeTermine(termine);
    } catch {
      // Verbindungen sind Beiwerk
    }
  }, [von, tageAnzahl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (aktiv && verbindungen.length) void ladeVerbunden();
  }, [aktiv, verbindungen.length, ladeVerbunden]);

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

  /** Farben: erst die Link-Personen, dann die verbundenen Konten. */
  const farbListe = useMemo(
    () => [...(personen ?? []).map((p) => ({ id: p.id })), ...verbindungen.map((v) => ({ id: `v:${v.partner}` }))],
    [personen, verbindungen],
  );

  const personenZweige: Zweig[] = useMemo(
    () =>
      PERSON_ARTEN.map((a) => ({
        key: `art:${a.art}`,
        titel: a.mehrzahl,
        knoten: [
          ...sichtbarePersonen
            .filter((p) => p.art === a.art)
            .map((p) => ({ key: p.id, name: p.name, farbe: personFarbe(farbListe, p.id) })),
          ...verbindungen
            .filter((v) => v.art === a.art)
            .map((v) => ({ key: `v:${v.partner}`, name: v.name || "Ohne Namen", farbe: personFarbe(farbListe, `v:${v.partner}`) })),
        ],
      })).filter((z) => z.knoten.length > 0),
    [sichtbarePersonen, verbindungen, farbListe],
  );

  /** Mitglieder der Gruppen – Farben nach den Personen weitergezählt. */
  const gruppenFarbe = useMemo(() => {
    const versatz = farbListe.length;
    const m = new Map<string, string>();
    gruppenAndere.forEach((g, i) => m.set(g.id, PERSON_FARBEN[(versatz + i) % PERSON_FARBEN.length]));
    return m;
  }, [gruppenAndere, farbListe]);

  const gruppenTage = useMemo(() => new Map(gruppenAndere.map((g) => [`u:${g.id}`, g.tage])), [gruppenAndere]);
  const gruppenFarben = useMemo(() => new Map(gruppenAndere.map((g) => [`u:${g.id}`, g.farben])), [gruppenAndere]);

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
          const code = k.key.startsWith("u:")
            ? gruppenTage.get(k.key)?.[iso]
            : k.key.startsWith("v:")
              ? vTage[k.key.slice(2)]?.tage[iso]
              : tage[k.key]?.[iso];
          // Eigene Farben haben nur Personen mit eigenem Konto.
          const farben = k.key.startsWith("u:") ? gruppenFarben.get(k.key) : k.key.startsWith("v:") ? vTage[k.key.slice(2)]?.farben : undefined;
          if (code) liste.push({ key: k.key, name: k.name, kurz: kuerzel(k.name), farbe: k.farbe, code, schichtFarbe: anzeige.farben[k.key] ?? codeFarbe(code, farben) });
        }
      }
      return liste;
    },
    [zweige, schalter, tage, gruppenTage, gruppenFarben, vTage, anzeige.farben],
  );

  /** Eigener Termin oder Termin einer Person – je nach Auswahl. */
  const terminSichtbar = useCallback(
    (t: Termin) => {
      if (t.inhaber) return schalter(`v:${t.inhaber}`)[1];
      if (t.vonUser) return schalter(`v:${t.vonUser}`)[1];
      if (!t.vonPartner) return schalter(ICH)[1];
      return t.personId ? schalter(t.personId)[1] : true;
    },
    [schalter],
  );

  const terminVon = useCallback(
    (t: Termin): { name: string; farbe: string } | null => {
      const konto = t.inhaber ?? t.vonUser;
      if (konto) {
        const v = verbindungen.find((x) => x.partner === konto);
        return v ? { name: v.name || "Verbunden", farbe: personFarbe(farbListe, `v:${v.partner}`) } : null;
      }
      if (!t.vonPartner || !t.personId) return null;
      const p = personen?.find((x) => x.id === t.personId);
      return p ? { name: p.name, farbe: personFarbe(farbListe, p.id) } : null;
    },
    [personen, verbindungen, farbListe],
  );

  return {
    personen,
    zweige,
    /** Eingeladene Personen (ohne Gruppen und Konten) – für die Auswahl beim Eintragen. */
    knoten: personenZweige.flatMap((z) => z.knoten).filter((k) => !k.key.startsWith("v:")),
    verbindungen,
    /** Termine der verbundenen Konten (die sie teilen, und meine Einträge bei ihnen). */
    fremdeTermine,
    /** Eintrag einer Person an einem Tag – unabhängig von der Auswahl. */
    rohTag: (key: string, iso: string): PartnerCode | null => tage[key]?.[iso] ?? null,
    schalter,
    setze,
    anzeige,
    setzeGroesse: (groesse: AnzeigeGroesse) => setzeAnzeige((a) => ({ ...a, groesse })),
    setzeText: (text: AnzeigeText) => setzeAnzeige((a) => ({ ...a, text })),
    /** Feste Schichtfarbe einer Person; null = wieder die eigenen Farben der Person. */
    setzeFarbe: (key: string, farbe: string | null) =>
      setzeAnzeige((a) => {
        const farben = { ...a.farben };
        if (farbe) farben[key] = farbe;
        else delete farben[key];
        return { ...a, farben };
      }),
    alleAn: () => speichern({}),
    nurIch: () => speichern(Object.fromEntries(alleKeys.map((k) => [k, k === ICH ? AN : ([false, false] as Schalter)]))),
    amTag,
    terminSichtbar,
    terminVon,
    /** Nach Änderungen (Einladen, Eintragen) neu laden. */
    neuLaden: async () => {
      geladen.current.clear();
      await Promise.all([ladePersonen(), ladeTage(true), ladeGruppenTage(), ladeVerbunden()]);
    },
    /** Wer gerade eingeblendet ist (jede Person einmal). */
    eingeblendet: [...new Map(zweige.flatMap((z) => z.knoten).map((k) => [k.key, k])).values()].filter(
      (k) => schalter(k.key)[0] || schalter(k.key)[1],
    ),
  };
}

export type Andere = ReturnType<typeof useAndere>;

const TAG_GROESSE: Record<AnzeigeGroesse, { zeile: string; kreis: string }> = {
  klein: { zeile: "h-[11px] text-[8px] leading-[11px]", kreis: "h-[11px] w-[11px] text-[7px]" },
  mittel: { zeile: "h-[14px] text-[9px] leading-[14px]", kreis: "h-[13px] w-[13px] text-[8px]" },
  gross: { zeile: "h-[20px] text-[11.5px] leading-[20px]", kreis: "h-[18px] w-[18px] text-[10.5px]" },
};

/**
 * Unter dem eigenen Eintrag: bis zwei Personen als Umriss „L·S“, ab drei als
 * kleine Kreise mit dem Kürzel der Schicht. Frei ist blasser. Ausgeschrieben
 * steht je Person eine Zeile mit dem Namen der Schicht, etwa „L Früh“. Größe
 * und Beschriftung stellt man im Kalender ein (Knopf „Wen sehe ich?“).
 */
export function AndereTags({
  eintraege,
  max = 2,
  anzeige = ANZEIGE_STANDARD,
  className,
}: {
  eintraege: AndererEintrag[];
  max?: number;
  anzeige?: Anzeige;
  className?: string;
}) {
  if (!eintraege.length) return null;
  // Bei drei und mehr Personen ist „Groß“ zu hoch für die Tageskachel.
  const g = TAG_GROESSE[anzeige.groesse === "gross" && eintraege.length > 2 ? "mittel" : anzeige.groesse];
  if (anzeige.text === "voll") {
    return (
      <span className={cn("flex w-full shrink-0 flex-col gap-[2px]", className)}>
        {eintraege.map((e) => (
          <span
            key={e.key}
            title={`${e.name}: ${partnerText(e.code, true)}`}
            className={cn("w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[5px] px-[3px] text-left font-bold", g.zeile, e.code === "X" && "opacity-70")}
            style={{ backgroundColor: e.schichtFarbe, color: textFarbe(e.schichtFarbe), boxShadow: `inset 0 -2px 0 ${e.farbe}` }}
          >
            {e.kurz.slice(0, 1)} {partnerText(e.code)}
          </span>
        ))}
      </span>
    );
  }
  if (eintraege.length > max) {
    return (
      <span className={cn("flex w-full shrink-0 flex-wrap justify-center gap-[2px]", className)}>
        {eintraege.map((e) => (
          <span
            key={e.key}
            title={`${e.name}: ${partnerText(e.code, true)}`}
            className={cn("flex items-center justify-center rounded-full font-bold leading-none", g.kreis, e.code === "X" && "opacity-60")}
            style={{ backgroundColor: e.schichtFarbe, color: textFarbe(e.schichtFarbe), boxShadow: `0 0 0 1.5px ${e.farbe}` }}
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
          className={cn("min-w-0 flex-1 overflow-hidden whitespace-nowrap rounded-[5px] text-center font-bold", g.zeile, e.code === "X" && "opacity-70")}
          style={{ backgroundColor: e.schichtFarbe, color: textFarbe(e.schichtFarbe), boxShadow: `inset 0 -2px 0 ${e.farbe}` }}
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
              className="shrink-0 rounded-[8px] px-2.5 py-0.5 text-[12.5px] font-semibold"
              style={{ backgroundColor: e.schichtFarbe, color: textFarbe(e.schichtFarbe) }}
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
        "h-8 shrink-0 rounded-full px-2 text-[11.5px] font-semibold transition-colors",
        an ? "bg-brand-500 text-white" : teil ? "bg-brand-500/10 text-brand-700 ring-1 ring-inset ring-brand-500/50" : "bg-ink/[0.06] text-ink-faint",
      )}
    >
      {children}
    </button>
  );
}

/** Zwei oder drei Möglichkeiten nebeneinander, eine ist gewählt. */
function Auswahl<T extends string>({ wert, onWahl, optionen }: { wert: T; onWahl: (w: T) => void; optionen: [T, string][] }) {
  return (
    <span className="flex rounded-full bg-ink/[0.06] p-[2px]">
      {optionen.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={wert === id}
          onClick={() => onWahl(id)}
          className={cn(
            "h-7 rounded-full px-2.5 text-[12px] font-semibold transition-colors",
            wert === id ? "bg-surface text-ink shadow-sm" : "text-ink-muted",
          )}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

/** Kleiner Farbpunkt bei einer Person: ihre eigenen Farben (bunt) oder eine feste Farbe. */
function FarbPunkt({ name, farbe, offen, onClick }: { name: string; farbe: string | null; offen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={offen}
      aria-label={`Farbe der Schicht von ${name}${farbe ? "" : " (eigene Farben)"}`}
      className="flex h-8 w-8 shrink-0 items-center justify-center"
    >
      <span
        className={cn("h-[22px] w-[22px] rounded-full ring-2", offen ? "ring-ink/60" : "ring-ink/15")}
        style={{ background: farbe ?? "conic-gradient(#F5A524 0 33%, #22A06B 0 66%, #2F6FDE 0)" }}
      />
    </button>
  );
}

/** Die Farben zur Wahl; „Eigene“ nimmt wieder die Farben, die die Person selbst gewählt hat. */
function FarbReihe({ farbe, onWahl }: { farbe: string | null; onWahl: (f: string | null) => void }) {
  return (
    <div className="mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-[14px] bg-surface/60 px-2.5 py-2">
      <button
        type="button"
        onClick={() => onWahl(null)}
        aria-pressed={!farbe}
        className={cn("h-8 rounded-full px-3 text-[12px] font-semibold", !farbe ? "bg-brand-500 text-white" : "bg-ink/[0.06] text-ink-muted")}
      >
        Eigene
      </button>
      {SCHICHT_FARBEN.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onWahl(f)}
          aria-label={`Farbe ${f}`}
          aria-pressed={farbe === f}
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: f, color: textFarbe(f) }}
        >
          {farbe === f ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Knopf oben rechts: die eingeblendeten Personen als kleine Kreise. Antippen
 * öffnet den Baum. Ohne Personen: Einladen.
 */
export function WenSeheIch({
  andere,
  onVerwalten,
  glas = false,
  offen: offenVonAussen,
  onOffen,
}: {
  andere: Andere;
  onVerwalten: () => void;
  glas?: boolean;
  /** Von außen öffnen (z. B. Wischen vom rechten Rand). */
  offen?: boolean;
  onOffen?: (offen: boolean) => void;
}) {
  const [offenIntern, setOffenIntern] = useState(false);
  const offen = offenVonAussen ?? offenIntern;
  const setOffen = useCallback(
    (o: boolean) => {
      setOffenIntern(o);
      onOffen?.(o);
    },
    [onOffen],
  );
  const [zu, setZu] = useState<Record<string, boolean>>({});
  /** Bei wem gerade die Farbwahl offen ist. */
  const [farbWahl, setFarbWahl] = useState<string | null>(null);
  const blatt = useRef<HTMLDivElement>(null);
  const zug = useRef<{ x: number; dx: number } | null>(null);

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen, setOffen]);
  const alle = [...new Map(andere.zweige.flatMap((z) => z.knoten).map((k) => [k.key, k])).values()];

  if (andere.personen === null) return null;

  const knopfKlasse = cn(
    "flex h-10 shrink-0 items-center rounded-full [@media(max-width:360px)]:h-9",
    glas ? "glas" : "bg-surface shadow-sm ring-1 ring-line",
  );
  const sichtbar = andere.eingeblendet;
  const ich = andere.schalter(ICH);

  // Nach rechts ziehen schließt das Seitenblatt.
  const ziehen = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, input, select")) return;
      zug.current = { x: e.clientX, dx: 0 };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const z = zug.current;
      if (!z || !blatt.current) return;
      z.dx = Math.max(0, e.clientX - z.x);
      blatt.current.style.transition = "none";
      blatt.current.style.transform = `translateX(${z.dx}px)`;
    },
    onPointerUp: () => {
      const z = zug.current;
      zug.current = null;
      if (!z || !blatt.current) return;
      blatt.current.style.transition = "";
      blatt.current.style.transform = "";
      if (z.dx > 70) setOffen(false);
    },
  };

  const abschnitt = "px-1 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint";

  return (
    <>
      {alle.length ? (
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
      ) : (
        <button type="button" onClick={onVerwalten} aria-label="Partner, Familie oder Freunde einladen" className={cn(knopfKlasse, "w-10 justify-center")}>
          <UserPlus className="h-[18px] w-[18px]" />
        </button>
      )}

      {offen
        ? createPortal(
            <div className="privat-schrift fixed inset-0 z-50">
              <button
                type="button"
                aria-label="Schließen"
                className="absolute inset-0 cursor-default bg-black/15 [animation:wen-dimm_.2s_ease-out]"
                onClick={() => setOffen(false)}
              />
              <div
                ref={blatt}
                role="dialog"
                aria-label="Wen sehe ich?"
                data-wen-sehe-ich
                {...ziehen}
                onPointerCancel={ziehen.onPointerUp}
                className="glas absolute bottom-[max(0.6rem,env(safe-area-inset-bottom))] right-2 top-[max(0.6rem,env(safe-area-inset-top))] flex w-[min(24rem,calc(100vw-1rem))] touch-pan-y flex-col overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(31,41,77,0.25)] transition-transform duration-200 [animation:wen-rein_.26s_cubic-bezier(.2,.8,.2,1)] motion-reduce:[animation:none]"
              >
                <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                  <span className="text-[19px] font-bold tracking-[-0.01em]">Wen sehe ich?</span>
                  <button
                    type="button"
                    onClick={() => setOffen(false)}
                    aria-label="Schließen"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/[0.07] text-ink-muted"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
                  {alle.length ? (
                    <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-ink/[0.06] p-[3px]">
                      <button type="button" onClick={andere.alleAn} className="h-9 rounded-[11px] bg-surface text-[13.5px] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                        Alle einblenden
                      </button>
                      <button type="button" onClick={andere.nurIch} className="h-9 rounded-[11px] text-[13.5px] font-semibold text-ink-muted">
                        Nur ich
                      </button>
                    </div>
                  ) : null}

                  <p className={abschnitt}>Ich</p>
                  <div className="flex items-center gap-2.5 rounded-[16px] bg-ink/[0.04] px-2.5 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-surface">Ich</span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold">Meine Termine</span>
                    <Pille an={ich[1]} onClick={() => andere.setze([ICH], 1, !ich[1])}>
                      Termine
                    </Pille>
                  </div>

                  {alle.length ? (
                    <>
                      <p className={abschnitt}>Andere · {sichtbar.length} von {alle.length} sichtbar</p>
                      <div className="space-y-1">
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
                          <div key={z.key} className="rounded-[16px] bg-ink/[0.04]">
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
                              {einzeln ? (
                                <FarbPunkt
                                  name={z.knoten[0].name}
                                  farbe={andere.anzeige.farben[z.knoten[0].key] ?? null}
                                  offen={farbWahl === z.knoten[0].key}
                                  onClick={() => setFarbWahl((k) => (k === z.knoten[0].key ? null : z.knoten[0].key))}
                                />
                              ) : null}
                              <Pille an={alleS} teil={!alleS && !keineS} onClick={() => andere.setze(keys, 0, !alleS)}>
                                Schichten
                              </Pille>
                              {z.nurSchichten ? null : (
                                <Pille an={alleT} teil={!alleT && !keineT} onClick={() => andere.setze(keys, 1, !alleT)}>
                                  Termine
                                </Pille>
                              )}
                            </div>
                            {einzeln && farbWahl === z.knoten[0].key ? (
                              <FarbReihe
                                farbe={andere.anzeige.farben[z.knoten[0].key] ?? null}
                                onWahl={(f) => {
                                  andere.setzeFarbe(z.knoten[0].key, f);
                                  setFarbWahl(null);
                                }}
                              />
                            ) : null}
                            {!einzeln && aufgeklappt ? (
                              <div className="mb-1.5 ml-[1.3rem] border-l-2 border-ink/10">
                                {z.knoten.map((k) => {
                                  const ks = andere.schalter(k.key);
                                  return (
                                    <div key={k.key}>
                                      <div className="flex items-center gap-2 py-1.5 pl-0 pr-2">
                                        <span className="h-0.5 w-3 shrink-0 bg-ink/10" />
                                        <PersonAvatar name={k.name} farbe={k.farbe} klein />
                                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{k.name}</span>
                                        <FarbPunkt
                                          name={k.name}
                                          farbe={andere.anzeige.farben[k.key] ?? null}
                                          offen={farbWahl === k.key}
                                          onClick={() => setFarbWahl((x) => (x === k.key ? null : k.key))}
                                        />
                                        <Pille an={ks[0]} onClick={() => andere.setze([k.key], 0, !ks[0])}>
                                          Schichten
                                        </Pille>
                                        {z.nurSchichten ? null : (
                                          <Pille an={ks[1]} onClick={() => andere.setze([k.key], 1, !ks[1])}>
                                            Termine
                                          </Pille>
                                        )}
                                      </div>
                                      {farbWahl === k.key ? (
                                        <FarbReihe
                                          farbe={andere.anzeige.farben[k.key] ?? null}
                                          onWahl={(f) => {
                                            andere.setzeFarbe(k.key, f);
                                            setFarbWahl(null);
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      </div>

                      <p className={abschnitt}>Darstellung der anderen</p>
                      <div className="space-y-2 rounded-[16px] bg-ink/[0.04] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-medium">Größe</span>
                          <Auswahl
                            wert={andere.anzeige.groesse}
                            onWahl={andere.setzeGroesse}
                            optionen={[
                              ["klein", "Klein"],
                              ["mittel", "Mittel"],
                              ["gross", "Groß"],
                            ]}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-medium">Schrift</span>
                          <Auswahl
                            wert={andere.anzeige.text}
                            onWahl={andere.setzeText}
                            optionen={[
                              ["kurz", "Kurz"],
                              ["voll", "Ausgeschrieben"],
                            ]}
                          />
                        </div>
                        <p className="text-[11.5px] leading-snug text-ink-muted">Die Farbe wählst du mit dem Farbpunkt bei jeder Person.</p>
                      </div>
                    </>
                  ) : (
                    <p className="px-1 pt-4 text-[14px] leading-snug text-ink-muted">
                      Noch niemand verbunden. Lade Partner, Familie oder Freunde ein – dann siehst du hier, wessen Schichten und
                      Termine im Kalender stehen.
                    </p>
                  )}
                </div>

                <div className="border-t border-line px-3 pb-3 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOffen(false);
                      onVerwalten();
                    }}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-[14px] bg-brand-600 text-[14.5px] font-semibold text-white"
                  >
                    <UserPlus className="h-4 w-4" /> Personen einladen oder verwalten
                  </button>
                  <p className="pt-2 text-center text-[11.5px] leading-snug text-ink-muted">Gilt nur für deine Ansicht – niemand merkt etwas.</p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
