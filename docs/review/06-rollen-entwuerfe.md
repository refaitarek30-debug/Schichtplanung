# 06 – Rollenmodell (Entwürfe)

Stand: 10. November 2026 · **Entwurf zur Entscheidung – nichts davon ist gebaut.**

Aufgabe: Zusätzlich zu Mitarbeiter, Schichtleitung und Administration kommen **Tagschichtmeister** und
**Verwaltung** dazu. Was diese Personen sehen und tun dürfen, entscheidest du später. Deshalb muss die
Administration je Rolle – und wo sinnvoll je Person – einstellen können, was sichtbar und erlaubt ist.
**Standard ist immer: so wenig wie möglich** (Least Privilege).

**Aufwand:** S = bis ½ Tag · M = 1–2 Tage · L = 3–5 Tage · XL = mehr als eine Woche.

---

## 1. Ausgangslage

- Drei feste Rollen als Aufzählung in der Datenbank (`app_role`: `employee`, `shift_leader`, `admin`).
- Die Rechte hängen an zwei Fragen: „Ist Administration?“ (`is_admin()`) und „Ist Führung?“ (`is_leadership()`).
  Diese zwei Funktionen stecken in fast allen Policies und in rund 190 Datenbank-Funktionen.
- Einzige feinere Regel: Urlaub entscheidet die Schichtleitung nur für die eigene Gruppe/Schicht
  (`darf_urlaub_entscheiden`).
- Es gibt einen unfertigen Entwurf im Repository (`supabase/entwuerfe/rollen_zusatzrechte.sql`): frei benannte
  Zusatzrollen für Schichtleitungen mit drei Schaltern (Urlaub aller Schichten, Entscheidungen ändern,
  Mitarbeiter verwalten). Er passt als Vorstufe zu Variante C unten.

**Schwächen des heutigen Modells** (aus `02-sicherheit.md` und `03-datenschutz.md`):
„Führung“ ist ein grobes Recht. Jede Schichtleitung sieht Krankheit und Geburtsdatum aller, kann Stammdaten
aller ändern (S-02) und Anträge aller zurücksetzen (S-03). Ein feineres Modell löst diese Funde gleich mit.

---

## 2. Bausteine, die alle Varianten brauchen

### 2.1 Rechte-Katalog

Ein Recht ist eine klar benannte Erlaubnis. Vorschlag: 28 Rechte in 8 Gruppen. Rechte mit ⚠ betreffen besonders
schützenswerte Daten oder Überwachung – sie brauchen beim Einschalten eine ausdrückliche Bestätigung und
erscheinen in der Unterlage für den Betriebsrat.

| Gruppe | Recht | Kurz | Reichweite einstellbar |
|---|---|---|---|
| **Plan** | Schichtplan aller sehen (nur Schichten) | `plan.sehen` | ja |
| | Plan ändern (Schicht zuweisen, tauschen) | `plan.aendern` | ja |
| | Schichtmuster und Rhythmus ändern | `plan.muster` | nein |
| **Abwesenheit** | Abwesenheit eintragen (Schulung, Sonstiges) | `abwesenheit.eintragen` | ja |
| | Grund einer Abwesenheit sehen | `abwesenheit.grund` | ja |
| | ⚠ „Krank“ eintragen und sehen | `krank.sehen` | ja |
| **Urlaub** | Anträge sehen | `urlaub.sehen` | ja |
| | Anträge entscheiden | `urlaub.entscheiden` | ja |
| | Eigene Anträge entscheiden | `urlaub.eigene` | nein (Vorgabe: aus) |
| | Genehmigten Urlaub zurücknehmen | `urlaub.zuruecknehmen` | ja |
| | Urlaubssperre setzen | `urlaub.sperre` | ja |
| | Urlaubs- und Zeitkonten sehen | `konto.sehen` | ja |
| | Konten und Ansprüche ändern | `konto.aendern` | ja |
| **Besetzung** | Besetzung und Ampel sehen | `besetzung.sehen` | ja |
| | Mindest-/Sollbesetzung und Regeln ändern | `besetzung.regeln` | nein |
| **Personen** | Stammdaten sehen (Name, Nummer, Gruppe, Kontakt) | `person.sehen` | ja |
| | Stammdaten ändern | `person.aendern` | ja |
| | ⚠ Geburtsdatum sehen | `person.geburtsdatum` | ja |
| | Personen anlegen, deaktivieren, löschen | `person.verwalten` | nein |
| | Zugänge einrichten | `person.zugang` | ja |
| **Auswertung** | ⚠ Auswertung je Person (Kranktage, Ausfall) | `auswertung.person` | ja |
| | Auswertung ohne Namen (Summen je Schicht) | `auswertung.summe` | ja |
| | ⚠ Fehlzeiten in Stunden erfassen und sehen | `fehlzeit` | ja |
| | Daten exportieren | `export` | ja |
| **Mitteilungen** | Mitteilungen und Hinweise senden | `mitteilung.senden` | ja |
| **Protokoll** | Änderungsprotokoll sehen | `protokoll.aenderungen` | ja |
| | ⚠ Anmeldeprotokoll und Fehlermeldungen sehen | `protokoll.anmeldungen` | nein |
| **Einstellungen** | Unternehmen einstellen (Schichten, Arten, Feiertage, Fristen, Rollen) | `einstellungen` | nein |

