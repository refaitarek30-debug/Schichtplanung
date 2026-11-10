# ShiftNexo – Unterlage für den Betriebsrat (Entwurf)

Stand: 10. November 2026 · Datenschutzerklärung Fassung 2.27 · ersetzt nach Freigabe `docs/betriebsrat.md` vom 09.11.2026

> **Dies ist keine Rechtsberatung.** Die Unterlage beschreibt, was die Anwendung technisch tut, und nennt
> offen, was noch fehlt. Die rechtliche Einordnung (Mitbestimmung, Betriebsvereinbarung, Datenschutz) sollte
> mit einer Fachperson abgestimmt werden – etwa der Gewerkschaft, einer Fachanwältin oder dem betrieblichen
> Datenschutz.

---

## 1. Wozu die Anwendung dient

Schichtplanung, Urlaubs- und Abwesenheitsverwaltung, Besetzung je Schicht und Mitteilungen an die Belegschaft.

**Was sie nicht ist:** keine Zeiterfassung, keine Stempeluhr, keine Lohnabrechnung, keine Leistungsbewertung.
Es gibt keine automatischen Entscheidungen über Menschen: Über jeden Antrag entscheidet eine Person
(Art. 22 DSGVO findet keine Anwendung). Es werden keine KI-Funktionen eingesetzt.

## 2. Funktionen in Kürze

| Bereich | Was passiert |
|---|---|
| Schichtplan | Wer arbeitet wann in welcher Schicht; Änderungen durch Schichtleitung und Administration |
| Urlaub | Beschäftigte beantragen in der App; Schichtleitung oder Administration entscheidet; Urlaubs- und Zeitkonten |
| Abwesenheiten | Urlaub, krank, Schulung, Sonderurlaub, Altersfreizeit, Bildungsurlaub, Sonstiges |
| Besetzung | Ampel je Schicht: Soll, Mindestbesetzung, Qualifikationen |
| Mitteilungen | Nachrichten und Hinweise der Führung, mit Lesebestätigung |
| Kalender | eigene Termine und To-dos, Erinnerungen, Kalender-Abo fürs Handy |
| Privatbereich | freiwillig und kostenlos, vom Betrieb getrennt (siehe Abschnitt 8) |

## 3. Welche Daten erhoben werden

| Daten | Zweck | Anmerkung |
|---|---|---|
| Name, Personalnummer, E-Mail, Telefon, Abteilung, Schichtgruppe, Ein-/Austritt, Azubi-Merkmal | Planung, Zuordnung | |
| Qualifikationen | Besetzung nach Qualifikation | |
| Geburtsdatum | Altersfreizeit, Sonderurlaub | freiwillig |
| Schichten je Tag, Schichtwechsel | Plan | |
| Urlaubsanträge mit Zeitraum, Art, Kommentar, Entscheidung, Grund der Ablehnung | Urlaubsverwaltung | Kommentar ist Freitext |
| Abwesenheiten mit Art und Datum, kurze Notiz | Plan, Besetzung | |
| **„Krank“ mit Datum** | Besetzung | Gesundheitsdatum (Art. 9 DSGVO). Keine Diagnose; medizinische Begriffe in der Notiz werden technisch abgewiesen. |
| **Fehlzeiten in Stunden** (früher gegangen, später gekommen) | Zeitkonto | Testphase, nur Administration |
| Urlaubs- und Zeitkonten | Anspruch, Rest | |
| Kommentare im Plan | Absprachen | für das ganze Unternehmen lesbar |
| Benachrichtigungen | Information | |
| Anmeldung: E-Mail, Passwort nur als Prüfwert | Zugang | |
| Protokolle | Nachvollziehbarkeit, Sicherheit | siehe Abschnitt 5 |

**Nicht erhoben** werden: Standort, Arbeitsbeginn und -ende, Pausen, Arbeitsergebnisse, aufgerufene Seiten, Klicks.

## 4. Wer sieht was

| Daten | Person selbst | Kollegen | Schichtleitung | Administration |
|---|---|---|---|---|
| Eigener Plan, eigene Anträge, eigenes Konto | ja | – | ja | ja |
| Schichtplan der anderen (Name, Schicht) | – | ja | ja | ja |
| Grund einer Abwesenheit | ja | nur mit Freigabe der Person, sonst „abwesend“ | ja | ja |
| „Krank“ | ja | nur mit Freigabe der Person | **ja – derzeit alle Schichten** | ja |
| Kranktage je Person (Auswertung) | – | – | – | ja |
| Fehlzeiten in Stunden | eigene | – | – | ja |
| Geburtsdatum | ja | – | **ja – derzeit alle** | ja |
| Urlaubs- und Zeitkonten | eigenes | – | ja | ja |
| Änderungsprotokoll | – | – | ja | ja |
| Anmeldeprotokoll, Fehlermeldungen | – | – | – | nur eine ausdrücklich freigeschaltete Person |

Die Rechte werden in der Datenbank durchgesetzt, nicht nur in der Oberfläche. Rollen vergibt nur die Administration.

