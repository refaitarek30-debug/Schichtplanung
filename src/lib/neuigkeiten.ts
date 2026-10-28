import type { Role } from "@/lib/types";

/**
 * Neuigkeiten für die Glühbirne oben neben dem Profil.
 *
 * Bei jeder Neuerung kommt hier ein kurzer Eintrag dazu – neueste oben. Was nach
 * dem letzten Öffnen (`profiles.neuigkeiten_gesehen`) erschienen ist, steht in
 * der Liste mit „NEU“ – die Glühbirne selbst leuchtet nicht.
 *
 * `rollen` leer = für alle. Sonst nur für diese Rollen, damit niemand von
 * Funktionen liest, die er gar nicht hat.
 *
 * `bereich`: wo der Eintrag erscheint – im Betrieb (Standard), im
 * Privatbereich (`privat_konten.neuigkeiten_gesehen`) oder in beiden.
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
  bereich?: "betrieb" | "privat" | "beide";
}

export const NEUIGKEITEN: Neuigkeit[] = [
  {
    zeit: "2026-10-28T14:00:00+01:00",
    titel: "Dein Privatbereich",
    text: "Ein eigener Kalender mit demselben Login – über dein Profil oben rechts. Dein Betrieb sieht davon nichts.",
  },
  {
    zeit: "2026-10-28T14:00:00+01:00",
    titel: "Deaktivieren beendet den Zugang",
    text: "Deaktivierte Personen kommen nicht mehr in den Betrieb.",
    rollen: ["admin"],
  },
  {
    zeit: "2026-10-28T14:00:00+01:00",
    titel: "Einem Betrieb beitreten",
    text: "Code aus deinem Betrieb unter „Mehr“ eingeben – dein Kalender bleibt.",
    bereich: "privat",
  },
  {
    zeit: "2026-10-28T08:00:00+01:00",
    titel: "Startseite „Kompakt“",
    text: "Kleinere Kacheln, alles auf einen Blick. Umschalten in deinem Profil.",
  },
  {
    zeit: "2026-10-26T09:00:00+01:00",
    titel: "Kalender ohne Netz",
    text: "Neue Termine werden später automatisch hochgeladen.",
  },
];

/**
 * Die Einträge für eine Rolle, neueste zuerst. Einträge mit einer Zeit in der
 * Zukunft bleiben noch verborgen – sonst gälten sie nach dem Lesen weiter als neu.
 */
export function neuigkeitenFuer(rolle: Role | "privat", jetzt = Date.now()): Neuigkeit[] {
  return NEUIGKEITEN.filter((n) => {
    const bereich = n.bereich ?? "betrieb";
    const passt =
      rolle === "privat"
        ? bereich !== "betrieb"
        : bereich !== "privat" && (!n.rollen || n.rollen.includes(rolle));
    return passt && Date.parse(n.zeit) <= jetzt;
  });
}

/** Ist ein Eintrag nach dem letzten Öffnen erschienen? */
export function istNeu(eintrag: Neuigkeit, gesehen: string | null): boolean {
  if (!gesehen) return true;
  return Date.parse(eintrag.zeit) > Date.parse(gesehen);
}

/** Gibt es etwas, das nach dem letzten Öffnen erschienen ist? */
export function hatNeues(rolle: Role | "privat", gesehen: string | null): boolean {
  return neuigkeitenFuer(rolle).some((n) => istNeu(n, gesehen));
}

/** „28.10.“ – für die Liste. */
export function neuigkeitDatum(eintrag: Neuigkeit): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(
    new Date(eintrag.zeit),
  );
}
