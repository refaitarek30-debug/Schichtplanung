# 10 – Fahrplan und Prompts

Stand: 10. November 2026 · gehört zu `00-uebersicht.md` (Funde) und `09-go-live-checkliste.md` (Anleitungen)

**Ziel:** Die App im Betriebsbereich so weit bringen, dass ein Unternehmen sie ohne Sicherheits- und
Datenschutzbedenken nutzen kann – und sie danach als App veröffentlichen.

**Wichtig vorweg:** Das Review war auftragsgemäß rein lesend. Es wurde nichts repariert außer der Abschaltung der
Lohnabrechnungen. Alle Funde unten sind **noch offen**. Das ist kein Fehler, sondern der Stand – aber er muss jetzt
abgearbeitet werden.

---

## 1. Die ehrliche Lage zum Thema „belangt werden“

*(Keine Rechtsberatung – nur Einordnung.)*

- Sobald ein Unternehmen Beschäftigtendaten in deine App einträgt, bist du **Auftragsverarbeiter**. Das gilt auch,
  wenn es nichts kostet und auch ohne Gewerbeanmeldung. Pflichten: Vertrag (AV-Vertrag), Sicherheit der Daten,
  Verzeichnis, Meldung von Pannen.
- Die typischen Risiken für Anbieter wie dich sind: (1) eine **Datenpanne** mit Folgen, (2) **fehlende oder fehlerhafte
  Pflichtangaben** (Impressum, Datenschutzerklärung, AV-Vertrag) – das ist der häufigste Abmahngrund,
  (3) **Zusagen, die nicht stimmen** („sicher“, „DSGVO-konform“, „Sicherung täglich“).
- **Am meisten schützt dich:** nichts zusagen, was nicht stimmt; die offenen Funde schließen; Verträge und Unterlagen
  vollständig haben; ein Pilot mit schriftlicher Vereinbarung („Testbetrieb, keine Verfügbarkeitszusage“).
- **Einmalig extern prüfen lassen** (ca. 300–800 €, IT-Recht-Anwalt oder Datenschutzberatung): Impressum,
  Datenschutzerklärung, Nutzungsbedingungen, AV-Vertrag. Das ist die beste Einzelinvestition gegen Abmahnungen.
- **Haftung:** Als Einzelunternehmer haftest du mit deinem Privatvermögen. Zwei Dinge dagegen: eine
  **Betriebshaftpflicht mit Vermögensschaden-/Cyber-Baustein** (ab etwa 300–600 € im Jahr, vorher mit dem
  Versicherer klären, dass Software-Dienste gedeckt sind) und später eine **UG oder GmbH**. Beides vor dem ersten
  zahlenden Kunden mit einer Steuerberatung besprechen.
- **Gewerbe:** Anmelden, bevor Geld fließt. Ein reiner kostenloser Pilot ohne Einnahmen ist etwas anderes als der
  Verkauf – im Zweifel das Gewerbeamt fragen.

---

## 2. Sortierung: alle Funde in Gruppen

**Gruppe A – Muss vor dem Betriebsrat-Gespräch stimmen (Aussagen müssen wahr sein)**
- S-01 Zugang der Führung zu fremden Konten · D-05 Sicht der Schichtleitung · Lohnabrechnungen (erledigt, noch nicht live)

**Gruppe B – Sicherheit im Code (Blocker vor dem ersten fremden Unternehmen)**
- S-01, S-02, S-03, S-04 (Mails), L-02/L-09 (Sperren), D-06 (Freitext), S-09 (Bremsen), V19 (Aufräumen Datenbank)

**Gruppe C – Betrieb der Plattform (du im Dashboard, ich helfe mit Anleitungen)**
- P-07 Datensicherung · P-08 Überwachung · S-05 Zwei-Faktor und Passwortregeln · Auth-Einstellungen · B9 Vorschauen schützen ·
  P-12 Tarife (spätestens zum ersten zahlenden Kunden)

**Gruppe D – Recht und Unterlagen**
- Gewerbe, Versicherung · AV-Verträge mit Supabase, Vercel, Brevo · Verarbeitungsverzeichnis · Löschkonzept ·
  Pannen-Ablauf · Datenschutzerklärung anpassen · Prüfung durch Fachperson · Betriebsvereinbarung

