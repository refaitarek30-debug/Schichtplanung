/**
 * Fassung der Datenschutz-Einwilligung.
 *
 * Bewusst eine eigene Datei und NICHT `privacy-actions.ts`: dort steht
 * `"use server"`, und so eine Datei darf ausschliesslich async-Funktionen
 * exportieren. Eine exportierte Zeichenkette laesst Next.js beim Auswerten
 * des Server-Bundles abbrechen -- der Build meldet nichts, aber jede Seite,
 * die das Modul laedt, faellt zur Laufzeit aus:
 *
 *   Error: A "use server" file can only export async functions, found string.
 *
 * Genau daran ist /dashboard in der Produktion gescheitert.
 *
 * Dieselbe Zeichenkette steht auch in `save_privacy_settings()` in der
 * Datenbank. Wird sie hier erhoeht, muss die Migration mitziehen -- sonst
 * erscheint die Abfrage entweder gar nicht mehr oder bei allen erneut.
 */
export const PRIVACY_NOTICE_VERSION = "1.0";
