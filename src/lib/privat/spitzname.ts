/**
 * Privatkonten ohne E-Mail: Die Anmeldung läuft über einen Spitznamen. Der
 * Anmeldedienst verlangt intern eine Adresse – daraus wird
 * `spitzname@privat.invalid` (`.invalid` ist reserviert, es gibt dort nie ein
 * Postfach und es wird nie eine Mail verschickt).
 */
export const PRIVAT_DOMAIN = "privat.invalid";

export const SPITZNAME_MIN = 3;
export const SPITZNAME_MAX = 24;

/** Buchstaben a–z, Ziffern, Punkt, Unterstrich, Bindestrich; beginnt mit Buchstabe oder Ziffer. */
const MUSTER = /^[a-z0-9][a-z0-9._-]*$/;

export function pruefeSpitzname(roh: string): string | null {
  const s = roh.trim().toLowerCase();
  if (s.length < SPITZNAME_MIN) return `Der Spitzname braucht mindestens ${SPITZNAME_MIN} Zeichen.`;
  if (s.length > SPITZNAME_MAX) return `Der Spitzname darf höchstens ${SPITZNAME_MAX} Zeichen haben.`;
  if (!MUSTER.test(s)) {
    return "Erlaubt sind Buchstaben (a–z, ohne Umlaute), Ziffern, Punkt, Unterstrich und Bindestrich – ohne Leerzeichen.";
  }
  return null;
}

export function spitznameZuEmail(spitzname: string): string {
  return `${spitzname.trim().toLowerCase()}@${PRIVAT_DOMAIN}`;
}

/** Anmeldefeld: enthält es ein „@“, ist es eine Adresse, sonst ein Spitzname. */
export function anmeldeEingabeZuEmail(eingabe: string): string {
  const e = eingabe.trim();
  return e.includes("@") ? e : spitznameZuEmail(e);
}

/** Hat das Konto eine echte (nicht die interne) Adresse? */
export function hatEchteEmail(email: string | null | undefined): boolean {
  return !!email && !email.toLowerCase().endsWith(`@${PRIVAT_DOMAIN}`);
}
