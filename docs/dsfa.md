# Datenschutz-Folgenabschätzung (DSFA) – Entwurf

ShiftNexo · Schichtplanung, Urlaub und Abwesenheiten · Art. 35 DSGVO
Stand: 13.11.2026 · **Entwurf zur Prüfung durch den Datenschutzbeauftragten des Kunden**

> **Wer ist zuständig?** Die DSFA erstellt der **Verantwortliche**, also der Betrieb, der
> ShiftNexo einsetzt. ShiftNexo ist Auftragsverarbeiter und unterstützt dabei
> (Art. 28 Abs. 3 lit. f DSGVO). Dieser Entwurf liefert alle technischen Angaben; die
> Bewertung und die Unterschrift bleiben beim Betrieb und seinem Datenschutzbeauftragten.

---

## 1. Schwellwertprüfung: Ist eine DSFA Pflicht?

| Kriterium (Art. 35 Abs. 3 DSGVO, Muss-Liste der DSK, Leitlinien WP 248) | Trifft zu? | Begründung |
|---|---|---|
| Daten von Beschäftigten (schutzbedürftige Personen, Abhängigkeit) | **ja** | Beschäftigte sind gegenüber dem Arbeitgeber in einer schwächeren Stellung |
| Besondere Kategorien (Art. 9) | **teilweise** | Nur „krank“ als Art der Abwesenheit, keine Diagnose, kein Attest; Freitexte weisen Gesundheitsangaben ab |
| Systematische Überwachung, Leistungs- oder Verhaltenskontrolle | **nein** | Keine Auswertung je Person, keine Zeiterfassung, keine Lesebestätigung, kein Standort; Auswertung nur als Summen ohne Namen (ab 5 Personen je Schicht) |
| Bewertung oder Scoring von Personen | nein | – |
| Automatisierte Entscheidung mit Rechtswirkung | nein | Über Urlaub entscheidet immer ein Mensch; auch „alle unkritischen genehmigen“ startet die Führung selbst. Die App rechnet nur die Besetzung vor und warnt bei Unterbesetzung |
| Umfangreiche Verarbeitung | nein | Ein Betrieb, typischerweise unter 500 Personen |
| Neue Technologie | nein | Übliche Web-Anwendung |
| Zusammenführen von Datensätzen | nein | Privatkalender und Betrieb bleiben getrennt |

**Ergebnis:** Zwei Kriterien treffen zu (Beschäftigtendaten, eingeschränkt Gesundheitsdaten).
Nach WP 248 legen zwei Kriterien eine DSFA nahe. **Empfehlung: DSFA durchführen** – der
Aufwand ist gering, und sie ist der beste Nachweis gegenüber Betriebsrat und Aufsicht.

---

## 2. Beschreibung der Verarbeitung (Art. 35 Abs. 7 lit. a)

**Zweck:** Schichtpläne erstellen und einsehen, Urlaub und Zeitausgleich beantragen und
genehmigen, Abwesenheiten erfassen, Mindestbesetzung prüfen, Beschäftigte über
Änderungen informieren.

**Rechtsgrundlage:** § 26 Abs. 1 BDSG / Art. 6 Abs. 1 lit. b und c DSGVO
(Durchführung des Arbeitsverhältnisses); für „krank“ Art. 9 Abs. 2 lit. b DSGVO i. V. m.
§ 26 Abs. 3 BDSG. Ergänzend die Betriebsvereinbarung.

**Betroffene:** Beschäftigte des Betriebs (Mitarbeiter, Schichtleitung, Administration).

**Daten:**

