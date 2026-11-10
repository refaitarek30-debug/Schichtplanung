# 01 – Logik und Funktion

Stand: 10. November 2026 · Grundlage: `main` (27d7a13), 206 Migrationen, Live-Datenbank nur lesend abgefragt.
In dieser Phase wurde **nichts geändert**. Zu jedem Fund stehen Varianten und eine Empfehlung – die Entscheidung liegt bei dir.

**Schweregrade:** kritisch = vor dem Start beheben · mittel = vor dem SaaS-Start beheben · klein = kann später.
**Aufwand:** S = bis ½ Tag · M = 1–2 Tage · L = mehrere Tage.

---

## Kurzfassung

Die Urlaubs- und Besetzungslogik liegt fast vollständig in der Datenbank (PL/pgSQL). Das ist gut, weil Regeln
nicht im Browser umgangen werden können. Die Grundrechnung stimmt: Jahreswechsel, Nachtschicht über Mitternacht,
Stornierung und Urlaubskonto sind sauber gelöst.

Die Schwächen liegen an drei Stellen:

1. **Gleichzeitigkeit** – nirgends in der Urlaubslogik wird gesperrt. Zwei gleichzeitige Aktionen können sich überholen.
2. **Zeit** – die Datenbank rechnet „heute“ in Weltzeit (UTC), nicht in deutscher Zeit.
3. **Feste Betriebsregeln** – vieles ist auf deinen Betrieb zugeschnitten (V-Tage, Altersfreizeit, „Nacht“ im Schichtnamen).

| Nr. | Fund | Schwere |
|---|---|---|
| L-01 | Genehmigung prüft die Mindestbesetzung nicht verbindlich; zwei Genehmigungen gleichzeitig möglich | mittel |
| L-02 | Gleichzeitige Anträge derselben Person können sich überlappen | mittel |
| L-03 | „Heute“ wird in UTC gerechnet (23 Funktionen) – falscher Tag zwischen 0 und 1 bzw. 2 Uhr | mittel |
| L-04 | Schichtleitung kann eigene Anträge genehmigen | mittel |
| L-05 | Resturlaub aus dem Vorjahr verfällt automatisch am 31.03. | mittel (rechtlich) |
| L-06 | Halbe Tage: Antrag zählt 0,5 – Konto zählt 1 | klein |
| L-07 | Nachtschicht wird am Namen erkannt („Nacht…“) | klein, für SaaS mittel |
| L-08 | Feiertage: Bundesland steht auf NRW, wenn die Einrichtung übersprungen wird; regionale Feiertage fehlen | klein, für SaaS mittel |
| L-09 | Automatischer Antrag liest das Restkonto ohne Sperre | klein |
| L-10 | Rücknahme genehmigten Urlaubs durch die Führung ohne Zustimmung der Person | klein (rechtlich prüfen) |
| L-11 | Sommerzeit: Schichtdauer wird aus Uhrzeiten gerechnet | klein |
| L-12 | Betriebsregeln fest im Code | für SaaS mittel → siehe `05-onboarding-entwuerfe.md` |

---

## Was geprüft wurde und in Ordnung ist

- **Jahreswechsel:** `submit_leave_auto` teilt einen Antrag über Silvester automatisch je Jahr und je Art in Blöcke.
  Das Urlaubskonto wird je Jahr geführt (`leave_balances`, eindeutig je Person und Jahr).
- **Kein doppelter Abzug:** `leave_balances_view` zählt jeden Tag nur einmal (DISTINCT je Person, Tag, Status, Art),
  selbst wenn sich zwei Anträge überlappen würden.
- **Nachtschicht über Mitternacht:** `shift_ends_at` legt das Ende auf den Folgetag, wenn die Endzeit vor der Startzeit
  liegt. Die Schicht gehört zum Tag, an dem sie beginnt.
- **Stornierung:** `antrag_zuruecknehmen` – die Person selbst nur vor Beginn (deutsches Datum), die Führung nur für die
  eigene Schicht, nach Beginn nur tageweise im Plan. Protokoll und Benachrichtigung werden geschrieben.
