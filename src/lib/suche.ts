import type { Role } from "@/lib/types";

/**
 * Suche im Menü „Mehr“: jede Seite und die wichtigsten Unterpunkte (z. B.
 * „Darstellung“ in den Einstellungen oder „Feiertage“ in der Einrichtung)
 * mit Suchwörtern. Nur Wege – was jemand dort darf, entscheiden die Seiten
 * und die Datenbank.
 */
export interface SuchEintrag {
  titel: string;
  /** Wo es liegt, z. B. „Einstellungen“. */
  wo: string;
  href: string;
  roles: Role[];
  worte: string[];
  /** Nur mit Zugang zum Protokoll. */
  nurProtokoll?: boolean;
}

const ALLE: Role[] = ["employee", "shift_leader", "admin"];
const FUEHRUNG: Role[] = ["shift_leader", "admin"];
const ADMIN: Role[] = ["admin"];

export const SUCHE: SuchEintrag[] = [
  // Hauptseiten
  { titel: "Start", wo: "Übersicht", href: "/dashboard", roles: ALLE, worte: ["dashboard", "startseite", "kacheln", "übersicht"] },
  { titel: "Schichtplan", wo: "Plan", href: "/schichtplan", roles: ALLE, worte: ["plan", "schichten", "dienstplan"] },
  { titel: "Urlaub beantragen", wo: "Plan", href: "/schichtplan?antrag=1", roles: ALLE, worte: ["antrag", "frei", "urlaub nehmen"] },
  { titel: "Mein Urlaub", wo: "Urlaub", href: "/urlaub", roles: ALLE, worte: ["urlaubskonto", "resturlaub", "anträge", "v-tage", "übertrag"] },
  { titel: "Mein Kalender", wo: "Kalender", href: "/meine-schichten", roles: ALLE, worte: ["kalender", "termine", "partner", "familie", "teilen"] },
  { titel: "To-dos", wo: "Für mich", href: "/todos", roles: ALLE, worte: ["aufgaben", "erledigen", "liste"] },
  { titel: "Meine Zahlen", wo: "Für mich", href: "/meine-zahlen", roles: ALLE, worte: ["statistik", "nächte", "sonntage", "jahr"] },
  { titel: "Krankmeldungen", wo: "Für mich", href: "/krank", roles: ALLE, worte: ["krank", "au", "arbeitsunfähig"] },
  { titel: "Hilfe", wo: "Für mich", href: "/hilfe", roles: ALLE, worte: ["fragen", "anleitung", "support", "kontakt"] },

  // Führung
  { titel: "Team", wo: "Verwaltung", href: "/verwaltung?bereich=mitarbeiter", roles: FUEHRUNG, worte: ["mitarbeiter", "personal", "anlegen", "einladen", "personen"] },
  { titel: "Schichtgruppen", wo: "Verwaltung", href: "/verwaltung?bereich=schichtgruppen", roles: FUEHRUNG, worte: ["gruppen", "schicht a", "rotation", "wechsel"] },
  { titel: "AF-Stunden & V-Tage", wo: "Verwaltung", href: "/verwaltung?bereich=altersfreizeit", roles: FUEHRUNG, worte: ["altersfreizeit", "af", "v-tage", "zeitausgleich", "geburtsdatum"] },
  { titel: "Besetzung", wo: "Plan", href: "/besetzung", roles: FUEHRUNG, worte: ["mindestbesetzung", "engpass", "kritisch", "wer ist da"] },
  { titel: "Ausbildung", wo: "Plan", href: "/ausbildung", roles: FUEHRUNG, worte: ["azubi", "berufsschule", "auszubildende"] },
  { titel: "Urlaubsanträge entscheiden", wo: "Urlaub", href: "/urlaubsantraege", roles: FUEHRUNG, worte: ["anträge", "genehmigen", "ablehnen", "entscheiden"] },
  { titel: "Mitteilungen", wo: "Führung", href: "/mitteilungen?neu=1", roles: FUEHRUNG, worte: ["nachricht", "hinweis", "an alle", "rundschreiben"] },
  { titel: "Urlaubssperre", wo: "Mitteilungen & Sperren", href: "/mitteilungen?bereich=sperren&neu=sperre", roles: FUEHRUNG, worte: ["sperre", "sperren", "zeitraum sperren", "urlaubsverbot"] },
  { titel: "Protokoll", wo: "Führung", href: "/protokoll", roles: FUEHRUNG, worte: ["änderungen", "wer hat", "verlauf", "log"], nurProtokoll: true },

  // Verwaltung
  { titel: "Schichten", wo: "Verwaltung", href: "/verwaltung?bereich=schichten", roles: ADMIN, worte: ["schichtarten", "uhrzeiten", "früh", "spät", "nacht"] },
  { titel: "Regeln", wo: "Verwaltung", href: "/verwaltung?bereich=regeln", roles: ADMIN, worte: ["4er-regel", "urlaubsanspruch", "kontingent", "regel"] },
  { titel: "Auswertung", wo: "Verwaltung", href: "/auswertung", roles: ADMIN, worte: ["gesundheitsrate", "ausfall", "anwesenheit", "statistik"] },
  { titel: "Einrichtung", wo: "Verwaltung", href: "/einrichtung", roles: ADMIN, worte: ["feiertage", "bundesland", "schichtsystem", "erste schritte"] },

  // Einstellungen und Profil
  { titel: "Einstellungen", wo: "Konto", href: "/einstellungen", roles: ALLE, worte: ["optionen", "konto"] },
  { titel: "Profil", wo: "Konto", href: "/profil", roles: ALLE, worte: ["name", "geburtsdatum", "stammdaten", "e-mail", "telefon"] },
  { titel: "Sicherheit", wo: "Profil", href: "/profil?bereich=sicherheit", roles: ALLE, worte: ["passwort", "zwei-faktor", "2fa", "geräte", "anmeldung", "wiederherstellung"] },
  { titel: "Datenschutz & meine Daten", wo: "Profil", href: "/profil/datenschutz", roles: ALLE, worte: ["datenschutz", "export", "löschen", "dsgvo", "auskunft"] },
  { titel: "Darstellung", wo: "Einstellungen", href: "/einstellungen?blatt=darstellung", roles: ALLE, worte: ["dunkel", "dunkelmodus", "hell", "farbe", "thema", "schrift"] },
  { titel: "Startseite & Kacheln", wo: "Einstellungen", href: "/einstellungen?blatt=startseite", roles: ALLE, worte: ["kacheln", "klassisch", "kompakt", "anordnen"] },
  { titel: "Aufs Handy", wo: "Einstellungen", href: "/einstellungen?blatt=mitteilungen", roles: ALLE, worte: ["push", "benachrichtigung", "erinnerung", "handy", "mitteilungen"] },
  { titel: "Kalender-Abo", wo: "Einstellungen", href: "/einstellungen?blatt=abo", roles: ALLE, worte: ["ical", "ics", "google", "apple kalender", "outlook", "abo"] },
  { titel: "Was Kollegen sehen", wo: "Einstellungen", href: "/einstellungen?blatt=kollegen", roles: ALLE, worte: ["sichtbarkeit", "privatsphäre", "grund", "kollegen"] },
  { titel: "Rollen und Rechte", wo: "Einstellungen", href: "/einstellungen?blatt=rollen", roles: ALLE, worte: ["rolle", "rechte", "schichtleitung", "administration"] },
  { titel: "Unternehmen", wo: "Einstellungen", href: "/einstellungen?blatt=unternehmen", roles: ADMIN, worte: ["firma", "betrieb", "name"] },
  { titel: "E-Mail-Benachrichtigungen", wo: "Einstellungen", href: "/einstellungen?blatt=benachrichtigungen", roles: ADMIN, worte: ["e-mail", "mail", "benachrichtigung"] },
  { titel: "Mailversand", wo: "Einstellungen", href: "/einstellungen?blatt=mail", roles: ADMIN, worte: ["absender", "smtp", "mail"] },
];