**Gruppe E – Richtigkeit der Urlaubs- und Besetzungslogik**
- L-01 Besetzung, L-03 Zeitzone, L-04 eigene Anträge, L-05 Verfall, L-06 Halbtage, L-10 Rücknahme

**Gruppe F – Datenschutz-Funktionen**
- D-02 Löschfristen · D-04 Auskunft/Datenkopie · D-07 Mails · D-10 Zugriff des Betreibers

**Gruppe G – Große Betriebe (erst bei Bedarf)**
- P-01 bis P-05 · Lasttest · Seitenaufteilung

**Gruppe H – Ausbau zum SaaS**
- Rollenmodell · frei einstellbare Arten · Einrichtungs-Assistent

**Gruppe I – App im AppStore**
- Capacitor, Push, Symbole, TestFlight, Einreichung

---

## 3. Fahrplan

### Phase 0 · Vor Donnerstag (Betriebsrat)
Ziel: Alles, was du dem Betriebsrat sagst, ist wahr.
1. Lohnabrechnungen live schalten (Pull Request freigeben).
2. S-01 beheben (Zugang zu fremden Konten) – sonst muss die Unterlage es offen nennen, was sie in `08-betriebsrat.md` auch tut.
3. D-05: Geburtsdatum nur für die Administration.
4. Unterlage `08-betriebsrat.md` und Funktionsblatt `07` lesen, an deinen Betrieb anpassen, **den Abschnitt „Was noch fehlt“ ehrlich lassen**.
5. Im Gespräch nichts zusagen, was noch nicht gebaut ist. Sag: „Berechtigungs- und Löschkonzept erarbeite ich mit euch.“
6. Fragen mitnehmen: Wer darf was sehen? Soll „Fehlzeiten in Stunden“ bleiben? Betriebsvereinbarung gewünscht?
**Aufwand:** 1–2 Tage Code, du: 1 Stunde.

### Phase 1 · Sicherheit schließen (Woche 1–2)
Gruppe B und C. Ich baue, du machst die Dashboard-Schritte.
- S-02, S-03, S-04, Sperren, Freitext-Schutz, Bremsen.
- Du: Zwei-Faktor überall, Datensicherung klären, Überwachung einrichten, Auth-Einstellungen prüfen.
**Fertig, wenn:** Testmatrix grün, Probe-Wiederherstellung einmal durchgeführt, Alarm kommt an.

### Phase 2 · Recht und Unterlagen (Woche 2–4, parallel)
Gruppe D. Du: Gewerbe, Versicherung, Verträge. Ich: Verzeichnis, Löschkonzept, Pannen-Ablauf, Texte entwerfen.
Danach einmal Fachperson drüberschauen lassen.

### Phase 3 · Logik und Datenschutz-Funktionen (Woche 3–6)
Gruppen E und F. Besetzungsprüfung, deutsche Zeit, Löschfristen, Datenkopie.
Nach jeder Änderung: Vergleichslauf und Tests, ein Pull Request je Thema.

### Phase 4 · Pilot im Betrieb (ab hier „ohne Bedenken“)
Schriftliche Pilotvereinbarung, Betriebsvereinbarung (falls der Betriebsrat es will), Rückmeldungen sammeln.

### Phase 5 · App im AppStore (parallel ab Woche 3)
Gruppe I. Developer-Konto beantragen (dauert), Capacitor einrichten, TestFlight, Einreichen.
Voraussetzung: Phase 1 abgeschlossen, Datenschutz-Angaben stimmen.

### Phase 6 · Ausbau
Gruppe H, nur wenn es Betriebe gibt, die es brauchen.

---

## 4. Wenn es mit dem Betrieb nicht klappt: der Privatbereich

Das ist kein Plan B im Sinne von Scheitern – der Privatbereich hat **weniger Risiko** (du bist selbst
verantwortlich, aber es gibt keine Beschäftigtendaten Dritter, keinen Betriebsrat, keinen AV-Vertrag) und
**geringere Kosten**. Die Kosten bleiben niedrig: Apple 99 $/Jahr, Supabase und Vercel kostenlos bis zu den Grenzen
in `04-performance-robustheit.md` (ab Pro dann etwa 45 $/Monat).

