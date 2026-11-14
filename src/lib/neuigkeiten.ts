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
    zeit: "2026-11-14T21:00:00+01:00",
    titel: "Meine Zahlen: genauer und verständlicher",
    text: "Gezählt wird jetzt bis heute – was schon geplant ist, steht extra daneben. Tage ohne Eintrag zählen als frei, dadurch stimmen freie Wochenenden und längste Pause. Der Vergleich mit dem Vorjahr nimmt denselben Zeitraum.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-14T17:00:00+01:00",
    titel: "Zwei-Faktor: Gerät merken",
    text: "Nach dem Code kannst du „Diesem Gerät 30 Tage vertrauen“ anhaken. Dann reicht auf diesem Gerät das Passwort – nach 7 Tagen ohne Anmeldung fragt ShiftNexo wieder. Alle Geräte vergessen: Profil → Zwei-Faktor-Anmeldung.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-13T21:00:00+01:00",
    titel: "Meine Daten herunterladen",
    text: "Alles, was ShiftNexo über dich gespeichert hat, als eine Datei – jederzeit und ohne Nachfrage. Betrieb: Profil → Datenschutz. Privat: Mehr.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-13T18:01:00+01:00",
    titel: "Hinweise ohne Lesebestätigung",
    text: "Unter Mitteilungen steht bei Hinweisen nicht mehr, ob und wann sie gelesen wurden – das sind Verhaltensdaten, die niemand braucht. Zurückziehen geht jetzt jederzeit.",
    rollen: ["admin", "shift_leader"],
  },
  {
    zeit: "2026-11-13T18:00:00+01:00",
    titel: "Zwei-Faktor-Anmeldung",
    text: "Mehr Schutz für dein Konto: Nach dem Passwort fragt ShiftNexo einen Code aus einer Authenticator-App ab (zum Beispiel Microsoft oder Google Authenticator). Für Administration und Schichtleitung ist sie Pflicht, für alle anderen freiwillig unter Profil → Zwei-Faktor-Anmeldung. Nach 5 falschen Versuchen wird der Zugang gesperrt – die Administration schaltet ihn unter Mitarbeiter wieder frei.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-11T18:00:00+01:00",
    titel: "Festes Monatsgehalt im Geld-Bereich",
    text: "Bekommst du ein festes Gehalt? Trag bei deinem Job unter „Bezahlung“ dein Brutto-Grundgehalt ein, z. B. 3.989 €. Die Zuschläge für Nacht, Sonntag und Feiertag werden dann aus dem Stundenlohn gerechnet, der sich aus Gehalt und deinen Wochenstunden ergibt.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-11T16:00:00+01:00",
    titel: "Meine Zahlen – deine eigene Statistik",
    text: "Wie viele Sonntage, Feiertage und Nächte hast du gearbeitet? Längste Serie, freie Wochenenden, Vergleich mit dem Vorjahr und „Mein Jahr“ zum Durchtippen. Nur du siehst das, nichts wird gespeichert. Privat: Schichten → Meine Zahlen. Betrieb: Mehr → Meine Zahlen.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-11T15:00:00+01:00",
    titel: "Kalender als PDF",
    text: "Jahreskalender in drei Darstellungen (schlicht, farbig, kompakt mit Summen) und eine Monatsansicht – zum Drucken oder als PDF. Im Kalender: „Wen sehe ich?“ öffnen, unten „Kalender als PDF“.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-10T19:30:00+01:00",
    titel: "Auswertung ohne Namen",
    text: "Die Auswertung zeigt nur noch Summen für den Betrieb und – ab fünf Personen je Schicht – je Schicht. Einzelne Personen sind nicht mehr erkennbar. Das Anmeldeprotokoll ist im Betrieb nicht mehr einsehbar.",
    rollen: ["admin"],
  },
  {
    zeit: "2026-11-10T16:30:00+01:00",
    titel: "Viel mehr Farben für deine Schichten",
    text: "Beim Bearbeiten einer Schicht: Pastell in sanften Reihen (Salbei, Mint, Senf, Pfirsich, Rosé, Flieder, Himmel, Taubenblau), dazu die kräftigen Farben – und unter „Eigene“ mischst du jede beliebige Farbe selbst.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-10T16:00:00+01:00",
    titel: "„Wen sehe ich?“ neu – auch eigene Schichten ausblenden",
    text: "Vom rechten Rand hereinziehen: Das Fenster folgt dem Finger. Häkchen bei einer Person = Schichten und Termine an oder aus, daneben beides einzeln. Farben änderst du über den Regler oben. Neu bei „Ich“: eigene Schichten ausblenden, um nur die anderen zu sehen.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-10T15:00:00+01:00",
    titel: "Urlaub trotz Unterbesetzung",
    text: "Würde eine Genehmigung die Mindestbesetzung unterschreiten, fragt die App „Trotzdem genehmigen?“. Bei Ja steht es mit Vermerk im Änderungsprotokoll.",
    rollen: ["admin", "shift_leader"],
  },
  {
    zeit: "2026-11-10T15:00:00+01:00",
    titel: "Eigene Anträge der Schichtleitung",
    text: "Unter Verwaltung → Regeln: einstellen, ob die Schichtleitung ihren eigenen Urlaub selbst genehmigt oder die Administration entscheidet.",
    rollen: ["admin"],
  },
  {
    zeit: "2026-11-10T12:00:00+01:00",
    titel: "Passwort vergessen? Eigener Code",
    text: "Im Profil kannst du dir einen eigenen Wiederherstellungs-Code erzeugen. Damit setzt du unter „Passwort vergessen“ selbst ein neues Passwort – ohne E-Mail.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-09T23:30:00+01:00",
    titel: "Kalender: hoch und runter",
    text: "Hochwischen = nächster Monat. Vom rechten Rand nach links ziehen: „Wen sehe ich?“.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-09T20:30:00+01:00",
    titel: "Geld je Job",
    text: "Zwei Jobs? Unter Schichten → Geld bekommt jeder Job seinen eigenen Lohn – Minijob netto mit Grenze, Zuschläge mit eigener Uhrzeit (z. B. 25 % von 23 bis 24 Uhr).",
    bereich: "privat",
  },
  {
    zeit: "2026-11-09T20:30:00+01:00",
    titel: "Andere Uhrzeit an einem Tag",
    text: "Tag antippen → „Andere Zeit“, z. B. heute 17:00–23:30. Stunden und Geld rechnen damit.",
    bereich: "privat",
  },
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