const glatt = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();

/** Treffer für eine Eingabe – Titel zuerst, dann Suchwörter. */
export function suche(eingabe: string, rolle: Role, protokoll: boolean, begriff: (t: string) => string = (t) => t): SuchEintrag[] {
  const q = glatt(eingabe);
  if (!q) return [];
  const teile = q.split(/\s+/);
  const erlaubt = SUCHE.filter((e) => e.roles.includes(rolle) && (!e.nurProtokoll || protokoll));
  const bewertet = erlaubt
    .map((e) => {
      const titel = glatt(begriff(e.titel));
      const alles = `${titel} ${glatt(e.wo)} ${e.worte.map((w) => glatt(begriff(w))).join(" ")}`;
      if (!teile.every((t) => alles.includes(t))) return null;
      // Titel vorne, dann ein Suchwort, das mit der Eingabe beginnt („pass“ → Passwort), dann der Rest.
      const woerter = alles.split(/\s+/);
      const punkte = titel.startsWith(q) ? 0 : titel.includes(q) ? 1 : woerter.some((w) => w.startsWith(teile[0]!)) ? 2 : 3;
      return { e, punkte };
    })
    .filter((x): x is { e: SuchEintrag; punkte: number } => x !== null)
    .sort((a, b) => a.punkte - b.punkte);
  return bewertet.map((x) => x.e).slice(0, 8);
}
