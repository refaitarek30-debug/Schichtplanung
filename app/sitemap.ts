import type { MetadataRoute } from "next";

const BASIS = process.env.NEXT_PUBLIC_SITE_URL || "https://ready-flame.vercel.app";

/** Öffentliche Seiten für Suchmaschinen (Search Console → Sitemaps). */
export default function sitemap(): MetadataRoute.Sitemap {
  const seiten: { pfad: string; prio: number }[] = [
    { pfad: "/", prio: 1 },
    { pfad: "/privat/registrieren", prio: 0.9 },
    { pfad: "/registrieren", prio: 0.7 },
    { pfad: "/demo", prio: 0.6 },
    { pfad: "/impressum", prio: 0.2 },
    { pfad: "/datenschutz", prio: 0.2 },
    { pfad: "/nutzungsbedingungen", prio: 0.2 },
  ];
  return seiten.map((s) => ({ url: `${BASIS}${s.pfad}`, changeFrequency: "weekly", priority: s.prio }));
}
