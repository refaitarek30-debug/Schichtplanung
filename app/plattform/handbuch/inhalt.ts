/**
 * Handbuch Privatbereich – für neue Betreiber. Einfache Sprache, Schritt für
 * Schritt. Bilder liegen unter /public/handbuch (Testdaten, fiktive Namen).
 *
 * Wenn sich im Privatbereich etwas ändert: hier mitpflegen.
 */

export interface Abschnitt {
  titel: string;
  text?: string[];
  schritte?: string[];
  tipp?: string;
  achtung?: string;
}

export interface Kapitel {
  id: string;
  titel: string;
  kurz: string;
  bilder?: { datei: string; alt: string }[];
  abschnitte: Abschnitt[];
}

export const KAPITEL: Kapitel[] = [
  {
    id: "ueberblick",
    titel: "1. Was ist der Privatbereich?",
    kurz: "Wofür es ihn gibt und was ihn vom Betrieb unterscheidet.",
    abschnitte: [
      {
        titel: "In einem Satz",
        text: [
          "Der Privatbereich ist ein kostenloser Schichtkalender für jeden – auch ohne Betrieb. Man trägt seine eigenen Schichten ein, plant Termine, sieht, wann der Partner frei hat, und rechnet seinen Lohn aus.",
          "Er ist für immer kostenlos. Geld verdienen wir nur mit Betrieben (Schichtplanung, Urlaubsanträge).",
        ],
      },
      {
        titel: "Privat und Betrieb – der Unterschied",
        text: [
          "Betrieb: Die Firma plant. Die Schichtleitung macht den Plan, Mitarbeiter stellen Urlaubsanträge. Daten gehören dem Betrieb.",
          "Privat: Die Person plant für sich selbst. Niemand aus einer Firma sieht etwas davon. Daten gehören der Person.",
          "Wer in einem Betrieb ist, hat oben ein Umschalten zwischen Betrieb und Privat. Dann erscheinen die Schichten aus dem Betrieb automatisch auch im Privatkalender (nur zum Anschauen, ändern geht dort nicht).",
        ],
      },
      {
        titel: "Wo die Daten liegen",
        text: [
          "In der Datenbank (auf dem Server): Schichten, eigene Schichtarten, Termine, To-dos, Verbindungen zu anderen, Kalender-Abo.",
          "Nur auf dem Handy der Person (nie auf dem Server): Lohn und Gehalt, Countdowns (auch Fotos), Urlaubsplaner, gemerkte Ansichten. Wechselt jemand das Handy, sind diese Dinge dort nicht mehr da.",
          "Wir als Betreiber sehen keine Inhalte. In der Konsole stehen nur Zahlen (z. B. wie viele Konten es gibt) – keine Namen von Terminen, keine Schichten einzelner Personen.",
        ],
        tipp: "Fragt jemand „Wo ist mein Lohn hin?“ nach einem Handywechsel: Das ist kein Fehler, der Lohn liegt nur auf dem alten Gerät.",
      },
    ],
  },
  {
    id: "start",
    titel: "2. Registrieren, anmelden, verbinden",
    kurz: "Wie man hineinkommt – mit Spitzname statt E-Mail.",
    abschnitte: [
      {
        titel: "Neu registrieren",
        schritte: [
          "shiftnexo.de öffnen → „Privat kostenlos starten“.",
          "Einen Spitznamen wählen. Er wird beim Tippen geprüft – ist er vergeben, steht es sofort darunter.",
          "Ein Passwort festlegen und der Datenschutzerklärung zustimmen.",
          "Fertig: Danach führt ein kurzer Assistent zu den ersten Schichten.",
        ],
        achtung:
          "Privatkonten haben meist keine E-Mail-Adresse. „Passwort vergessen“ per Mail geht dann nicht – dafür gibt es in der Konsole den Passwort-Code (Kapitel 11).",
      },
      {
        titel: "Anmelden",
        text: ["Mit Spitzname und Passwort. Nach 5 falschen Versuchen wird das Konto gesperrt – freischalten geht in der Konsole unter „Zugänge & Support“."],
      },
      {
        titel: "Als App auf den Startbildschirm",
        schritte: [
          "iPhone: in Safari auf „Teilen“ → „Zum Home-Bildschirm“.",
          "Android: im Chrome-Menü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.",
        ],
        tipp: "Mitteilungen aufs Handy funktionieren am iPhone nur, wenn die App so auf dem Startbildschirm liegt.",
      },
      {
        titel: "Mit einem Betrieb verbunden",
        text: [
          "Wer zusätzlich im Betrieb ist, sieht im Privatkalender die Betriebsschichten mit (in der Farbe, die er gewählt hat). Ändern kann man sie nur im Betrieb.",
          "Freie Tage aus dem Betrieb erscheinen als „Frei“.",
        ],
      },
    ],
  },
  {
    id: "leiste",
    titel: "3. Die Leiste unten",
    kurz: "Fünf Knöpfe – alles Weitere hängt daran.",
    abschnitte: [
      {
        titel: "Die fünf Bereiche",
        text: [
          "Kalender – Monat, Woche oder Jahr. Hier trägt man alles ein.",
          "Schichten – Übersicht der Stunden, Lohn, Urlaubsplaner, Countdown, Statistik, eigene Schichtarten, Plan hochladen.",
          "Teilen – Partner, Familie, Freunde einladen; Kalender-Abo für Google/Apple.",
          "To-dos – kleine Aufgaben mit Datum zum Abhaken.",
          "Mehr – Einstellungen, PDF, eigene Daten, Konto löschen.",
        ],
        tipp: "Nochmal auf „Kalender“ tippen, wenn man schon im Kalender ist, springt zurück zu heute.",
      },
      {
        titel: "Oben rechts",
        text: [
          "Glühbirne: Neuigkeiten – was neu in der App ist.",
          "Kreise mit Namen: „Wen sehe ich?“ – wessen Schichten und Termine im eigenen Kalender angezeigt werden.",
          "Kalender-Symbol: Ansicht wählen (Woche, Monat, Jahr).",
        ],
      },
    ],
  },
  {
    id: "kalender",
    titel: "4. Kalender: Monat",
    kurz: "Schichten eintragen, Tag öffnen, Pinsel.",
    bilder: [{ datei: "01-monat.png", alt: "Monatsansicht mit Schichten und kleinen Kreisen der verbundenen Personen" }],
    abschnitte: [
      {
        titel: "Was man sieht",
        text: [
          "Jeder Tag zeigt die eigene Schicht als farbiges Feld (z. B. Früh, Spät, Nacht, Frei).",
          "Darunter kleine Kreise: die Schichten der verbundenen Personen (F, S, N …). Ein kleiner Punkt oben rechts am Tag heißt: Es gibt einen Termin.",
          "Heute ist rot eingekreist. Feiertage stehen rot (Bundesland unter Mehr → Feiertage).",
        ],
      },
      {
        titel: "Blättern",
        text: ["Nach oben wischen = nächster Monat, nach unten = vorheriger. Am Computer mit den Pfeilen."],
      },
      {
        titel: "Einen Tag öffnen",
        schritte: [
          "Auf den Tag tippen – unten öffnet sich ein Blatt.",
          "Dort die Schicht wählen. Bis zu drei Einträge pro Tag sind möglich (z. B. Früh + Arzttermin-Zusatz).",
          "„Andere Uhrzeit“: Die Schicht beginnt an diesem einen Tag anders (z. B. 17:00 statt 18:00). Das gilt nur für diesen Tag.",
          "Darunter stehen Termine und To-dos des Tages; „+ Termin“ legt einen neuen an.",
        ],
      },
      {
        titel: "Lange drücken",
        text: ["Lange auf einen Tag drücken öffnet direkt „Neuer Termin“ für diesen Tag."],
      },
      {
        titel: "Pinsel – viele Tage auf einmal",
        schritte: [
          "Unten rechts auf den Pinsel tippen. Unten erscheint eine Leiste mit allen Schichtarten.",
          "Eine Schicht wählen (z. B. Früh).",
          "Auf Tage tippen – oder kurz halten und über mehrere Tage wischen. Alle bekommen diese Schicht.",
          "Nochmal auf einen Tag mit derselben Schicht tippen nimmt sie wieder weg. „Leeren“ löscht Einträge.",
          "Oben erscheint „Rückgängig“, falls man sich vertan hat.",
          "Mit dem X die Pinsel-Leiste schließen.",
        ],
        tipp: "Für einen festen Rhythmus (z. B. 2 Früh, 2 Spät, 2 Nacht, 4 frei) ist die „Schichtfolge“ schneller – Kapitel 7.",
      },
    ],
  },
  {
    id: "woche",
    titel: "5. Kalender: Woche und Jahr",
    kurz: "Zeitraster mit Uhrzeiten, Ziehen zum Verschieben.",
    bilder: [{ datei: "02-woche.png", alt: "Wochenansicht mit Schichten als Blöcke und Terminen darüber" }],
    abschnitte: [
      {
        titel: "Woche",
        text: [
          "Sieben Spalten, 0 bis 24 Uhr. Schichten stehen als breite farbige Blöcke an ihrer Uhrzeit – Nachtschichten laufen in den nächsten Tag.",
          "Termine liegen leicht versetzt über den Schichten. Ganztägiges (Frei, Urlaub, ganztägige Termine) liegt zart im Hintergrund von 8 bis 16 Uhr.",
          "Zur Seite wischen = andere Woche.",
        ],
      },
      {
        titel: "In der Woche bearbeiten",
        schritte: [
          "Lange in ein freies Feld drücken: neuer Termin zu genau dieser Uhrzeit.",
          "Einen Termin lange drücken und ziehen: anderer Tag und andere Uhrzeit.",
          "Eine eigene Schicht lange drücken und ziehen: zur Seite = anderer Tag, hoch/runter = andere Uhrzeit nur an diesem Tag.",
          "Schichten aus dem Betrieb lassen sich hier nicht verschieben.",
        ],
      },
      {
        titel: "Jahr",
        text: ["Zwölf kleine Monate mit den Schichtfarben – gut, um Urlaub und freie Wochenenden zu überblicken. Antippen öffnet den Monat."],
      },
    ],
  },
  {
    id: "termine",
    titel: "6. Termine und To-dos",
    kurz: "Termine mit Uhrzeit, Wiederholung, Erinnerung – und Aufgaben.",
    bilder: [{ datei: "12-todos.png", alt: "To-do-Liste" }],
    abschnitte: [
      {
        titel: "Termin anlegen",
        schritte: [
          "Tag öffnen → „+ Termin“ (oder lange auf den Tag drücken).",
          "Titel eingeben. Optional: ganztägig, bis-Datum (mehrere Tage), Uhrzeit von/bis, Ort, Notiz.",
          "Wiederholung: täglich, wöchentlich, monatlich, jährlich.",
          "Erinnerung: kommt als Mitteilung aufs Handy (wenn Mitteilungen erlaubt sind).",
          "Speichern.",
        ],
      },
      {
        titel: "Serie ändern oder löschen",
        text: ["Bei einem Wiederholungstermin fragt die App: nur diesen Tag, ab hier, oder die ganze Serie."],
      },
      {
        titel: "Termin bei jemand anderem",
        text: ["Wer verbunden ist und „darf eintragen“ erlaubt hat, bei dem kann man Termine direkt in seinen Kalender schreiben."],
      },
      {
        titel: "Countdown merken",
        text: ["Im Termin auf „Countdown“ tippen – dann zählt der Countdown (Kapitel 8) die Tage bis dahin."],
      },
      {
        titel: "To-dos",
        text: [
          "Unter „To-dos“: Aufgaben mit Datum und optional Uhrzeit. Abhaken, bearbeiten, suchen.",
          "Die Zahl am Symbol zeigt offene To-dos bis heute. To-dos sieht nur die Person selbst.",
        ],
      },
    ],
  },
  {
    id: "schichten",
    titel: "7. Schichten: eigene Schichtarten, Schichtfolge, Plan hochladen",
    kurz: "Die Grundlage – welche Schichten es gibt und wie sie in den Kalender kommen.",
    bilder: [{ datei: "04-schichten.png", alt: "Schichten-Seite mit Übersicht und Liste" }, { datei: "05-meine-schichten.png", alt: "Meine Schichten mit Schichtarten" }],
    abschnitte: [
      {
        titel: "Die Schichten-Seite",
        text: [
          "Oben groß: die Stunden des Monats. Darunter eine Liste: Übersicht, Lohn, Urlaubsplaner, Countdown, Meine Zahlen, Gemeinsam frei, Meine Schichten, Plan hochladen.",
          "Mit den Pfeilen oben den Monat wechseln.",
        ],
      },
      {
        titel: "Meine Schichten (Schichtarten)",
        schritte: [
          "Schichten → Meine Schichten.",
          "Jede Schichtart hat: Name (z. B. Früh), Kürzel (F), Farbe, Uhrzeit von–bis, Stunden.",
          "Art festlegen: Arbeit, Frei, Urlaub oder Krank. Urlaub und Krank zählen in der Statistik nicht als Arbeitstag.",
          "Neue Schichtart mit „+“, ändern durch Antippen.",
        ],
        tipp: "Am Anfang gibt es Vorschläge (Früh, Spät, Nacht, Frei, Urlaub, Krank). Die kann man umbenennen und umfärben.",
      },
      {
        titel: "Schichtfolge (Rotation)",
        schritte: [
          "Meine Schichten → Schichtfolge.",
          "Das Muster zusammenklicken (z. B. F F S S N N – – – –) oder eine Vorlage wählen.",
          "Startdatum und Dauer wählen (z. B. 1 Jahr).",
          "Übernehmen – der Kalender füllt sich von selbst. Bestehende Einträge können überschrieben oder behalten werden.",
        ],
      },
      {
        titel: "Plan hochladen",
        text: [
          "Statt alles einzutippen: einen Screenshot vom Schichtplan (z. B. aus der Firmen-App) oder eine .ics-Kalenderdatei hochladen.",
          "Die App erkennt die Tage und Schichten und zeigt vorher, was sie eintragen würde. Erst nach Bestätigen wird gespeichert, und es gibt „Rückgängig“.",
        ],
      },
    ],
  },
  {
    id: "lohn",
    titel: "8. Lohn, Urlaubsplaner, Countdown, Gemeinsam frei",
    kurz: "Die Extras auf der Schichten-Seite.",
    bilder: [{ datei: "06-geld.png", alt: "Lohn-Assistent Schritt 1" }, { datei: "07-urlaubsplaner.png", alt: "Urlaubsplaner" }, { datei: "09-countdown.png", alt: "Countdown" }, { datei: "08-gemeinsam.png", alt: "Gemeinsam frei" }],
    abschnitte: [
      {
        titel: "Lohn – erstmal einrichten",
        schritte: [
          "Schichten → Lohn. Beim ersten Mal startet ein Assistent in 4 Schritten.",
          "Job benennen (z. B. Tankstelle) und die Art wählen: Minijob (ohne Abzüge), Normaler Job (mit Steuer und Sozialabgaben) oder Ohne Geld.",
          "Stundenlohn oder Monatsgehalt eintragen. Zuschläge (Nacht, Sonntag, Feiertag) in Prozent oder € pro Stunde, mit Uhrzeit.",
          "Bei normalem Job: Steuerklasse, Kinder, Kirchensteuer, Zusatzbeitrag der Krankenkasse.",
        ],
      },
      {
        titel: "Lohn – im Alltag",
        text: [
          "Der Monat zeigt: Brutto, Abzüge, geschätztes Netto. Steuerfreie Zuschläge (Sonntag, Feiertag, Nacht) werden richtig abgezogen.",
          "Extras pro Monat (Prämie, Fahrgeld …) kann man dazu tragen. Den tatsächlich ausgezahlten Betrag kann man eintragen – so sieht man die Abweichung.",
          "Reiter „Jahr“: alle Monate auf einen Blick.",
          "Mehrere Jobs möglich. Jede Schichtart wird einem Job zugeordnet.",
        ],
        achtung: "Alles rund um Lohn liegt nur auf dem Handy. Es ist eine Schätzung, keine Lohnabrechnung.",
      },
      {
        titel: "Urlaubsplaner",
        text: [
          "Zeigt für jeden Feiertag im Jahr, wie viele Urlaubstage wie viele freie Tage am Stück bringen („Hebel“).",
          "Man kann übrige Urlaubstage eintragen, Vorschläge nach Strategie bekommen, Zeilen ändern, den Plan als .ics speichern oder direkt in den Kalender übernehmen.",
        ],
      },
      {
        titel: "Countdown",
        text: [
          "Oben: wie lange noch bis zur nächsten Schicht (läuft live mit).",
          "Darunter: Urlaub (kommt von selbst), gemerkte Termine und eigene Countdowns (z. B. Geburtstag, Reise).",
          "Eigenen Countdown anlegen: „Hinzufügen“ → Symbol, Titel, Datum (mit Vorschlägen wie „1 Monat“ oder im Kalender) und auf Wunsch ein Foto. Antippen ändert oder löscht.",
        ],
      },
      {
        titel: "Gemeinsam frei",
        text: ["Wann haben zwei Verbundene beide frei? Monat mit zwei Balken je Tag, Jahr als zwölf kleine Monate. Gerechnet nur auf dem Gerät."],
      },
    ],
  },
  {
    id: "zahlen",
    titel: "9. Meine Zahlen (Statistik)",
    kurz: "Sonntage, Nächte, Arbeitstage, Serien – und ein Jahresrückblick.",
    bilder: [{ datei: "10-zahlen.png", alt: "Meine Zahlen" }],
    abschnitte: [
      {
        titel: "Was gezählt wird",
        text: [
          "Arbeitstage, Stunden, Nächte, Sonntage, Feiertage, freie Wochenenden.",
          "Arbeitstage zählen nicht: Urlaub, V-Tag, Krank, Sonderurlaub, Gewerkschaft und Ähnliches.",
          "„Längste Zeit am Stück“: Freie Tage unterbrechen die Serie nicht – erst Urlaub, V-Tag oder Krank.",
          "„Freies Wochenende“ = Samstag und Sonntag beide Urlaub oder V-Tag.",
        ],
      },
      {
        titel: "Rückblick",
        text: ["Ein Jahresrückblick zum Durchwischen – nett zum Teilen."],
      },
    ],
  },
  {
    id: "teilen",
    titel: "10. Teilen: Partner, Familie, Gruppen, Kalender-Abo",
    kurz: "Wer sieht was – und wie man Leute dazuholt.",
    bilder: [{ datei: "11-teilen.png", alt: "Teilen-Seite" }],
    abschnitte: [
      {
        titel: "Jemanden mit eigenem Konto verbinden",
        schritte: [
          "Teilen → Einladen. Es entsteht ein Code (6 Zeichen) oder ein Link.",
          "Die andere Person öffnet den Link oder gibt den Code ein und bestätigt.",
          "Beide legen fest: Schichten zeigen, Termine zeigen, darf bei mir eintragen.",
          "Danach sieht man sich gegenseitig im Kalender (kleine Kreise im Monat).",
        ],
      },
      {
        titel: "Personen ohne Konto (z. B. Oma)",
        text: ["Man kann einen Link für jemanden ohne Konto erstellen. Die Person sieht über den Link den Kalender (nur lesend oder mit Eintragen, je nach Einstellung). Den Link kann man jederzeit beenden."],
      },
      {
        titel: "Gruppen",
        text: ["Mehrere Leute in einer Gruppe (z. B. Familie, Fahrgemeinschaft) – alle sehen sich gegenseitig."],
      },
      {
        titel: "„Wen sehe ich?“ und Farben",
        schritte: [
          "Oben rechts auf die Kreise tippen.",
          "Je Person einstellen: Schichten anzeigen, Termine anzeigen.",
          "Farben: Zahnrad → Farbpunkt neben der Person. Man kann eine Farbe für alle Schichten wählen oder je Schicht (Früh, Spät, Nacht, Arbeit, Urlaub, Frei).",
        ],
      },
      {
        titel: "Kalender-Abo (Google / Apple)",
        text: [
          "Teilen → Kalender-Abo: ein geheimer Link, den man in Google Kalender oder Apple Kalender abonniert. Dann stehen die Schichten dort mit drin.",
          "Die Kalender-Apps holen sich die Daten selbst – je nach App alle paar Stunden. Der Link kann jederzeit beendet und neu erstellt werden.",
        ],
        tipp: "Kommt nichts an: Link neu erstellen und neu abonnieren. Google aktualisiert manchmal nur einmal am Tag.",
      },
    ],
  },
  {
    id: "mehr",
    titel: "11. Mehr: Einstellungen, PDF, Daten, Konto",
    kurz: "Alles, was man selten braucht – aber wissen muss.",
    bilder: [{ datei: "13-mehr.png", alt: "Mehr-Seite mit Kacheln und Listen" }, { datei: "14-export.png", alt: "Kalender als PDF" }],
    abschnitte: [
      {
        titel: "Einstellungen",
        text: [
          "Mitteilungen: Erinnerungen und Hinweise aufs Handy an/aus.",
          "Darstellung: hell/dunkel, Größe.",
          "Feiertage: Bundesland wählen.",
          "Wochenstunden: für die Übersicht der Stunden.",
          "Name & Sicherheit: Spitzname, Passwort ändern, optional eine Kontakt-E-Mail.",
        ],
      },
      {
        titel: "Kalender als PDF",
        text: ["Mehr → PDF: Jahreskalender (schlicht, farbig, kompakt) oder Monat. Über „Drucken“ → „Als PDF sichern“ speichern oder teilen."],
      },
      {
        titel: "Meine Daten und Konto löschen",
        text: [
          "„Meine Daten herunterladen“ liefert alles, was über die Person gespeichert ist (Datenschutz-Auskunft).",
          "„Konto löschen“ löscht sofort und endgültig. Das kann niemand rückgängig machen – auch wir nicht.",
        ],
      },
    ],
  },
  {
    id: "support",
    titel: "12. Support: häufige Fragen und was du tust",
    kurz: "Die typischen Anfragen – und die Antwort.",
    abschnitte: [
      {
        titel: "„Ich komme nicht mehr rein / Passwort vergessen“",
        schritte: [
          "Erst sicherstellen, dass die Anfrage wirklich von der Person kommt (z. B. Rückruf, bekannte Nummer).",
          "Konsole → Zugänge & Support.",
          "Gesperrt (5 Fehlversuche)? → „Freischalten“.",
          "Passwort vergessen bei Privatkonto? → „Passwort-Code“ erzeugen, der Person persönlich geben. Sie setzt damit selbst ein neues Passwort.",
        ],
        achtung: "Niemals ein Passwort für jemanden ausdenken, aufschreiben oder per Mail schicken.",
      },
      {
        titel: "„Mein Partner sieht meine Schichten nicht“",
        schritte: [
          "Ist die Verbindung da? (Teilen → Deine Leute)",
          "Ist „Schichten zeigen“ an – bei der Person selbst und beim Partner unter „Wen sehe ich?“.",
          "App ganz schließen und neu öffnen.",
          "Hilft das nicht: im Protokoll/Logs nachsehen bzw. Entwickler fragen.",
        ],
      },
      {
        titel: "„Mein Lohn / Countdown ist weg“",
        text: ["Lohn, Countdown und Urlaubsplaner liegen nur auf dem Gerät. Neues Handy oder Browserdaten gelöscht = weg. Bitte neu einrichten."],
      },
      {
        titel: "„Im Google-Kalender fehlen Schichten“",
        text: ["Kalender-Abo neu erstellen und neu abonnieren. Google aktualisiert langsam (bis zu 24 Stunden)."],
      },
      {
        titel: "„Ich will mein Konto löschen“",
        text: ["Die Person kann das selbst: Mehr → Konto löschen. Auf Wunsch geht es auch in der Konsole unter „Löschen“ – aber nur, wenn sicher ist, dass es die Person ist."],
      },
      {
        titel: "Datenschutz-Regeln für dich",
        text: [
          "Keine Inhalte von Nutzern ansehen, nur wenn die Person selbst darum bittet und es für die Hilfe nötig ist.",
          "Nie Passwörter, Codes oder Zwei-Faktor-Schlüssel in Chats, Mails oder Notizen schreiben.",
          "Bei Unsicherheit: lieber nachfragen als etwas löschen.",
        ],
      },
    ],
  },
  {
    id: "konsole",
    titel: "13. Deine Zugriffe in der Konsole",
    kurz: "Was du als Betreiber siehst und darfst.",
    abschnitte: [
      {
        titel: "Anmeldung",
        text: ["Die Konsole verlangt immer den Zwei-Faktor-Code (Authenticator-App). Ohne Zwei-Faktor kein Zugang."],
      },
      {
        titel: "Die Bereiche",
        text: [
          "Übersicht – Zahlen und eine „Zu tun“-Liste.",
          "Firmen & Konten – Betriebe mit Zählwerten (keine Inhalte).",
          "Zugänge & Support – Sperren lösen, Zwei-Faktor zurücksetzen, Passwort-Code für Privatkonten.",
          "Nutzung – zusammengezählte Zahlen zum Privatbereich (keine Namen).",
          "Umfrage – Antworten aus dem Privatbereich, ohne Namen.",
          "Löschen – Papierkorb für Firmen, Konten löschen.",
          "Protokoll – wer im Team was gemacht hat.",
          "Team – Betreiber aufnehmen (voll oder nur lesen).",
          "Unterlagen & Tresor – wichtige Dokumente und verschlüsselte Zugangsdaten.",
          "Handbuch – diese Seite.",
        ],
      },
      {
        titel: "Nur lesen oder voll",
        text: [
          "„Nur lesen“: alles ansehen, aber nichts ändern (gut für die Einarbeitung).",
          "„Voll“: auch freischalten, Codes erzeugen, löschen, Team ändern.",
          "Neue Betreiber legt jemand mit vollem Recht unter Team an. Der Einladungslink wird persönlich weitergegeben.",
        ],
      },
    ],
  },
];
