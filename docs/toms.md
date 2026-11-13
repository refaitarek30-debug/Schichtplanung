# Technische und organisatorische Maßnahmen (TOM)

Anlage zum Vertrag über die Auftragsverarbeitung (§ 8) · Art. 32 DSGVO
Stand: 13.11.2026 · ShiftNexo (shiftnexo.de)

Diese Anlage beschreibt, wie die Daten der Beschäftigten geschützt werden. Sie
nennt, was **heute tatsächlich umgesetzt** ist, und unter „Offene Punkte“ ehrlich,
was noch fehlt.

---

## 1. Vertraulichkeit (Art. 32 Abs. 1 lit. b)

### 1.1 Zutrittskontrolle (Räume, Server)
- ShiftNexo betreibt keine eigenen Server. Die Verarbeitung läuft ausschließlich in
  Rechenzentren der Unterauftragsverarbeiter (siehe AVV § 7):
  - Datenbank und Anmeldung: Supabase, Rechenzentrum Irland (AWS eu-west-1)
  - Anwendung: Vercel, Rechenzentrum Dublin (dub1)
- Zutrittsschutz, Bewachung und Zertifizierungen (u. a. SOC 2 Typ II, ISO 27001
  der Rechenzentren) richten sich nach den Angaben der Anbieter.
- Der Betreiber arbeitet nicht mit Ausdrucken oder lokalen Kopien von Daten der
  Beschäftigten.

### 1.2 Zugangskontrolle (Anmeldung)
- Persönliche Konten, keine Sammelkonten. Passwörter nur als Hash (bcrypt beim
  Anmeldedienst), Mindestlänge 8 Zeichen.
- **Zwei-Faktor-Anmeldung** (6-stelliger Code aus einer Authenticator-App, TOTP):
  **Pflicht für Administration, Schichtleitung und Betreiber**, freiwillig für alle
  anderen. Die Pflicht setzt die Datenbank selbst durch: Wer einen zweiten Faktor hat,
  bekommt ohne bestätigten Code keine Firmendaten – auch nicht über direkte
  Schnittstellenaufrufe.
- **Sperre nach 5 Fehlversuchen** (falsches Passwort oder falscher Code). Firmenkonten
  bleiben gesperrt, bis die Administration des Betriebs freischaltet.
- Zusätzlich Ratenbegrenzung je IP-Adresse und je Konto für Anmeldung, Passwort
  zurücksetzen und Registrierung (gesalzene Hashwerte, nach einem Tag gelöscht).
- **Automatische Abmeldung** nach Inaktivität: Administration 15 Minuten,
  Schichtleitung 8 Stunden, Mitarbeiter 12 Stunden. Die Prüfung läuft auf dem Server
  bei jedem Aufruf; danach werden die Anmelde-Cookies entfernt.
- Passwort vergessen: Link per E-Mail oder eigener Wiederherstellungs-Code; ein
  Einmal-Code der Leitung gilt 24 Stunden, wird protokolliert, und die Person wird
  benachrichtigt. Konten, die die Person selbst eingerichtet hat, kann die Leitung
  nicht übernehmen.

### 1.3 Zugriffskontrolle (wer sieht was)
- **Mandantentrennung in der Datenbank** (Row Level Security in PostgreSQL): Jede
  Zeile trägt die Unternehmenskennung; jede Abfrage wird serverseitig auf das
  Unternehmen der angemeldeten Person begrenzt. Eine Abfrage über
  Unternehmensgrenzen hinweg ist technisch ausgeschlossen.
- Rollenmodell Mitarbeiter – Schichtleitung – Administration, Einzelheiten im
  Berechtigungskonzept (`docs/berechtigungskonzept.md`). Die Schichtleitung kann
  nur Personen mit der Rolle Mitarbeiter bearbeiten.
- Gesundheitsdaten: Krankmeldungen sind standardmäßig für Kolleginnen und Kollegen
  unsichtbar; Freitextfelder weisen Gesundheitsangaben ab; keine Diagnosen.
