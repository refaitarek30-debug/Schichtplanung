/**
 * Ist Supabase konfiguriert? Beide Variablen werden zur Buildzeit ersetzt,
 * die Prüfung funktioniert deshalb im Browser und auf dem Server.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Läuft gerade `next build` und nicht der fertige Server?
 *
 * Während des Builds steht `NODE_ENV` immer auf `production` – auch lokal
 * und in der CI. Eine Sperre allein daran hat jeden Build ohne
 * hinterlegte Zugangsdaten abgebrochen: das Prerendering von `/schichten`
 * lief in den Fehler und `next build` endete mit Code 1.
 */
const istBuildLauf = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Produktion ohne Backend – das darf nie stillschweigend im Demo-Modus
 * enden.
 *
 * Die Sperre ist dadurch **nicht schwächer**, sondern schärfer:
 *
 *   - Auf Vercel greift sie über `VERCEL_ENV`, das nur Vercel selbst
 *     setzt – und zwar bereits **während des Produktionsbuilds**. Fehlen
 *     dort die Variablen, scheitert schon der Build und nicht erst der
 *     erste Aufruf.
 *   - Außerhalb von Vercel greift weiterhin `NODE_ENV`, aber erst im
 *     laufenden Server. Ein selbst gehosteter `next start` ohne
 *     Konfiguration bricht also nach wie vor ab.
 *
 * Nur der reine Build-Lauf ohne Vercel ist ausgenommen, und dort gibt es
 * keine Produktion zu schützen.
 */
export const isProductionMisconfigured =
  !isSupabaseConfigured &&
  (process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && !istBuildLauf));

export const canUseDemoMode =
  process.env.NODE_ENV !== "production" && !isSupabaseConfigured;

export const sessionMode: "demo" | "live" =
  isSupabaseConfigured ? "live" : "demo";
