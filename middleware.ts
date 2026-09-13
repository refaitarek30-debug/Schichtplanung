import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

/** Alles unter diesen Pfaden setzt eine Anmeldung voraus. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/kalender",
  "/schichtplan",
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
  "/hilfe",
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
     *
     * Manifest, Service Worker und Offline-Seite bleiben bewusst außen vor:
     * sie enthalten keine Daten und müssen auch ohne Anmeldung erreichbar
     * sein, sonst lässt sich die App nicht installieren.
     */
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