**Was dich abhebt (aus dem, was schon da ist):**
- Gebaut für **Wechselschicht-Rhythmen**, nicht für Bürokalender: Schichtfolge einmal eintragen, Jahre im Voraus.
- **Urlaubsplaner je Feiertag** – wie viele Tage frei bekomme ich mit wie vielen Urlaubstagen.
- **Gehalt je Job** mit Zuschlägen, Minijob-Grenze, direkt aus dem Schichtplan.
- **Gemeinsam frei** mit Partner und Familie.
- **Plan-Upload per Foto/Screenshot** aus einer anderen App.
- **Daten in der EU, Lohn bleibt auf dem Gerät.** Das ist ein echtes Verkaufsargument gerade nach der Kritik:
  „Dein Gehalt verlässt dein Handy nicht.“
- Dein Pluspunkt gegenüber Konkurrenz: **Du kennst den Alltag** (Schichtbetrieb, Messwarte), und die Mitarbeiter
  deines Betriebs können es mit Familie kostenlos nutzen.

Mehr Ideen, die zu Privatleuten passen: Ruhezeit-Warnung, Monatsrückblick, Netto-Rechner. Sie stehen schon als
Vorschlag aus früheren Gesprächen.

**Empfehlung:** Beide Linien gleichzeitig, aber mit klarer Priorität: **1. Sicherheit und Unterlagen (nützt beiden),
2. App im AppStore für Privatleute, 3. Betriebsausbau je nach Rückmeldung.** Die App im AppStore hilft auch deinem
Betrieb, weil die Kollegen danach fragen.

---

## 5. Prompts für die nächsten Schritte

Kopiere jeweils einen Block in ein neues Gespräch (oder hierher). Jeder Prompt ist so geschrieben, dass er allein
verständlich ist, nur den Auftrag umsetzt und die Regeln einhält.

**Gemeinsamer Vorspann – bei jedem Prompt mitgeben:**
```
Projekt: ShiftNexo (Repo Schichtplanung). Lies zuerst CLAUDE.md/AGENTS.md und docs/review/00-uebersicht.md.
Regeln: einfaches Deutsch; ein Thema pro Pull Request; Tests schreiben und laufen lassen (npm run test:e2e);
Migrationen als Datei anlegen, ich spiele sie selbst in Supabase ein; Rechtstexte nur mit Versionsnummer
(LEGAL_VERSIONS) und Migration legal_versions ändern; keine Secrets im Chat; kein Pull Request ohne meine Freigabe;
nach jeder Änderung kurz sagen, was ich im Dashboard tun muss.
```

**Prompt 1 – S-01 Zugang zu fremden Konten**
```
Setze Fund S-01 aus docs/review/02-sicherheit.md um (Variante A). Zugangslink (invite.ts) und Passwort-Code
(passwort_code_fuer_mitarbeiter) nur noch für Konten, die sich noch nie angemeldet haben. Für Konten mit Anmeldung:
Fehlermeldung mit Hinweis auf „Passwort vergessen“ und den eigenen Wiederherstellungs-Code. Das Erzeugen von Link und
Code ins Änderungsprotokoll schreiben (write_audit). Schreibe Tests, die genau die alten Wege versuchen und scheitern.
Zeige mir vor dem Pull Request eine Zusammenfassung.
```

**Prompt 2 – S-02 und S-03 Schreibrechte der Führung**
```
Setze S-02 und S-03 aus docs/review/02-sicherheit.md um. Die Schichtleitung darf employees nur in einer festen Liste
von Feldern ändern (Schutz-Trigger, Liste mit mir abstimmen: erst vorschlagen). Die UPDATE-Policy auf leave_requests
für die Führung entfernen; Entscheiden und Zurücknehmen nur über die vorhandenen Funktionen. Prüfe zuerst, ob die
Oberfläche irgendwo direkt in diese Tabellen schreibt. Tests: direkte Schnittstellenaufrufe müssen scheitern.
```

**Prompt 3 – Mails, Freitext, Sperren, Bremsen**
```
Setze S-04 + D-07 (Mails nur als Hinweis ohne persönliche Inhalte), D-06 (Schutz vor Gesundheitsangaben in allen
Freitextfeldern), L-02 + L-09 (Sperre je Person bei Anträgen) und S-09 (Bremse für Zugangslinks, Codes,
Beitritts-Codes inkl. Fehlversuche) um. Je Thema ein eigener Commit, alles in einem Pull Request mit Testliste.
```