- **Sammelgenehmigung:** `sicher_genehmigen` prüft Besetzung **und** Qualifikationen, bevor es genehmigt.
- **Auszubildende** zählen nicht zur Besetzung (`zaehlt_zur_besetzung`).
- **Urlaubskonto bei Genehmigung:** `decide_leave_request` lehnt ab, wenn der Resturlaub negativ würde.
- **Mandantentrennung in der Logik:** jede Funktion mit Firmenbezug prüft `auth_company_id()`.

---

## L-01 · Genehmigung ohne verbindliche Besetzungsprüfung (mittel)

**Was passiert:** `decide_leave_request` prüft Rolle, Firma, Zuständigkeit und das Urlaubskonto – aber nicht die
Mindestbesetzung. Die Besetzung wird nur angezeigt (`check_leave_staffing_impact`). Außerdem wird nichts gesperrt:
Zwei Schichtleiter können im selben Moment zwei Anträge für denselben Tag genehmigen. Jeder sieht „noch in Ordnung“,
zusammen ist die Schicht unterbesetzt.

**Wo:** `decide_leave_request`, `check_leave_staffing_impact` (zuletzt Migration 0108 ff.).

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | Weiche Sperre: Bei „kritisch“ muss die Führung bewusst bestätigen („Trotzdem genehmigen“, mit Grund). Wird protokolliert. | Führung behält die Entscheidung; nachvollziehbar | Unterbesetzung bleibt möglich | S–M | gering |
| B | Harte Sperre: Unter Mindestbesetzung nur die Administration. | Mindestbesetzung ist garantiert | Kann im Alltag blockieren (Krankheit, Notfälle) | M | mittel |
| C | Technische Sperre je Schicht und Tag (Advisory-Lock) und erneute Prüfung innerhalb der Genehmigung. | Löst das Problem der Gleichzeitigkeit | Allein keine fachliche Regel | S | gering |
| D | So lassen. | kein Aufwand | Fund bleibt | – | – |

**Empfehlung:** A + C. Später je Unternehmen einstellbar („Mindestbesetzung: Hinweis / Bestätigung nötig / gesperrt“) –
das passt zum Onboarding-Entwurf.

---

## L-02 · Gleichzeitige Anträge derselben Person (mittel)

**Was passiert:** Der Trigger `leave_requests_check_overlap` schaut nach, ob es schon einen Antrag im Zeitraum gibt,
und fügt dann ein. Dazwischen liegt keine Sperre, und die Tabelle hat keine harte Regel gegen Überlappung. Zwei
gleichzeitige Anfragen (Doppeltipp, zwei Geräte, schlechtes Netz mit Wiederholung) können beide durchgehen.
Folge: doppelte Anträge im Postfach der Führung. Das Konto zählt die Tage nur einmal, der Schaden ist also begrenzt.

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | Sperre je Person im Trigger (`pg_advisory_xact_lock` auf die Mitarbeiter-ID). | 5 Zeilen, wirkt sofort | – | S | gering |
| B | Harte Datenbankregel (Exclusion-Constraint über den Zeitraum). | stärkste Garantie | Ausnahme „zwei Halbtage am selben Tag“ macht es knifflig; Altdaten müssen sauber sein | M | mittel |
| C | Einmal-Schlüssel je Absenden (Idempotenz-Schlüssel vom Gerät). | hilft auch bei Wiederholungen nach Netzfehler | deckt echte Parallel-Anträge nicht ab | M | gering |

**Empfehlung:** A sofort. C ist sinnvoll für alle schreibenden Aktionen, sobald ihr viele Geräte mit schwachem Netz habt
(siehe `04-performance-robustheit.md`, P-10).

---

## L-03 · „Heute“ in Weltzeit statt deutscher Zeit (mittel)

**Was passiert:** Die Datenbank läuft in UTC. 23 Funktionen benutzen `current_date`, nur 7 rechnen ausdrücklich in
`Europe/Berlin`. Zwischen 0:00 und 1:00 Uhr (Winter) bzw. 2:00 Uhr (Sommer) ist „heute“ für diese Funktionen noch
gestern. Das trifft genau die Nachtschicht – und den Jahreswechsel: In der ersten Stunde des neuen Jahres rechnet
z. B. `ensure_leave_balance` noch mit dem alten Jahr.

