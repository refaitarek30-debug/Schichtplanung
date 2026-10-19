import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, isProductionMisconfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";
import {
  ACTIVITY_COOKIE,
  ACTIVITY_COOKIE_MAX_AGE,
  FRIST_COOKIE,
  fristAusCookie,
} from "@/lib/auth/idle";
import { START_COOKIE, startZielAusCookie } from "@/lib/start-seite";

/**
 * Alles unter diesen Pfaden setzt eine Anmeldung voraus.
 *
 * Die Liste muss jede Seite unter `app/(app)` enthalten. Fehlt eine, wird
 * der Zugriff zwar immer noch abgewiesen -- das Layout von `(app)` prueft
 * die Sitzung ebenfalls und leitet um --, aber erst eine Stufe spaeter:
 * die Anfrage erreicht dann die Server-Komponente der Seite, statt schon
 * in der Middleware zu enden. Nachgemessen fehlten hier vier Eintraege.
 */
const PROTECTED_PREFIXES = [
  "/altersfreizeit",
  "/ausbildung",
  "/auswertung",
  "/protokoll",
  "/mitteilungen",
  "/krank",
  "/dashboard",
  "/start",
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
  "/verwaltung",
  "/einstellungen",
  "/einrichtung",
  "/profil",
  "/hilfe",
  "/privat",
];

const AUTH_PATHS = ["/login", "/passwort-vergessen", "/registrieren", "/privat/registrieren"];

/** Öffentlich, obwohl unter einem geschützten Pfad. */
const OEFFENTLICH = ["/privat/registrieren"];

/** Zeitpunkt der letzten Aktivität auf der Antwort festhalten. */
function merkeAktivitaet(response: NextResponse): NextResponse {
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVITY_COOKIE_MAX_AGE,
  });
  return response;
}

/**
 * Sitzung beenden: die Supabase-Cookies aus dem Browser entfernen und zur
 * Anmeldung schicken. Ohne diese Cookies ist der Zugang weg, auch wenn das
 * Gerät unbeaufsichtigt liegen bleibt.
 */
function abmelden(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("fehler", "inaktiv");

  const response = NextResponse.redirect(url);
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) response.cookies.delete(cookie.name);
  }
  response.cookies.delete(ACTIVITY_COOKIE);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // In Production darf eine fehlende Backend-Konfiguration niemals den
  // Demo-Datensatz aktivieren oder geschützte Seiten freigeben.
  if (isProductionMisconfigured) {
    return new NextResponse("Supabase ist in der Produktion nicht konfiguriert.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!isSupabaseConfigured) return NextResponse.next();

  // Einladungslink für Partner: ohne Anmeldung, ohne Sitzung. Bewusst vor
  // allem anderen – auch eine abgelaufene Sitzung auf demselben Gerät soll
  // hier nicht zur Anmeldeseite umleiten.
  if (pathname.startsWith("/partner/")) return NextResponse.next();

  // Kalender-Abo: Der Kalender des Handys ruft den Link ohne Anmeldung ab.
  if (pathname.startsWith("/abo/")) return NextResponse.next();

  const { response, user, dienstGestoert } = await updateSession(request);

  // Antwortet Supabase nicht, ist unbekannt, wer da klopft. Geschützte
  // Seiten bleiben deshalb zu – aber mit einer ehrlichen Begründung statt
  // einer stillen Umleitung, die nach „falsches Passwort" aussieht. Die
  // Cookies bleiben liegen: sobald der Dienst wieder da ist, läuft die
  // bestehende Sitzung weiter, ohne erneute Anmeldung.
  if (dienstGestoert) {
    const isProtectedPath =
      !OEFFENTLICH.includes(pathname) && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!isProtectedPath) return response;

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("fehler", "dienst");
    url.searchParams.set("weiter", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const zuletzt = Number(request.cookies.get(ACTIVITY_COOKIE)?.value);
    if (Number.isFinite(zuletzt) && Date.now() - zuletzt > fristAusCookie(request.cookies.get(FRIST_COOKIE)?.value)) {
      return abmelden(request);
    }
  }

  const isProtected =
    !OEFFENTLICH.includes(pathname) && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("weiter", pathname);
    return NextResponse.redirect(url);
  }

  // Angemeldete brauchen weder die Anmeldeseiten noch die öffentliche
  // Produktseite unter "/": sie gehen direkt in die Anwendung.
  if (user && (AUTH_PATHS.includes(pathname) || pathname === "/" || pathname === "/start")) {
    const url = request.nextUrl.clone();
    // Gemerkte Startseite dieser Person: gleich dorthin, ohne Umweg über /start.
    const gemerkt = startZielAusCookie(request.cookies.get(START_COOKIE)?.value, user.id);
    if (gemerkt) {
      url.pathname = gemerkt;
      url.search = "";
      const antwort = NextResponse.redirect(url);
      antwort.headers.set("Cache-Control", "no-store");
      return merkeAktivitaet(antwort);
    }
    if (pathname !== "/start") {
      url.pathname = "/start";
      url.search = "";
      return merkeAktivitaet(NextResponse.redirect(url));
    }
  }

  // Ein Seitenaufruf ist Aktivität – damit läuft die Frist neu.
  return user ? merkeAktivitaet(response) : response;
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
     *
     * `api/version` ebenso: die Abfrage läuft jede Minute von selbst und
     * darf nicht als Aktivität zählen, sonst endete keine Sitzung mehr
     * wegen Untätigkeit. `api/erinnerungen` ruft die Datenbank jede Minute
     * selbst auf (mit eigenem Geheimnis, ohne Sitzung).
     */
    "/((?!_next/static|api/version|api/erinnerungen|ocr/|_next/image|favicon.ico|favicon.png|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
