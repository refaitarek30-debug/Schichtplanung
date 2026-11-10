# 04 – Performance und Robustheit

Stand: 10. November 2026 · rein lesende Prüfung.
Messwerte stammen aus der Statistik der Live-Datenbank (`pg_stat_statements`, nur Zeiten und Zähler, keine
Personendaten) und aus einem lokalen Produktions-Build. **Es wurde kein Lasttest gegen die Live-Seite gefahren.**
Die Lasttest-Skripte liegen in `docs/review/lasttest/` und sind für einen **Test-Mandanten in einem eigenen
Supabase-Projekt** gedacht.

**Schweregrade:** kritisch = vor dem Start beheben · mittel = vor dem SaaS-Start beheben · klein = kann später.

---

## Kurzfassung

Für die heutige Größe (5 Unternehmen, 94 Mitarbeiter, 24 MB Datenbank) ist die App schnell genug.
Die Risiken liegen woanders:

1. **Kein Netz und kein doppelter Boden:** keine verlässliche Sicherung, keine Überwachung, kostenloser Tarif.
2. **Ein großer Mandant bricht mehrere Bildschirme:** Die Plan- und Auswertungsfunktionen rechnen je Person und Tag
   einzeln. Hochgerechnet auf 2.000 Mitarbeiter laufen sie in die Zeitgrenze der Datenbank (8 Sekunden).
3. **Listen ohne Seiten:** Ab 1.000 Zeilen schneidet die Schnittstelle stumm ab.

| Nr. | Fund | Schwere |
|---|---|---|
| P-07 | Keine verlässliche Sicherung; Wiederherstellung nie geprobt | **kritisch** |
| P-08 | Keine Überwachung, keine Alarme | **kritisch** für SaaS, heute mittel |
| P-12 | Tarife: Supabase „Free“; Vercel-Tarif prüfen | **kritisch** für den kommerziellen Start |
| P-01 | Plan- und Auswertungsfunktionen skalieren nicht auf große Mandanten | mittel (bei erstem Großkunden kritisch) |
| P-02 | Keine Seitenaufteilung; stilles Abschneiden bei 1.000 Zeilen | mittel |
| P-03 | Kalender-Abo ist der größte Verbraucher und nah an der Zeitgrenze | mittel |
| P-04 | Abfrage-Takt je offenem Gerät (60 s / 20 s) | mittel bei vielen Nutzern |
| P-05 | Urlaubskonto-Ansicht rechnet jedes Mal alles neu | mittel |
| P-06 | 29 Fremdschlüssel ohne Index, 103 doppelte Policies | klein |
| P-09 | Verhalten bei Ausfall: gut im Privatbereich, im Betrieb kein Notbetrieb | klein–mittel |
| P-10 | Wiederholungen und Doppel-Absenden nur im Browser abgesichert | klein–mittel |
| P-11 | Paketgröße in Ordnung; Messung auf echtem Mobilnetz fehlt | klein |
| P-13 | Lohnabrechnungen können den Speicher schnell füllen | klein–mittel |
| P-14 | Fehlerseiten und Ladezustände unvollständig | klein |

---

## 1. Messwerte

### 1.1 Datenbank heute

| Wert | Stand |
|---|---|
| PostgreSQL | 17.6, Zeitzone UTC |
| Größe | 24 MB (Grenze im kostenlosen Tarif: 500 MB) |
| Unternehmen / Mitarbeiter / Konten | 5 / 94 / 26 |
| Größte Tabellen | `privat_tage` 1.848, `audit_logs` 1.461, `leave_requests` 788, `absences` 695, `notifications` 580, `shift_assignments` 395 Zeilen |
| Zeitgrenze je Abfrage | angemeldet 8 s, nicht angemeldet 3 s |
| Geplante Aufgaben | 7, davon 2 jede Minute; 0 Fehler in 7 Tagen bei 6.187 Läufen |

### 1.2 Die teuersten Aufrufe (seit Beginn der Statistik)

