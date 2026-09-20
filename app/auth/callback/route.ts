import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ACTIVITY_COOKIE, ACTIVITY_COOKIE_MAX_AGE } from "@/lib/auth/idle";

/**
 * Landepunkt für Einladungs- und Passwort-Links.
 *
 * Es gibt drei Sorten von Links, und früher konnte diese Stelle nur eine
 * davon:
 *
 *  1. `?code=…`       – entsteht, wenn der Vorgang im Browser begonnen hat
 *                       (etwa "Passwort vergessen" auf der Anmeldeseite).
 *  2. `?token_hash=…` – entsteht, wenn der Link auf dem Server erzeugt wurde.
 *                       Diesen Weg gehen die Einladungen: er ist der einzige,
 *                       der ohne Postversand auskommt.
 *  3. `#access_token=…` – so leitet Supabase nach einem Klick in seiner
 *                       eigenen Einladungsmail weiter. Die Angaben stehen
 *                       hinter dem Rautezeichen und erreichen den Server
 *                       nie; dafür übernimmt `/auth/weiter` im Browser.
 *
 * Wer eine Einladung anklickt, landet danach beim Passwort-Setzen.
 */
const OTP_TYPES = new Set([
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
  "email_change",
]);

/**
 * Weiterleitung mit frischem Zeitstempel: ein eingelöster Link ist eine
 * Anmeldung, ab hier läuft die Frist für die automatische Abmeldung.
 */
function angemeldet(ziel: string) {
  const response = NextResponse.redirect(ziel);
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACTIVITY_COOKIE_MAX_AGE,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const type = searchParams.get("type") ?? "";
  const nextParam = searchParams.get("weiter");

  // Wohin es nach dem Einlösen geht. Einladung und Passwort-Neusetzen führen
  // zwingend zum Passwortformular – sonst steht jemand im Dashboard und hat
  // kein Passwort, mit dem er sich beim nächsten Mal anmelden könnte.
  const fallback =
    type === "invite" || type === "recovery"
      ? "/passwort-neu"
      : type === "signup"
        ? "/willkommen"
        : "/dashboard";
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : fallback;

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(`${origin}/login?fehler=link`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return angemeldet(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?fehler=link`);
  }

  // Hier wird bewusst NICHTS eingelöst.
  //
  // Gemessen an einem echten Fall: Link erzeugt um 17:39:44, Token
  // verbraucht um 17:39:50 – sechs Sekunden später. Kein Mensch klickt so
  // schnell. Das war der Link-Vorschau-Abruf des Mail- bzw.
  // Messenger-Dienstes, der jede zugestellte Adresse für Vorschaubild und
  // Virenprüfung aufruft. Dieser Abruf hat das Einmal-Token verbraucht,
  // und die eingeladene Person bekam beim ERSTEN eigenen Klick
  // "bereits eingelöst" zu sehen.
  //
  // Deshalb führt ein GET nur noch zu einer Zwischenseite mit einer
  // Schaltfläche. Eingelöst wird erst beim Absenden des Formulars, also
  // per POST. Scanner rufen ab, sie senden keine Formulare – das Token
  // überlebt sie.
  if (tokenHash && OTP_TYPES.has(type)) {
    // `(auth)` ist eine Routengruppe und steht nicht in der Adresse:
    // die Seite liegt unter /bestaetigen.
    const seite = new URL(`${origin}/bestaetigen`);
    seite.searchParams.set("token_hash", tokenHash);
    seite.searchParams.set("type", type);
    seite.searchParams.set("weiter", next);
    return NextResponse.redirect(seite.toString());
  }

  // Weder Code noch Token: dann stehen die Angaben hinter dem Rautezeichen.
  // Browser nehmen den Teil bei einer Weiterleitung mit, also reicht es,
  // an die Seite zu schicken, die ihn auslesen kann.
  const bridge = new URL(`${origin}/auth/weiter`);
  if (nextParam) bridge.searchParams.set("weiter", next);
  return NextResponse.redirect(bridge.toString());
}

/**
 * Das eigentliche Einlösen – nur über ein abgesendetes Formular erreichbar.
 */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "");
  const weiter = String(form.get("weiter") ?? "");

  const ziel =
    weiter.startsWith("/") && !weiter.startsWith("//") ? weiter : "/dashboard";

  if (!isSupabaseConfigured || !tokenHash || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/login?fehler=link`, { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "invite" | "recovery" | "signup" | "magiclink" | "email" | "email_change",
  });

  // 303, damit der Browser nach dem Absenden auf GET wechselt und ein
  // Neuladen nicht erneut abschickt.
  if (!error) {
    const antwort = angemeldet(`${origin}${ziel}`);
    return new NextResponse(antwort.body, {
      status: 303,
      headers: antwort.headers,
    });
  }

  // Zweiter Versuch mit demselben Link: wer noch angemeldet ist, geht
  // weiter statt auf einer Fehlerseite zu landen.
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const antwort = angemeldet(`${origin}${ziel}`);
    return new NextResponse(antwort.body, {
      status: 303,
      headers: antwort.headers,
    });
  }

  return NextResponse.redirect(`${origin}/login?fehler=verbraucht`, { status: 303 });
}