Immer erlaubt, nicht abschaltbar: eigene Daten sehen, eigenen Urlaub beantragen, eigene Einstellungen.

### 2.2 Reichweite

Ein Recht gilt nicht einfach „ja/nein“, sondern **für wen**:

| Reichweite | Bedeutung | Beispiel |
|---|---|---|
| keine | Recht ist aus | Vorgabe für alles |
| eigene Zuständigkeit | Personen, für die man eingetragen ist | Schichtleitung Gruppe C; Tagschichtmeister Werkstatt |
| ganzes Unternehmen | alle | Administration, Personalbüro |

Dafür braucht es **Zuständigkeiten**: eine Tabelle, die sagt „Person X ist zuständig für Gruppe C / Schicht
Tagdienst / Abteilung Werkstatt / einzelne Person Y“. Heute wird das aus der eigenen Gruppe abgeleitet –
ein Tagschichtmeister hat aber keine Wechselschicht-Gruppe, und eine Vertretung braucht eine zweite Zuständigkeit
auf Zeit.

### 2.3 Sicherheits-Leitplanken (für jede Variante)

1. **Alles ist aus, bis es eingeschaltet wird.** Eine neue Rolle hat nur die Grundrechte jeder Person.
2. **Die Administration ist nicht einstellbar** und hat immer alle Rechte. Es muss immer mindestens eine aktive geben.
3. **Niemand vergibt Rechte, die er selbst nicht hat.** Nur wer `einstellungen` hat, ändert Rollen.
4. **Änderungen gelten sofort.** Rechte werden bei jeder Abfrage aus der Datenbank gelesen, nicht im
   Anmelde-Token zwischengespeichert (sonst wirkt ein Entzug erst nach bis zu einer Stunde).
5. **Jede Änderung an Rollen und Rechten steht im Protokoll** – wer, wann, welches Recht, für wen.
6. **⚠-Rechte** verlangen eine Bestätigung mit Begründung und sind in einer eigenen Übersicht sichtbar.
7. **„Was sieht diese Person?“** – eine Ansicht für die Administration (und zum Vorlegen beim Betriebsrat), die für
   eine Person alle wirksamen Rechte mit Herkunft zeigt (aus Rolle / persönliche Ausnahme / befristet bis …).
8. **Die Datenbank setzt es durch**, nicht die Oberfläche: eine zentrale Funktion `hat_recht(recht, person)`,
   die jede Policy und jede Funktion benutzt.
9. **Automatischer Test:** eine Tabelle „Rolle × Recht × Aktion → erlaubt?“, die bei jeder Änderung geprüft wird.

### 2.4 Vorschlag für die Vorgaben (du entscheidest später)

„Vorgabe“ heißt: So wird die Rolle angelegt. Bei **minimal** ist alles aus; die Spalte „Startpaket“ ist nur
ein Vorschlag, den die Administration mit einem Klick übernehmen **kann**.

| Rolle | Vorgabe | Mögliches Startpaket (Vorschlag) |
|---|---|---|
| Mitarbeiter | nur Grundrechte | – |
| Schichtleitung | wie heute, aber auf die **eigene Zuständigkeit** begrenzt | Plan ändern, Abwesenheit und krank eintragen, Urlaub entscheiden, Sperre, Konten sehen, Besetzung sehen, Mitteilungen – alles „eigene Zuständigkeit“; Plan sehen „alle“ |
| **Tagschichtmeister** | **minimal** | Plan sehen „alle“; Plan ändern, Abwesenheit eintragen, Urlaub entscheiden, Besetzung sehen, Mitteilungen „eigene Zuständigkeit“. Kein „krank“, keine Auswertung. |
| **Verwaltung** | **minimal** | Stammdaten sehen und ändern „alle“, Konten sehen und ändern „alle“, Zugänge einrichten, Export. Kein Plan ändern, kein „krank“, keine Auswertung je Person, kein Protokoll. |
| Administration | alles (fest) | – |

