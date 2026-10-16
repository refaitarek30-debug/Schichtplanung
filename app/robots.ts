import type { MetadataRoute } from "next";

const BASIS = process.env.NEXT_PUBLIC_SITE_URL || "https://ready-flame.vercel.app";

/**
 * Für Suchmaschinen: öffentliche Seiten ja, persönliche Bereiche nein.
 * Die geschützten Seiten leiten ohne Anmeldung ohnehin zum Login um.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privat/registrieren"],
      disallow: ["/api/", "/abo/", "/partner/", "/privat/", "/plattform", "/auth/"],
    },
    sitemap: `${BASIS}/sitemap.xml`,
  };
}