| Bereich | Daten | Wer sieht es |
|---|---|---|
| Stammdaten | Name, Personalnummer, Schichtgruppe, Rolle, Ein-/Austritt, Qualifikationen | Führung; Name und Schicht auch Kollegen |
| Schichtplan | Schicht je Tag | alle im Betrieb |
| Urlaub, V-Tage, Altersfreizeit | Anträge, Zeiträume, Entscheidungen, Konten; Geburtsdatum (nur für Altersfreizeit) | Person selbst, Führung |
| Abwesenheiten | Art (z. B. krank, Schulung), Zeitraum, Notiz ohne Gesundheitsangaben | Person selbst, Führung; Grund für Kollegen standardmäßig verborgen, „krank“ standardmäßig privat |
| Zugang | E-Mail, Passwort-Hash, Zwei-Faktor-Schlüssel, Fehlversuche | technisch; im Betrieb niemand |
| Protokolle | Änderungsprotokoll (wer hat was geändert, 24 Monate); Anmeldeprotokoll (90 Tage) | Änderungen: Führung; Anmeldungen: im Betrieb niemand |

**Systeme und Empfänger:** Datenbank Supabase (Irland), Anwendung Vercel (Dublin),
Mail-Versand Brevo (EU), verschlüsselte Sicherung GitHub (USA, Schlüssel nur beim
Betreiber). Einzelheiten: AV-Vertrag § 7, Verzeichnis `docs/verarbeitungsverzeichnis.md`.

**Löschung:** automatisiert nach `docs/loeschkonzept.md`; bei Vertragsende Herausgabe
und Löschung nach AV-Vertrag § 10.

---

## 3. Notwendigkeit und Verhältnismäßigkeit (Art. 35 Abs. 7 lit. b)

- **Datenminimierung:** Nur, was für Plan und Urlaub nötig ist. Bewusst **nicht** vorhanden:
  Zeiterfassung, Fehlzeiten („früher gegangen / später gekommen“, abgeschaltet),
  Lesebestätigungen, Standort, Diagnosen, Leistungsauswertungen.
- **Zweckbindung:** Die Auswertung für die Administration zeigt nur Summen ohne Namen.
  Das Anmeldeprotokoll dient nur der Aufklärung von Sicherheitsvorfällen und ist im
  Betrieb nicht einsehbar.
- **Speicherbegrenzung:** feste Fristen, automatisch gelöscht.
- **Transparenz:** Datenschutzerklärung in der App; jede Person sieht ihre eigenen Daten
  und kann sie jederzeit als Datei herunterladen (Art. 15/20).
- **Betroffenenrechte:** Auskunft per Knopf, Berichtigung durch die Person selbst
  (Stammdaten) bzw. Führung, Löschung nach Fristen oder auf Antrag über die Administration.
- **Alternative ohne App** (Papier/Excel) wäre nicht datensparsamer: Listen hängen offen
  aus, Krankmeldungen sind für alle sichtbar, es gibt keine Löschfristen.

---

## 4. Risiken für die Beschäftigten (Art. 35 Abs. 7 lit. c)

Bewertung: Eintrittswahrscheinlichkeit × Schwere, jeweils **gering / mittel / hoch**.
„Vorher“ = ohne Maßnahmen, „Nachher“ = mit den Maßnahmen aus Abschnitt 5.

| # | Risiko | Vorher | Maßnahmen (Abschnitt 5) | Nachher |
|---|---|---|---|---|
| R1 | Kollegen erfahren von Krankheit | mittel × hoch | M3, M4 | gering × mittel |
| R2 | Leistungs- oder Verhaltenskontrolle durch den Arbeitgeber | mittel × hoch | M5, M6 | gering × mittel |
| R3 | Fremde erlangen Zugang (gestohlenes Passwort) | mittel × hoch | M1, M2 | gering × mittel |
| R4 | Daten eines Betriebs werden in einem anderen sichtbar | gering × hoch | M3 | gering × gering |
| R5 | Betreiber (Dienstleister) greift auf Inhalte zu | mittel × mittel | M7 | gering × mittel |
| R6 | Datenverlust oder längerer Ausfall | mittel × mittel | M8, M9 | gering × mittel |
| R7 | Zugriff aus Drittländern (Anbieter mit Sitz in den USA) | gering × mittel | M10 | gering × gering |
| R8 | Daten werden länger als nötig aufbewahrt | mittel × mittel | M11 | gering × gering |
| R9 | Benachrichtigungen (Mail, Handy) verraten Inhalte | mittel × mittel | M12 | gering × gering |
| R10 | Ausfall des einzigen Betreibers | mittel × mittel | M9 | gering × mittel |

