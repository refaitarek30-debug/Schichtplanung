/**
 * Passwort-Regeln für neue Passwörter (Registrierung, Passwort ändern oder neu setzen).
 * Bestehende Passwörter bleiben gültig, bis sie geändert werden.
 *
 * Länge: mindestens 10 Zeichen. Supabase (bcrypt) berücksichtigt nur die ersten
 * 72 Bytes; die Obergrenze verhindert außerdem unnötig große Eingaben.
 * Bewusst keine Datei mit "use server": sie exportiert Konstanten.
 */
export const PASSWORT_MIN = 10;
export const PASSWORT_MAX = 72;

/** Häufigste Passwörter (deutsch und englisch), ohne angehängte Ziffern und Zeichen. */
const HAEUFIG = new Set([
  "passwort", "password", "passwort!", "kennwort", "hallo", "hallohallo", "geheim", "schatz",
  "qwertz", "qwerty", "qwertzuiop", "qwertyuiop", "asdfgh", "asdfghjkl", "yxcvbnm", "abc", "abcdef",
  "abcdefgh", "abcdefghij", "iloveyou", "ichliebedich", "admin", "administrator", "willkommen",
  "welcome", "letmein", "sommer", "winter", "fruehling", "herbst", "fussball", "football", "dragon",
  "monkey", "master", "sunshine", "princess", "shadow", "superman", "batman", "baseball", "freedom",
  "schichtplan", "schichtplanung", "dienstplan", "urlaub", "arbeit", "firma", "test", "testtest",
  "changeme", "starwars", "pokemon", "computer", "internet", "deutschland", "berlin", "hamburg",
  "muenchen", "koeln", "schalke", "dortmund", "bayern", "borussia",
]);

const REIHEN = ["0123456789", "1234567890", "9876543210", "abcdefghijklmnopqrstuvwxyz", "qwertzuiopasdfghjklyxcvbnm", "qwertyuiopasdfghjklzxcvbnm"];

/**
 * Prüft ein neues Passwort. Gibt eine Meldung zurück oder null, wenn es passt.
 * `kennung`: E-Mail oder Spitzname – das Passwort darf ihn nicht enthalten.
 */
export function passwortProblem(passwort: string, kennung?: string | null): string | null {
  if (passwort.length < PASSWORT_MIN) return `Das Passwort muss mindestens ${PASSWORT_MIN} Zeichen lang sein.`;
  if (passwort.length > PASSWORT_MAX) return `Das Passwort darf höchstens ${PASSWORT_MAX} Zeichen lang sein.`;

  const klein = passwort.toLowerCase();
  const zuSchwach = "Dieses Passwort ist zu leicht zu erraten. Nimm zum Beispiel drei, vier Wörter, die nichts miteinander zu tun haben.";
  if (/^(.)\1+$/.test(klein)) return zuSchwach;
  if (REIHEN.some((r) => r.includes(klein))) return zuSchwach;
  // Häufiges Wort mit angehängten Ziffern oder Zeichen (z. B. „Passwort123!“).
  const kern = klein.replace(/[^a-zäöüß]+$/u, "").replace(/^[^a-zäöüß]+/u, "");
  if (HAEUFIG.has(kern) || HAEUFIG.has(klein)) return zuSchwach;
  if (klein.includes("shiftnexo")) return "Das Passwort darf nicht „ShiftNexo“ enthalten.";

  const name = (kennung ?? "").toLowerCase().split("@")[0]?.trim() ?? "";
  if (name.length >= 4 && klein.includes(name)) return "Das Passwort darf deinen Namen oder deine E-Mail-Adresse nicht enthalten.";
  return null;
}