| Aufruf | Anzahl | Mittel | Maximum | Summe |
|---|---|---|---|---|
| `abo_plan` (Kalender-Abo, ohne Anmeldung) | 11.512 | **426 ms** | **2.975 ms** | 4.905 s |
| `schichtplan_kompakt` (Schichtplan) | 13.375 | 124 ms | 5.926 ms | 1.662 s |
| `staffing_range` (Besetzung über Zeitraum) | 2.165 | 270 ms | 3.025 ms | 586 s |
| `leave_requests` (Tabelle direkt) | 6.581 | 67 ms | 2.703 ms | 440 s |
| `shift_leave_overlap` | 5.347 | 71 ms | 2.437 ms | 381 s |
| `shift_plan_grid` | 2.110 | 92 ms | 1.202 ms | 194 s |
| `leave_balances_view` (Urlaubskonto) | 4.117 | 46 ms | 2.238 ms | 188 s |
| `absence_report` (Auswertung) | 186 | **850 ms** | 4.275 ms | 158 s |
| `af_uebersicht` | 1.146 | 124 ms | 3.454 ms | 142 s |
| `aenderungsstand` (Takt alle 60 s) | 4.982 | 27 ms | 1.476 ms | 137 s |
| `team_leave_balances` | 127 | **368 ms** | 2.512 ms | 47 s |
| `leave_staffing_detail` | 408 | 170 ms | 1.030 ms | 69 s |

Zum Vergleich die Hintergrundlast: `erinnerungen_anstossen` 35.769 Läufe à 19 ms, `mail_versand_anstossen`
20.821 à 6 ms, `demo_cleanup` 966 à 114 ms. Das ist unkritisch.

### 1.3 Hochrechnung auf einen Mandanten mit 2.000 Mitarbeitern

Der größte Mandant hat heute unter 100 Personen. Die Funktionen oben rechnen je Person und Tag
(Funktionsaufruf je Zelle: `effective_shift_id`, `is_planned_workday`, `schicht_laeuft_fuer`). Der Aufwand wächst
also mindestens linear mit der Zahl der Personen – Faktor rund 25:

| Aufruf | heute (Mittel) | hochgerechnet | Zeitgrenze 8 s |
|---|---|---|---|
| `absence_report` | 0,85 s | ≈ 20 s | **überschritten** |
| `team_leave_balances` | 0,37 s | ≈ 9 s | **überschritten** |
| `staffing_range` | 0,27 s | ≈ 7 s | knapp, bei Spitzen überschritten |
| `schichtplan_kompakt` | 0,12 s | ≈ 3 s | hält, aber träge; Spitzen überschritten |
| `shift_plan_grid` für ein ganzes Jahr | ≈ 5,5 s (frühere Messung) | weit darüber | **überschritten** |

Das ist eine **Hochrechnung, keine Messung**. Mit `lasttest/seed-testmandant.sql` und `lasttest/messung.sql`
lässt sie sich in einem Testprojekt nachmessen.

### 1.4 Paketgröße (lokaler Produktions-Build)

| Wert | Größe |
|---|---|
| Alle Skripte und Styles zusammen | 2,97 MB roh, **0,92 MB komprimiert**, 84 Dateien |
| Größtes einzelnes Paket | 70 kB komprimiert |
| Styles | 19 kB komprimiert |
| Texterkennung (Tesseract) | wird erst beim Screenshot-Import geladen |

Eine Seite lädt nur einen Teil davon. Auf einem schwachen Mobilnetz (ca. 400 kbit/s) sind 300 kB rund 6 Sekunden.
Wie viel der erste Aufruf wirklich lädt, misst `lasttest/lighthouse.sh` (gegen eine Vorschau-Adresse).

---

## P-07 · Sicherung und Wiederherstellung (kritisch)

**Was passiert:**
- Supabase-Tarif „Free“: keine automatischen Sicherungen, keine Wiederherstellung auf einen Zeitpunkt.
- Die eigene nächtliche Sicherung (`.github/workflows/datensicherung.yml`, verschlüsselt, 14 Tage) schlägt
  seit dem **29.10.2026** fehl.
- Eine Wiederherstellung wurde – soweit ersichtlich – nie geprobt.
- Der Dateispeicher (Lohnabrechnungen) ist in keiner Sicherung enthalten.

Ein falsches `delete`, ein fehlerhafter Migrationslauf oder ein gesperrtes Supabase-Konto – und die Daten von
fünf Unternehmen sind weg.

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Kosten |
|---|---|---|---|---|---|
| A | **Supabase Pro**: tägliche Sicherung, 7 Tage, Wiederherstellung per Klick. | sofort, ohne Eigenbau | nur tageweise; Speicher nicht enthalten | S | ca. 25 $/Monat |
| B | A + **Wiederherstellung auf den Zeitpunkt** (PITR, Zusatzoption). | höchstens Minuten Verlust | deutlich teurer | S | zusätzlich ca. 100 $/Monat |
| C | Eigene Sicherung reparieren und in einen EU-Speicher legen (statt GitHub/USA), inklusive Dateispeicher. | unabhängig von Supabase; EU | Eigenbau, muss überwacht werden | M | wenige Euro |
| D | Vor jeder Migration automatisch eine Sicherung ziehen. | schützt vor dem häufigsten Fehler | – | S | – |

