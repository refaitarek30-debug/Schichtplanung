"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Termin, TerminEingabe } from "@/lib/data/partner";

/**
 * Termine ohne Netz anlegen und später hochladen.
 *
 * Nur neue, eigene Termine: Ändern oder Löschen bestehender Termine und
 * Einträge bei Verbundenen braucht weiter Netz. Die wartenden Termine liegen
 * im lokalen Speicher dieses Geräts (mit der Benutzer-Kennung im Schlüssel)
 * und gehen hoch, sobald wieder Netz da ist. Eigener Schlüssel (nicht
 * sp_geraet:), damit sie nie wie ein alter Zwischenstand verdrängt werden;
 * beim Abmelden löscht leereZwischenspeicher() sie mit.
 */

const PRAEFIX = "offline:";
export const OFFLINE_TERMINE_PRAEFIX = "sp_offline_termine:";
const schluessel = (benutzer: string) => `${OFFLINE_TERMINE_PRAEFIX}${benutzer}`;
const ohneMarke = (titel: string) => titel.replace(/^⏳\s*/, "");

interface Wartend {
  id: string;
  eingabe: TerminEingabe;
  t: number;
}

function lesen(benutzer: string): Wartend[] {
  try {
    const roh = window.localStorage.getItem(schluessel(benutzer));
    if (!roh) return [];
    const daten = JSON.parse(roh) as { t?: number; w?: Wartend[] };
    return Array.isArray(daten?.w) ? daten.w : [];
  } catch {
    return [];
  }
}

function schreiben(benutzer: string, liste: Wartend[]) {
  try {
    if (liste.length) window.localStorage.setItem(schluessel(benutzer), JSON.stringify({ t: Date.now(), w: liste }));
    else window.localStorage.removeItem(schluessel(benutzer));
  } catch {
    // Speicher voll oder gesperrt – dann geht es nur mit Netz.
  }
}

/** Ein Termin, der noch auf das Hochladen wartet? */
export const istWartend = (t: { id: string | null } | null | undefined) => !!t?.id?.startsWith(PRAEFIX);

/**
 * Wartende Termine verwalten. `speichern` lädt einen Termin hoch,
 * `fertig` läuft, wenn etwas hochgeladen wurde (z. B. Termine neu laden).
 */
export function useOfflineTermine(
  benutzer: string,
  speichern: (t: TerminEingabe) => Promise<unknown>,
  fertig: () => void,
) {
  const [liste, setListe] = useState<Wartend[]>([]);
  const laeuft = useRef(false);
  const aktuell = useRef({ speichern, fertig });
  useEffect(() => {
    aktuell.current = { speichern, fertig };
  });

  const setzen = useCallback(
    (neu: Wartend[]) => {
      schreiben(benutzer, neu);
      setListe(neu);
    },
    [benutzer],
  );

  const hochladen = useCallback(async () => {
    if (laeuft.current || !navigator.onLine) return;
    const offen = lesen(benutzer);
    if (!offen.length) return;
    laeuft.current = true;
    let hoch = 0;
    try {
      for (const w of offen) {
        try {
          // Hängt die Verbindung, nicht ewig warten – sonst blockiert die Warteschlange.
          await Promise.race([
            aktuell.current.speichern({ ...w.eingabe, id: null }),
            new Promise((_, nein) => setTimeout(() => nein(new Error("Zeit abgelaufen")), 20_000)),
          ]);
          hoch++;
          // Sofort austragen, damit nichts doppelt hochgeht.
          setzen(lesen(benutzer).filter((x) => x.id !== w.id));
        } catch {
          // Hat nicht geklappt (z. B. Netz wieder weg) – beim nächsten Mal weiter.
          break;
        }
      }
    } finally {
      laeuft.current = false;
      if (hoch) aktuell.current.fertig();
    }
  }, [benutzer, setzen]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListe(lesen(benutzer));
    void hochladen();
    const wiederDa = () => void hochladen();
    window.addEventListener("online", wiederDa);
    return () => window.removeEventListener("online", wiederDa);
  }, [benutzer, hochladen]);

  // Wackliges Netz: solange etwas wartet, alle 30 s neu versuchen (nur sichtbar).
  const wartet = liste.length > 0;
  useEffect(() => {
    if (!wartet) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void hochladen();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [wartet, hochladen]);

  /** Neuen Termin merken – oder einen wartenden ändern. */
  const merken = useCallback(
    (eingabe: TerminEingabe, alt?: { id: string } | null) => {
      const jetzt = lesen(benutzer);
      const sauber: TerminEingabe = { ...eingabe, id: null, titel: ohneMarke(eingabe.titel) };
      if (alt && istWartend(alt)) {
        setzen(jetzt.map((w) => (w.id === alt.id ? { ...w, eingabe: sauber } : w)));
      } else {
        setzen([...jetzt, { id: `${PRAEFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, eingabe: sauber, t: Date.now() }]);
      }
      void hochladen();
    },
    [benutzer, setzen, hochladen],
  );

  const entfernen = useCallback(
    (id: string) => setzen(lesen(benutzer).filter((w) => w.id !== id)),
    [benutzer, setzen],
  );

  /** Zum Anzeigen im Kalender – der Titel zeigt, dass er noch wartet. */
  const termine: Termin[] = useMemo(
    () =>
      liste.map((w) => ({
        ...w.eingabe,
        id: w.id,
        vonPartner: false,
        titel: `⏳ ${w.eingabe.titel}`,
      })),
    [liste],
  );

  return { termine, merken, entfernen, anzahl: liste.length };
}