**Prompt 4 – Datensicherung reparieren**
```
Die tägliche Sicherung (.github/workflows/datensicherung.yml) schlägt seit dem 29.10.2026 fehl. Finde die Ursache,
repariere sie, sichere auch den Dateispeicher, und baue eine Prüfung ein, die mich bei Fehlern benachrichtigt.
Beschreibe eine Anleitung zur Probe-Wiederherstellung in docs/datensicherung.md. Keine Schlüssel im Chat ausgeben.
```

**Prompt 5 – Unterlagen**
```
Aktualisiere docs/verarbeitungsverzeichnis.md (Mail-Dienst, Dateispeicher, Fehlzeiten, Push), lege ein Löschkonzept
(docs/loeschkonzept.md), einen Pannen-Ablauf (docs/datenpanne.md) und ein Berechtigungskonzept
(docs/berechtigungskonzept.md, Grundlage docs/review/06-rollen-entwuerfe.md) an. Jede Datei mit „Entwurf – keine
Rechtsberatung, bitte prüfen lassen“. Schreibe verständlich, kein Juristendeutsch.
```

**Prompt 6 – Logik**
```
Setze aus docs/review/01-logik.md um: L-03 (Hilfsfunktion „heute“ in deutscher Zeit, alle 23 Stellen), L-01
(Genehmigung bei Unterbesetzung nur mit Bestätigung und Grund, plus Sperre gegen gleichzeitiges Genehmigen),
L-04 (eigene Anträge: je Unternehmen einstellbar, Vorgabe „nein“; für meinen Betrieb Vorgabe „ja“ lassen).
Ein Pull Request je Thema. Vor dem Umbau einen Vergleichslauf alt/neu schreiben.
```

**Prompt 7 – Datenschutz-Funktionen**
```
Setze D-02 (Löschfristen je Unternehmen einstellbar mit Vorschau „das würde gelöscht“, Ausgeschiedene anonymisieren),
D-04 (Meine Daten herunterladen + Gesamtexport je Unternehmen) und D-05 (Sicht der Schichtleitung auf die
eigene Zuständigkeit) um. Zuerst nur einen Entwurf mit Datenmodell und Tests zeigen, dann bauen.
```

**Prompt 8 – App im AppStore**
```
Prüfe, was nötig ist, ShiftNexo mit Capacitor als iPhone-App zu veröffentlichen: Anmeldung, Weiterleitungen,
Push-Meldungen (nativ), Offline-Kalender, Konto löschen in der App, Datenschutz-Etiketten, Symbole, Screenshots,
Testzugang für Apple. Schreibe eine Liste mit Aufwand und Risiken (Richtlinie 4.2 Mindestfunktion, Zahlungen in der
App). Noch nichts bauen.
```

**Prompt 9 – Neustart mit aktuellem Stand**
```
Lies docs/review/00-uebersicht.md und docs/review/10-fahrplan.md. Zeige mir den aktuellen Stand: welche Funde sind
erledigt (Code und Datenbank prüfen), welche offen, und was als Nächstes dran ist. Keine Änderungen.
```

---

## 6. Ablauf je Fund (damit nichts durchrutscht)

1. Prompt abschicken → ich zeige Plan und Änderungen.
2. Tests laufen lassen → Pull Request mit Testliste.
3. Migration: ich lege die Datei an, **du spielst sie ein**, ich prüfe danach lesend.
4. Pull Request freigeben und mergen.
5. In `docs/review/11-stand.md` hakst du ab (oder ich, auf Zuruf): Fund · Datum · Pull Request.

## 7. Meine Empfehlung für die nächsten 7 Tage

| Tag | Was |
|---|---|
| heute | Lohnabrechnungen live (PR freigeben) · Prompt 1 (S-01) |
| morgen | Prompt 2 (Schreibrechte) · D-05 Geburtsdatum |
| vor Donnerstag | Unterlage 08 lesen, Fragen sammeln · Zwei-Faktor einschalten |
| Donnerstag | Gespräch mit dem Betriebsrat – nur zusagen, was gebaut ist |
| danach | Prompt 4 (Sicherung) · Prompt 3 · Gewerbe und Versicherung klären |