---

## 3. Variante A · Feste Rollen mit Schaltern

**Idee:** Die Rollenliste wird um zwei feste Rollen erweitert (fünf insgesamt). Je Unternehmen gibt es eine
Tabelle mit Schaltern: Rolle × Recht → Reichweite. Die Oberfläche ist eine Matrix mit Häkchen.

**Datenmodell**
```
app_role: employee, shift_leader, day_shift_leader, office, admin      (Aufzählung erweitert)

rollen_rechte
  company_id, rolle (app_role), recht (text), reichweite ('keine'|'zustaendigkeit'|'alle')
  Primärschlüssel (company_id, rolle, recht)

zustaendigkeiten
  company_id, employee_id (wer), art ('gruppe'|'schicht'|'abteilung'|'person'), ziel, gueltig_bis

hat_recht(p_recht text, p_ziel_employee uuid default null) returns boolean
sichtbare_personen(p_recht text) returns setof uuid
```

**Bildschirme:** Einstellungen → Rollen: fünf Spalten, Rechte als Zeilen in Gruppen, je Zelle
„aus / eigene Zuständigkeit / alle“. Darunter „Startpaket übernehmen“ und „Auf minimal zurücksetzen“.

| | |
|---|---|
| **Vorteile** | überschaubar; fünf bekannte Rollen; leicht zu erklären und zu testen (5 × 28 Fälle); Betriebsrat kann die Matrix lesen |
| **Nachteile** | kein Unternehmen kann eine sechste Rolle anlegen („Springer“, „Azubi-Betreuer“); Ausnahmen für einzelne Personen fehlen |
| **Auswirkung auf RLS** | Policies wechseln von `is_leadership()` auf `hat_recht('…')` bzw. `employee_id in (select sichtbare_personen('…'))`. Beides wird je Abfrage einmal ausgewertet – kaum langsamer als heute. Alle Policies der Betriebstabellen und rund 190 Funktionen müssen einem Recht zugeordnet werden. |
| **Sicherheitsrisiken** | falsche Zuordnung Funktion → Recht beim Umbau (mit Testmatrix abfangen); zu großzügige Einstellung durch die Administration (Warnung bei ⚠-Rechten) |
| **Komplexität** | mittel |
| **Aufwand** | XL (ca. 2 Wochen inklusive Tests) |
| **Risiko** | mittel – der Umbau fasst fast alle Zugriffsregeln an |

---

## 4. Variante B · Frei definierbare Rollen

**Idee:** Rollen sind Zeilen in einer Tabelle. Jedes Unternehmen legt beliebig viele an, nennt sie, wie es will,
und stellt die Rechte je Rolle ein. Fest ist nur „Administration“.

**Datenmodell**
```
rollen
  id, company_id, name, beschreibung, system ('admin'|'basis'|null), sortierung

rollen_rechte
  rolle_id, recht, reichweite

employees.rolle_id → rollen           (ersetzt employees.role und profiles.role)
personen_rollen (optional)            (eine Person, mehrere Rollen)

zustaendigkeiten, hat_recht(), sichtbare_personen()     wie in A
```

**Bildschirme:** Einstellungen → Rollen: Liste der Rollen mit „Neu“, „Kopieren“, „Löschen“. Je Rolle eine Seite
mit den Rechte-Gruppen. Personen-Seite: Auswahl der Rolle.

| | |
|---|---|
| **Vorteile** | passt für jede Organisation; keine Datenbank-Änderung für neue Rollen; sauberstes Modell |
| **Nachteile** | Unternehmen können sich unübersichtliche Rollen bauen; Support muss fremde Rollen verstehen; „Schichtleitung“ hat keine feste Bedeutung mehr – jede Stelle im Code, die heute nach der Rolle fragt (Abmeldefrist, Benachrichtigungen, Menü), muss auf Rechte umgestellt werden |
| **Auswirkung auf RLS** | wie A, aber **alle** Stellen müssen weg von der Aufzählung; `auth_role()` entfällt. Der Trigger-Schutz gegen Selbst-Beförderung muss neu gedacht werden (wer darf `rolle_id` ändern, wer `rollen_rechte`?) |
| **Sicherheitsrisiken** | höher: Rechte-Ausweitung über das Bearbeiten von Rollen (jemand mit `einstellungen` gibt seiner eigenen Rolle alles – muss verhindert oder zumindest gemeldet werden); verwaiste Rollen; Unternehmen ohne wirksame Administration; mehr Kombinationen = mehr ungetestete Fälle |
| **Komplexität** | hoch |
| **Aufwand** | XL+ (4–6 Wochen) |
| **Risiko** | hoch |