**Offen benannt – drei Stellen, an denen die Führung heute mehr kann als vorgesehen** (Ergebnis der Prüfung
vom 10.11.2026, Behebung ist vorgeschlagen, aber noch nicht umgesetzt):

1. **Zugang zu fremden Konten:** Schichtleitung (für Mitarbeiter) und Administration (für alle) können einen
   Zugangslink oder Passwort-Code für das Konto einer Person erzeugen. Damit ist eine Anmeldung als diese Person
   technisch möglich – auch im Privatbereich, falls die Person einen nutzt. Das Erzeugen wird derzeit nicht
   protokolliert, die Person wird nicht benachrichtigt.
2. **Stammdaten:** Die Schichtleitung kann über die technische Schnittstelle mehr Felder ändern, als die Oberfläche
   anbietet (z. B. Austrittsdatum, Urlaubsanspruch). Jede Änderung steht im Protokoll.
3. **Reichweite:** Die Schichtleitung sieht Abwesenheiten und Geburtsdaten des ganzen Unternehmens, nicht nur der
   eigenen Schicht.

## 5. Protokolle – Möglichkeit der Leistungs- und Verhaltenskontrolle

| Protokoll | Inhalt | Wer sieht es | Löschung |
|---|---|---|---|
| Änderungsprotokoll | wer hat wann was geändert (Plan, Anträge, Konten, Stammdaten) – ohne Gesundheitsinhalte | Schichtleitung, Administration | nach 24 Monaten |
| Anmeldeprotokoll | An- und Abmeldung mit Zeit, Art des Zugangs und grobem Gerätetyp; fehlgeschlagene Anmeldungen | freigeschaltete Person der Administration | nach 90 Tagen |
| Fehlermeldungen | Fehler, die jemandem angezeigt wurden | wie oben | nach 90 Tagen |
| Lesebestätigung von Hinweisen | wer hat einen Hinweis gelesen | Absender | mit dem Hinweis, nach 90 Tagen (beim nächsten Senden) |

**Einschätzung:** Die Anwendung ist nicht dafür gebaut, Leistung oder Verhalten zu überwachen. Mehrere Teile sind
dazu aber **objektiv geeignet** – und darauf kommt es nach der Rechtsprechung zu § 87 Abs. 1 Nr. 6 BetrVG an,
nicht auf die Absicht:

- das **Anmeldeprotokoll** (wann meldet sich wer an),
- das **Änderungsprotokoll** (wer bearbeitet wann was – betrifft vor allem die Führungskräfte selbst),
- die **Auswertung der Kranktage je Person**,
- die **Fehlzeiten in Stunden** (früher gegangen, später gekommen),
- die **Lesebestätigungen**.

## 6. Mitbestimmung

Nach unserer Einschätzung berührt die Einführung mehrere Mitbestimmungsrechte:

| Vorschrift | Warum |
|---|---|
| **§ 87 Abs. 1 Nr. 6 BetrVG** – technische Einrichtungen zur Überwachung | siehe Abschnitt 5 |
| § 87 Abs. 1 Nr. 2 – Beginn und Ende der Arbeitszeit, Verteilung | Schichtpläne, Schichtwechsel |
| § 87 Abs. 1 Nr. 5 – Urlaubsgrundsätze und Urlaubsplan | Antragsweg, Sperren, Vorrangregeln |
| § 87 Abs. 1 Nr. 1 – Ordnung des Betriebs | Pflicht zur Nutzung, Erreichbarkeit über Push |
| § 80 Abs. 1 Nr. 1, § 75 – Überwachung von Schutzgesetzen | Datenschutz, Gleichbehandlung |
| § 26 BDSG / Art. 88 DSGVO | Beschäftigtendaten; eine Betriebsvereinbarung kann Rechtsgrundlage sein |

**Eine Betriebsvereinbarung halten wir für sinnvoll** – sie schafft Klarheit für beide Seiten und kann zugleich
die datenschutzrechtliche Grundlage sein. Vorschläge für den Inhalt stehen in Abschnitt 10.

## 7. Vorhandene Schutzmaßnahmen

- **Datensparsame Voreinstellungen:** Gründe für Kollegen aus; „krank“ nur mit Freigabe der Person sichtbar.
- **Keine Diagnosen**, medizinische Begriffe in Notizen zu Abwesenheiten werden abgewiesen.
- **Trennung der Unternehmen** und der Rollen direkt in der Datenbank.
- **Verschlüsselte Übertragung**, Sicherheits-Kopfzeilen, Schutz gegen Durchprobieren von Passwörtern.
- **Automatische Abmeldung:** Administration 15 Minuten, Schichtleitung 8 Stunden, Mitarbeiter 12 Stunden.
- **Kurze Fristen** für Protokolle (90 Tage / 24 Monate), Benachrichtigungen (180 Tage), Plan-Kommentare (12 Monate).
- **Austritt:** Der Zugang zum Betrieb endet am Tag nach dem letzten Arbeitstag von selbst.
- **Einwilligungen** mit Zeitpunkt und Fassung gespeichert, jederzeit widerrufbar.
- **Speicherort:** Datenbank in Irland (EU), Anwendung in Dublin (EU). Verträge zur Auftragsverarbeitung mit den
  Dienstleistern laut Verarbeitungsverzeichnis.