**Betroffen u. a.:** `team_leave_balances`, `ensure_leave_balance`, `mein_naechster_urlaub`, `erinnerungen_im_fenster`,
`retention_cleanup`, `shift_staffing_overview`, `stundenkonto`, `abo_termine`, `beitritt_annehmen`,
`register_company_for_user`, die Ansicht `leave_balances_view` (Verfall zum 31.03.).

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | Zeitzone der Datenbank auf `Europe/Berlin` stellen (eine Einstellung). | ein Schritt, alle 23 Stellen stimmen | gilt für alle Mandanten gleich; Cron-Zeiten prüfen; versteckte Annahmen | S | mittel |
| B | Eine Hilfsfunktion `heute()` (deutsche Zeit) und alle 23 Stellen umstellen. | ausdrücklich, testbar | mehr Stellen anfassen | M | gering |
| C | Zeitzone je Unternehmen (`companies.zeitzone`) und `heute(firma)`. | richtig für ein SaaS mit Kunden außerhalb Deutschlands | größter Umbau | M–L | mittel |

**Empfehlung:** B, dabei die Funktion gleich so bauen, dass sie später die Zeitzone des Unternehmens nehmen kann
(Vorbereitung auf C). Dazu ein Test, der „0:30 Uhr am 1. Januar“ simuliert.

---

## L-04 · Schichtleitung genehmigt eigene Anträge (mittel)

**Was passiert:** `darf_urlaub_entscheiden` gibt für die eigene Person „ja“ zurück. Eine Schichtleitung kann ihren
eigenen Urlaub genehmigen. Es gibt kein Vier-Augen-Prinzip. (Das wurde in Migration 0108 bewusst so gebaut.)

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | Verbieten: eigene Anträge entscheidet eine andere Schichtleitung oder die Administration. | sauberes Vier-Augen-Prinzip | kleiner Betrieb mit nur einer Führungskraft bleibt hängen | S | gering |
| B | Erlauben, aber Meldung an die Administration und eigener Protokoll-Eintrag. | bleibt praktisch | Kontrolle nur im Nachhinein | S | gering |
| C | Je Unternehmen einstellbar, Standard „nicht erlaubt“. | passt für alle Betriebe | eine Einstellung mehr | S–M | gering |

**Empfehlung:** C. Für deinen Betrieb entscheidest du selbst; für fremde Unternehmen ist „nicht erlaubt“ der sichere
Standard (Least Privilege). Das gehört auch in die Unterlage für den Betriebsrat.

---

## L-05 · Resturlaub verfällt automatisch am 31.03. (mittel, rechtlich)

**Was passiert:** `leave_balances_view` rechnet den Übertrag nach dem 31.03. nur noch in der Höhe an, in der er bis
dahin genommen wurde. Der Rest ist ohne weiteres Zutun weg.

**Warum heikel:** Nach der Rechtsprechung (EuGH 2018, BAG 2019) verfällt Urlaub nur, wenn der Arbeitgeber rechtzeitig
und klar darauf hingewiesen hat. Bei langer Krankheit gelten 15 Monate. Die App entscheidet das heute pauschal.
*(Keine Rechtsberatung – bitte mit Personalabteilung oder Anwalt klären.)*

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | Verfall je Unternehmen einstellbar: Stichtag oder „kein automatischer Verfall“. | passt für jede Betriebsregel | Unternehmen muss die Regel kennen | M | gering |
| B | Verfall nur, wenn ein Hinweis dokumentiert ist („Hinweis erteilt am …“ je Person und Jahr). Die App erinnert die Administration im Herbst. | bildet die Rechtslage ab; guter Nutzen | mehr Oberfläche | M–L | gering |
| C | So lassen und in der Oberfläche einen Hinweis zeigen. | kein Umbau | Zahl im Konto kann rechtlich falsch sein | S | mittel |

