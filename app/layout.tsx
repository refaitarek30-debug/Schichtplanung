import type { Metadata, Viewport } from "next";
import "./globals.css";

const inter = { variable: "" };

export const metadata: Metadata = {
  title: "Schichtplan – Urlaubs- und Schichtplanung",
  description:
    "Urlaub beantragen, Schichten sehen und die Mindestbesetzung automatisch prüfen.",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
