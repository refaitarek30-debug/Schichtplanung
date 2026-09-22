import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieToSet } from "./cookies";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Wie lange auf Supabase gewartet wird, bevor die Anfrage ohne Antwort
 * weiterläuft.
 *
 * Im Normalfall antwortet der Anmeldedienst in unter einer halben Sekunde.
 * Fällt er aus, blockierte hier bisher JEDER Seitenaufruf – auch die
 * Anmeldeseite selbst – bis Cloudflare nach rund 20 Sekunden abbrach. Die
 * App wirkte dann tot, obwohl nur ein Dienst dahinter hing. Fünf Sekunden
 * sind großzügig für den Normalbetrieb und kurz genug, dass eine Störung
 * als Störung erkennbar wird statt als Hänger.
 */
const ANTWORTFRIST_MS = 5_000;

export interface SitzungsErgebnis {
  response: NextResponse;
  user: { id: string } | null;
  /**
   * true, wenn Supabase nicht geantwortet hat. Dann ist `user` null, ohne
   * dass daraus folgt, dass niemand angemeldet ist – der Aufrufer darf
   * daraus also keine Abmeldung ableiten.
   */
  dienstGestoert: boolean;
}

/**
 * Erneuert die Supabase-Session bei jedem Request und liefert den
 * angemeldeten Benutzer zurück. `getUser()` validiert das Token gegen
 * Supabase – im Gegensatz zu `getSession()`, das dem Cookie vertraut.
 *
 * Zwei Dinge halten die Anwendung auch bei einer Störung benutzbar:
 *
 *   * Ohne Supabase-Cookie gibt es keine Sitzung zu prüfen. Der Aufruf
 *     entfällt dann ganz – das spart bei jedem anonymen Zugriff und auf
 *     der Anmeldeseite eine Anfrage an einen Dienst, der ohnehin nichts
 *     zu sagen hätte.
 *   * Antwortet Supabase nicht oder schlägt der Aufruf fehl, wird das
 *     gemeldet statt geworfen. Ein Ausfall darf die Anwendung nicht
 *     mitreißen.
 *
 * An der Sicherheit ändert das nichts: eine unbeantwortete Prüfung gilt
 * weiterhin als „nicht angemeldet". Geschützte Seiten bleiben zu.
 */
export async function updateSession(request: NextRequest): Promise<SitzungsErgebnis> {
  let response = NextResponse.next({ request });

  const hatSitzungsCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  if (!hatSitzungsCookie) {
    return { response, user: null, dienstGestoert: false };
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Sentinel statt Ausnahme: so bleibt unterscheidbar, ob Supabase „niemand
  // ist angemeldet" gesagt hat oder ob es gar nicht geantwortet hat.
  const ZEIT_ABGELAUFEN = Symbol("zeit-abgelaufen");
  let uhr: ReturnType<typeof setTimeout> | undefined;

  try {
    const ergebnis = await Promise.race([
      supabase.auth.getUser(),
      new Promise<typeof ZEIT_ABGELAUFEN>((resolve) => {
        uhr = setTimeout(() => resolve(ZEIT_ABGELAUFEN), ANTWORTFRIST_MS);
      }),
    ]);

    if (ergebnis === ZEIT_ABGELAUFEN) {
      return { response, user: null, dienstGestoert: true };
    }

    // supabase-js wirft bei einem Netzwerkfehler nicht, sondern legt ihn in
    // `error` ab. Ohne diese Auswertung sähe ein Ausfall exakt aus wie
    // „niemand ist angemeldet" -- und genau das führte zur stummen
    // Umleitung auf die Anmeldeseite.
    //
    // `AuthRetryableFetchError` ist die Klasse, die supabase-js selbst für
    // Netzwerkfehler und 5xx verwendet; „keine Sitzung vorhanden" kommt
    // dagegen als AuthSessionMissingError mit Status 400 und ist eine
    // gültige Antwort, kein Ausfall.
    const fehler = ergebnis.error;
    if (fehler) {
      const istAusfall =
        fehler.name === "AuthRetryableFetchError" ||
        (typeof fehler.status === "number" && fehler.status >= 500) ||
        fehler.status === 0 ||
        fehler.status === undefined;
      if (istAusfall) {
        return { response, user: null, dienstGestoert: true };
      }
    }

    return { response, user: ergebnis.data.user, dienstGestoert: false };
  } catch {
    // Netzwerkfehler, 5xx, abgebrochene Verbindung. Der Grund steht in den
    // Supabase-Protokollen; hier zählt nur, dass die Anwendung weiterläuft.
    return { response, user: null, dienstGestoert: true };
  } finally {
    if (uhr) clearTimeout(uhr);
  }
}
