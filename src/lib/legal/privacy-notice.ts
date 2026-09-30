import { LEGAL_VERSIONS } from "./version";

/**
 * Fassung der Datenschutzerklärung, deren Kenntnisnahme abgefragt wird.
 *
 * Bewusst eine eigene Datei und NICHT `privacy-actions.ts`: dort steht
 * `"use server"`, und so eine Datei darf ausschliesslich async-Funktionen
 * exportieren. Eine exportierte Zeichenkette laesst Next.js beim Auswerten
 * des Server-Bundles abbrechen -- der Build meldet nichts, aber jede Seite,
 * die das Modul laedt, faellt zur Laufzeit aus:
 *
 *   Error: A "use server" file can only export async functions, found string.
 *
 * Es geht um die Kenntnisnahme eines Informationstextes (Art. 13 DSGVO),
 * nicht um eine Einwilligung. Die Datenbank (`save_privacy_settings`) setzt
 * die Fassung selbst aus `legal_versions`; hier steht dieselbe Fassung, damit
 * die Anwendung erkennt, wer die aktuelle noch nicht gesehen hat.
 */
export const PRIVACY_NOTICE_VERSION: string = LEGAL_VERSIONS.datenschutz;