**Empfehlung:** A jetzt (mit Standard „kein automatischer Verfall“ für neue Unternehmen), B als spätere Funktion.

---

## L-06 · Halbe Tage (klein)

**Was passiert:** Die Formulare bieten keine halben Tage mehr an. Die Serveraktion `submitLeaveRequest` nimmt das Feld
`half_day_period` aber weiter entgegen. Ein Antrag bekommt dann 0,5 Tage – das Konto (`leave_balances_view`) zählt
den Tag jedoch als ganzen Tag. Über die normale Oberfläche tritt das nicht auf, nur bei gezielt gebauten Anfragen
oder Altdaten.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Halbe Tage ganz abschalten (Server lehnt das Feld ab). | S | gering |
| B | Halbe Tage richtig einführen: Konto zählt 0,5; Besetzung zählt die halbe Schicht. | M–L | mittel |
| C | So lassen. | – | Zahlen können abweichen |

**Empfehlung:** A jetzt. B nur zusammen mit den frei einstellbaren Abwesenheitsarten (Eigenschaft „halbe Tage erlaubt“).

---

## L-07 · Nachtschicht wird am Namen erkannt (klein, für SaaS mittel)

**Was passiert:** `is_premium_day` behandelt einen Tag als „besonders“, wenn der Schichtname mit „Nacht“ beginnt.
Ein Unternehmen, das seine Schicht „N3“ oder „Night“ nennt, bekommt andere Ergebnisse. Bei der Registrierung
werden die Schichten „Frühschicht / Spätschicht / Nachtschicht“ fest angelegt.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Aus den Zeiten ableiten (Ende vor Beginn = geht über Mitternacht). | S | gering |
| B | Eigenes Merkmal an der Schicht („Nachtschicht ja/nein“, „zählt als besonderer Tag“). | S–M | gering |
| C | Regel je Unternehmen frei einstellbar. | M | mittel |

**Empfehlung:** B mit A als Voreinstellung.

---

## L-08 · Feiertage je Bundesland (klein, für SaaS mittel)

**Was geprüft wurde:** `german_holidays` kennt alle 16 Bundesländer, inklusive Buß- und Bettag (Sachsen),
Frauentag (Berlin, Mecklenburg-Vorpommern), Weltkindertag (Thüringen), Reformationstag und Fronleichnam.

**Was fehlt:**
- Bei der Registrierung wird **NRW** eingetragen. Die Einrichtung fragt das Bundesland in Schritt 2 ab – sie lässt
  sich aber jederzeit überspringen. Ein Betrieb in Bayern, der abbricht, rechnet mit falschen Feiertagen und damit
  falschen Urlaubstagen, ohne es zu merken.
- Feiertage, die nur in Teilen eines Landes gelten: Mariä Himmelfahrt in Bayern (überwiegend katholische Gemeinden),
  Friedensfest in Augsburg, Fronleichnam in Teilen von Sachsen und Thüringen.
- Heiligabend und Silvester sind keine Feiertage; viele Betriebe behandeln sie als halbe Tage oder Betriebsruhe.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Bundesland als **Pflichtfrage** (nicht überspringbar) – am besten schon bei der Registrierung; Feiertage danach neu erzeugen. | S | gering |
| B | Zusätzlich „regionale Feiertage“ zum Anhaken (Liste je Bundesland). | M | gering |
| C | Feiertage frei pflegbar (gibt es schon als Betriebsruhe) – nur besser erklären. | S | gering |

**Empfehlung:** A + B, C als Hinweis im Assistenten.

---

## L-09 · Automatischer Antrag liest das Restkonto ohne Sperre (klein)

`submit_leave_auto` liest die Restkonten einmal am Anfang und verteilt dann die Tage auf Urlaub und V-Tage.
Zwei gleichzeitige Anträge können beide vom selben Rest ausgehen. Beim Urlaub fängt die Genehmigung das ab
(Konto darf nicht negativ werden); bei V-Tagen gibt es diese Prüfung nicht.

