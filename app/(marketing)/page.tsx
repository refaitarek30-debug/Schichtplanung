import type { Metadata } from "next";
import { BereichSeiten } from "@/components/marketing/bereich";
import { BetriebSeite, PrivatSeite } from "@/components/marketing/startseite";

const META =
  "Kostenloser Schichtkalender mit Schichtfolge, Feiertagen, Partner-Ansicht und Kalender-Abo fürs Handy – und Schichtplanung mit Urlaub und Besetzung für Betriebe.";

export const metadata: Metadata = {
  title: "ShiftNexo – kostenloser Schichtkalender und Schichtplanung für Betriebe",
  description: META,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://shiftnexo.de"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "/",
    siteName: "ShiftNexo",
    title: "Dein Schichtkalender. Kostenlos.",
    description: META,
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "ShiftNexo" }],
  },
  twitter: {
    card: "summary",
    title: "ShiftNexo – kostenloser Schichtkalender",
    description: META,
  },
};

export default function LandingPage() {
  return <BereichSeiten privat={<PrivatSeite />} betrieb={<BetriebSeite />} />;
}