- **Kein Verkauf, keine Werbung, keine Auswertung zu eigenen Zwecken** durch den Anbieter.

## 8. Privatbereich

Beschäftigte können freiwillig einen kostenlosen Privatbereich nutzen (eigener Kalender, eigene Schichten,
Termine, auf Wunsch Lohnabrechnungen). Dafür ist nicht der Betrieb verantwortlich, sondern der Anbieter.
**Der Betrieb sieht davon nichts** – mit der in Abschnitt 4 Nr. 1 genannten technischen Lücke, die vor einer
Einführung geschlossen sein muss. Lohn und Zuschläge bleiben ausschließlich auf dem eigenen Gerät.

## 9. Was noch fehlt

| Thema | Stand | Vorschlag |
|---|---|---|
| Zugang der Führung zu fremden Konten | technisch möglich, nicht protokolliert | Zugangslinks und Codes nur für Konten, die sich noch nie angemeldet haben; sonst Selbsthilfe; Protokoll und Nachricht an die Person |
| **Berechtigungskonzept** | Rollen sind beschrieben, feine Rechte fehlen | Rechte je Rolle einstellbar, Schichtleitung auf eigene Zuständigkeit begrenzt, Übersicht „Wer darf was sehen“ |
| **Löschkonzept** | Fristen nur für Protokolle und Nachrichten | Fristen für Krankheitstage, Anträge, Schichtdaten und ausgeschiedene Personen festlegen und automatisch umsetzen |
| **Auskunft und Datenkopie** | nur von Hand durch den Anbieter | Funktion „Meine Daten herunterladen“ |
| **Verzeichnis der Verarbeitungstätigkeiten** | vorhanden (Stand 22.10.2026), nicht aktuell | Mail-Dienst, Dateispeicher und Fehlzeiten nachtragen |
| **AV-Verträge** | mit Kunden: vorhanden. Mit Dienstleistern: laut Verzeichnis vorhanden | Nachweise vorlegen; Mail-Dienst ergänzen |
| **Datenschutz-Folgenabschätzung** | nicht dokumentiert | durch den Betrieb, Vorlage vom Anbieter |
| **Datensicherung** | nächtliche Sicherung seit 29.10.2026 defekt | reparieren; Wiederherstellung proben; vor Einführung nachweisen |
| Zwei-Faktor-Anmeldung für Administration | nicht vorhanden | einführen |
| Freitextfelder (Kommentar zum Antrag, Fehlzeit-Notiz) | kein Schutz vor Gesundheitsangaben | denselben Schutz wie bei Abwesenheiten; Hinweis am Feld |
| Mails mit Inhalten | Name, Zeitraum und Kommentar stehen in der Mail | Mail nur als Hinweis ohne Inhalt |
| Protokoll der Lesezugriffe auf Auswertungen | nicht vorhanden | einführen, wenn der Betriebsrat es wünscht |
| Fehlzeiten in Stunden | Testphase | Zweck festlegen oder abschalten |

## 10. Vorschläge für die Betriebsvereinbarung

1. **Zweck:** Planung, Urlaub, Information. Ausdrücklich **keine** Leistungs- oder Verhaltenskontrolle;
   Verwertungsverbot für Daten, die entgegen der Vereinbarung ausgewertet werden.
2. **Rollen und Rechte:** Anlage mit der Rechte-Übersicht; Änderungen nur nach Information des Betriebsrats.
3. **Sensible Auswertungen** (Kranktage je Person, Fehlzeiten, Anmeldeprotokoll): namentlich benannte Personen,
   Anlass, Vier-Augen-Prinzip, keine Ranglisten.
4. **Zugriff auf Konten:** keine Anmeldung im Namen anderer; Passwort-Hilfe nur auf Wunsch der Person.
5. **Löschfristen** je Datenart als Anlage.
6. **Freiwilligkeit:** Push-Meldungen, Privatbereich und Kalender-Abo sind freiwillig; keine Pflicht zur
   Erreichbarkeit in der Freizeit; keine Pflicht zur Nutzung privater Geräte (Alternative: Aushang, Terminal).
7. **Transparenz:** Jede Person kann sehen, welche Daten über sie gespeichert sind und wer zuständig ist.
8. **Urlaubsgrundsätze:** Antragsweg, Fristen, Vorrang bei Überschneidung, Rücknahme genehmigten Urlaubs nur
   einvernehmlich.
9. **Kontrollrechte des Betriebsrats:** Einsicht in Rollen, Rechte und Protokoll-Einstellungen; jährliche Prüfung.
10. **Änderungen der Software:** Information vor neuen Funktionen mit Überwachungspotenzial.

## 11. Ansprechpartner

Anbieter (Auftragsverarbeiter): Tarek Oussama Refai, Bornheim – Kontaktdaten im Impressum.
Verantwortlich für die Daten im Betrieb ist das Unternehmen.
