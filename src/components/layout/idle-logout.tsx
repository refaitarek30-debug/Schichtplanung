"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE, FRIST_COOKIE } from "@/lib/auth/idle";
import { melde } from "@/lib/protokoll-melden";

/** Wie oft geprüft wird. Gemessen wird an Zeitstempeln, nicht am Takt. */
const PRUEF_INTERVALL_MS = 30_000;

/** So oft höchstens ins Cookie schreiben – es ist nur ein grobes Raster. */
const COOKIE_SCHREIB_ABSTAND_MS = 20_000;

const AKTIVITAET = ["pointerdown", "keydown", "scroll", "focus"] as const;

/** Die Frist dieser Person für die Middleware (siehe idle.ts). */
function schreibeFrist(fristMs: number) {
  const sicher = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie =
    `${FRIST_COOKIE}=${fristMs}; path=/; max-age=${ACTIVITY_COOKIE_MAX_AGE}; samesite=lax` + sicher;
}

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
 * Meldet nach Ablauf der Frist ohne Aktivität ab (je nach Rolle, siehe
 * idle.ts).
 *
 * Die Middleware prüft dasselbe bei jedem Seitenaufruf – die hier ist für den
 * Fall, dass die Seite einfach offen liegen bleibt und gar kein Aufruf mehr
 * kommt. Beide teilen sich den Zeitstempel im Cookie, deshalb hält auch ein
 * zweiter Tab, in dem gearbeitet wird, diesen Tab angemeldet.
 */
export function IdleLogout({ fristMs }: { fristMs: number }) {
  useEffect(() => {
    schreibeFrist(fristMs);
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
      if (Date.now() - letzteAktivitaet <= fristMs) return;

      abgemeldet = true;
      // Erst ins Protokoll (solange die Sitzung noch gilt), dann abmelden –
      // höchstens 3 s warten, die Abmeldung geht vor.
      void Promise.race([
        melde("abmeldung.inaktiv", null),
        new Promise((fertig) => window.setTimeout(fertig, 3_000)),
      ])
        .then(() => createClient().auth.signOut())
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
  }, [fristMs]);

  return null;
}