**Empfehlung:** A + C + D. B, sobald zahlende Kunden da sind. Dazu **einmal im Quartal eine Probe-Wiederherstellung**
in ein leeres Projekt, mit Datum im Notfallplan. Schritt-für-Schritt in `09-go-live-checkliste.md`.

---

## P-08 · Überwachung und Fehlermeldungen (kritisch für SaaS)

**Was es gibt:** Fehlermeldungen, die Nutzer sehen, landen im Protokoll (`audit_logs`, Aktion `fehler.*`).
`/api/version` zeigt die laufende Version. Die Mail-Karte in den Einstellungen zeigt einen Stau im Postausgang.

**Was fehlt:**
- Kein Fehler-Dienst (Sentry o. ä.) – Abstürze im Browser oder auf dem Server sieht niemand.
- Keine Erreichbarkeits-Prüfung von außen – einen Ausfall bemerkst du erst, wenn jemand anruft.
- Kein Alarm, wenn eine geplante Aufgabe scheitert (Austritte, Aufräumen, Mail-Versand, Sicherung –
  die Sicherung ist seit 12 Tagen defekt, ohne dass ein Alarm kam).
- Kein Alarm bei vollem Speicher, vielen Fehlanmeldungen oder langsamen Abfragen.

| Variante | Beschreibung | Aufwand | Kosten |
|---|---|---|---|
| A | **Minimal:** Erreichbarkeits-Prüfung von außen (z. B. UptimeRobot, Better Stack) auf `/api/version` und eine neue Seite `/api/gesund` (prüft Datenbank). Alarm per Mail/SMS. GitHub-Mail bei fehlgeschlagener Sicherung einschalten. | S | 0–10 €/Monat |
| B | A + Fehler-Dienst mit EU-Standort (Sentry EU oder selbst betriebenes GlitchTip). Personenbezug abschalten (keine IP, keine Namen). | M | 0–30 €/Monat |
| C | B + tägliche Prüf-Abfrage in der Datenbank: gescheiterte Aufgaben, Postausgang älter als 1 Stunde, Speicher über 80 %, Abfragen über 2 s → Mail an dich. | M | – |

**Empfehlung:** A sofort, B + C vor dem SaaS-Start. Ein Fehler-Dienst ist ein weiterer Auftragsverarbeiter –
ins Verzeichnis und in den AV-Vertrag aufnehmen.

---

## P-12 · Grenzen der aktuellen Tarife (kritisch für den kommerziellen Start)

### Supabase „Free“ (ausgelesen: Organisation „ShiftNexo“, Tarif `free`)

| Grenze | Wert im kostenlosen Tarif | Stand heute | Bewertung |
|---|---|---|---|
| Datenbank | 500 MB | 24 MB | reicht für Jahre: Schichten werden heute aus Rotationsmustern berechnet und nicht je Tag gespeichert. Würde je Person und Tag gespeichert (P-01, Variante A), wären 2.000 MA × 3 Jahre ≈ 2,2 Mio. Zeilen ≈ 300–400 MB |
| Dateispeicher | 1 GB | wenig | **knapp**: je Person sind 300 Lohnabrechnungen à 10 MB erlaubt (P-13) |
| Datenverkehr | 5 GB/Monat | unbekannt | bei vielen Kalender-Abos relevant |
| Sicherungen | keine | – | siehe P-07 |
| Pausierung | nach 7 Tagen ohne Aktivität | läuft (Aufgaben jede Minute) | Risiko gering, aber kein Anspruch |
| Verbindungen | geteilte kleine Instanz | – | bei Last eng |
| Zusagen | keine Verfügbarkeitszusage, Support nur Forum | – | für zahlende Kunden nicht tragbar |
| Sicherheitsfunktionen | Leak-Prüfung, Sitzungsgrenzen erst ab Pro | aus | siehe S-05, S-11 |

### Vercel

Der Tarif ließ sich nicht auslesen. **Der kostenlose Tarif („Hobby“) erlaubt laut Vercel nur nicht-kommerzielle
Nutzung.** Sobald ein Unternehmen zahlt (oder die App geschäftlich eingesetzt wird), ist „Pro“ nötig
(ca. 20 $ je Mitglied und Monat). Bitte im Dashboard prüfen (Checkliste).

