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
