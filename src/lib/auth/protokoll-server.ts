import { headers } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

/** Grobes Gerät für das Protokoll: „iPhone · Safari“ statt der ganzen Kennung. */
export async function geraet(): Promise<string | null> {
  const ua = (await headers()).get("user-agent") ?? "";
  if (!ua) return null;
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unbekannt";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /CriOS|Chrome\//.test(ua)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${system} · ${browser}`;
}

/** Höchstens zwei Sekunden – Anmelden und Abmelden gehen vor. */
export function mitFrist<T>(versprechen: Promise<T>): Promise<T | undefined> {
  return Promise.race([
    versprechen,
    new Promise<undefined>((fertig) => setTimeout(() => fertig(undefined), 2_000)),
  ]);
}

/**
 * Ins Protokoll schreiben, ohne die Anmeldung aufzuhalten: schlägt das
 * fehl, geht es trotzdem weiter.
 */
export async function protokolliere(
  supabase: Awaited<ReturnType<typeof createClient>>,
  art: "anmeldung" | "abmeldung" | "anmeldung.passwort",
  text: string | null,
) {
  try {
    await mitFrist(
      Promise.resolve(supabase.rpc("protokoll_melden", { p_art: art, p_text: text, p_seite: null })),
    );
  } catch {
    // Protokoll ist Beiwerk.
  }
}
