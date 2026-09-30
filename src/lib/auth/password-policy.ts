/**
 * Passwortlänge. Supabase (bcrypt) berücksichtigt nur die ersten 72 Bytes;
 * eine Obergrenze verhindert außerdem unnötig große Eingaben.
 * Bewusst keine Datei mit "use server": sie exportiert Konstanten.
 */
export const PASSWORT_MIN = 8;
export const PASSWORT_MAX = 72;
