# 00 – Übersicht zum Review vom 10. November 2026

**Auftrag:** rein lesende Prüfung von ShiftNexo (Logik, Sicherheit, Datenschutz, Performance), Entwürfe für
Onboarding und Rollen, Unterlagen für Schichtmeister und Betriebsrat, Go-live-Checkliste.

**In dieser Phase wurde nichts geändert** – kein Code, kein Schema, keine Einstellung. Angelegt wurden nur die
Dateien in `docs/review/`. Die Datenbank wurde ausschließlich lesend abgefragt (Struktur, Regeln, Zähler, Zeiten);
es wurden keine Personendaten ausgelesen. Die Lasttest-Skripte wurden angelegt, aber nicht ausgeführt.

---

## Dateien

| Datei | Inhalt |
|---|---|
| `01-logik.md` | Besetzung, Urlaubskonto, Anträge, Kalender – 12 Funde mit Varianten |
| `02-sicherheit.md` | RLS, Rollen, Anmeldung, Einladungen, Kopfzeilen – 13 Funde mit Varianten |
| `03-datenschutz.md` | Daten, Sichtbarkeit, Löschung, Export, Dienstleister – 11 Funde mit Varianten |
| `04-performance-robustheit.md` | Messwerte, Skalierung, Sicherung, Überwachung, Tarife – 14 Funde mit Varianten |
| `05-onboarding-entwuerfe.md` | Fragenkatalog, frei einstellbare Arten, Branchen-Vorlagen, drei Assistenten-Varianten |
| `06-rollen-entwuerfe.md` | Rechte-Katalog, Tagschichtmeister, Verwaltung, drei Varianten |
| `07-funktionsblatt-schichtmeister.md` | zwei Seiten ohne Technik-Sprache |
| `08-betriebsrat.md` | Daten, Sichtbarkeit, Überwachungspotenzial, Mitbestimmung, was fehlt |
| `09-go-live-checkliste.md` | Blocker / vorher / später, mit Anleitungen für Supabase, Vercel, GitHub, Brevo |
| `lasttest/` | Skripte für einen Test-Mandanten mit 2.000 Personen (nicht ausgeführt) |

---

## Gesamtbild

**Stark:** Die Mandantentrennung ist konsequent in der Datenbank umgesetzt. Auf allen 68 Tabellen ist
Row Level Security an, nicht angemeldete Besucher haben auf keine Tabelle Zugriff, und es wurde kein Weg von
einem Unternehmen in ein anderes gefunden. Die Geschäftslogik liegt in der Datenbank und lässt sich nicht im
Browser umgehen. Datenschutz-Voreinstellungen sind sparsam, Protokolle haben kurze Fristen.

**Schwach:** Die Lücken liegen nicht zwischen Unternehmen, sondern **innerhalb** eines Unternehmens (was Führung
darf) und im **Betrieb** der Plattform (Sicherung, Überwachung, Tarif, Unterlagen). Für ein SaaS fehlt außerdem
die Beweglichkeit: Viele Regeln deines Betriebs stehen fest im Code.

### Funde nach Schweregrad

**Kritisch (3 Themen)**
| Fund | Kurz |
|---|---|
| S-01 / D-01 | Führung kann sich über Zugangslink oder Passwort-Code als andere Person anmelden – bis in den Privatbereich mit Lohnabrechnungen; nicht protokolliert |
| P-07 / D-03 | Keine verlässliche Datensicherung: kostenloser Supabase-Tarif ohne Sicherungen, eigene Sicherung seit 29.10. defekt, Wiederherstellung nie geprobt |
| P-12, P-08, D-02 | Für den kommerziellen Start: kostenlose Tarife, keine Überwachung, keine Löschfristen für Krankheitstage und Ausgeschiedene |

**Mittel (20)**
| Bereich | Funde |
|---|---|
| Sicherheit | S-02 Schichtleitung ändert Stammdaten direkt (auch Konten sperren) · S-03 Anträge direkt änderbar · S-04 Mail-HTML ungeprüft · S-05 kein zweiter Faktor, schwache Passwortregeln |
| Logik | L-01 Genehmigung ohne verbindliche Besetzungsprüfung · L-02 gleichzeitige Anträge · L-03 „heute“ in UTC · L-04 eigene Anträge genehmigen · L-05 automatischer Verfall von Resturlaub |
| Datenschutz | D-04 kein Datenexport · D-05 Schichtleitung sieht Krankheit und Geburtsdatum aller · D-06 Freitextfelder · D-07 Inhalte in Mails · D-08 Unterlagen veraltet · D-09 Folgenabschätzung fehlt |
| Performance | P-01 Funktionen skalieren nicht auf 2.000 Mitarbeiter · P-02 Listen werden bei 1.000 Zeilen stumm abgeschnitten · P-03 Kalender-Abo nah an der Zeitgrenze · P-04/P-05 Abfrage-Takt und Urlaubskonto-Ansicht |