- **Keine Leistungs- und Verhaltenskontrolle:** keine Auswertung je Person; die
  Auswertung für die Administration zeigt nur Summen ohne Namen (je Schicht erst ab
  5 Personen). Hinweise der Leitung haben **keine Lesebestätigung**. Das
  Anmeldeprotokoll kann im Betrieb niemand einsehen.
- **Betreiber-Zugang:** Der Betreiber (technischer Dienstleister) braucht für die
  Betreiber-Übersicht die Zwei-Faktor-Anmeldung. Diese Übersicht zeigt nur Zählwerte
  je Firma (keine Pläne, keine Namen von Beschäftigten). Ein Zugriff auf Inhalte
  erfolgt nur auf Weisung des Auftraggebers, z. B. zur Fehlerbehebung (AVV § 5).
  Lösch- und Support-Vorgänge werden im Betreiber-Protokoll festgehalten.
- Geheimnisse (Schlüssel für Datenbank, Mail-Versand, Handy-Mitteilungen) liegen
  nur als verschlüsselte Umgebungsvariablen beim Hosting, nie im Programmcode.

### 1.4 Trennungskontrolle
- Getrennte Mandanten über die Unternehmenskennung (siehe 1.3).
- Der Privatbereich (persönlicher Schichtkalender) ist vom Betrieb getrennt; der
  Betrieb sieht ihn nicht.
- Test- und Demodaten liegen in eigenen Demo-Firmen mit erfundenen Namen und werden
  aus allen Auswertungen herausgehalten.

### 1.5 Pseudonymisierung und Verschlüsselung (Art. 32 Abs. 1 lit. a)
- Übertragung nur verschlüsselt (TLS 1.2+, HSTS mit 2 Jahren).
- Speicherung verschlüsselt im Ruhezustand (AES-256 beim Datenbank-Anbieter).
- Codes und Links (Passwort-Codes, Einladungen, Kalender-Abo) werden nur als
  Prüfwert (SHA-256) gespeichert, nie im Klartext.
- Nächtliche Sicherung zusätzlich mit eigenem Passwort verschlüsselt (AES-256).

---

## 2. Integrität (Art. 32 Abs. 1 lit. b)

### 2.1 Weitergabekontrolle
- Keine Weitergabe an Dritte außer den Unterauftragsverarbeitern in AVV § 7.
- E-Mails (über Brevo, EU) und Handy-Mitteilungen enthalten keine Inhalte wie Namen,
  Zeiträume oder Gründe, nur den Hinweis, dass es etwas Neues gibt.
- Schutz im Browser: Content-Security-Policy, X-Frame-Options DENY (kein Einbetten),
  Referrer-Policy, Permissions-Policy (keine Kamera, kein Mikrofon, kein Standort).

### 2.2 Eingabekontrolle
- **Änderungsprotokoll:** Anträge, Entscheidungen, Planänderungen, Konten,
  Stammdaten, Rollen, Freischaltungen und das Zurücksetzen der Zwei-Faktor-Anmeldung
  werden mit Zeitpunkt, handelnder und betroffener Person gespeichert – ohne
  Gesundheitsinhalte. Aufbewahrung 24 Monate.
- Anmeldeprotokoll (Anmeldung, Abmeldung, Fehlversuche, Sperren): nur für die
  Aufklärung von Sicherheitsvorfällen durch den Betreiber, im Betrieb für niemanden
  sichtbar, nach 90 Tagen gelöscht.
- Kritische Änderungen (Rollen, Zuordnungen, Entscheidungen) nur über geprüfte
  Funktionen auf dem Server, nicht direkt.

---

## 3. Verfügbarkeit und Belastbarkeit (Art. 32 Abs. 1 lit. b und c)

- **Nächtliche Vollsicherung** der Datenbank (Rollen, Aufbau, Daten), verschlüsselt,
  14 Tage aufbewahrt (`docs/datensicherung.md`).
- **Wiederherstellungsprobe** monatlich und auf Knopfdruck: Die neueste Sicherung wird
  entschlüsselt und auf Vollständigkeit geprüft.
