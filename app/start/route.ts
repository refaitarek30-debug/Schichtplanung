import { NextResponse, type NextRequest } from "next/server";
import { getAppSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { startPfad } from "@/lib/start-seite";
import { getPrivatKonto } from "@/lib/privat/server";

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
  const session = await getAppSession();
  if (!session) {
    // Privatkonto (ohne Firma): eigener Bereich.
    if (await getPrivatKonto()) return NextResponse.redirect(new URL("/privat", request.url));
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const ziel = new URL(startPfad(session.profile.startSeite), request.url);
  const antwort = NextResponse.redirect(ziel);
  antwort.headers.set("Cache-Control", "no-store");
  return antwort;
}
