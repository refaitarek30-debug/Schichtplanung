import type { Metadata } from "next";
import { BetriebSeite } from "@/components/marketing/startseite";

/**
 * Eigene Seite nur für Betriebe – das Ziel für Anzeigen und Gespräche mit
 * Betrieben. Gleicher Inhalt wie der Reiter „Betrieb“ der Startseite, ohne
 * den Umweg über den privaten Kalender.
 */
const META =
  "Schichtplan, Urlaub und Besetzung für Schichtbetriebe – am PC planen, auf dem Handy für jeden im Team. Drei Monate kostenlos testen in der Pilotphase.";

export const metadata: Metadata = {
  title: "ShiftNexo für Betriebe – Schichtplanung, Urlaub und Besetzung",
  description: META,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://shiftnexo.de"),
  alternates: { canonical: "/betriebe" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/betriebe",
    siteName: "ShiftNexo",
    title: "ShiftNexo für Betriebe",
    description: META,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "ShiftNexo" }],
  },
};

export default function BetriebePage() {
  return <BetriebSeite />;
}