---

## 5. Variante C · Hybrid: feste Grundrollen, einstellbare Rechte, Ausnahmen je Person

**Idee:** Fünf feste Grundrollen wie in A – jede mit einer **Obergrenze** (was diese Rolle höchstens bekommen kann)
und einer minimalen Vorgabe. Je Unternehmen stellt die Administration die Rechte innerhalb der Obergrenze ein.
Dazu kommen:

- **Ausnahmen je Person**: einzelnes Recht zusätzlich oder entzogen, auf Wunsch befristet
  („Frau X vertritt bis 31.12. die Gruppe B“; „Herr Y ist Schichtleitung, darf aber kein ‚krank‘ sehen“).
- **Eigene Rollen als Kopie** einer Grundrolle (später, optional): „Springer“ = Kopie von Schichtleitung mit
  weniger Rechten. Die Kopie erbt die Obergrenze ihrer Grundrolle.

**Obergrenzen (Beispiel):** Mitarbeiter können nie `krank.sehen` für andere bekommen; Verwaltung nie `plan.muster`;
nur die Administration hat `einstellungen` und `protokoll.anmeldungen`. So kann eine Fehlbedienung nie mehr
öffnen, als für die Grundrolle vertretbar ist.

**Datenmodell**
```
app_role: employee, shift_leader, day_shift_leader, office, admin

rollen                                 (je Unternehmen; anfangs genau die fünf Grundrollen)
  id, company_id, name, grundrolle (app_role), ist_grundrolle bool

rollen_rechte
  rolle_id, recht, reichweite

personen_rechte                        (Ausnahmen)
  company_id, employee_id, recht, reichweite, gueltig_bis, grund, vergeben_von, vergeben_am

zustaendigkeiten                       (wie in A, mit gueltig_bis für Vertretungen)

recht_obergrenzen                      (im Code, nicht je Unternehmen: grundrolle × recht → höchste Reichweite)

hat_recht(), sichtbare_personen(), wirksame_rechte(employee_id)  -- letzte für „Was sieht diese Person?“
```

Wirksames Recht = Ausnahme der Person, sonst Recht der Rolle – nie mehr als die Obergrenze der Grundrolle.

**Bildschirme**
1. **Rollen** – Matrix wie in A, Zellen über der Obergrenze sind ausgegraut mit Erklärung.
2. **Person → Rechte** – Liste „Aus der Rolle“ (grau) und „Abweichungen“ (mit Grund und Ablaufdatum).
3. **Zuständigkeiten** – wer ist für welche Gruppe/Abteilung zuständig, mit Vertretung auf Zeit.
4. **Was sieht diese Person?** – alle wirksamen Rechte mit Herkunft; als PDF für den Betriebsrat.
5. **Übersicht ⚠** – wer hat sensible Rechte, seit wann, durch wen.

| | |
|---|---|
| **Vorteile** | deckt Tagschichtmeister, Verwaltung, Vertretungen und Sonderfälle ab; Obergrenzen verhindern grobe Fehlbedienung; „Schichtleitung“ behält eine feste Bedeutung im Code; stufenweise baubar; der vorhandene Entwurf (`rollen_zusatzrechte.sql`) geht darin auf |
| **Nachteile** | mehr Tabellen und mehr zu erklären als A; Ausnahmen je Person können unübersichtlich werden (deshalb Grund, Ablaufdatum, Übersicht) |
| **Auswirkung auf RLS** | wie A. Zusätzlich liest `hat_recht()` die Ausnahmen der eigenen Person – eine kleine Indexabfrage je Aufruf. Für Zeilen-Rechte (`sichtbare_personen`) wird die Menge der sichtbaren Personen je Abfrage einmal gebildet. Bei 2.000 Personen bleibt das im Millisekunden-Bereich, wenn `zustaendigkeiten` und `employees` passend indexiert sind – im Lasttest mitmessen. |
| **Sicherheitsrisiken** | abgelaufene Ausnahmen müssen wirklich enden (Prüfung zur Abfragezeit, nicht per nächtlichem Job); Ausnahmen dürfen die Obergrenze nicht umgehen; Zuständigkeit „einzelne Person“ darf nicht zum heimlichen Beobachten dienen (im Protokoll, sichtbar für die Person selbst: „Wer ist für mich zuständig?“) |
| **Komplexität** | mittel bis hoch |
| **Aufwand** | Stufe 1 XL (ca. 2 Wochen), gesamt ca. 4–5 Wochen |
| **Risiko** | mittel – durch die Stufen gut beherrschbar |

