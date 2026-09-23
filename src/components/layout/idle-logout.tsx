"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE, IDLE_TIMEOUT_MS } from "@/lib/auth/idle";

/** Wie oft geprüft wird. Gemessen wird an Zeitstempeln, nicht am Takt. */
const PRUEF_INTERVALL_MS = 30_000;

/** So oft höchstens ins Cookie schreiben – es ist nur ein grobes Raster. */
const COOKIE_SCHREIB_ABSTAND_MS = 20_000;

const AKTIVITAET = ["pointerdown", "keydown", "scroll", "focus"] as const;

function schreibeCookie(zeit: number) {
  const sicher = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie =
    `${ACTIVITY_COOKIE}=${zeit}; path=/; max-age=${ACTIVITY_COOKIE_MAX_AGE}; samesite=lax` +
    sicher;
}

function liesCookie(): number {
  const treffer = document.cookie.match(new RegExp(`(?:^|; )${ACTIVITY_COOKIE}=(\\d+)`));
  return treffer ? Number(treffer[1]) : 0;
}

/**
 * Meldet nach 10 Minuten ohne Aktivität ab.
 *
 * Die Middleware prüft dasselbe bei jedem Seitenaufruf – die hier ist für den
 * Fall, dass die Seite einfach offen liegen bleibt und gar kein Aufruf mehr
 * kommt. Beide teilen sich den Zeitstempel im Cookie, deshalb hält auch ein
 * zweiter Tab, in dem gearbeitet wird, diesen Tab angemeldet.
 */
export function IdleLogout() {
  useEffect(() => {
    let letzteAktivitaet = Date.now();
    let zuletztGeschrieben = 0;
    let abgemeldet = false;

    const merken = () => {
      letzteAktivitaet = Date.now();
      if (letzteAktivitaet - zuletztGeschrieben < COOKIE_SCHREIB_ABSTAND_MS) return;
      zuletztGeschrieben = letzteAktivitaet;
      schreibeCookie(letzteAktivitaet);
    };

    const pruefen = () => {
      if (abgemeldet) return;
      // Ein anderer Tab kann jünger sein – dann zählt dessen Aktivität.
      letzteAktivitaet = Math.max(letzteAktivitaet, liesCookie());
      if (Date.now() - letzteAktivitaet <= IDLE_TIMEOUT_MS) return;

      abgemeldet = true;
      void createClient()
        .auth.signOut()
        .finally(() => {
          window.location.replace("/login?fehler=inaktiv");
        });
    };

    merken();
    for (const ereignis of AKTIVITAET) {
      window.addEventListener(ereignis, merken, { passive: true });
    }

    // Beim Zurückkommen sofort prüfen: in ausgeblendeten Tabs werden Timer
    // gedrosselt, die Zeit läuft aber trotzdem weiter.
    const beiSichtbarkeit = () => {
      if (document.visibilityState !== "visible") return;
      pruefen();
      if (!abgemeldet) merken();
    };
    document.addEventListener("visibilitychange", beiSichtbarkeit);

    const takt = window.setInterval(pruefen, PRUEF_INTERVALL_MS);

    return () => {
      for (const ereignis of AKTIVITAET) window.removeEventListener(ereignis, merken);
      document.removeEventListener("visibilitychange", beiSichtbarkeit);
      window.clearInterval(takt);
    };
  }, []);

  return null;
}
