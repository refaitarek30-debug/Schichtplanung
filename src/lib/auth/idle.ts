/**
 * Automatische Abmeldung nach Inaktivität.
 *
 * Den Zeitstempel der letzten Aktivität teilen sich Browser und Server über
 * ein Cookie: der Browser schreibt ihn bei jeder Eingabe fort, die Middleware
 * liest ihn bei jedem Seitenaufruf. Deshalb ist das Cookie bewusst nicht
 * httpOnly – es enthält nur eine Uhrzeit, kein Geheimnis.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const ACTIVITY_COOKIE = "sp_letzte_aktivitaet";

/**
 * Das Cookie lebt bewusst deutlich länger als die Frist. Über den Ablauf
 * entscheidet der Zeitstempel darin – wäre das Cookie selbst nach 30 Minuten
 * weg, sähe eine lange Pause aus wie eine frische Anmeldung.
 */
export const ACTIVITY_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