**Stufen**
| Stufe | Inhalt | Aufwand | Löst |
|---|---|---|---|
| 1 | `hat_recht()` als Fundament; fünf Grundrollen; die 12 wichtigsten Rechte einstellbar; Testmatrix | XL | S-02, S-03, D-05, L-04 |
| 2 | Zuständigkeiten (Gruppe, Schicht, Abteilung) mit Vertretung auf Zeit | L | Tagschichtmeister, Vertretungen |
| 3 | Ausnahmen je Person, „Was sieht diese Person?“, Übersicht ⚠ | L | Betriebsrat, Berechtigungskonzept |
| 4 | Restliche Rechte; eigene Rollen als Kopie | L | SaaS-Sonderwünsche |

---

## 6. Vergleich

| | A · Feste Rollen mit Schaltern | B · Frei definierbar | C · Hybrid |
|---|---|---|---|
| Tagschichtmeister und Verwaltung | ja | ja | ja |
| Einstellbar je Rolle | ja | ja | ja |
| Einstellbar je Person | nein | nur über eigene Rolle je Person | ja, befristbar |
| Eigene Rollen je Unternehmen | nein | ja | ja (als Kopie, später) |
| Schutz vor Fehlbedienung | Warnungen | Warnungen | **Obergrenzen** + Warnungen |
| Umbau der Zugriffsregeln | groß | sehr groß | groß (in Stufen) |
| Verständlich für Betriebsrat | sehr gut | schwierig | gut („Was sieht diese Person?“) |
| Aufwand | ca. 2 Wochen | 4–6 Wochen | 4–5 Wochen in 4 Stufen |
| Risiko | mittel | hoch | mittel |

**Empfehlung: Variante C, begonnen mit Stufe 1.**
Stufe 1 ist praktisch Variante A mit dem richtigen Fundament – du verlierst nichts, wenn du danach aufhörst.
Die beiden neuen Rollen starten **minimal**; du schaltest frei, sobald du entschieden hast, was sie dürfen.

---

## 7. Technische Hinweise für den Umbau

- **Reihenfolge:** erst `hat_recht()` einführen und so belegen, dass sich **nichts ändert** (Schichtleitung =
  alles wie heute). Dann Policy für Policy und Funktion für Funktion umstellen, jeweils mit Vergleichstest.
  Erst zum Schluss die Vorgaben verschärfen.
- **Geschwindigkeit:** Policies immer in der Form `(select hat_recht('…'))` schreiben, damit PostgreSQL die Prüfung
  je Abfrage einmal ausführt. Zeilen-Rechte über `employee_id in (select sichtbare_personen('…'))`.
- **Kein Zwischenspeichern im Token.** Wenn es je nötig wird, dann höchstens für „ist Administration“.
- **Verweise an das Unternehmen binden** (S-06): `rollen_rechte`, `personen_rechte`, `zustaendigkeiten` bekommen
  zusammengesetzte Fremdschlüssel mit `company_id`.
- **Schutz-Trigger** wie heute bei `role`: niemand ändert die eigene Rolle oder eigene Ausnahmen.
- **Benachrichtigungen, Abmeldefristen, Menüs** hängen heute an der Rolle – in Stufe 1 bleiben sie an der Grundrolle.
- **Inaktive Personen** verlieren alle Rechte sofort (ist heute schon so: Profil `active`).

## 8. Offene Fragen an dich

1. Variante A, B oder C?
2. Soll die Schichtleitung mit dem Umbau auf die **eigene Zuständigkeit** begrenzt werden (strenger als heute),
   oder bleibt sie zunächst firmenweit?
3. Sollen ⚠-Rechte (krank, Auswertung je Person, Fehlzeiten, Anmeldeprotokoll) nur mit Bestätigung und Begründung
   einschaltbar sein?
4. Soll jede Person sehen können, wer für sie zuständig ist und wer ihre Daten sehen darf? (stärkt das Vertrauen,
   üblich in Betriebsvereinbarungen)
5. Braucht ihr Vertretungen auf Zeit schon in Stufe 1?
