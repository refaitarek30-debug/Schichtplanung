import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Landepunkt für Einladungs- und Passwort-Links.
 * Tauscht den Code gegen eine Session und leitet danach weiter.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("weiter");
  const type = searchParams.get("type");
  // Nach einer Registrierungs-Bestätigung ("signup") auf die freundliche
  // Willkommensseite statt direkt ins Dashboard – der Nutzer hat sonst
  // keine Rückmeldung, dass die Bestätigung geklappt hat.
  const fallback = type === "signup" ? "/willkommen" : "/dashboard";
  const next = nextParam && nextParam.startsWith("/") ? nextParam : fallback;

  if (code && isSupabaseConfigured) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?fehler=link`);
}
