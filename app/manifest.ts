import type { MetadataRoute } from "next";

/**
 * Web-App-Manifest. Damit lässt sich die Seite auf dem Handy über
 * "Zum Home-Bildschirm" installieren und startet ohne Browserleiste.
 * Next.js liefert diese Datei automatisch unter /manifest.webmanifest aus.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ShiftNexo – Urlaubs- und Schichtplanung",
    short_name: "ShiftNexo",
    description:
      "Urlaub beantragen, Schichten sehen und die Mindestbesetzung automatisch prüfen.",
    // Startet auf der gewählten Startseite (/start leitet dorthin); ohne
    // Anmeldung leitet die Middleware auf /login um.
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#2F5BEA",
    lang: "de",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Schichtplan", url: "/schichtplan" },
      { name: "Urlaub beantragen", url: "/urlaub" },
      { name: "Mein Kalender", url: "/meine-schichten" },
    ],
  };
}
