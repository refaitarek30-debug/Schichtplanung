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
    zeit: "2026-11-21T18:00:00+01:00",
    titel: "Urlaub beantragen: deine Zeile im Blick",
    text: "Wer im Plan Urlaub beantragt, sieht die eigene Zeile jetzt umrandet mit „Du“, alle anderen leicht blass. Der Hinweis steht unten über der Leiste – der Plan rutscht nicht mehr. Die Startseite hat engere Abstände.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-21T15:00:00+01:00",
    titel: "„Mehr“ mit Suche",
    text: "Im Menü „Mehr“ kannst du jetzt suchen – z. B. „Passwort“, „Dunkelmodus“ oder „Sperre“ – und landest direkt beim richtigen Punkt. Ein Wisch nach unten schließt das Menü. In „Klassisch“ schwebt „Urlaub beantragen“ jetzt unten rechts.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-20T21:00:00+01:00",
    titel: "Kalender und Startseite: aufgeräumt",
    text: "Eingeladene Personen: bis zu zwei stehen als eigene Zeile im Tag, ab drei als kleine Kreise. „Wen sehe ich?“ kommt mit einem kurzen Wisch vom rechten Rand und geht mit einem kurzen Wisch nach rechts wieder zu. Neue Privatkonten sehen oben nur noch einen schmalen Hinweis.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-20T21:00:00+01:00",
    titel: "Aufgaben als Kachel",
    text: "Offene Aufgaben (z. B. Geburtsdatum bestätigen) stehen jetzt als eigene Kachel auf der Startseite. Wer die Kachel ausblendet, sieht stattdessen einen kleinen Punkt unter der Begrüßung.",
    rollen: ["admin"],
  },
  {
    zeit: "2026-11-20T19:00:00+01:00",
    titel: "Startseite aufgeräumt",
    text: "Im Plan auf der Startseite stehen „Heute“ und „…“ jetzt oben neben dem Monat, „Groß“ neben dem Zeitraum. Legende, Ansicht, Wochenende und Farben findest du unter „…“ – beim Schließen klappt dort alles wieder zu. Die untere Leiste ist schlanker, die aktive Seite sitzt in einer kleinen Glasblase.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-20T12:00:00+01:00",
    titel: "Kalender: 5 Jahre im Voraus gespeichert",
    text: "Deine Schichten der nächsten 5 Jahre werden im Hintergrund auf dem Handy gemerkt – Blättern geht sofort, auch ohne Netz. Das Fenster „Wen sehe ich?“ öffnet sich vom rechten Rand jetzt erst bei einem klaren Wisch, nicht mehr aus Versehen.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-19T12:00:00+01:00",
    titel: "Kalender: Monate flüssig wischen",
    text: "Im Kalender einfach hoch- oder runterwischen – der nächste Monat rastet sauber ein und steht sofort mit deinen Schichten da, weil die kommenden Monate schon vorgeladen sind. Woche, Monat und Jahr wählst du jetzt im Fenster „Wen sehe ich?“.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-18T00:30:00+01:00",
    titel: "Woche: flüssiger und lesbarer",
    text: "Zur Seite wischen schiebt die Woche jetzt sanft weiter. Mehrere ganztägige Einträge stehen sauber untereinander statt übereinander, und auch mehrtägige Termine lassen sich per Halten und Ziehen verschieben.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-17T21:00:00+01:00",
    titel: "Woche im Kalender",
    text: "Im Kalender gibt es jetzt auch eine Wochenansicht: oben rechts umschalten. Schichten mit Uhrzeit, Termine darüber – lange drücken legt einen Termin an, Termine lassen sich verschieben.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-17T21:00:00+01:00",
    titel: "Woche aufgeräumt",
    text: "Die Wochenansicht nutzt jetzt die ganze Breite. Schichten stehen breit, Termine legen sich leicht versetzt darüber, Frei und Urlaub liegen zart im Hintergrund.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-17T18:00:00+01:00",
    titel: "VJ und V überall, 4er-Regel, Gruppenwechsel",
    text: "Ab 2027 steht überall, ob ein V-Tag VJ (fest wie Urlaub) oder V (widerrufbar) ist – im Urlaubskonto, beim Beantragen und in der automatischen Verteilung. Die Leitung kann VJ und V im Plan und bei den Entscheidungen umstellen. Neu ist ein Hinweis zur 4er-Regel (höchstens 4 gleichzeitig weg, bei 4 muss ein V dabei sein). Wechselt jemand die Schichtgruppe, lässt sich das ab einem Datum planen. Am PC zeigt die Startseite den Plan über die ganze Breite.",
  },
  {
    zeit: "2026-11-17T09:00:00+01:00",
    titel: "VJ-Tage ab 2027 und neuer Druckplan",
    text: "Ab 2027 sind 75 % der V-Tage VJ-Tage (Jahresplanung, aufgerundet) und 25 % V-Tage. Die automatische Verteilung nimmt erst VJ, solange da, dann V – im Plan steht „VJ“ oder „V“. Der gedruckte Plan zeigt jetzt U, VJ und V, markiert Karneval und Urlaubssperren (z. B. Abstellung), hat eine kleine Legende und lässt Azubis weg.",
  },
  {
    zeit: "2026-11-16T22:30:00+01:00",
    titel: "Woche: Uhrzeit per Ziehen",
    text: "Eigene Schichten kannst du in der Woche jetzt auch nach oben oder unten ziehen – die neue Uhrzeit gilt nur für diesen Tag. Ganztägiges (Urlaub, Frei, ganztägige Termine) steht nicht mehr oben, sondern als Block von 8 bis 16 Uhr im Raster.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-16T21:30:00+01:00",
    titel: "Countdown mit Fotos",
    text: "Countdowns bekommen auf Wunsch ein Foto, das Datum wählst du mit Vorschlägen wie „1 Monat“ oder direkt im Kalender. Antippen öffnet zum Ändern. In der Woche lassen sich Schichten und Termine jetzt per Gedrückthalten auf einen anderen Tag ziehen.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-16T21:00:00+01:00",
    titel: "Countdown und neue Woche",
    text: "Neu unter Schichten → Countdown: wie lange noch bis zur nächsten Schicht, zum Urlaub oder zu gemerkten Terminen. Die Woche zeigt jetzt 7 Spalten mit Uhrzeiten – lange drücken legt einen Termin an, Termine lassen sich halten und verschieben, der Pinsel geht auch hier.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-16T21:00:00+01:00",
    titel: "Einstellungen aufgeräumt",
    text: "Die Einstellungen haben oben vier Kacheln und darunter kurze Listen – alles Weitere öffnet sich als Fenster. Beim Urlaub steht jetzt dabei, wie viele Tage es noch sind.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-16T18:00:00+01:00",
    titel: "Lohn: was am Ende ausgezahlt wird",
    text: "Unter Schichten → Lohn rechnet ShiftNexo jetzt auch die Auszahlung aus – mit Lohnsteuer und Abgaben, Zuschläge aus deinem Kalender. Monat speichern, später den echten Betrag von der Abrechnung eintragen und alles in der Jahresübersicht sehen. Bleibt nur auf deinem Gerät.",
    bereich: "privat",
  },
  {
    zeit: "2026-11-15T20:00:00+01:00",
    titel: "Neues Logo, aufgeräumtes Profil",
    text: "ShiftNexo hat ein neues Zeichen – auch als App-Symbol (am Handy ggf. die App einmal neu zum Startbildschirm hinzufügen). Das Profil ist jetzt in Daten, Sicherheit und Datenschutz aufgeteilt.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-15T18:00:00+01:00",
    titel: "Berufsschule im Plan",
    text: "Berufsschule (BS) gibt es jetzt als eigene Abwesenheit. Die Leitung trägt sie unter „Plan ändern“ ein, Azubis auch selbst: Profil → Berufsschule eintragen, z. B. jeden Montag. Die Kachel „Nächste Schicht“ zeigt dann, wann es wieder zur Schule geht.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-15T15:00:00+01:00",
    titel: "Kalender-Abo: seltener abgefragt",
    text: "Der Schichtplan im Handy-Kalender (Abo) wird jetzt etwa alle 1–2 Stunden aktualisiert statt ständig. Das schont den Akku und die Server – Änderungen im Plan kommen dadurch etwas später im Handy-Kalender an.",
    bereich: "beide",
  },
  {
    zeit: "2026-11-15T09:00:00+01:00",
    titel: "Profil aufgeräumt",
    text: "Auf dem Handy: Profil-Fenster mit klaren Gruppen, Glocke oben, Abmelden unten. Am Computer: dunkle Seitenleiste, dein Konto-Menü unten links. Benachrichtigungen führen beim Antippen direkt zur passenden Seite.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-14T23:30:00+01:00",
    titel: "Schichtplan drucken wie auf Papier",
    text: "Schichtplan → unter „Plan ändern“: „Plan drucken oder als PDF teilen“. Je Monat ein Blatt, passt quer auf A4 oder A3 – Wochenenden, Feiertage und Ferien farbig, die Gruppe mit F/S/N obendrüber. Bei den Personen steht nur der Urlaub, ohne Legende.",
    bereich: "betrieb",
  },
  {
    zeit: "2026-11-14T23:00:00+01:00",
    titel: "Kacheln selbst anordnen",
    text: "Lange auf eine Kachel der Startseite drücken: Minus blendet sie aus, „Kachel hinzufügen“ holt sie zurück. Neu: „Nächste Schicht“ zeigt, wann z. B. die Berufsschule als Nächstes kommt. Die Einstellungen sind jetzt in aufklappbare Bereiche sortiert.",
    bereich: "betrieb",
  },
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