**Klein (ca. 20)** – u. a. Halbtage, Nachtschicht am Namen erkannt, regionale Feiertage, Verweise nicht an das
Unternehmen gebunden, Registrierung ohne Captcha, CSP mit Inline-Skripten, fehlende Indizes, Fehlerseiten,
Speichergrenze für Lohnabrechnungen. Einzeln in den Dateien 01–04.

---

## Entscheidungen, die du treffen musst

| Nr. | Entscheidung | Meine Empfehlung | Datei |
|---|---|---|---|
| 1 | Zugang der Führung zu fremden Konten | Link/Code nur für Konten, die sich noch nie angemeldet haben; sonst Selbsthilfe; Erzeugen protokollieren | 02, S-01 |
| 2 | Datensicherung | Supabase Pro (tägliche Sicherung) + eigene Sicherung reparieren und in EU-Speicher legen + Probe-Wiederherstellung | 04, P-07 |
| 3 | Tarife | Supabase Pro und Vercel Pro, bevor ein fremdes Unternehmen produktiv arbeitet (ca. 45 $/Monat) | 04, P-12 |
| 4 | Stammdaten-Rechte der Schichtleitung | sofort feste Spaltenliste per Schutz-Trigger; später eigene Funktion | 02, S-02 |
| 5 | Direktes Ändern von Anträgen | Policy entfernen, nur noch über die Funktionen | 02, S-03 |
| 6 | Inhalt der Mails | nur Hinweis ohne persönliche Inhalte | 02, S-04 · 03, D-07 |
| 7 | Anmeldung absichern | Passwort 12 Zeichen und Leak-Prüfung sofort; Zwei-Faktor Pflicht für den Betreiber-Zugang, freiwillig für Administratoren | 02, S-05 |
| 8 | Urlaub trotz Unterbesetzung | bewusste Bestätigung mit Grund + technische Sperre gegen gleichzeitiges Genehmigen | 01, L-01 |
| 9 | Gleichzeitige Anträge | Sperre je Person im Trigger | 01, L-02, L-09 |
| 10 | Zeitrechnung | Hilfsfunktion „heute“ in deutscher Zeit, vorbereitet für Zeitzone je Unternehmen | 01, L-03 |
| 11 | Eigene Anträge genehmigen | je Unternehmen einstellbar, Vorgabe „nein“ | 01, L-04 |
| 12 | Verfall von Resturlaub | einstellbar, Vorgabe „kein automatischer Verfall“; rechtlich klären | 01, L-05 |
| 13 | Halbe Tage | abschalten, bis die einstellbaren Arten kommen | 01, L-06 |
| 14 | Rücknahme genehmigten Urlaubs durch die Führung | nur mit Grund und Bestätigung der Person | 01, L-10 |
| 15 | Löschfristen | je Unternehmen einstellbar mit Vorgaben; Ausgeschiedene anonymisieren; sofort eine Erinnerung an die Administration | 03, D-02 |
| 16 | Auskunft und Datenkopie | schriftlicher Ablauf sofort; Download-Funktion und Gesamtexport vor dem SaaS-Start | 03, D-04 |
| 17 | Sicht der Schichtleitung | Geburtsdatum sofort nur für die Administration; Begrenzung auf die eigene Zuständigkeit mit dem Rollenmodell | 03, D-05 |
| 18 | Freitextfelder | Schutz vor Gesundheitsangaben überall + Hinweis am Feld | 03, D-06 |
| 19 | Folgenabschätzung, Unterlagen | mit einer Fachperson erstellen; Vorlage für Kunden mitliefern | 03, D-08, D-09 |
| 20 | Zugriff des Betreibers | schriftliche Regel sofort; Schalter „Support darf zugreifen“ vor dem SaaS-Start | 03, D-10 |
| 21 | Überwachung | Erreichbarkeits-Prüfung sofort; Fehler-Dienst mit EU-Standort und tägliche Prüf-Abfrage vor dem SaaS-Start | 04, P-08 |
| 22 | Große Mandanten | jetzt messen (Lasttest), Fenster begrenzen; vorberechnete Tagestabelle, sobald ein Mandant über 300 Personen absehbar ist | 04, P-01 |
| 23 | Lange Listen | Warnung bei Abschneiden sofort; seitenweises Laden später | 04, P-02 |
| 24 | Notbetrieb | letzter Schichtplan bleibt auf dem Gerät lesbar | 04, P-09 |
| 25 | Testumgebung | eigenes Supabase-Testprojekt; Vorschauen nicht auf Live-Daten; Vorschau-Adressen schützen | 09, B9, V18 |
| 26 | Onboarding-Assistent | Variante A (Kurz-Start) mit Einrichtungs-Liste; Kapitel aus B als Vertiefung | 05 |
| 27 | Abwesenheits- und Tagesarten | zuerst eigene Namen (Variante 1), Ziel Verhaltensklassen (Variante 2) | 05 |
| 28 | Erste Branchen-Vorlagen | dein Betrieb (Chemie vollkonti), Produktion 3-Schicht, Tagschicht | 05 |
| 29 | Rollenmodell | Variante C (Hybrid), begonnen mit Stufe 1 | 06 |
| 30 | Reichweite der Schichtleitung | auf eigene Zuständigkeit begrenzen (mit Stufe 2) | 06 |
| 31 | Sensible Rechte (krank, Auswertung, Fehlzeiten, Anmeldeprotokoll) | nur mit Bestätigung und Begründung; Übersicht „Wer sieht was“ | 06 |
| 32 | Fehlzeiten in Stunden (Testphase) | Zweck festlegen oder abschalten, bis eine Betriebsvereinbarung steht | 08 |
| 33 | Betriebsvereinbarung | anstreben; Unterlage vorher fachlich prüfen lassen | 08 |

