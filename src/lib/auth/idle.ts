import type { Role } from "@/lib/types";

/**
 * Automatische Abmeldung nach Inaktivität – je nach Rolle.
 *
 * Wer viel sieht, wird schneller abgemeldet:
 *   - Administration (Konten, Krankheit, Geburtstage, Protokoll): 15 Minuten
 *   - Schichtleitung (Anträge, Abwesenheiten, Konten ihrer Leute):  8 Stunden
 *   - Mitarbeiter (nur der eigene Plan und das eigene Konto):      12 Stunden
 *
 * Mitarbeiter öffnen die App kurz in der Pause oder im Bus und arbeiten
 * 8 bis 12 Stunden am Stück – kürzere Fristen würden sie mitten in der
 * Schicht abmelden. Das Handy sichert die Displaysperre. Eine Zahl an
 * einer Stelle: hier.
 *
 * Den Zeitstempel der letzten Aktivität teilen sich Browser und Server über
 * ein Cookie: der Browser schreibt ihn bei jeder Eingabe fort, die Middleware
 * liest ihn bei jedem Seitenaufruf. Deshalb ist das Cookie bewusst nicht
 * httpOnly – es enthält nur eine Uhrzeit, kein Geheimnis. Dasselbe gilt für
 * die Frist (`sp_frist`): Die Middleware begrenzt sie auf 15 Minuten bis
 * 12 Stunden, der Browser prüft zusätzlich mit der Frist der echten Rolle.
 */
const MINUTE = 60 * 1000;
const STUNDE = 60 * MINUTE;

export const FRIST_NACH_ROLLE: Record<Role, number> = {
  admin: 15 * MINUTE,
  shift_leader: 8 * STUNDE,
  employee: 12 * STUNDE,
};

/** Gilt, solange die Rolle (noch) nicht bekannt ist: die strengste Frist. */
export const IDLE_TIMEOUT_MS = FRIST_NACH_ROLLE.admin;

const FRIST_MIN_MS = 15 * MINUTE;
const FRIST_MAX_MS = 12 * STUNDE;

export const ACTIVITY_COOKIE = "sp_letzte_aktivitaet";

/** Die Frist der angemeldeten Person – vom Browser gesetzt, von der Middleware gelesen. */
export const FRIST_COOKIE = "sp_frist";

/** Frist aus dem Cookie; fehlt es oder ist es unsinnig, gilt die strengste. */
export function fristAusCookie(roh: string | undefined): number {
  const n = Number(roh);
  if (!Number.isFinite(n) || n <= 0) return IDLE_TIMEOUT_MS;
  return Math.min(Math.max(n, FRIST_MIN_MS), FRIST_MAX_MS);
}

/**
 * Das Cookie lebt bewusst deutlich länger als die Frist. Über den Ablauf
 * entscheidet der Zeitstempel darin – wäre das Cookie selbst nach 30 Minuten
 * weg, sähe eine lange Pause aus wie eine frische Anmeldung.
 */
export const ACTIVITY_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
