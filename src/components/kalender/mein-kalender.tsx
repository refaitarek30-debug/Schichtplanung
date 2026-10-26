"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, UserPlus, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/context/session";
import { fetchHolidays } from "@/lib/data/holidays";
import { DataError, fetchShiftPlanGrid } from "@/lib/data/rotation";
import { fetchShiftDetails, type ShiftDetail } from "@/lib/data/shifts";
import { addDays, formatDE, fromISO, heuteInBerlin, monthName, toISO } from "@/lib/dates";
import { useAktualisierung } from "@/lib/live-refresh";
import { ausZwischenspeicher, inZwischenspeicher } from "@/lib/zwischenspeicher";
import { holeEigeneTage, merkeEigeneTage } from "./stand-geraet";
import { aufGeraet, ausGeraet } from "@/lib/geraete-speicher";
import { istOffline, useOnline } from "@/lib/netz";
import type { LiveShiftPlanCell } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  TerminBlatt,
  alteLokaleTermine,
  termineAm,
  vergissLokaleTermine,
  type Termin,
  type TerminEingabe,
} from "./termine";
import { KalenderTeilen } from "./teilen";
import {
  PARTNER_FARBE,
  PartnerBlatt,
  alteLokalePartnerTage,
  partnerText,
  vergissLokalePartnerTage,
  type PartnerSchicht,
} from "./partner";
import {
  fetchMeinePartnerTage,
  fetchMeineTermine,
  loescheTermin,
  setzeMeinePartnerTage,
  speichereTermin,
} from "@/lib/data/partner";
import { setzeLokal, useLokaleEinstellung, useLokalNachLaden } from "./lokal";
import { KalenderEinfuehrung } from "./einfuehrung";
import { setzeEinfuehrungGesehen, useEinfuehrungImKonto } from "@/lib/anzeige";
import { neuGesehenSchluessel } from "@/components/layout/neu-marke";
import { useBegriffe } from "@/lib/begriffe";

/**
 * Mein Kalender – der eigene Schichtplan als Monat.
 *
 * Dieselben Daten wie im Schichtplan (`schichtplan_kompakt()`), nur die
 * eigene Zeile. Damit gelten dieselben Regeln: Rotation, Tagesausnahmen,
 * Feiertage, Abwesenheiten und Anträge. Eine eigene Abfrage dafür gibt es
 * bewusst nicht – zwei Wege zum selben Plan laufen irgendwann auseinander.
 *
 * Tippen auf einen Tag öffnet eine Sprechblase mit Schicht, Uhrzeit und
 * Stunden. Von dort lassen sich eigene Termine und die Arbeitstage des
 * Partners eintragen (beides nur auf diesem Gerät). Anträge laufen bewusst
 * nicht über den Kalender – er ist Übersicht und Terminkalender, beantragt
 * wird im Schichtplan und unter Urlaub.
 */

const WOCHENTAGE = ["M", "D", "M", "D", "F", "S", "S"];

// Kleine Handys (Bildschirmhöhe bis 700 px, z. B. iPhone SE) bekommen über
// `[@media(max-height:700px)]:` etwas engere Abstände, damit Schicht,
// Partner und Termin auch dort in eine Zelle passen.
const WOCHENTAG_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

/** Farben wie im Schichtplan. */
const FARBE: Record<string, string> = {
  F: "bg-shift-frueh text-shift-frueh-ink",
  S: "bg-shift-spaet text-shift-spaet-ink",
  N: "bg-shift-nacht text-shift-nacht-ink",
  U: "bg-shift-urlaub text-shift-urlaub-ink",
  V: "bg-shift-vtag text-shift-vtag-ink",
  AF: "bg-shift-altersfrei text-shift-altersfrei-ink",
  SU: "bg-shift-sonderurlaub text-shift-sonderurlaub-ink",
  BU: "bg-shift-bildungsurlaub text-shift-bildungsurlaub-ink",
  G: "bg-shift-gewerkschaft text-shift-gewerkschaft-ink",
  K: "bg-shift-krank text-shift-krank-ink",
  FB: "bg-shift-schulung text-shift-schulung-ink",
  A: "bg-surface-sunken text-ink-muted",
};

/** Beantragt: heller Grund mit Rahmen, wie im Schichtplan. */
const FARBE_BEANTRAGT: Record<string, string> = {
  U: "bg-shift-urlaub/40 text-shift-urlaub-ink ring-1 ring-inset ring-shift-urlaub-ink/40",
  V: "bg-shift-vtag/40 text-shift-vtag-ink ring-1 ring-inset ring-shift-vtag-ink/40",
  AF: "bg-shift-altersfrei/15 text-shift-altersfrei-offen ring-1 ring-inset ring-shift-altersfrei-offen/60",
  SU: "bg-shift-sonderurlaub/40 text-shift-sonderurlaub-ink ring-1 ring-inset ring-shift-sonderurlaub-ink/40",
  BU: "bg-shift-bildungsurlaub/40 text-shift-bildungsurlaub-ink ring-1 ring-inset ring-shift-bildungsurlaub-ink/40",
  G: "bg-shift-gewerkschaft/40 text-shift-gewerkschaft-ink ring-1 ring-inset ring-shift-gewerkschaft-ink/40",
};

