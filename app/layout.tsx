import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker";

const inter = { variable: "" };

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
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  // Ohne das steht die App auf dem iPhone unter der Statusleiste.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable}>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
