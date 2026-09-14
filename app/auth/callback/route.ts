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

  if (tokenHash && OTP_TYPES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "signup" | "magiclink" | "email" | "email_change",
    });
    if (!error) return angemeldet(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?fehler=abgelaufen`);
  }

  // Weder Code noch Token: dann stehen die Angaben hinter dem Rautezeichen.
  // Browser nehmen den Teil bei einer Weiterleitung mit, also reicht es,
  // an die Seite zu schicken, die ihn auslesen kann.
  const bridge = new URL(`${origin}/auth/weiter`);
  if (nextParam) bridge.searchParams.set("weiter", next);
  return NextResponse.redirect(bridge.toString());
}
