import { NextResponse, type NextRequest } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { START_COOKIE, START_COOKIE_MAX_AGE, startCookieWert, startPfad } from "@/lib/start-seite";
import { getPrivatKonto } from "@/lib/privat/server";
import { istKonsolenKonto } from "@/lib/auth/konsole";
import { createClient } from "@/lib/supabase/server";

/**
 * Einstieg in die App: schickt jede Person auf ihre gewählte Startseite.
 *
 * Anmeldung, Einladungslink, Startbildschirm-Symbol und die Hauptadresse
 * zeigen alle hierher – so gibt es eine einzige Stelle, die entscheidet.
 * Ohne Anmeldung leitet die Middleware vorher auf /login um; fehlt trotzdem
 * die Sitzung, geht es dorthin zurück.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL("/dashboard", request.url));
  const merke = (antwort: NextResponse, wert: string) => {
    antwort.cookies.set(START_COOKIE, wert, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: START_COOKIE_MAX_AGE,
    });
    return antwort;
  };
  const session = await getAppSession();
  if (!session) {
    // Reines Betreiber-Konto (ohne Betrieb): direkt in die Konsole.
    const { data: anspruch } = await (await createClient()).auth.getClaims();
    const userId = anspruch?.claims?.sub;
    if (userId && (await istKonsolenKonto(userId))) {
      const antwort = NextResponse.redirect(new URL("/plattform", request.url));
      antwort.headers.set("Cache-Control", "no-store");
      return merke(antwort, startCookieWert(userId, "konsole"));
    }
    // Privatkonto (ohne Firma): eigener Bereich.
    const privat = await getPrivatKonto();
    if (privat) return merke(NextResponse.redirect(new URL("/privat", request.url)), startCookieWert(privat.userId, "privat"));
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const ziel = new URL(startPfad(session.profile.startSeite), request.url);
  const antwort = NextResponse.redirect(ziel);
  antwort.headers.set("Cache-Control", "no-store");
  return merke(antwort, startCookieWert(session.profile.id, session.profile.startSeite ?? null));
}
