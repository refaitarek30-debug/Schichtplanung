/**
 * Versionszeichen der Datenschutzerklärung.
 *
 * Eine einzige Quelle, die überall dort angezeigt wird, wo „Datenschutz“
 * als Link oder Titel auftaucht (Footer, Registrierung, die Erklärung
 * selbst) – so zeigen alle Stellen immer denselben Stand.
 *
 * Bei jeder inhaltlichen Änderung der Erklärung diese Zahl um eins
 * erhöhen und das Datum in `app/(rechtliches)/datenschutz/page.tsx`
 * (Prop `updated` von `LegalPage`) mitziehen. Rein redaktionelle
 * Korrekturen – Tippfehler, Formatierung – erhöhen die Version nicht.
 */
export const DATENSCHUTZ_VERSION = 1;
