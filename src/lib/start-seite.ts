/**
 * Was beim Öffnen der App zuerst kommt – jede Person wählt das selbst
 * (Einstellungen → Startseite). Gespeichert in `profiles.start_seite`;
 * leer heißt: das Dashboard, wie bisher.
 */
export type StartSeite = "dashboard" | "schichtplan" | "kalender";

export const STARTSEITEN: { wert: StartSeite; label: string; pfad: string; text: string }[] = [
  { wert: "dashboard", label: "Start", pfad: "/dashboard", text: "Die Übersicht mit Kacheln" },
  { wert: "schichtplan", label: "Schichtplan", pfad: "/schichtplan", text: "Der ganze Plan, deine Zeile oben" },
  { wert: "kalender", label: "Mein Kalender", pfad: "/meine-schichten", text: "Nur dein Monat" },
];

export function istStartSeite(wert: unknown): wert is StartSeite {
  return wert === "dashboard" || wert === "schichtplan" || wert === "kalender";
}

export function startPfad(wert: string | null | undefined): string {
  return STARTSEITEN.find((s) => s.wert === wert)?.pfad ?? "/dashboard";
}

/**
 * Merkzettel für die Startseite: „<Benutzer-Id>|<Wahl>“. So kann die
 * Middleware beim Öffnen der App gleich auf die richtige Seite schicken,
 * ohne dass für /start erst eine Funktion anläuft und das Profil gelesen
 * wird. Gilt nur für genau diese Person (Id) – wer sich auf demselben Gerät
 * anders anmeldet, bekommt den normalen Weg. Nichts Geheimes: nur welche
 * Seite zuerst kommt.
 */
export const START_COOKIE = "sp_start";
export const START_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function startCookieWert(benutzerId: string, wahl: StartSeite | "privat" | null): string {
  return `${benutzerId}|${wahl ?? "dashboard"}`;
}

/** Ziel aus dem Merkzettel – nur wenn er zu dieser Person gehört und eine bekannte Wahl enthält. */
export function startZielAusCookie(wert: string | undefined, benutzerId: string): string | null {
  if (!wert) return null;
  const [id, wahl] = wert.split("|");
  if (id !== benutzerId) return null;
  if (wahl === "privat") return "/privat";
  return istStartSeite(wahl) ? startPfad(wahl) : null;
}