---

## Wie geprüft wurde – und was nicht

**Vollständig gelesen bzw. ausgewertet**
- Konfiguration: `package.json`, `next.config.mjs`, `middleware.ts`, `vercel.json`, Liste der Workflows.
- Live-Datenbank (nur Struktur): alle Tabellen mit RLS-Status, alle Policies, Rechte der Rollen, alle Funktionen
  mit Sicherheitsmerkmalen, Trigger, Indizes, geplante Aufgaben, Erweiterungen, Speicher-Regeln.
- Beide Supabase-Advisors (Sicherheit und Performance).
- Anmeldung, Einladung, Registrierung (Unternehmen und privat), Passwort-Code, Demo, Betreiber-Bereich,
  alle Stellen mit dem Service-Schlüssel.
- Rund 40 Funktionen der Urlaubs-, Besetzungs-, Beitritts- und Löschlogik im Volltext (jeweils letzter Stand).
- Vorhandene Unterlagen in `docs/`.

**Nur automatisch oder in Stichproben**
- Die 206 Migrationen wurden nicht Zeile für Zeile gelesen. Aus ihnen wurde der jeweils **letzte Stand jeder
  Funktion** herausgezogen (330 Funktionen) und mit Suchmustern auf Rechteprüfungen untersucht.
- Die Oberfläche (rund 64.000 Zeilen) wurde gezielt gelesen: Formulare, Datenabfragen, Abfrage-Takt, Fehlerseiten.
  Nicht jede Komponente.
- Der Privatbereich wurde auf Zugriffsregeln geprüft, nicht auf fachliche Richtigkeit (Gehalts- und Urlaubsrechner).
- Die automatischen Tests wurden in dieser Phase nicht ausgeführt.

**Nicht geprüft**
- Einstellungen von Supabase Auth, der Vercel-Tarif und die tatsächlich abgeschlossenen Verträge –
  per Abfrage nicht einsehbar, stehen als Aufgaben in der Checkliste.
- Kein Angriffstest und kein Lasttest gegen die Live-Seite.
- Hochrechnungen für 2.000 Mitarbeiter sind **Schätzungen** aus heutigen Messwerten, keine Messungen.
- Rechtliche Bewertungen (DSGVO, BetrVG, Urlaubsrecht) sind Hinweise, **keine Rechtsberatung**.
- Ob eine der gefundenen Lücken je ausgenutzt wurde.

---

## Vorschlag für die Reihenfolge

1. **Diese Woche (auch für deinen Betrieb):** Entscheidungen 1, 2, 4, 5 · Checkliste B6, B7, B8.
2. **Vor dem ersten fremden Unternehmen:** Entscheidungen 3, 6, 7, 15, 19, 21, 25 · Rest der Stufe 1.
3. **Vor dem öffentlichen Start:** Entscheidungen 8–14, 16–18, 20, 22–24 · Stufe 2.
4. **Ausbau zum SaaS:** Entscheidungen 26–31 – zuerst das Rollen-Fundament (Stufe 1), dann eigene Namen für Arten
   und der Kurz-Start-Assistent.