**Empfehlung:** Beide auf den bezahlten Tarif, bevor das erste fremde Unternehmen produktiv arbeitet.
Zusammen rund 45 $ im Monat.

---

## P-01 · Plan- und Auswertungsfunktionen bei großen Mandanten (mittel)

**Ursache:** Die Funktionen laufen in Schleifen über Tage und rufen je Person und Tag weitere Funktionen auf
(`effective_shift_id`, `schicht_laeuft_fuer`, `is_planned_workday`). PostgreSQL kann das nicht als eine
Mengenabfrage optimieren.

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | **Vorberechnete Tagestabelle**: je Person und Tag steht die wirksame Schicht in einer Tabelle (`plan_tage`), gepflegt per Trigger bei Änderungen an Rotation, Zuordnung, Abwesenheit. Alle Auswertungen lesen nur noch diese Tabelle. | sehr schnell, einfache Abfragen, gut indexierbar | Trigger müssen lückenlos sein; einmaliger Aufbau | L | mittel |
| B | **Mengenbasiert umschreiben**: die Schleifen durch eine Abfrage mit `generate_series` und Joins ersetzen, Funktionen einbetten. | kein neuer Datenbestand | je Funktion Handarbeit; Rotation bleibt rechenintensiv | L | mittel |
| C | **Fenster begrenzen**: Schichtplan lädt nur die sichtbaren Wochen und die sichtbare Gruppe; Auswertungen laufen im Hintergrund und werden zwischengespeichert. | schnell umsetzbar, hilft sofort | löst das Grundproblem nicht | M | gering |
| D | **Abwarten und messen**: Lasttest-Skripte einrichten, Schwelle festlegen („ab 300 MA je Mandant handeln“). | kein Aufwand jetzt | Überraschung beim ersten Großkunden | S | mittel |

**Empfehlung:** D sofort (Skripte liegen bei), C vor dem SaaS-Start, A wenn ein Mandant über 300 Personen absehbar ist.

---

## P-02 · Keine Seitenaufteilung (mittel)

**Was passiert:** In `src/lib/data/` gibt es nur drei Abfragen mit Obergrenze. Mitarbeiterliste, Anträge, Abwesenheiten
eines Monats, Protokoll – alles wird vollständig geladen. Die Supabase-Schnittstelle liefert standardmäßig höchstens
**1.000 Zeilen** je Abfrage und meldet nicht, dass etwas fehlt. Ein Mandant mit 2.000 Mitarbeitern sähe eine
unvollständige Liste, ohne Fehlermeldung. Abwesenheiten eines Monats wären schon ab etwa 50 Abwesenheiten je Tag betroffen.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Seitenweises Laden mit „weiter“-Marke (Keyset) für Listen; Suche auf dem Server. | M–L | gering |
| B | Sicherung: jede Listenabfrage fragt die Gesamtzahl mit ab und zeigt eine Warnung, wenn abgeschnitten wurde. | S | gering |
| C | Obergrenze der Schnittstelle erhöhen (Einstellung in Supabase). | S | mittel (verschiebt das Problem, große Antworten auf dem Handy) |

**Empfehlung:** B sofort, A für Mitarbeiter, Anträge und Protokoll vor dem ersten großen Mandanten.

---

## P-03 · Kalender-Abo (mittel)

`abo_plan` ist mit Abstand der größte Verbraucher (4.905 Sekunden Rechenzeit, 426 ms im Mittel) und kam mit
2.975 ms schon an die Zeitgrenze von 3 Sekunden für nicht angemeldete Aufrufe. Kalender-Programme fragen von
selbst alle paar Minuten bis Stunden ab – die Last wächst mit jeder Person, die das Abo nutzt, auch wenn niemand
die App öffnet.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Zwischenspeicher im Vercel-Netz (z. B. 15–60 Minuten) und `ETag`, damit unveränderte Kalender nichts kosten. Laut früherer Arbeit gibt es schon einen Abo-Cache – Dauer und Trefferquote prüfen. | S | gering |
| B | Fertige Kalenderdatei je Person in einer Tabelle ablegen und nur bei Änderung neu bauen. | M | gering |
| C | Zeitraum des Abos begrenzen (z. B. 2 Monate zurück, 12 voraus). | S | gering |

**Empfehlung:** A prüfen und C; B, wenn die Zahl der Abos stark wächst.

---

## P-04 · Abfrage-Takt (mittel bei vielen Nutzern)

