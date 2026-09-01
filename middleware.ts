import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

/** Alles unter diesen Pfaden setzt eine Anmeldung voraus. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/kalender",
  "/urlaub",
  "/meine-schichten",
  "/besetzung",
  "/antraege",
  "/urlaubsantraege",
  "/mitarbeiter",
  "/schichten",
  "/regeln",
  "/einstellungen",
  "/profil",
];

const AUTH_PATHS = ["/login", "/passwort-vergessen", "/registrieren"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ohne Supabase läuft die Anwendung im Demo-Modus weiter.
  if (!isSupabaseConfigured) return NextResponse.next();

  const { response, user } = await updateSession(request);
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("weiter", pathname);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Alles außer statischen Dateien und Bildern. Die Middleware ist die
     * erste Verteidigungslinie; die eigentliche Absicherung der Daten
     * passiert über Row Level Security in Supabase.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
