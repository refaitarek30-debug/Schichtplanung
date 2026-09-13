import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker";
import { ThemeScript } from "@/components/layout/theme";

/**
 * IBM Plex: nüchtern, gut lesbar in kleinen Größen, und die Mono-Variante
 * passt zu den Zahlenkolonnen im Plan. Bis hierher lief die Anwendung mit
 * der Systemschrift – die sah auf jedem Gerät anders aus.
 */
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Schichtplan – Urlaubs- und Schichtplanung",
  description:
    "Urlaub beantragen, Schichten sehen und die Mindestbesetzung automatisch prüfen.",
  // Macht die Seite auf dem Handy installierbar (siehe app/manifest.ts).
  manifest: "/manifest.webmanifest",
  applicationName: "Schichtplan",
  appleWebApp: {
    capable: true,
    title: "Schichtplan",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Zwei Werte, damit die Systemleiste im Dunkelmodus mitzieht.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#14161C" },
  ],
  width: "device-width",
  initialScale: 1,
  // Ohne das steht die App auf dem iPhone unter der Statusleiste.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${mono.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