Jedes offene Gerät fragt alle 60 Sekunden `aenderungsstand` (27 ms), der Schichtplan zusätzlich alle 20 Sekunden,
die Partner-Ansicht alle 60 Sekunden. Nur bei sichtbarer Seite – das ist gut gelöst.

Rechnung: 2.000 gleichzeitig offene Geräte × 1 Abfrage je Minute = 33 Abfragen je Sekunde nur für den Takt.
Das trägt die kleine Instanz nicht mehr sicher.

**Varianten:** A) Takt mit Zufallsversatz und Verlängerung bei Ruhe (60 s → 5 min) (S). B) Supabase Realtime statt
Takt (M–L; eigene Grenzen je Tarif, RLS muss mitgeprüft werden). C) So lassen bis ca. 300 gleichzeitige Nutzer.
**Empfehlung:** A; B erst bei Bedarf.

---

## P-05 · Urlaubskonto-Ansicht (mittel)

`leave_balances_view` zerlegt bei jeder Abfrage alle Anträge einer Person in einzelne Tage und ruft je Tag
`is_planned_workday` auf. Für eine Person 46 ms – in Ordnung. `team_leave_balances` macht das für alle (368 ms
bei unter 100 Personen). Außerdem wird das Konto bei jeder Genehmigung über die Ansicht geprüft.

**Varianten:** A) Die vorhandene Spalte `requested_days` verwenden statt jeden Tag neu zu zählen (M; vorher prüfen,
dass sie überall stimmt – siehe Halbtage L-06). B) Kontostände in `leave_balances` mitführen, per Trigger gepflegt
(M–L). C) Mit der Tagestabelle aus P-01 erledigt sich das. **Empfehlung:** A, sonst C.

---

## P-06 · Indizes und Policies (klein)

- **Gut:** Die Haupttabellen haben die richtigen Indizes (`company_id, date` und `employee_id, date`). Die Policies
  nutzen `(select auth_company_id())` – das wird je Abfrage einmal ausgewertet, nicht je Zeile.
- 29 Fremdschlüssel ohne Index (u. a. `notifications.company_id`, `leave_balances.company_id`, `shifts.company_id`,
  `leave_requests.decided_by`). Spürbar erst beim Löschen eines Unternehmens oder einer Person in großen Tabellen.
- 103 Meldungen „mehrere erlaubende Policies“: Viele Policies gelten für die Rolle `public` statt `authenticated`,
  und „alles“ plus „lesen“ überlappen sich. Kostet je Abfrage etwas Zeit.
- 11 unbenutzte Indizes, `kalender_code_versuche` ohne Primärschlüssel.
- `notifications` hat keinen Index auf `created_at` (nächtliches Aufräumen) – bei Millionen Zeilen relevant.

**Empfehlung:** In einem Wartungs-Schritt: fehlende Indizes anlegen, Policies auf `authenticated` umstellen und
zusammenlegen. Aufwand M, Risiko gering mit den vorhandenen Tests.

---

## P-09 · Verhalten bei Ausfällen (klein–mittel)

| Ausfall | Verhalten heute | Bewertung |
|---|---|---|
| Supabase nicht erreichbar | Die Middleware leitet zur Anmeldung mit dem Hinweis „Dienst gestört“. Der Privat-Kalender läuft offline weiter (Service Worker, letzter Stand auf dem Gerät). | Privat gut. **Im Betrieb gibt es keinen Notbetrieb** – der Schichtplan ist nicht einsehbar. |
| Fehlkonfiguration in Produktion | Antwort 503 statt halber Funktion | gut |
| Mail-Dienst fällt aus | Nachrichten bleiben im Postausgang, bis zu 5 Versuche, sichtbar für die Administration | gut; nach 5 Versuchen still gescheitert, kein Alarm |
| Mail-Dienst nicht eingerichtet | Funktion tut nichts und sagt es | gut |
| Push schlägt fehl | Warteschlange | gut |
| Vercel fällt aus | nichts geht | kein Ausweichplan – bei einem SaaS üblich, sollte in `docs/stoerungen.md` stehen |
| Einladungen | brauchen keine Mail (Link wird angezeigt) | robust, aber siehe S-01 |

**Varianten für den Notbetrieb:** A) Der letzte Schichtplan (4 Wochen) wird auf dem Gerät gemerkt und bei Ausfall
mit Hinweis „Stand von …“ gezeigt (M). B) Wöchentlicher PDF-Aushang per Mail an die Schichtleitung (S–M).
C) Nichts, Papier-Aushang bleibt Pflicht. **Empfehlung:** A – ein Schichtplan muss auch ohne Server lesbar sein.