**Varianten:** A) dieselbe Sperre je Person wie in L-02 (deckt beides ab, S). B) Prüfung bei Genehmigung auch für
V-Tage (S). **Empfehlung:** A + B.

---

## L-10 · Rücknahme genehmigten Urlaubs durch die Führung (klein, rechtlich prüfen)

Die Führung kann einen genehmigten Urlaub der eigenen Schicht zurücknehmen. Es wird protokolliert und die Person
wird benachrichtigt – eine Zustimmung der Person ist aber nicht nötig. Arbeitsrechtlich kann genehmigter Urlaub
in der Regel nicht einseitig widerrufen werden.

**Varianten:** A) Pflichtfeld „Grund“ und Bestätigung durch die Person (M). B) Nur die Administration darf
zurücknehmen (S). C) So lassen, in der Betriebsvereinbarung regeln. **Empfehlung:** A für das SaaS, bis dahin C.

---

## L-11 · Sommerzeit (klein)

Schichten haben Uhrzeiten ohne Datum. Die Dauer wird aus Beginn und Ende gerechnet – die Nachtschicht in der
Umstellungsnacht hat rechnerisch 8 Stunden, tatsächlich 7 (März) oder 9 (Oktober). Für den Plan ist das egal.
Wichtig wird es erst, wenn Stunden- oder Zeitkonten aus dem Plan berechnet werden (`stundenkonto`, Fehlzeiten).
**Nicht abschließend geprüft:** ob `stundenkonto` diese zwei Nächte berücksichtigt.

**Varianten:** A) Bei Zeitkonten mit echten Zeitpunkten in `Europe/Berlin` rechnen (M). B) Die zwei Nächte im Jahr
von Hand korrigieren (kein Aufwand). **Empfehlung:** B, solange es keine Zeiterfassung gibt.

---

## L-12 · Fest eingebaute Betriebsregeln (für SaaS mittel)

Diese Regeln stehen fest in der Datenbank und passen nur für deinen Betrieb:

| Regel | Wo |
|---|---|
| V-Tage mit 7,5 Stunden je Tag | `leave_balances_view`, `companies.v_tag_name` |
| Altersfreizeit 8 Stunden je Tag | `leave_requests_check_kontingent` |
| Sonderurlaub ab dem Jahr nach dem 55. Geburtstag, 4 Tage | `leave_requests_check_kontingent` |
| Gewerkschaftstag, Bildungsurlaub-Haken | `leave_kind`, `employees.bildungsurlaub_erlaubt` |
| Schichtgruppen A bis E | Aufzählungstyp `rotation_team` |
| Qualifikationen Labor, Lager, Messwarte, B-Schein, Anlagenfahrer | Aufzählungstyp `qualification` |
| Antragsarten (6) und Abwesenheitsarten (7) | Aufzählungstypen `leave_kind`, `absence_type` |
| „Nacht…“ im Schichtnamen | `is_premium_day` |
| Bundesland NRW, Personalnummer 10000 | `register_company_for_user` |

Wie daraus frei einstellbare Arten werden, steht in `05-onboarding-entwuerfe.md`.

---

## Rechte je Rolle (Ist-Stand)

| Aktion | Mitarbeiter | Schichtleitung | Administration |
|---|---|---|---|
| Eigenen Urlaub beantragen, vor Beginn zurücknehmen | ja | ja | ja |
| Anträge entscheiden | – | eigene Schicht/Gruppe **und eigene Anträge** | alle |
| Plan ändern, Abwesenheit eintragen | – | ja (ganze Firma) | ja |
| Urlaubssperre setzen | – | ja | ja |
| Mindest-/Sollbesetzung, Schichten, Regeln | – | – | ja |
| Stammdaten ändern | – | über die Oberfläche begrenzt, **per direkter Schnittstelle fast alles** (siehe S-02) | ja |
| Rollen vergeben, Personen löschen | – | – | ja |
| Zugangslink / Passwort-Code erzeugen | – | für Mitarbeiter | für alle (siehe S-01) |

Die fett markierten Stellen weichen vom Prinzip „so wenig Rechte wie nötig“ ab und sind in `02-sicherheit.md` beschrieben.
