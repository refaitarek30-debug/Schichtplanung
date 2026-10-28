import type { Role } from "@/lib/types";

/**
 * Neuigkeiten für die Glühbirne oben neben dem Profil.
 *
 * Bei jeder Neuerung kommt hier ein kurzer Eintrag dazu – neueste oben. Die
 * Glühbirne leuchtet, solange es einen Eintrag gibt, der nach dem letzten
 * Öffnen (`profiles.neuigkeiten_gesehen`) erschienen ist.
 *
 * `rollen` leer = für alle. Sonst nur für diese Rollen, damit niemand von
 * Funktionen liest, die er gar nicht hat.
 */
export interface Neuigkeit {
  /**
   * Erscheinungszeitpunkt mit Zeitzone, z. B. "2026-10-28T08:00:00+01:00".
   * Neu ist ein Eintrag für jeden, der die Liste davor zuletzt geöffnet hat.
   */
  zeit: string;
  titel: string;
  text: string;
  rollen?: Role[];
}

export const NEUIGKEITEN: Neuigkeit[] = [
  {
    zeit: "2026-10-28T08:00:00+01:00",
    titel: "Startseite „Kompakt“",
    text: "Kleinere Kacheln, alles auf einen Blick. Umschalten über dein Profil oben rechts – jederzeit wieder zurück.",
  },
  {
    zeit: "2026-10-28T08:00:00+01:00",
    titel: "Abmelden direkt im Profil",
    text: "Ein Tipp auf dein Profil oben rechts – „Abmelden“ steht gleich neben deinem Namen.",
  },
  {
    zeit: "2026-10-28T08:00:00+01:00",
    titel: "Personalnummer und Abteilung selbst eintragen",
    text: "Unter „Mein Profil“ kannst du beides selbst eintragen oder ändern. Dein Geburtsdatum lässt sich jetzt jederzeit ändern.",
  },
  {
    zeit: "2026-10-27T09:00:00+01:00",
    titel: "Hinweise zur Arbeitszeit",
    text: "Hinweise der Schichtleitung erscheinen auf Wunsch erst, wenn du arbeitest – nicht in deiner Freizeit.",
  },
  {
    zeit: "2026-10-26T09:00:00+01:00",
    titel: "Dein Kalender ohne Netz",
    text: "„Mein Kalender“ geht auch im Funkloch. Neue Termine werden später automatisch hochgeladen.",
  },
];

/**
 * Die Einträge für eine Rolle, neueste zuerst. Einträge mit einer Zeit in der
 * Zukunft bleiben noch verborgen – sonst gälten sie nach dem Lesen weiter als neu.
 */
export function neuigkeitenFuer(rolle: Role, jetzt = Date.now()): Neuigkeit[] {
  return NEUIGKEITEN.filter((n) => (!n.rollen || n.rollen.includes(rolle)) && Date.parse(n.zeit) <= jetzt);
}

/** Ist ein Eintrag nach dem letzten Öffnen erschienen? */
export function istNeu(eintrag: Neuigkeit, gesehen: string | null): boolean {
  if (!gesehen) return true;
  return Date.parse(eintrag.zeit) > Date.parse(gesehen);
}

/** Gibt es etwas, das nach dem letzten Öffnen erschienen ist? */
export function hatNeues(rolle: Role, gesehen: string | null): boolean {
  return neuigkeitenFuer(rolle).some((n) => istNeu(n, gesehen));
}

/** „28.10.“ – für die Liste. */
export function neuigkeitDatum(eintrag: Neuigkeit): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(
    new Date(eintrag.zeit),
  );
}
