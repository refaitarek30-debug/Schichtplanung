/**
 * Ist Supabase konfiguriert? Beide Variablen werden zur Buildzeit ersetzt,
 * die Prüfung funktioniert deshalb im Browser und auf dem Server.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Läuft diese Auslieferung wirklich in Produktion?
 *
 * Bewusst an `VERCEL_ENV` und nicht an `NODE_ENV`: beim Bauen steht
 * `NODE_ENV` immer auf `production`, auch lokal und in der CI. Ein
 * Abbruch daran hätte jeden Build ohne hinterlegte Zugangsdaten
 * zerschossen, statt nur die echte Produktion zu schützen.
 *
 * `VERCEL_ENV` setzt Vercel selbst und nur dort. Fehlen in der echten
 * Produktion die Supabase-Variablen, scheitert damit schon der Build –
 * und genau das ist gewollt.
 */
const istProduktion = process.env.VERCEL_ENV === "production";

/**
 * Der Demo-Modus darf in Produktion nicht erreichbar sein.
 *
 * Vorher galt schlicht `isSupabaseConfigured ? "live" : "demo"`. Fehlte
 * in Vercel eine Umgebungsvariable, fiel die Anwendung damit *still* in
 * den Demo-Modus – und der hat einen Rollenumschalter, mit dem sich jeder
 * zur Administration macht. Es waren zwar keine echten Daten zu sehen,
 * aber es ist ein Zustand, den eine produktive Anwendung nie einnehmen
 * darf, und niemand hätte es gemerkt.
 *
 * Ab hier bricht der Start in Produktion ab, statt leise umzuschalten.
 * In Entwicklung und Vorschau bleibt der Demo-Modus wie bisher.
 */
if (istProduktion && !isSupabaseConfigured) {
  throw new Error(
    "Supabase ist in dieser Produktionsumgebung nicht konfiguriert " +
      "(NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen). " +
      "Der Demo-Modus ist in Produktion gesperrt – bitte die Variablen in " +
      "Vercel hinterlegen und neu bereitstellen.",
  );
}

/** Im Demo-Modus laufen die Ansichten aus Phase 1 ohne Backend weiter. */
export const sessionMode: "demo" | "live" = isSupabaseConfigured ? "live" : "demo";

/**
 * Darf der Rollenumschalter des Demo-Modus benutzt werden?
 *
 * Doppelter Boden: selbst wenn der Demo-Modus je wieder in einer
 * Auslieferung erreichbar wäre, bleibt der Umschalter dort aus. Hier
 * `NODE_ENV`, weil der Wert zur Buildzeit ersetzt wird und deshalb auch
 * im Browser gilt – jede gebaute Auslieferung zählt als nicht-lokal.
 *
 * Die Berechtigung hängt ohnehin an `profiles.role` in der Datenbank.
 * Der Umschalter ändert nur die Anzeige und kann keine Rechte vergeben.
 */
export const darfRolleUmschalten = process.env.NODE_ENV !== "production";
