/**
 * Ist Supabase konfiguriert? Beide Variablen werden zur Buildzeit ersetzt,
 * die Prüfung funktioniert deshalb im Browser und auf dem Server.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** Im Demo-Modus laufen die Ansichten aus Phase 1 ohne Backend weiter. */
export const sessionMode: "demo" | "live" = isSupabaseConfigured ? "live" : "demo";
