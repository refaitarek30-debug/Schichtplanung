"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { Check, Minus, Share, Plus, SlidersHorizontal, UserPlus, Users } from "lucide-react";
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
import { FarbWahl } from "./farb-wahl";

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
    // Alle drei gleichzeitig – nacheinander warten macht den Kalender beim Öffnen spürbar langsamer.
    const [p, g, v] = await Promise.allSettled([fetchPersonen(), fetchGruppen(), fetchVerbindungen()]);
    if (p.status === "fulfilled") setPersonen(p.value);
    else setPersonen((a) => a ?? []);
    // Gruppen und Verbindungen sind Beiwerk.
    if (g.status === "fulfilled") setGruppen(g.value);
    if (v.status === "fulfilled") setVerbindungen(v.value);
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

  /** Auswahl ändern – als Änderung am jeweils neuesten Stand, damit zwei Schalter direkt hintereinander beide wirken. */
  const speichern = useCallback(
    (aender: Sicht | ((alt: Sicht) => Sicht)) => {
      setSichtState((alt) => {
        const neu = typeof aender === "function" ? aender(alt) : aender;
        try {
          window.localStorage.setItem(speicherKey(benutzer), JSON.stringify(neu));
        } catch {
          // ohne Speicher gilt die Auswahl nur bis zum Neuladen
        }
        return neu;
      });
    },
    [benutzer],
  );

  const setze = useCallback(
    (keys: string[], i: 0 | 1, wert: boolean) => {
      speichern((alt) => {
        const neu = { ...alt };
        for (const k of keys) {
          const s: Schalter = [...(neu[k] ?? AN)] as Schalter;
          s[i] = wert;
          neu[k] = s;
        }
        return neu;
      });
    },
    [speichern],
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
    /** Eigene Schichten im Kalender zeigen (Schalter „Ich · Schichten“). */
    eigeneSchichten: schalter(ICH)[0],
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

/** Zwei oder drei Möglichkeiten nebeneinander, eine ist gewählt. */
function Auswahl<T extends string>({ wert, onWahl, optionen }: { wert: T; onWahl: (w: T) => void; optionen: [T, string][] }) {
  return (
    <span className="flex w-full rounded-[12px] bg-ink/[0.06] p-[3px]">
      {optionen.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={wert === id}
          onClick={() => onWahl(id)}
          className={cn(
            "h-9 min-w-0 flex-1 truncate rounded-[10px] px-1.5 text-[12.5px] font-semibold transition-colors",
            wert === id ? "bg-surface text-ink shadow-sm" : "text-ink-muted",
          )}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

/** Die Farben zur Wahl; „Eigene“ nimmt wieder die Farben, die die Person selbst gewählt hat. */
function FarbReihe({ farbe, onWahl }: { farbe: string | null; onWahl: (f: string | null) => void }) {
  return (
    <div className="space-y-2 rounded-[14px] bg-surface/60 px-2.5 py-2.5">
      <button
        type="button"
        onClick={() => onWahl(null)}
        aria-pressed={!farbe}
        className={cn("h-8 rounded-full px-3 text-[12.5px] font-semibold", !farbe ? "bg-brand-500 text-white" : "bg-ink/[0.06] text-ink-muted")}
      >
        Ihre eigenen Farben
      </button>
      <FarbWahl wert={farbe} onWahl={onWahl} name="Schicht dieser Person" />
    </div>
  );
}


/** Breite Rand-Zone rechts, in der ein Zug nach links „Wen sehe ich?“ hereinholt. */
const RAND = 28;

/**
 * Knopf oben rechts: die eingeblendeten Personen als kleine Kreise. Antippen
 * öffnet „Wen sehe ich?“ als Seitenblatt am rechten Rand: eine ruhige Liste
 * mit Häkchen je Person, „…“ für Einzelheiten (Schichten/Termine, Farbe). Mit `randWischen` lässt es sich vom
 * rechten Rand mit dem Finger hereinziehen und nach rechts wieder wegschieben.
 */
export function WenSeheIch({
  andere,
  onVerwalten,
  glas = false,
  randWischen = false,
  onEigeneFarben,
  onExport,
}: {
  andere: Andere;
  onVerwalten: () => void;
  glas?: boolean;
  /** Vom rechten Bildschirmrand hereinziehen (nur, wenn sonst nichts offen ist). */
  randWischen?: boolean;
  /** Einstellungen: zu den Farben der eigenen Schichten. */
  onEigeneFarben?: () => void;
  /** Unten im Fenster: Kalender als PDF (nur Privatbereich). */
  onExport?: () => void;
}) {
  const [offen, setOffen] = useState(false);
  /** Blatt ist da, folgt aber noch dem Finger (beim Hereinziehen). */
  const [zieht, setZieht] = useState(false);
  /** Einstellungen (Regler oben): Farben je Person, Größe und Schrift der anderen. */
  const [einstellen, setEinstellen] = useState(false);
  /** Bei wem in den Einstellungen gerade die Farbwahl offen ist. */
  const [farbWahl, setFarbWahl] = useState<string | null>(null);
  const blatt = useRef<HTMLDivElement>(null);
  const zug = useRef<{ x: number; dx: number } | null>(null);
  /** Hereingezogen statt angetippt: dann ohne Einflug-Animation. */
  const [perHand, setPerHand] = useState(false);
  const schliesstGerade = useRef(false);

  const breite = () => blatt.current?.offsetWidth ?? 280;
  const setzeVersatz = (px: number, weich: boolean) => {
    const el = blatt.current;
    if (!el) return;
    el.style.transition = weich ? "transform .24s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = px > 0 ? `translateX(${px}px)` : "";
  };

  const schliessen = useCallback(() => {
    if (schliesstGerade.current) return;
    const el = blatt.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOffen(false);
      setZieht(false);
      return;
    }
    schliesstGerade.current = true;
    el.style.transition = "transform .2s cubic-bezier(.4,0,1,1)";
    el.style.transform = "translateX(calc(100% + 1rem))";
    window.setTimeout(() => {
      schliesstGerade.current = false;
      setOffen(false);
      setZieht(false);
    }, 190);
  }, []);

  const oeffnen = () => {
    setPerHand(false);
    setOffen(true);
  };

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen, schliessen]);

  // Vom rechten Rand nach links ziehen: das Blatt folgt dem Finger.
  useEffect(() => {
    if (!randWischen || offen) return;
    let start: { x: number; y: number; t: number } | null = null;
    let gezogen = false;
    let letztesX = 0;
    const los = (e: PointerEvent) => {
      start = e.clientX > window.innerWidth - RAND ? { x: e.clientX, y: e.clientY, t: Date.now() } : null;
      gezogen = false;
      letztesX = e.clientX;
    };
    const bewegt = (e: PointerEvent) => {
      if (!start) return;
      letztesX = e.clientX;
      const dx = start.x - e.clientX;
      const dy = Math.abs(e.clientY - start.y);
      if (!gezogen) {
        if (dy > 24 && dy > dx) {
          start = null;
          return;
        }
        if (dx < 10) return;
        gezogen = true;
        setPerHand(true);
        setZieht(true);
      }
      setzeVersatz(Math.max(0, breite() - dx), false);
    };
    const ende = () => {
      const s = start;
      start = null;
      if (!s || !gezogen) return;
      const dx = s.x - letztesX;
      const schnell = dx > 30 && Date.now() - s.t < 260;
      if (dx > breite() * 0.3 || schnell) {
        setzeVersatz(0, true);
        setOffen(true);
        setZieht(false);
      } else {
        setzeVersatz(breite() + 16, true);
        window.setTimeout(() => setZieht(false), 220);
      }
    };
    window.addEventListener("pointerdown", los, true);
    window.addEventListener("pointermove", bewegt, true);
    window.addEventListener("pointerup", ende, true);
    window.addEventListener("pointercancel", ende, true);
    return () => {
      window.removeEventListener("pointerdown", los, true);
      window.removeEventListener("pointermove", bewegt, true);
      window.removeEventListener("pointerup", ende, true);
      window.removeEventListener("pointercancel", ende, true);
    };
  }, [randWischen, offen]);

  const alle = [...new Map(andere.zweige.flatMap((z) => z.knoten).map((k) => [k.key, k])).values()];

  if (andere.personen === null) return null;

  const knopfKlasse = cn(
    "flex h-10 shrink-0 items-center rounded-full [@media(max-width:360px)]:h-9",
    glas ? "glas" : "bg-surface shadow-sm ring-1 ring-line",
  );
  const sichtbar = andere.eingeblendet;
  const ich = andere.schalter(ICH);
  const da = offen || zieht;

  // Im Blatt nach rechts ziehen schiebt es wieder hinaus.
  const ziehen = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, input, select")) return;
      zug.current = { x: e.clientX, dx: 0 };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const z = zug.current;
      if (!z) return;
      z.dx = Math.max(0, e.clientX - z.x);
      setzeVersatz(z.dx, false);
    },
    onPointerUp: () => {
      const z = zug.current;
      zug.current = null;
      if (!z) return;
      if (z.dx > 70) schliessen();
      else setzeVersatz(0, true);
    },
  };

  const keysAlle = alle.map((k) => k.key);
  const istAlle = ich[0] && ich[1] && keysAlle.every((k) => andere.schalter(k)[0] && andere.schalter(k)[1]);
  const istNurIch = ich[0] && ich[1] && keysAlle.every((k) => !andere.schalter(k)[0] && !andere.schalter(k)[1]);

  /**
   * Eine Zeile: Häkchen (alles an/aus), Name, daneben „Schichten“ und „Termine“
   * einzeln. In den Einstellungen statt der beiden ein Farbpunkt.
   */
  const zeile = ({
    key,
    name,
    farbe,
    s: [sAn, tAn],
    nurSchichten = false,
    onSetze,
    farbKey,
    unten,
  }: {
    key: string;
    name: string;
    farbe: string;
    s: Schalter;
    nurSchichten?: boolean;
    onSetze: (i: 0 | 1, wert: boolean) => void;
    /** In den Einstellungen: wessen Farbe hier gewählt wird. */
    farbKey?: string;
    /** In den Einstellungen unter der Zeile (z. B. „Farben meiner Schichten“). */
    unten?: React.ReactNode;
  }) => {
    const voll = nurSchichten ? sAn : sAn && tAn;
    const an = nurSchichten ? sAn : sAn || tAn;
    const eigeneFarbe = farbKey ? (andere.anzeige.farben[farbKey] ?? null) : null;
    return (
      <div key={key} data-wen-zeile={key}>
        <div className="flex min-h-[50px] items-center gap-2">
          <button
            type="button"
            onClick={() => {
              // Anwählen zeigt Schichten und Termine, Abwählen nimmt beides weg.
              onSetze(0, !voll);
              if (!nurSchichten) onSetze(1, !voll);
            }}
            aria-pressed={voll}
            aria-label={`${name}: ${voll ? "ausblenden" : "einblenden"}`}
            className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left"
          >
            <Haken an={an} teil={an && !voll} farbe={farbe} />
            <span className="min-w-0 flex-1 truncate text-[16.5px]">{name}</span>
          </button>
          {einstellen ? (
            farbKey ? (
              <button
                type="button"
                onClick={() => setFarbWahl((k) => (k === farbKey ? null : farbKey))}
                aria-expanded={farbWahl === farbKey}
                aria-label={`Farbe der Schichten von ${name}${eigeneFarbe ? "" : " (ihre eigenen Farben)"}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center"
              >
                <span
                  className={cn("h-7 w-7 rounded-full ring-2", farbWahl === farbKey ? "ring-ink/60" : "ring-ink/15")}
                  style={{ background: eigeneFarbe ?? "conic-gradient(#F5A524 0 33%, #22A06B 0 66%, #2F6FDE 0)" }}
                />
              </button>
            ) : null
          ) : (
            <span className="flex shrink-0 gap-1">
              <Mini an={sAn} onClick={() => onSetze(0, !sAn)} label={`${name}: Schichten`}>
                Schichten
              </Mini>
              {nurSchichten ? null : (
                <Mini an={tAn} onClick={() => onSetze(1, !tAn)} label={`${name}: Termine`}>
                  Termine
                </Mini>
              )}
            </span>
          )}
        </div>
        {einstellen && farbKey && farbWahl === farbKey ? (
          <div className="mb-2">
            <FarbReihe farbe={eigeneFarbe} onWahl={(f) => andere.setzeFarbe(farbKey, f)} />
          </div>
        ) : null}
        {einstellen && unten ? <div className="mb-2 ml-[2.4rem]">{unten}</div> : null}
      </div>
    );
  };

  const abschnitt = (titel: string, unter: string | null, kinder: React.ReactNode, plus?: boolean) => (
    <section className="pt-3">
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <h3 className="min-w-0 flex-1 truncate text-[19px] font-bold">
          {titel}
          {unter ? <span className="ml-1.5 text-[13px] font-medium text-ink-muted">{unter}</span> : null}
        </h3>
        {plus ? (
          <button
            type="button"
            onClick={() => {
              schliessen();
              onVerwalten();
            }}
            aria-label="Personen einladen"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-surface"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
      <div className="pt-1">{kinder}</div>
    </section>
  );

  return (
    <>
      {alle.length ? (
        <button
          type="button"
          onClick={oeffnen}
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
        <button type="button" onClick={oeffnen} aria-label="Wen sehe ich? Partner, Familie oder Freunde einladen" className={cn(knopfKlasse, "w-10 justify-center")}>
          <UserPlus className="h-[18px] w-[18px]" />
        </button>
      )}

      {da
        ? createPortal(
            <div className="privat-schrift fixed inset-0 z-50">
              {/* Kein Abdunkeln: der Kalender bleibt sichtbar. Antippen daneben schließt. */}
              <button type="button" aria-label="Schließen" className="absolute inset-0 cursor-default bg-transparent" onClick={schliessen} />
              <div
                ref={blatt}
                role="dialog"
                aria-label="Wen sehe ich?"
                data-wen-sehe-ich
                {...ziehen}
                onPointerCancel={ziehen.onPointerUp}
                style={zieht ? { transform: "translateX(calc(100% + 1rem))" } : undefined}
                className={cn(
                  "wen-blatt absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-2 top-[max(0.6rem,env(safe-area-inset-top))] flex w-[min(23rem,calc(100vw-3.5rem))] touch-pan-y flex-col overflow-hidden rounded-[30px]",
                  !perHand && "[animation:wen-rein_.28s_cubic-bezier(.2,.8,.2,1)] motion-reduce:[animation:none]",
                )}
              >
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-4">
                  <h2 className="border-b border-line pb-2 text-[20px] font-bold">Wen sehe ich?</h2>

                  <div className="flex items-center gap-1 border-b border-line py-1.5">
                    {alle.length ? (
                      <>
                        <button
                          type="button"
                          onClick={andere.alleAn}
                          aria-pressed={istAlle}
                          className={cn("h-10 flex-1 rounded-full text-[15.5px] font-semibold transition-colors", istAlle ? "bg-ink/10" : "text-ink-muted")}
                        >
                          Alle
                        </button>
                        <button
                          type="button"
                          onClick={andere.nurIch}
                          aria-pressed={istNurIch}
                          className={cn("h-10 flex-1 rounded-full text-[15.5px] font-semibold transition-colors", istNurIch ? "bg-ink/10" : "text-ink-muted")}
                        >
                          Nur ich
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEinstellen((d) => !d);
                            setFarbWahl(null);
                          }}
                          aria-expanded={einstellen}
                          aria-label="Einstellungen: Farben und Darstellung"
                          className={cn("flex h-10 w-11 shrink-0 items-center justify-center rounded-full", einstellen ? "bg-ink/10 text-ink" : "text-ink-muted")}
                        >
                          <SlidersHorizontal className="h-[21px] w-[21px]" />
                        </button>
                      </>
                    ) : (
                      <p className="text-[14px] leading-snug text-ink-muted">Lade Partner, Familie oder Freunde ein – dann siehst du hier auch deren Schichten und Termine.</p>
                    )}
                  </div>
                  {einstellen && alle.length ? (
                    <div className="space-y-3 border-b border-line py-3">
                      <div className="space-y-1.5">
                        <span className="block text-[13.5px] font-semibold text-ink-muted">Größe der anderen</span>
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
                      <div className="space-y-1.5">
                        <span className="block text-[13.5px] font-semibold text-ink-muted">Schrift</span>
                        <Auswahl
                          wert={andere.anzeige.text}
                          onWahl={andere.setzeText}
                          optionen={[
                            ["kurz", "Kurz"],
                            ["voll", "Ausgeschrieben"],
                          ]}
                        />
                      </div>
                      <p className="text-[12.5px] leading-snug text-ink-muted">Farbe einer Person: auf ihren Farbpunkt tippen.</p>
                    </div>
                  ) : null}

                  <div data-wen-ich className="border-b border-line py-1">
                    {zeile({
                        key: "ich",
                        name: "Ich",
                        farbe: "rgb(var(--c-brand-500))",
                        s: ich,
                        onSetze: (i, w) => andere.setze([ICH], i, w),
                        unten: onEigeneFarben ? (
                          <button
                            type="button"
                            onClick={() => {
                              schliessen();
                              onEigeneFarben();
                            }}
                            className="h-9 rounded-full bg-ink/[0.07] px-3.5 text-[13.5px] font-semibold"
                          >
                            Farben meiner Schichten ändern
                          </button>
                        ) : null,
                      })}
                  </div>

                  {andere.zweige.map((z) =>
                    abschnitt(
                      z.titel,
                      z.nurSchichten ? "Gruppe" : null,
                      z.knoten.map((k) =>
                        zeile({
                          key: `${z.key}:${k.key}`,
                          name: k.name,
                          farbe: k.farbe,
                          s: andere.schalter(k.key),
                          nurSchichten: z.nurSchichten,
                          onSetze: (i, w) => andere.setze([k.key], i, w),
                          farbKey: k.key,
                        }),
                      ),
                      !z.nurSchichten,
                    ),
                  )}

                  {!andere.zweige.some((z) => !z.nurSchichten) ? abschnitt("Partner & Familie", null, null, true) : null}
                </div>
                {onExport ? (
                  <div className="shrink-0 px-4 pb-4 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        schliessen();
                        onExport();
                      }}
                      data-wen-export
                      className="glas flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold active:scale-[0.98]"
                    >
                      <Share className="h-[18px] w-[18px]" /> Kalender als PDF
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Häkchen-Kästchen in der Farbe der Person; halb = nur Schichten oder nur Termine. */
function Haken({ an, teil, farbe }: { an: boolean; teil: boolean; farbe: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] transition-colors",
        an ? "text-white" : "ring-2 ring-inset ring-ink/25",
        an && teil && "opacity-55",
      )}
      style={an ? { backgroundColor: farbe } : undefined}
    >
      {an ? teil ? <Minus className="h-4 w-4" strokeWidth={3.2} /> : <Check className="h-4 w-4" strokeWidth={3.2} /> : null}
    </span>
  );
}

/** Kleiner Schalter neben dem Namen: „Schichten“ oder „Termine“. */
function Mini({ an, onClick, label, children }: { an: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={an}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full px-2 text-[12px] font-semibold transition-colors active:scale-95",
        an ? "bg-brand-500 text-white" : "text-ink-muted ring-1 ring-inset ring-ink/15",
      )}
    >
      {children}
    </button>
  );
}