- Anwendung ohne eigenen Server (Vercel): Ausfälle einzelner Rechner fängt der
  Anbieter ab; jede neue Fassung kann per Klick auf die vorige zurückgesetzt werden.
- Störung des Anmeldedienstes: Die App meldet sie ehrlich, statt still abzumelden;
  bestehende Sitzungen bleiben erhalten.
- Ablauf für Störungen (`docs/stoerungen.md`) und Datenpannen (`docs/datenpanne.md`)
  mit Meldung an den Auftraggeber ohne schuldhaftes Zögern.

## 4. Wiederherstellbarkeit (Art. 32 Abs. 1 lit. c)
- Wiederherstellung aus der nächtlichen Sicherung; geprüft durch die monatliche
  Probe. Ziel: Wiederherstellung innerhalb von 24 Stunden, Datenverlust höchstens
  ein Tag.

---

## 5. Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d)

- **Automatische Tests bei jeder Änderung**: Oberflächentests der wichtigsten Abläufe
  (u. a. Zwei-Faktor-Anmeldung und Sperre) laufen vor jeder Veröffentlichung.
- Prüfskripte für Zugriffsregeln und Mandantentrennung in der Datenbank
  (`supabase/tests/`).
- Sicherheitshinweise des Datenbankanbieters (Supabase Advisors) nach Änderungen am
  Datenbankschema.
- Veröffentlichung nur über geprüfte Änderungsanfragen (Pull Requests) mit
  automatischer Prüfung; keine Änderungen direkt am Live-System.
- Überprüfung dieser Anlage mindestens jährlich und nach jeder wesentlichen Änderung.

## 6. Datenschutz durch Technik und Voreinstellungen (Art. 25)
- Nur Daten, die für Dienstplan und Urlaub nötig sind. Keine Standortdaten, keine
  Zeiterfassung, keine Fehlzeiten-Erfassung („früher gegangen“), keine Lesebestätigung.
- Voreinstellungen datensparsam: Abwesenheitsgründe für Kolleginnen und Kollegen
  verborgen, Krankheit privat.
- Löschfristen sind automatisiert (`docs/loeschkonzept.md`).
- **Auskunft auf Knopfdruck:** Jede Person lädt ihre Daten selbst als Datei herunter
  (Profil → Datenschutz → „Meine Daten herunterladen“).

## 7. Organisatorische Maßnahmen
- Der Betreiber ist zur Vertraulichkeit verpflichtet (AVV § 6).
- Eigene Zugänge des Betreibers zu Datenbank (Supabase), Hosting (Vercel) und Code
  (GitHub) sind mit Zwei-Faktor-Anmeldung geschützt.
- Datenpanne: fester Ablauf, Meldung an den Auftraggeber, Unterstützung bei der
  Meldung an die Aufsichtsbehörde innerhalb von 72 Stunden.
- Verzeichnis der Verarbeitungstätigkeiten, Löschkonzept, Berechtigungskonzept und
  Unterlage für den Betriebsrat liegen vor.

---

## Offene Punkte (ehrlich)

| Punkt | Stand | Plan |
|---|---|---|
| Sicherung liegt bei GitHub (Firma in den USA) | verschlüsselt mit eigenem Passwort, GitHub hat keinen Schlüssel | Umzug zu einem Speicher in Deutschland |
| Anmeldung mit Firmenkonto (SSO / Entra ID) | nicht vorhanden | mit größerem Tarif des Datenbankanbieters |
| Prüfung gegen bekannte, geleakte Passwörter | nicht vorhanden | mit Supabase Pro |
| Zugesagte Verfügbarkeit (SLA) | keine (kostenloser Tarif) | mit Supabase Pro bzw. Vertrag |
| Externer Sicherheitstest (Penetrationstest) | noch keiner | vor dem Regelbetrieb; Test durch die IT des Auftraggebers ist willkommen |
| Abhängigkeit von einer Person | Notfallkonto und Notfall-Blatt in Arbeit | Notfallkonto (nur lesen), Notfall-Umschlag |
