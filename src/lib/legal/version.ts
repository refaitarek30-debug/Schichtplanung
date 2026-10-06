/**
 * Fassungen der Rechtstexte.
 *
 * Eine einzige Quelle für alles, was eine Fassung anzeigt (Footer,
 * Registrierung, die Texte selbst) oder speichert. Die Datenbank kennt
 * dieselben Werte in `legal_versions` – bei jeder Änderung hier muss eine
 * Migration die Tabelle nachziehen; `supabase/tests/legal_versions.mjs`
 * prüft das.
 *
 * Bei jeder inhaltlichen Änderung eines Textes die Fassung erhöhen und das
 * Datum in der jeweiligen Seite (Prop `updated` von `LegalPage`) mitziehen.
 * Rein redaktionelle Korrekturen – Tippfehler, Formatierung – erhöhen sie
 * nicht.
 *
 * Diese Datei darf nie `"use server"` tragen: eine solche Datei darf nur
 * async-Funktionen exportieren.
 */
export const LEGAL_VERSIONS = {
  datenschutz: "2.2",
  nutzungsbedingungen: "1.0",
  avv: "1.0",
} as const;

/** Kurzform für die Anzeige („Fassung 1“). */
export const DATENSCHUTZ_VERSION = Number.parseInt(LEGAL_VERSIONS.datenschutz, 10);
export const NUTZUNGSBEDINGUNGEN_VERSION = Number.parseInt(LEGAL_VERSIONS.nutzungsbedingungen, 10);
export const AVV_VERSION = Number.parseInt(LEGAL_VERSIONS.avv, 10);