const FREI = "bg-surface-sunken text-ink-faint";
const SONSTIGE_SCHICHT = "bg-brand-100 text-brand-700";

/** Kurz fürs Kästchen, lang für die Sprechblase. */
const ABWESENHEIT: Record<string, { kurz: string; lang: string }> = {
  U: { kurz: "Urlaub", lang: "Urlaub" },
  V: { kurz: "V-Tag", lang: "V-Tag" },
  AF: { kurz: "AF", lang: "Altersfreizeit" },
  SU: { kurz: "SU", lang: "Sonderurlaub" },
  BU: { kurz: "BU", lang: "Bildungsurlaub" },
  G: { kurz: "Gew.", lang: "Gewerkschaftstag" },
  K: { kurz: "Krank", lang: "Krank" },
  FB: { kurz: "Schul.", lang: "Schulung" },
  A: { kurz: "Abw.", lang: "Abwesend" },
};

/** "Frühschicht" -> "Früh", "Tagschicht" -> "Tag". */
function schichtKurz(name: string): string {
  const kurz = name.replace(/schicht$/i, "").trim();
  return kurz || name;
}

/** Stunden zwischen zwei Uhrzeiten, über Mitternacht hinweg. */
function stunden(von: string, bis: string): string | null {
  if (!von || !bis) return null;
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  if ([vh, vm, bh, bm].some((n) => n === undefined || Number.isNaN(n))) return null;
  let minuten = bh! * 60 + bm! - (vh! * 60 + vm!);
  if (minuten <= 0) minuten += 24 * 60;
  const h = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`;
}

interface TagInfo {
  /** Kürzel der Schicht (F, S, N, T …) oder null bei frei. */
  schichtCode: string | null;
  schichtName: string | null;
  /** Abwesenheit groß (genehmigt/eingetragen) oder klein (beantragt). */
  abwesenheit: string | null;
}

function tagInfo(zelle: LiveShiftPlanCell | undefined): TagInfo {
  return {
    schichtCode: zelle?.shiftCode ?? null,
    schichtName: zelle?.shiftName ?? null,
    abwesenheit: zelle?.absenceCode ?? null,
  };
}

/** Erster Tag des Rasters (Montag) und Zahl der Wochen eines Monats. */
function raster(jahr: number, monat: number) {
  const erster = new Date(jahr, monat, 1);
  const versatz = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const wochen = Math.ceil((versatz + tage) / 7);
  return { start: toISO(new Date(jahr, monat, 1 - versatz)), wochen };
}

interface Stand {
  /** Für welchen Ausschnitt dieser Stand gilt. */
  schluessel: string;
  tage: Map<string, LiveShiftPlanCell>;
  /** Steht die eigene Person überhaupt im Plan? */
  imPlan: boolean;
  /** Arbeitstage des Partners in diesem Ausschnitt. */
  partner: Record<string, PartnerSchicht>;
}

export function MeinKalender() {
  const t = useBegriffe();
  const { profile, company } = useSession();
  const heute = heuteInBerlin();
  // Gesetzliche Feiertage des Betriebs: im Monat nur gefärbt, der Name steht in der Sprechblase.
  const [feiertage, setFeiertage] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let ab = false;
    fetchHolidays()
      .then((liste) => {
        if (!ab) setFeiertage(new Map(liste.map((h) => [h.date, h.name])));
      })
      .catch(() => {
        // Ohne Feiertage fehlt nur die Färbung.
      });
    return () => {
      ab = true;
    };
  }, []);
  const [monat, setMonat] = useState(() => {
    const d = fromISO(heute);
    return { jahr: d.getFullYear(), monat: d.getMonth() };
  });
  const { start, wochen } = raster(monat.jahr, monat.monat);
  const tageImRaster = wochen * 7;

  const schluessel = useCallback(
    (s: string, n: number) => `${profile.id}:kalender:${company.id}:${s}:${n}`,
    [profile.id, company.id],
  );

  const [stand, setStand] = useState<Stand | null>(
    () => ausZwischenspeicher<Stand>(schluessel(start, tageImRaster)) ?? null,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const online = useOnline();
  const [schichten, setSchichten] = useState<ShiftDetail[]>([]);
  const ladeNr = useRef(0);

  const holen = useCallback(
    async (s: string, n: number): Promise<Stand> => {
      // Die Partnertage sind Beiwerk: fehlen sie, steht der Kalender trotzdem.
      const [zellen, partner] = await Promise.all([
        fetchShiftPlanGrid(company.id, s, n),
        fetchMeinePartnerTage(s, addDays(s, n - 1)).catch(() => ({})),
      ]);
      const tage = new Map<string, LiveShiftPlanCell>();
      for (const z of zellen) if (z.isMe) tage.set(z.day, z);
      const ergebnis: Stand = { schluessel: schluessel(s, n), tage, imPlan: tage.size > 0, partner };
      inZwischenspeicher(schluessel(s, n), ergebnis);
      merkeEigeneTage(schluessel(s, n), tage, tage.size > 0);
      return ergebnis;
    },
    [company.id, schluessel],
  );

  const laden = useCallback(async () => {
    const nr = ++ladeNr.current;
    const s = start;
    const n = tageImRaster;
    const gespeichert = ausZwischenspeicher<Stand>(schluessel(s, n));
    if (gespeichert) setStand(gespeichert);
    else {
      // Gleich nach dem Öffnen der App: der letzte Stand vom Gerät (ohne Partner), bis die frischen Daten da sind.
      const vomGeraet = holeEigeneTage(schluessel(s, n));
      if (vomGeraet) setStand({ schluessel: schluessel(s, n), ...vomGeraet, partner: {} });
    }
    // Eine kurze Störung soll nicht gleich als Fehler auf dem Schirm landen:
    // einmal still nachfassen, dann erst melden.
    for (let versuch = 0; versuch < 2; versuch++) {
      try {
        const neu = await holen(s, n);
        if (nr !== ladeNr.current) return;
        setStand(neu);
        setFehler(null);
        // Nachbarmonate vorab holen, damit das Wischen sofort etwas zeigt.
        const d = fromISO(addDays(s, 10));
        for (const schritt of [-1, 1]) {
          const r = raster(d.getFullYear(), d.getMonth() + schritt);
          if (!ausZwischenspeicher(schluessel(r.start, r.wochen * 7))) {
            void holen(r.start, r.wochen * 7).catch(() => undefined);
          }
        }
        return;
      } catch (err) {
        if (versuch === 0) {
          await new Promise((ok) => setTimeout(ok, 1500));
          if (nr !== ladeNr.current) return;
          continue;
        }
        if (nr !== ladeNr.current) return;
        // Ohne Netz: der gemerkte Stand bleibt stehen, statt Fehler ein Hinweis (Banner).
        if (istOffline()) return;
        setFehler(
          err instanceof DataError || err instanceof Error
            ? err.message
            : "Der Kalender konnte nicht geladen werden.",
        );
      }
    }
  }, [start, tageImRaster, schluessel, holen]);

  useEffect(() => {
    // Laden beim Monatswechsel – der Zustand kommt aus dem Netz, nicht aus React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void laden();
  }, [laden]);

  useAktualisierung(["plan", "abwesenheiten", "antraege"], () => void laden());

  // Der Partner trägt auf seinem Handy ein – beim Zurückkehren in die App
  // frisch holen, damit seine Tage ohne Neuladen erscheinen.
  useEffect(() => {
    let zuletzt = 0;
    const auffrischen = () => {
      if (document.visibilityState !== "visible" || Date.now() - zuletzt < 15_000) return;
      zuletzt = Date.now();
      void laden();
    };
    document.addEventListener("visibilitychange", auffrischen);
    window.addEventListener("focus", auffrischen);
    return () => {
      document.removeEventListener("visibilitychange", auffrischen);
      window.removeEventListener("focus", auffrischen);
    };
  }, [laden]);

  // Was der Partner auf seinem Handy einträgt, soll ohne Neuladen
  // erscheinen: jede Minute – nur solange der Kalender sichtbar ist –
  // die Partnertage des angezeigten Monats frisch holen. Bewusst nicht den
  // ganzen Plan: der ändert sich selten und ist die teurere Abfrage.
  useEffect(() => {
    const s = start;
    const n = tageImRaster;
    const k = schluessel(s, n);
    const takt = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const partner = await fetchMeinePartnerTage(s, addDays(s, n - 1));
        setStand((alt) => {
          if (!alt || alt.schluessel !== k) return alt;
          if (JSON.stringify(alt.partner) === JSON.stringify(partner)) return alt;
          const neu = { ...alt, partner };
          inZwischenspeicher(k, neu);
          return neu;
        });
      } catch {
        // nächster Takt
      }
    }, 60_000);
    return () => window.clearInterval(takt);
  }, [start, tageImRaster, schluessel]);

  // Partnertage lagen anfangs nur im Browser – einmal übernehmen.
  useEffect(() => {
    const alt = alteLokalePartnerTage(profile.id);
    if (!alt) return;
    let aus = false;
    void (async () => {
      try {
        for (const [tag, code] of Object.entries(alt)) {
          if (aus) return;
          await setzeMeinePartnerTage(tag, 1, code);
        }
        vergissLokalePartnerTage(profile.id);
        if (!aus) void laden();
      } catch {
        // Beim nächsten Öffnen noch einmal – das Setzen ist wiederholbar.
      }
    })();
    return () => {
      aus = true;
    };
    // Nur einmal beim Öffnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  useEffect(() => {
    let aus = false;
    fetchShiftDetails()
      .then((liste) => !aus && setSchichten(liste))
      .catch(() => undefined);
    return () => {
      aus = true;
    };
  }, []);

  const uhrzeit = useMemo(() => {
    const m = new Map<string, ShiftDetail>();
    for (const s of schichten) m.set(s.name, s);
    return m;
  }, [schichten]);

  // ---- Termine (nur auf diesem Gerät) ---------------------------------
  // In der Datenbank: eigene und die des Partners (0139).
  const [termine, setTermine] = useState<Termin[]>([]);
  const ladeTermine = useCallback(async () => {
    try {
      const neu = await fetchMeineTermine();
      // Nur bei Änderung neu zeichnen – der 20-Sekunden-Takt bringt meist nichts Neues.
      setTermine((alt) => (JSON.stringify(alt) === JSON.stringify(neu) ? alt : neu));
      // Nur die eigenen Termine auf dem Gerät merken – für den Kalender ohne Netz.
      aufGeraet(`${profile.id}:kalender:termine`, neu.filter((t) => !t.vonPartner && !t.inhaber));
    } catch {
      // Termine sind Beiwerk – der Kalender steht auch ohne sie. Ohne Netz: der gemerkte Stand.
      const gemerkt = ausGeraet<Termin[]>(`${profile.id}:kalender:termine`);
      if (gemerkt) setTermine((alt) => (alt.length ? alt : gemerkt));
    }
  }, [profile.id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void ladeTermine();
    // Termine des Partners kommen von seinem Handy – beim Zurückkehren holen.
    const sichtbar = () => {
      if (document.visibilityState === "visible") void ladeTermine();
    };
    document.addEventListener("visibilitychange", sichtbar);
    // Termine des Partners ebenfalls jede Minute, solange sichtbar.
    const takt = window.setInterval(() => {
      if (document.visibilityState === "visible") void ladeTermine();
    }, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", sichtbar);
      window.clearInterval(takt);
    };
  }, [ladeTermine]);
  // Termine lagen anfangs nur im Browser – einmal übernehmen.
  useEffect(() => {
    const alt = alteLokaleTermine(profile.id);
    if (!alt) return;
    let aus = false;
    void (async () => {
      try {
        for (const t of alt) {
          if (aus) return;
          await speichereTermin(t);
        }
        vergissLokaleTermine(profile.id);
        if (!aus) void ladeTermine();
      } catch {
        // beim nächsten Öffnen noch einmal
      }
    })();
    return () => {
      aus = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);
  async function terminSpeichern(t: TerminEingabe) {
    try {
      await speichereTermin(t);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gespeichert werden.");
    }
    void ladeTermine();
  }
  async function terminLoeschen(id: string) {
    try {
      await loescheTermin(id);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Der Termin konnte nicht gelöscht werden.");
    }
    void ladeTermine();
  }
  // ---- Arbeitstage des Partners (Datenbank, nur Inhaber + Partner) -----
  const [partnerZeigen, setPartnerZeigen] = useLokaleEinstellung(
    `schichtplan.partner-zeigen.${profile.id}`,
    true,
  );
  const [einladen, setEinladen] = useState(false);

  // „Neu“ im Menü verschwindet, sobald der Kalender einmal offen war.
  useEffect(() => {
    setzeLokal(neuGesehenSchluessel("kalender-partner"), true);
  }, []);
  // Einführung (drei Fenster) beim ersten Öffnen.
  const einfuehrungLokal = useLokalNachLaden(`schichtplan.kalender-einfuehrung-2.${profile.id}`, false, true);
  // Einmal pro Konto: erst zeigen, wenn feststeht, dass das Konto sie noch nicht kennt.
  const einfuehrungKonto = useEinfuehrungImKonto();
  const einfuehrungGesehen = einfuehrungLokal || !einfuehrungKonto.geladen || einfuehrungKonto.einfuehrungGesehen;
  async function partnerSetzen(von: string, anzahl: number, code: PartnerSchicht | null) {
    try {
      await setzeMeinePartnerTage(von, anzahl, code);
      setFehler(null);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Das konnte nicht gespeichert werden.");
    }
    void laden();
  }

  // ---- Auswahl, Sprechblase, Blätter ------------------------------------
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [blase, setBlase] = useState<{ oben: number; pfeil: number; unten: boolean } | null>(null);
  const [terminBlatt, setTerminBlatt] = useState<{ datum: string; termin: Termin | null } | null>(null);
  const [partnerBlatt, setPartnerBlatt] = useState<string | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);

  // Auf dem Handy steht der Kalender fest – die Seite dahinter soll nicht
  // mitscrollen (sonst zieht der Finger beim Wischen den Rahmen mit).
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const html = document.documentElement;
    const vorher = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = vorher.html;
      document.body.style.overflow = vorher.body;
    };
  }, []);
  const blaseRef = useRef<HTMLDivElement>(null);
  const gewischt = useRef(false);
  const blaseZelle = useRef<{ oben: number; unten: number } | null>(null);

  function springe(schritt: number) {
    setGewaehlt(null);
    setBlase(null);
    setMonat((m) => {
      const d = new Date(m.jahr, m.monat + schritt, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });
  }

  function zuHeute() {
    const d = fromISO(heute);
    setGewaehlt(null);
    setBlase(null);
    setMonat({ jahr: d.getFullYear(), monat: d.getMonth() });
  }

  // Wischen links/rechts wechselt den Monat.
  const wisch = useRef<{ x: number; y: number } | null>(null);
  function wischStart(e: React.PointerEvent) {
    gewischt.current = false;
    wisch.current = { x: e.clientX, y: e.clientY };
  }
  function wischEnde(e: React.PointerEvent) {
    const s = wisch.current;
    wisch.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      gewischt.current = true;
      springe(dx < 0 ? 1 : -1);
    }
  }

  function tagAntippen(iso: string, knopf: HTMLElement) {
    if (gewischt.current) {
      gewischt.current = false;
      return;
    }
    setGewaehlt(iso);
    const box = flaeche.current?.getBoundingClientRect();
    const zelle = knopf.getBoundingClientRect();
    if (!box) return;
    setBlase({
      // Erst unterhalb messen; die Lage über dem Tag folgt im Effekt unten,
      // sobald die Höhe der Blase bekannt ist.
      oben: zelle.bottom - box.top + 12,
      pfeil: Math.max(28, Math.min(box.width - 28, zelle.left - box.left + zelle.width / 2)),
      unten: true,
    });
    blaseZelle.current = { oben: zelle.top - box.top, unten: zelle.bottom - box.top };
  }

  // Unter dem Tag, wenn sie dort ganz zu sehen ist – sonst darüber. Gemessen
  // wird am sichtbaren Bildschirm, nicht an der Fläche: die kann unten
  // hinter der Navigation weiterlaufen.
  useEffect(() => {
    if (!blase || !blaseRef.current || !blaseZelle.current || !flaeche.current) return;
    const hoehe = blaseRef.current.offsetHeight;
    const box = flaeche.current.getBoundingClientRect();
    const navigation = window.innerWidth >= 1024 ? 0 : 72;
    const sichtOben = Math.max(box.top, 0);
    const sichtUnten = Math.min(box.bottom, window.innerHeight - navigation);
    const zOben = box.top + blaseZelle.current.oben;
    const zUnten = box.top + blaseZelle.current.unten;
    const platzUnten = sichtUnten - (zUnten + 12);
    const platzOben = zOben - 12 - sichtOben;
    let neu: { oben: number; unten: boolean };
    if (platzUnten >= hoehe || platzUnten >= platzOben) {
      const vp = Math.max(sichtOben, Math.min(zUnten + 12, sichtUnten - hoehe));
      neu = { oben: Math.round(vp - box.top), unten: true };
    } else {
      const vp = Math.max(sichtOben, zOben - 12 - hoehe);
      neu = { oben: Math.round(vp - box.top), unten: false };
    }
    if (neu.oben !== blase.oben || neu.unten !== blase.unten) {
      setBlase({ ...blase, ...neu });
    }
  }, [blase, termine]);

  function blaseZu() {
    setGewaehlt(null);
    setBlase(null);
  }

  // ---- Darstellung ------------------------------------------------------
  const tage = useMemo(
    () => Array.from({ length: tageImRaster }, (_, i) => addDays(start, i)),
    [start, tageImRaster],
  );
  // Nur den Stand des angezeigten Monats zeigen – beim Blättern sonst kurz
  // die Tage des vorigen Monats unter neuen Daten.
  const aktuellerSchluessel = schluessel(start, tageImRaster);
  const sichtbar =
    stand?.schluessel === aktuellerSchluessel
      ? stand
      : (ausZwischenspeicher<Stand>(aktuellerSchluessel) ?? null);
  const zellen = sichtbar?.tage ?? new Map<string, LiveShiftPlanCell>();
  const partnerTage = sichtbar?.partner ?? {};
  const imMonat = (iso: string) => fromISO(iso).getMonth() === monat.monat;
  const istAktuellerMonat = (() => {
    const d = fromISO(heute);
    return d.getFullYear() === monat.jahr && d.getMonth() === monat.monat;
  })();

  function kaestchen(info: TagInfo) {
    const liste: { text: string; klasse: string }[] = [];
    const abw = info.abwesenheit;
    const gross = abw?.toUpperCase() ?? null;
    const beantragt = abw !== null && abw !== gross;
    if (abw && !beantragt) {
      liste.push({ text: t(ABWESENHEIT[abw]?.kurz ?? abw), klasse: FARBE[abw] ?? FARBE.A! });
      return liste;
    }
    if (info.schichtName) {
      liste.push({
        text: schichtKurz(info.schichtName),
        klasse: (info.schichtCode && FARBE[info.schichtCode]) || SONSTIGE_SCHICHT,
      });
    } else {
      liste.push({ text: "Frei", klasse: FREI });
    }
    if (abw && beantragt && gross) {
      liste.push({
        text: `${t(ABWESENHEIT[gross]?.kurz ?? gross)}?`,
        klasse: FARBE_BEANTRAGT[gross] ?? FARBE_BEANTRAGT.U!,
      });
    }
    return liste;
  }

  const gewaehltInfo = gewaehlt ? tagInfo(zellen.get(gewaehlt)) : null;
  const gewaehltTermine = gewaehlt ? termineAm(termine, gewaehlt) : [];

  return (
    <div
      className={cn(
        // Handy: genau ein Bildschirm, fest zwischen Kopfleiste (4rem) und
        // Navigation unten. Nichts scrollt, nichts schiebt den Kalender weg
        // – auch nicht der Installationshinweis darüber. Ab Desktop steht
        // er normal im Seitenrahmen.
        "fixed inset-x-0 top-16 bottom-[calc(3.85rem+env(safe-area-inset-bottom))] z-10 flex flex-col bg-surface-muted",
        "lg:static lg:z-auto lg:h-[calc(100dvh-7rem)] lg:min-h-[520px]",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3 sm:px-6 lg:px-0 [@media(max-height:700px)]:pb-1 [@media(max-height:700px)]:pt-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight sm:text-[32px] [@media(max-height:700px)]:text-[25px]">
              {monthName(monat.monat)}
            </h1>
            {/* Partnertage ein- und ausblenden – gemerkt auf diesem Gerät. */}
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1 text-[12px] font-semibold text-ink-muted">
              <input
                type="checkbox"
                checked={partnerZeigen}
                onChange={(e) => setPartnerZeigen(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand-500"
              />
              Partner
            </label>
          </div>
          <p className="tnum text-[13px] font-medium text-ink-muted">
            {monat.jahr}
            {!istAktuellerMonat ? (
              <>
                {" · "}
                <button type="button" onClick={zuHeute} className="font-semibold text-brand-600">
                  Heute
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEinladen(true)}
            aria-label="Partner einladen"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-brand-600 ring-1 ring-inset ring-line"
          >
            <UserPlus className="h-[18px] w-[18px]" />
          </button>
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

      {!online ? (
        <div role="status" className="mx-4 mb-2 sm:mx-6 lg:mx-0 flex items-center gap-2 rounded-xl bg-warn-bg/70 px-3 py-2 text-[13px] leading-snug text-warn-fg">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline – du siehst deinen zuletzt geladenen Kalender. Alles andere braucht Netz.</span>
        </div>
      ) : null}
      {fehler ? (
        <div className="px-4 pb-2 sm:px-6 lg:px-0">
          <Alert tone="error">{fehler}</Alert>
          <button
            type="button"
            className="mt-1 text-[13px] font-semibold text-brand-600 underline"
            onClick={() => void laden()}
          >
            Erneut versuchen
          </button>
        </div>
      ) : null}
      {sichtbar && !sichtbar.imPlan ? (
        <p className="px-4 pb-2 text-[13px] text-ink-muted sm:px-6 lg:px-0">
          Für dein Konto ist im Schichtplan keine Person hinterlegt – deshalb bleibt der Kalender leer.
        </p>
      ) : null}

      <div
        ref={flaeche}
        className="relative grid min-h-0 flex-1 touch-pan-y select-none grid-cols-7 overflow-hidden bg-surface lg:rounded-2xl lg:border lg:border-line"
        style={{ gridTemplateRows: `auto repeat(${wochen}, minmax(0, 1fr))` }}
        onPointerDown={wischStart}
        onPointerUp={wischEnde}
        onPointerCancel={() => (wisch.current = null)}
        aria-busy={!sichtbar}
      >
        {WOCHENTAGE.map((w, i) => (
          <span
            key={i}
            className="py-1.5 text-center text-[12px] font-semibold text-ink-faint"
            aria-hidden
          >
            {w}
          </span>
        ))}
        {tage.map((iso, i) => {
          const info = tagInfo(zellen.get(iso));
          const d = fromISO(iso);
          const imM = imMonat(iso);
          const istHeute = iso === heute;
          const wochenende = i % 7 >= 5;
          const ts = termineAm(termine, iso);
          const partner = partnerZeigen ? (partnerTage[iso] ?? null) : null;
          return (
            <button
              key={iso}
              type="button"
              onClick={(e) => tagAntippen(iso, e.currentTarget)}
              aria-label={`${WOCHENTAG_LANG[d.getDay()]}, ${formatDE(iso)}: ${beschreibung(info, t)}${partner ? `, Partner: ${partnerText(partner, true)}` : ""}${ts.length ? `, ${ts.length} Termin${ts.length === 1 ? "" : "e"}` : ""}`}
              className={cn(
                "flex min-h-0 flex-col items-stretch gap-[3px] overflow-hidden border-t border-line px-[2px] pb-1 pt-1 text-center [@media(max-height:700px)]:gap-[2px] [@media(max-height:700px)]:pt-0.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                i % 7 !== 0 && "border-l",
                wochenende && "bg-surface-muted/70",
                feiertage.has(iso) && "feiertag-zelle",
                istHeute && "bg-ink/[0.07]",
                gewaehlt === iso && "ring-2 ring-inset ring-brand-500",
              )}
            >
              <span className="relative mx-auto shrink-0">
                <span
                  className={cn(
                    "tnum flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[16px] leading-none [@media(max-height:700px)]:h-5 [@media(max-height:700px)]:min-w-5 [@media(max-height:700px)]:text-[14px]",
                    istHeute
                      ? "bg-ink font-bold text-surface"
                      : feiertage.has(iso)
                        ? "font-semibold text-[#e5484d]"
                        : imM
                          ? "font-medium"
                          : "text-ink-faint",
                  )}
                >
                  {d.getDate()}
                </span>
                {/* Kleine Handys: statt der Terminzeilen ein Punkt je Termin an der Zahl. */}
                {ts.length ? (
                  <span aria-hidden className="absolute -right-2 top-0 hidden gap-px [@media(max-height:700px)]:flex">
                    {ts.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className={cn("h-1.5 w-1.5 rounded-full", t.vonPartner ? "bg-brand-500" : "bg-ink-muted")}
                      />
                    ))}
                  </span>
                ) : null}
              </span>
              {sichtbar
                ? kaestchen(info).map((k, j) => (
                    <span
                      key={j}
                      className={cn(
                        "shrink-0 truncate rounded-md px-0.5 py-[3px] text-[12.5px] font-medium leading-tight [@media(max-height:700px)]:py-[2px] [@media(max-height:700px)]:text-[12px]",
                        k.klasse,
                        !imM && "opacity-45",
                      )}
                    >
                      {k.text}
                    </span>
                  ))
                : (
                    <span className="h-5 animate-pulse rounded-md bg-surface-sunken" />
                  )}
              {partner ? (
                // Partner: nur Umriss – gefüllt sind die eigenen Schichten.
                <span
                  className={cn(
                    "shrink-0 truncate rounded-md px-0.5 py-px text-[11px] font-semibold leading-tight ring-[1.5px] ring-inset",
                    PARTNER_FARBE[partner],
                    !imM && "opacity-45",
                  )}
                >
                  {partnerText(partner)}
                </span>
              ) : null}
              {/* Termine: so viele Zeilen, wie in die Zelle passen – der Rest
                  wird abgeschnitten, alle stehen in der Sprechblase. */}
              {ts.map((t, j) => (
                <span
                  key={t.id}
                  className={cn(
                    "shrink-0 truncate text-left text-[11px] leading-tight text-ink-muted [@media(max-height:700px)]:hidden",
                    !imM && "opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "mr-0.5 inline-block h-1.5 w-1.5 rounded-full align-middle",
                      t.vonPartner ? "bg-brand-500" : "bg-ink-faint",
                    )}
                  />
                  {t.titel || "Termin"}
                  {j === 2 && ts.length > 3 ? ` +${ts.length - 3}` : ""}
                </span>
              )).slice(0, 3)}
            </button>
          );
        })}

        {gewaehlt && blase && gewaehltInfo ? (
          <>
            {/* Tipp daneben schließt die Blase. */}
            <button
              type="button"
              aria-label="Schließen"
              className="fixed inset-0 z-40 cursor-default"
              onClick={blaseZu}
            />
            <div
              ref={blaseRef}
              role="dialog"
              aria-label={formatDE(gewaehlt)}
              className="absolute inset-x-2 z-50 rounded-3xl border border-line bg-surface px-4 pb-1 pt-3 shadow-pop"
              style={{ top: blase.oben }}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute h-4 w-4 -translate-x-1/2 rotate-45 border-line bg-surface",
                  blase.unten ? "-top-2 border-l border-t" : "-bottom-2 border-b border-r",
                )}
                style={{ left: blase.pfeil - 8 }}
              />
              <Sprechblase
                iso={gewaehlt}
                feiertag={feiertage.get(gewaehlt)}
                info={gewaehltInfo}
                schicht={gewaehltInfo.schichtName ? uhrzeit.get(gewaehltInfo.schichtName) : undefined}
                termine={gewaehltTermine}
                partner={partnerZeigen ? (partnerTage[gewaehlt] ?? null) : null}
                onTermin={(t) => {
                  setTerminBlatt({ datum: gewaehlt, termin: t });
                  blaseZu();
                }}
                onPartner={() => {
                  setPartnerBlatt(gewaehlt);
                  blaseZu();
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      {terminBlatt ? (
        <TerminBlatt
          datum={terminBlatt.datum}
          termin={terminBlatt.termin}
          hinweis={
            terminBlatt.termin?.vonPartner
              ? "Von deinem Partner eingetragen. Ihr seht ihn beide."
              : "Dein Partner sieht deine Termine nur, wenn du sie beim Teilen freigibst."
          }
          onSpeichern={(t) => {
            void terminSpeichern(t);
            setTerminBlatt(null);
          }}
          onLoeschen={(id) => {
            void terminLoeschen(id);
            setTerminBlatt(null);
          }}
          onClose={() => setTerminBlatt(null)}
        />
      ) : null}

      {partnerBlatt ? (
        <PartnerBlatt
          datum={partnerBlatt}
          aktuell={partnerTage[partnerBlatt] ?? null}
          hinweis="Das siehst nur du – und dein Partner, wenn du ihn einlädst."
          onWahl={(code, anzahl) => {
            if (!partnerZeigen) setPartnerZeigen(true);
            void partnerSetzen(partnerBlatt, anzahl, code);
            setPartnerBlatt(null);
          }}
          onClose={() => setPartnerBlatt(null)}
          onEinladen={() => {
            setPartnerBlatt(null);
            setEinladen(true);
          }}
        />
      ) : null}

      {einladen ? <KalenderTeilen vorname={profile.firstName} onClose={() => setEinladen(false)} /> : null}

      {!einfuehrungGesehen ? (
        <KalenderEinfuehrung
          onFertig={() => {
            setzeLokal(`schichtplan.kalender-einfuehrung-2.${profile.id}`, true);
            void setzeEinfuehrungGesehen();
          }}
        />
      ) : null}

    </div>
  );
}

function beschreibung(info: TagInfo, t: (text: string) => string): string {
  const abw = info.abwesenheit;
  if (abw && abw === abw.toUpperCase()) return t(ABWESENHEIT[abw]?.lang ?? "Abwesend");
  const teil = info.schichtName ?? "Frei";
  if (abw) return `${teil}, ${t(ABWESENHEIT[abw.toUpperCase()]?.lang ?? "Antrag")} beantragt`;
  return teil;
}

function Sprechblase({
  iso,
  feiertag,
  info,
  schicht,
  termine,
  partner,
  onTermin,
  onPartner,
}: {
  iso: string;
  /** Name des Feiertags – steht nur hier, im Monat ist der Tag nur gefärbt. */
  feiertag?: string;
  info: TagInfo;
  schicht: ShiftDetail | undefined;
  termine: Termin[];
  partner: PartnerSchicht | null;
  onTermin: (t: Termin | null) => void;
  onPartner: () => void;
}) {
  const t = useBegriffe();
  const d = fromISO(iso);
  const abw = info.abwesenheit;
  const gross = abw?.toUpperCase() ?? null;
  const beantragt = abw !== null && abw !== gross;

  let titel: string;
  let unterzeile: string | null = null;
  let farbe: string;
  let zeichen: string;
  let dauer: string | null = null;

  if (abw && !beantragt) {
    titel = t(ABWESENHEIT[abw]?.lang ?? "Abwesend");
    farbe = FARBE[abw] ?? FARBE.A!;
    zeichen = abw.slice(0, 2);
    if (info.schichtName) unterzeile = `statt ${info.schichtName}`;
  } else if (info.schichtName) {
    titel = info.schichtName;
    farbe = (info.schichtCode && FARBE[info.schichtCode]) || SONSTIGE_SCHICHT;
    zeichen = info.schichtCode ?? info.schichtName.slice(0, 1);
    if (schicht?.startTime && schicht.endTime) {
      unterzeile = `${schicht.startTime} – ${schicht.endTime} Uhr`;
      dauer = stunden(schicht.startTime, schicht.endTime);
    }
  } else {
    titel = "Frei";
    farbe = FREI;
    zeichen = "–";
  }

  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {WOCHENTAG_LANG[d.getDay()]}, {formatDE(iso)}
      </p>
      {feiertag ? <p className="text-[14px] font-medium text-[#e5484d]">{feiertag}</p> : null}
      <div className="flex items-center gap-3 py-2">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
            farbe,
          )}
          aria-hidden
        >
          {zeichen}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-semibold leading-tight">{titel}</p>
          {unterzeile ? <p className="tnum text-[14px] text-ink-muted">{unterzeile}</p> : null}
        </div>
        {dauer ? <span className="tnum shrink-0 self-start text-[14px] text-ink-muted">{dauer}</span> : null}
      </div>
      {beantragt && gross ? (
        <p className="pb-2 text-[13px] text-ink-muted">
          {t(ABWESENHEIT[gross]?.lang ?? "Antrag")} beantragt – noch nicht genehmigt.
        </p>
      ) : null}

      {partner ? (
        <button
          type="button"
          onClick={onPartner}
          className="flex w-full items-center gap-3 border-t border-line py-2.5 text-left text-[15px]"
        >
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[13px] font-semibold ring-[1.5px] ring-inset",
              PARTNER_FARBE[partner],
            )}
          >
            {partnerText(partner)}
          </span>
          <span className="text-ink-muted">Partner: {partnerText(partner, true)}</span>
        </button>
      ) : null}

      {termine.length ? (
        <ul className="border-t border-line py-1">
          {termine.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onTermin(t)}
                className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-[15px]"
              >
                <span className="min-w-0 truncate">
                  {t.titel || "Ohne Titel"}
                  {t.vonPartner ? (
                    <span className="ml-1.5 rounded bg-brand-50 px-1 py-px text-[11px] font-semibold text-brand-700">
                      Partner
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

      <div className="-mx-4 grid grid-cols-2 border-t border-line">
        <button
          type="button"
          onClick={() => onTermin(null)}
          className="flex items-center justify-center gap-2 py-3.5 text-[15px] font-semibold text-ink-muted"
        >
          <Plus className="h-5 w-5 text-ink" strokeWidth={2} />
          Termin
        </button>
        <button
          type="button"
          onClick={onPartner}
          className="flex items-center justify-center gap-2 border-l border-line py-3.5 text-[15px] font-semibold text-ink-muted"
        >
          <Plus className="h-5 w-5 text-ink" strokeWidth={2} />
          Partner
        </button>
      </div>
    </div>
  );
}