---

## P-10 · Wiederholungen und Doppel-Absenden (klein–mittel)

- Im Browser gibt es eine „Ladesperre“ (`src/lib/ladesperre.ts`) gegen Doppeltipps. Auf dem Server gibt es keinen
  Einmal-Schlüssel. Bricht die Verbindung nach dem Absenden ab und die Person tippt erneut, hängt es von der
  jeweiligen Datenbankregel ab, ob ein Duplikat entsteht (Anträge: siehe L-02; Zuordnungen: eindeutig je Person und Tag – gut).
- Der Mail-Versand holt alle 60 Sekunden bis zu 25 offene Nachrichten, ohne sie zu sperren. Dauert ein Lauf länger
  als eine Minute, kann der nächste dieselben Nachrichten noch einmal senden.
- Die Push-Warteschlange sperrt richtig (`for update`).

**Varianten:** A) Mail-Versand wie die Push-Warteschlange sperren (`for update skip locked`) (S).
B) Einmal-Schlüssel für schreibende Aktionen (M). **Empfehlung:** A sofort, B mit L-02.

---

## P-11 · Ladezeiten (klein)

Die Paketgröße ist für eine App dieser Größe in Ordnung. Es gibt Merkzettel auf dem Gerät für Startseite und
Kalender. Nicht gemessen ist die tatsächliche Zeit bis zur ersten Anzeige auf einem schwachen Mobilnetz.
**Empfehlung:** einmal mit `lasttest/lighthouse.sh` messen (langsames 4G) und Zielwerte festlegen
(erste Anzeige unter 3 Sekunden, bedienbar unter 5 Sekunden).

---

## P-13 · Speicher für Lohnabrechnungen (klein–mittel)

Erlaubt sind 300 Dateien je Person mit je bis zu 10 MB – theoretisch 3 GB je Person. Bilder werden im Browser
verkleinert, PDFs nicht. Der kostenlose Tarif hat 1 GB für alle.

**Varianten:** A) Gesamtgrenze je Person (z. B. 200 MB) und PDFs über 2 MB ablehnen oder verkleinern (S).
B) Speicherstand überwachen (gehört zu P-08). **Empfehlung:** A + B.

---

## P-14 · Fehlerseiten und Ladezustände (klein)

Es gibt eine Fehlerseite für den angemeldeten Bereich (`app/(app)/error.tsx`), aber keine globale
(`global-error.tsx`) und keine `loading.tsx`. Ein Fehler in der Hauptseite zeigt die Standardseite von Next.js.
**Empfehlung:** globale Fehlerseite mit „Neu laden“ und Kontakt; Ladezustände für die drei langsamsten Seiten.

---

## 2. Viele Mandanten

Mit vielen kleinen Mandanten skaliert das Modell gut: Jede Abfrage ist über `company_id` eingegrenzt, die Indizes
passen. Was mit der Zahl der Mandanten wächst:

- Hintergrundaufgaben, die über **alle** Unternehmen laufen (`austritte_vollziehen`, `retention_cleanup`,
  `erinnerungen_im_fenster`). Heute Millisekunden; bei 1.000 Unternehmen prüfen.
- Feiertage werden je Unternehmen gespeichert (rund 12 Zeilen je Jahr) – unkritisch.
- Das Protokoll wächst mit der Aktivität: heute 1.461 Zeilen in rund 10 Wochen. Bei 200 Unternehmen wären das
  rund 1,5 Mio. Zeilen in 24 Monaten – mit dem vorhandenen Index kein Problem.

## 3. Lasttest-Skripte

In `docs/review/lasttest/`:

| Datei | Zweck |
|---|---|
| `README.md` | Ablauf und Warnhinweise |
| `seed-testmandant.sql` | legt in einem **leeren Testprojekt** einen Mandanten mit 2.000 Personen und 3 Jahren Schichtdaten an |
| `messung.sql` | misst die zwölf teuersten Aufrufe mit `EXPLAIN (ANALYZE, BUFFERS)` |
| `k6-lesen.js` | simuliert 50–500 gleichzeitige Leser (Takt, Schichtplan, Urlaubskonto) |
| `lighthouse.sh` | misst Ladezeiten mit gedrosseltem Netz |

**Keines dieser Skripte wurde ausgeführt.** Sie dürfen nicht gegen die Live-Datenbank laufen.