---

## 5. Abhilfemaßnahmen (Art. 35 Abs. 7 lit. d)

| # | Maßnahme | Stand |
|---|---|---|
| M1 | Zwei-Faktor-Anmeldung, Pflicht für Administration, Schichtleitung und Betreiber, in der Datenbank durchgesetzt | umgesetzt |
| M2 | Sperre nach 5 Fehlversuchen (Freischaltung durch Administration), Ratenbegrenzung, Passwort mind. 10 Zeichen ohne häufige Passwörter, automatische Abmeldung nach Inaktivität | umgesetzt |
| M3 | Mandantentrennung und Rollenrechte in der Datenbank (Row Level Security), nicht nur in der Oberfläche | umgesetzt |
| M4 | Krankheit standardmäßig privat, Gründe für Kollegen verborgen; Freitexte weisen Gesundheitsangaben ab; keine Diagnosen | umgesetzt |
| M5 | Keine Auswertung je Person; Auswertung nur Summen ab 5 Personen je Schicht; keine Lesebestätigung; Fehlzeiten-Erfassung abgeschaltet | umgesetzt |
| M6 | Anmeldeprotokoll im Betrieb für niemanden einsehbar; Änderungsprotokoll ohne Gesundheitsinhalte | umgesetzt |
| M7 | Betreiber-Übersicht nur mit Zählwerten und Zwei-Faktor; Zugriff auf Inhalte nur auf Weisung; Betreiber-Vorgänge protokolliert | umgesetzt |
| M8 | Nächtliche, zusätzlich verschlüsselte Vollsicherung (14 Tage), monatliche Wiederherstellungsprobe | umgesetzt |
| M9 | Notfallplan mit Notfallzugang (nur lesen) und versiegeltem Wiederherstellungs-Umschlag | umgesetzt |
| M10 | Datenbank und Anwendung in der EU; Sicherung bei GitHub nur verschlüsselt (Schlüssel beim Betreiber); Standardvertragsklauseln bzw. EU-US Data Privacy Framework | umgesetzt; Umzug der Sicherung in die EU geplant |
| M11 | Automatische Löschfristen (Löschkonzept) | umgesetzt |
| M12 | Mails und Handy-Mitteilungen ohne Namen, Zeiträume oder Gründe | umgesetzt |
| M13 | Betriebsvereinbarung mit Zweckbindung und Verbot der Leistungskontrolle | **beim Betrieb** |
| M14 | Externer Sicherheitstest (Penetrationstest) | **offen** – vor dem Regelbetrieb |

---

## 6. Ergebnis

Mit den umgesetzten Maßnahmen ist das **verbleibende Risiko gering bis mittel** und
**vertretbar**. Eine vorherige Konsultation der Aufsichtsbehörde (Art. 36 DSGVO) ist
nicht erforderlich.

Offene Punkte für den Regelbetrieb: Betriebsvereinbarung (M13), externer
Sicherheitstest (M14), Umzug der Sicherung in die EU (M10).

**Überprüfung:** jährlich und bei wesentlichen Änderungen (neue Datenarten, neue
Dienstleister, neue Auswertungen).

| | Name, Funktion | Datum | Unterschrift |
|---|---|---|---|
| Verantwortlicher (Betrieb) | | | |
| Datenschutzbeauftragter (Stellungnahme) | | | |
| Betriebsrat (zur Kenntnis) | | | |
| Auftragsverarbeiter (technische Angaben) | Tarek Oussama Refai, ShiftNexo | | |
