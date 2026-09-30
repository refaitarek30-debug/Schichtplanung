const istProduktion = process.env.NODE_ENV === "production";

/**
 * Supabase-Adresse für die CSP: HTTP(S) für Auth/REST, WebSocket für Realtime.
 * Ohne Konfiguration (Demo-Modus) bleibt connect-src auf die eigene Herkunft
 * beschränkt.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHost = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).host : "";
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` für Skripte ist nötig, weil Next.js (App Router) Inline-
 * Skripte für Hydration erzeugt und die Themenwahl vor dem ersten Rendern ein
 * Inline-Skript setzt (`src/components/layout/theme.tsx`, verhindert Flackern).
 * Eine strengere Nonce-basierte Richtlinie bräuchte dynamisches Rendering aller
 * Seiten; das ist ein eigenes Vorhaben. `'unsafe-eval'` bleibt in der
 * Produktion aus (nur die Entwicklung braucht es für Hot Reload).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${istProduktion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}${istProduktion ? "" : " ws: http:"}`,
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const sicherheitsHeader = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS nur in der Produktion, sonst merkt sich der lokale Browser HTTPS für localhost.
  ...(istProduktion
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Verrät die Framework-Version nicht ungefragt in jeder Antwort.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: sicherheitsHeader }];
  },
};

export default nextConfig;
