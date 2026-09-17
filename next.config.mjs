/**
 * Security-Header. Vorher enthielt diese Datei nur `reactStrictMode` –
 * die Anwendung lieferte also keinen einzigen Schutzheader aus.
 *
 * Die CSP ist an den tatsächlichen Bedarf angepasst und nicht abgeschrieben:
 *
 *   - `connect-src` braucht die Supabase-Domäne (REST, Auth, Realtime über
 *     wss) und Vercel, sonst lädt der Schichtplan nicht mehr.
 *   - `script-src` braucht `'unsafe-inline'` für die Hydration-Skripte von
 *     Next.js und `'unsafe-eval'` nur in der Entwicklung (React Refresh).
 *   - `style-src` braucht `'unsafe-inline'`, weil Tailwind und die
 *     Inline-Stile der Komponenten sonst wegfallen.
 *   - `frame-ancestors 'none'` ersetzt X-Frame-Options und verhindert, dass
 *     jemand den Schichtplan in eine fremde Seite einbettet.
 *
 * Wichtig beim Ändern: erst im Vorschau-Deployment prüfen, ob Plan,
 * Anmeldung und Auswertung noch vollständig funktionieren. Eine zu strenge
 * CSP, die den Schichtplan leert, ist schlimmer als keine.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseHost.replace(/^https:/, "wss:");
const istEntwicklung = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${istEntwicklung ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${supabaseHost} ${supabaseWs} https://vitals.vercel-insights.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .filter(Boolean)
  .join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Ein Jahr, inklusive Unterdomänen. Die Anwendung läuft
          // ausschließlich über HTTPS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Kein Verweis auf fremde Seiten, aber innerhalb der eigenen
          // Anwendung der volle Pfad – sonst funktionieren Rücksprünge nicht.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
