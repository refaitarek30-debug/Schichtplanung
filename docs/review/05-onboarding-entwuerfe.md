# 05 – Onboarding-Leitfaden und Verallgemeinerung (Entwürfe)

Stand: 10. November 2026 · **Entwurf zur Entscheidung – nichts davon ist gebaut.**

Ziel: Ein fremdes Unternehmen registriert sich und wird durch alles geführt, was es vor dem Start braucht.
Der Assistent erklärt, was sinnvoll ist, und stellt die App passend ein.

**Aufwand:** S = bis ½ Tag · M = 1–2 Tage · L = 3–5 Tage · XL = mehr als eine Woche.

---

## 1. Ausgangslage

**Heute gibt es:**
- Registrierung in Schritten: Unternehmen, Name, E-Mail, Passwort, Frage „Gibt es Zeitausgleich?“ samt eigenem
  Namen dafür (V-Tag), Zustimmungen.
- Einrichtung (`/einrichtung`) mit vier Schritten: eigene Angaben · Feiertage (Bundesland) · Schichtsystem
  (Muster und Gruppen) · Mitarbeiter anlegen. Jederzeit überspringbar.
- Drei fest angelegte Schichten (Früh, Spät, Nacht) mit Mindestbesetzung 1.

**Was ein fremdes Unternehmen heute nicht einstellen kann** (steht fest im Code, siehe `01-logik.md`, L-12):
Abwesenheitsarten, Antragsarten, Qualifikationen, Zahl und Namen der Gruppen (fest A–E), Regeln für Altersfreizeit
und Sonderurlaub, Stunden je Zeitausgleichs-Tag (fest 7,5), Verfall des Resturlaubs, wer was genehmigt.

Der Assistent allein reicht also nicht – darunter muss das Datenmodell beweglich werden (Abschnitt 3).

---

## 2. Welche Fragen ein Unternehmen beantworten muss

**P** = Pflicht vor dem Start · **E** = empfohlen (hat eine sinnvolle Vorgabe) · **O** = optional, später möglich.

### A · Unternehmen

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Name des Unternehmens | P | – | Anzeige, AV-Vertrag |
| Branche | E | – | wählt die Vorlage (Abschnitt 4) |
| Größe (bis 20 / bis 100 / bis 500 / mehr) | E | – | Vorgaben für Rollen und Seitenaufbau; Hinweis auf Betriebsrat |
| **Bundesland** | **P** | – (heute NRW) | Feiertage → Urlaubstage |
| Regionale Feiertage, Betriebsruhe, Heiligabend/Silvester | O | keine | Feiertage |
| Gibt es einen Betriebsrat? | E | – | zeigt die Unterlage und empfiehlt strengere Vorgaben |

### B · Arbeitsmodell

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Wie wird gearbeitet? Tagschicht · 2-Schicht · 3-Schicht · Vollkonti (rund um die Uhr) · gemischt | P | aus Branche | Schichten, Rhythmus |
| Schichten mit Namen, Kürzel, Zeiten, Farbe | P | aus Vorlage | Plan |
| Arbeitstage (Mo–Fr / Mo–Sa / alle Tage) | P | aus Vorlage | Urlaubstage zählen |
| Gruppen / Teams: wie viele, wie heißen sie | E | aus Vorlage | Rhythmus, Zuständigkeit |
| Schichtrhythmus (z. B. 2 Früh, 2 Spät, 2 Nacht, 4 frei) | E | aus Vorlage | Plan im Voraus |
| Gibt es Tagschicht-Bereiche neben der Wechselschicht (Werkstatt, Labor, Büro)? | O | nein | Bereiche, Tagschichtmeister |

### C · Besetzung

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Mindestbesetzung je Schicht | P | 1 | Besetzungsprüfung |
| Sollbesetzung je Schicht | E | = Mindest | Ampel „knapp“ |
| Andere Werte am Wochenende / an Feiertagen | O | nein | genauere Prüfung |
| Qualifikationen: welche gibt es, wie viele je Schicht nötig | O | keine | Qualifikations-Prüfung |
| Was passiert, wenn ein Urlaub die Mindestbesetzung unterschreitet? Hinweis · Bestätigung nötig · gesperrt | E | Bestätigung nötig | L-01 |
| Zählen Auszubildende zur Besetzung? | E | nein | Besetzungsprüfung |

### D · Urlaub

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Urlaubstage je Jahr (Standard, je Person änderbar) | P | 30 | Konto |
| Resturlaub: Übertrag ja/nein, Stichtag oder kein automatischer Verfall | E | Übertrag ja, **kein** automatischer Verfall | L-05 |
| Halbe Tage erlaubt? | O | nein | L-06 |
| Vorlaufzeit für Anträge (Tage) | O | 0 | Planbarkeit |
| Wer genehmigt? Schichtleitung der eigenen Gruppe · zentrale Stelle · beide | P | Schichtleitung eigene Gruppe | Zuständigkeit |
| Darf jemand eigene Anträge genehmigen? | E | **nein** | L-04 |
| Wie viele dürfen je Schicht gleichzeitig in Urlaub? | O | über Mindestbesetzung | Besetzung |

### E · Abwesenheits- und Tagesarten

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Welche Arten gibt es? (Liste aus der Vorlage, an-/abwählbar, umbenennbar) | P | aus Vorlage | Abschnitt 3 |
| Gibt es einen Zeitausgleich (Freischicht, V-Tag, Überstundenabbau)? Wie heißt er, wie viele Stunden hat ein Tag? | E | aus Vorlage | Zeitkonto |
| Gibt es besondere Kontingente (Altersfreizeit, Sonderurlaub, Bildungsurlaub)? | O | nein | Kontingente |

### F · Rollen und Sichtbarkeit

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Wer ist Administrator? (mindestens zwei empfohlen) | P | registrierende Person | Vertretung |
| Welche Rollen gibt es bei euch? | E | aus Vorlage | `06-rollen-entwuerfe.md` |
| Sehen Kollegen den Grund einer Abwesenheit? | E | **nein** | Datenschutz |
| Wer sieht „krank“? | E | Person selbst + zuständige Führung | Datenschutz |
| Löschfristen (Krankheit, Anträge, ausgeschiedene Personen) | E | Vorgaben | D-02 |

### G · Mitarbeiter und Start

| Frage | Art | Vorgabe | Wozu |
|---|---|---|---|
| Mitarbeiter anlegen: Tabelle hochladen (Excel/CSV) oder einzeln | P (mind. 1) | – | Stammdaten |
| Resturlaub und Zeitkonto-Stand zum Starttag übernehmen | E | 0 | richtige Konten ab Tag 1 |
| Wie werden Zugänge verteilt? Link · QR-Aushang · Code · E-Mail | P | Link/QR | Einladung |
| Benachrichtigungen per E-Mail an? | O | an (ohne Inhalte, siehe D-07) | Mails |
| Starttermin („ab wann gilt der Plan in der App?“) | E | heute | Parallelbetrieb mit Papier |

**Sieben Pflichtfragen** reichen für einen arbeitsfähigen Start: Name, Bundesland, Arbeitsmodell, Schichten,
Mindestbesetzung, Urlaubstage, mindestens eine Person. Alles andere hat eine sichere Vorgabe.

---

## 3. Verallgemeinerung: frei einstellbare Tages- und Abwesenheitsarten

### 3.1 Das Problem

Bei dir heißt es „V-Tag“, anderswo „Freischicht“, „Überstundenausgleich“, „Gleittag“, „AZV-Tag“. Heute gibt es
zwei feste Listen in der Datenbank:

- Antragsarten (`leave_kind`): Urlaub, V-Tag, Altersfreizeit, Sonderurlaub, Bildungsurlaub, Gewerkschaftstag
- Abwesenheitsarten (`absence_type`): Urlaub, krank, Schulung, Sonstiges, Sonderurlaub, Altersfreizeit, Bildungsurlaub

Jede Art hat ihr Verhalten fest im Code. Eine neue Art bedeutet heute eine Datenbank-Änderung für alle.

### 3.2 Entwurf: eine Art mit Eigenschaften

Tabelle `abwesenheitsarten` (je Unternehmen):

| Eigenschaft | Typ | Beispiel V-Tag | Beispiel krank | Beispiel Schulung |
|---|---|---|---|---|
| Name / Mehrzahl | Text | V-Tag / V-Tage | Krank | Schulung |
| Kürzel | 1–3 Zeichen | V | K | SCH |
| Farbe, Symbol | Farbe | Türkis | Rot | Violett |
| **Verhaltensklasse** (siehe 3.3) | Auswahl | Zeitkonto | Krankheit | Dienstlich |
| **Zählt gegen Urlaubskonto** | ja/nein | nein | nein | nein |
| **Eigenes Zeitkonto** | Verweis auf Konto oder leer | „Zeitausgleich“ | – | – |
| Einheit und Wert | Tage oder Stunden; Stunden je Tag | 7,5 h | – | – |
| **Zählt gegen Mindestbesetzung** (Person fehlt in der Schicht) | ja/nein | ja | ja | ja |
| **Genehmigung nötig** | ja / nein / nur Eintrag durch Führung | ja | nein (Führung trägt ein) | nein (Führung trägt ein) |
| Wer darf beantragen | Person selbst / nur Führung | selbst | Führung | Führung |
| Sichtbar für Kollegen | Art sichtbar / nur „abwesend“ / gar nicht | nur „abwesend“ | nur „abwesend“ (fest) | Art sichtbar |
| Besondere Kategorie (Gesundheit) | ja/nein | nein | **ja** – strengere Sicht, kürzere Löschfrist, kein Freitext | nein |
| Halbe Tage erlaubt | ja/nein | nein | nein | ja |
| Kontingent je Jahr | Zahl oder leer | – | – | – |
| Voraussetzung | Regel oder leer (z. B. „ab Alter 55“, „Haken an der Person“) | – | – | – |
| Vorlaufzeit, Höchstdauer am Stück | Tage | – | – | – |
| Zählt an Feiertagen / freien Tagen | ja/nein | nein | ja | nein |
| Löschfrist | Monate | 36 | 12 | 36 |
| Aktiv, Reihenfolge | | | | |
| System-Art (nicht löschbar) | ja/nein | nein | ja | nein |

Dazu Tabelle `zeitkonten` (je Unternehmen): Name, Einheit, Stunden je Tag, Jahresanspruch, Übertrag-Regel,
Startstand je Person. Aus „V-Tage“, „Altersfreizeit“ und „Sonderurlaub“ werden drei Konten mit verschiedenen Regeln.

Genauso werden beweglich: **Qualifikationen** (Liste je Unternehmen statt fester Aufzählung) und
**Gruppen** (frei benannt, beliebig viele statt A–E).

### 3.3 Drei Varianten für das Datenmodell

| | Variante 1: Etiketten | Variante 2: Verhaltensklassen (Hybrid) | Variante 3: Alles frei |
|---|---|---|---|
| Idee | Die festen Listen bleiben. Je Unternehmen lassen sich Name, Kürzel, Farbe und „aktiv“ je Art einstellen. | Wenige feste **Klassen** mit festem Verhalten: Urlaub · Zeitkonto · Krankheit · Dienstlich abwesend · Frei/Sonstiges. Je Unternehmen beliebig viele **Arten** je Klasse, mit den Eigenschaften aus 3.2. | Keine Klassen. Jede Eigenschaft frei kombinierbar; die Logik liest nur noch Eigenschaften. |
| Neue Art anlegen | nein | ja | ja |
| Umbau | klein: eine Tabelle, Anzeige anpassen | mittel–groß: Listen durch Verweise ersetzen, ca. 25 Funktionen anpassen | groß: fast die gesamte Urlaubslogik neu |
| RLS | eine neue Tabelle, Standardmuster | zwei bis vier neue Tabellen, Standardmuster; Verweise an das Unternehmen binden (S-06) | wie 2 |
| Risiko | gering | mittel – Datenumzug der bestehenden Anträge | hoch – unsinnige Kombinationen möglich („krank zählt gegen Urlaub“) |
| Aufwand | M | XL (2–3 Wochen mit Tests) | XL+ (4–6 Wochen) |
| Reicht für | Unternehmen, die nur andere Namen brauchen | fast alle Branchen | theoretisch alle |

**Empfehlung:** Variante 2. Die Klasse legt fest, was technisch passiert (welches Konto, welche Prüfung, welche
Sichtbarkeit) – das bleibt testbar und sicher. Die Art legt fest, wie es heißt und welche Feinheiten gelten.
Variante 1 ist ein guter **erster Schritt** dorthin: Sie bringt eigene Namen sofort und verbaut nichts.

### 3.4 Umzug deines Betriebs

Deine heutigen Regeln werden zur ersten Vorlage („Chemie / Prozessindustrie, vollkontinuierlich, 5 Gruppen“).
Der Umzug läuft in drei Schritten, jeder einzeln rückholbar:

1. Neue Tabellen anlegen und aus den festen Listen befüllen (nichts ändert sich sichtbar).
2. Funktionen eine nach der anderen umstellen, mit Vergleichslauf alt gegen neu (wie beim Konten-Abgleich im Oktober).
3. Alte Spalten erst entfernen, wenn vier Wochen keine Abweichung auftrat.

---

## 4. Branchen-Vorlagen

Vorlagen liegen als Dateien im Code (versioniert, testbar), nicht in der Datenbank. Eine Vorlage setzt: Schichten,
Rhythmus, Gruppen, Arten, Zeitkonten, Rollen-Vorgaben, Besetzungsverhalten.

| Vorlage | Arbeitsmodell | Schichten | Arten zusätzlich zu Urlaub/Krank | Besonderheit |
|---|---|---|---|---|
| **Chemie / Prozessindustrie (vollkonti)** – dein Betrieb | 5 Gruppen, rund um die Uhr | Früh 6–14, Spät 14–22, Nacht 22–6 | V-Tag (Zeitausgleich 7,5 h), Altersfreizeit, Sonderurlaub, Bildungsurlaub, Schulung, Gewerkschaftstag | Qualifikationen (Messwarte, Anlagenfahrer …), Tagschichtmeister |
| Produktion 3-Schicht | 3 Gruppen, Mo–Fr/Sa | Früh, Spät, Nacht | Freischicht, Schulung, Kurzarbeit | Wochenwechsel |
| Produktion 2-Schicht | 2 Gruppen, Mo–Fr | Früh, Spät | Freischicht, Schulung | |
| Pflege / Klinik | Dienstplan je Station, alle Tage | Früh, Spät, Nacht, Zwischen, Bereitschaft | Frei nach Nachtdienst, Fortbildung, Überstundenfrei | Fachkraftquote als Qualifikation; Wunschfrei |
| Logistik / Lager | 2–3 Schichten, Mo–Sa | Früh, Spät, Nacht | Freischicht, Schulung (Stapler) | Qualifikation Staplerschein |
| Einzelhandel | Tagesdienste, Mo–Sa | Früh, Mittel, Spät | Überstundenfrei, Schulung | Teilzeit, wechselnde Wochentage |
| Gastronomie / Hotel | Dienste, alle Tage | Früh, Spät, Teildienst | Ruhetag, Überstundenfrei | geteilte Dienste |
| Sicherheit / Leitstelle | 12-Stunden-Dienste, alle Tage | Tag 6–18, Nacht 18–6 | Freischicht, Schulung | lange Dienste, Ruhezeit-Hinweis |
| Rettungsdienst / Feuerwehr | 24-Stunden-Dienste | 24 h, Tag, Nacht | Freischicht, Fortbildung | Rhythmus 1 Dienst, 2 frei |
| Handwerk / Büro (Tagschicht) | Mo–Fr | Tag | Gleittag, Schulung, mobiles Arbeiten | keine Besetzungsprüfung nötig |
| Leer | – | selbst anlegen | nur Urlaub, Krank | für alle anderen |

Jede Vorlage zeigt vor der Übernahme eine Vorschau („so sähe eure Woche aus“).

---

## 5. Drei Varianten für den Assistenten

### Variante A · Kurz-Start (5 Minuten)

**Ablauf der Bildschirme**
1. **Willkommen** – „In 5 Schritten startklar.“ Branche wählen (Kacheln mit Bild).
2. **Bundesland** (Pflicht) – Karte oder Liste.
3. **So arbeitet ihr** – Vorschau der Vorlage: Schichten mit Zeiten, Rhythmus. Knöpfe „Passt“ / „Anpassen“
   (Anpassen öffnet die Zeiten direkt in der Vorschau).
4. **Besetzung und Urlaub** – zwei Zahlen: Mindestbesetzung je Schicht, Urlaubstage je Jahr.
5. **Mitarbeiter** – Tabelle hochladen oder drei Personen von Hand; QR-Aushang zum Ausdrucken.
6. **Fertig** – Startseite mit **Einrichtungs-Liste** („7 von 15 erledigt“): Rollen, Arten, Löschfristen,
   Betriebsrat-Unterlage, zweiter Administrator …

**Datenmodell:** `company_settings` + `branche`, `vorlage`, `einrichtung` (JSON: erledigte Punkte).
Keine neuen Tabellen nötig, wenn die Arten vorerst fest bleiben (Variante 1 aus 3.3).

| Vorteile | Nachteile |
|---|---|
| niedrigste Hürde, wenig Abbrüche | Unternehmen starten mit Vorgaben, die sie nicht bewusst gewählt haben |
| schnell gebaut | Erklärungen fehlen – mehr Rückfragen |
| passt zum Handy | Datenschutz-Entscheidungen (Sichtbarkeit, Fristen) rutschen nach hinten |

**Aufwand:** L (3–5 Tage) · **Risiko:** gering.

### Variante B · Geführter Leitfaden mit Erklärungen (20–30 Minuten)

**Ablauf der Bildschirme** – zehn Kapitel, links die Übersicht, Zwischenstand wird gespeichert, jedes Kapitel
hat „Warum fragen wir das?“ und ein Beispiel:

1. **Euer Unternehmen** – Name, Branche, Größe, Bundesland, Betriebsrat ja/nein.
2. **Arbeitsmodell** – Tagschicht / Wechselschicht / vollkonti; kurze Erklärung mit Bild.
3. **Schichten und Rhythmus** – Zeiten, Gruppen, Vorschau über 4 Wochen.
4. **Besetzung** – Mindest/Soll, Wochenende, Qualifikationen; Erklärung der Ampel; „Was passiert bei Unterschreitung?“
5. **Urlaub** – Tage, Übertrag und Verfall (mit rechtlichem Hinweis), Genehmigungsweg, eigene Anträge.
6. **Abwesenheits- und Tagesarten** – Liste aus der Vorlage; je Art eine Karte mit den Eigenschaften aus 3.2 in
   Alltagssprache („Wird vom Urlaub abgezogen?“ „Fehlt die Person dann in der Schicht?“ „Muss das jemand genehmigen?“).
7. **Zeitkonten** – Zeitausgleich, besondere Kontingente; Startstände.
8. **Rollen und Rechte** – Rollen aus der Vorlage, je Rolle die Rechte-Gruppen (siehe `06-rollen-entwuerfe.md`).
9. **Datenschutz** – Sichtbarkeit für Kollegen, Krank-Sichtbarkeit, Löschfristen; AV-Vertrag und Unterlage für den
   Betriebsrat zum Herunterladen.
10. **Mitarbeiter und Start** – Import mit Prüfung („3 Zeilen ohne Personalnummer“), Zugänge, Starttermin,
    **Zusammenfassung zum Ausdrucken** („So ist ShiftNexo bei euch eingestellt“).

**Datenmodell:** wie A, dazu `einrichtung_antworten` (JSON je Kapitel, mit Fassung des Assistenten) – daraus
lässt sich später nachvollziehen, wer was wann entschieden hat. Braucht die beweglichen Arten (Variante 2 aus 3.3),
sonst sind Kapitel 6 und 7 nur Anzeige.

| Vorteile | Nachteile |
|---|---|
| Unternehmen versteht seine Einstellungen; weniger Support | lang – Abbruchgefahr, am Handy mühsam |
| Datenschutz-Entscheidungen werden bewusst getroffen und sind belegt | viel Text zu pflegen |
| Zusammenfassung dient als Grundlage für die Betriebsvereinbarung | setzt den großen Umbau der Arten voraus |

**Aufwand:** XL (2 Wochen ohne den Umbau der Arten) · **Risiko:** mittel.

### Variante C · Vorlage mit Vorschau („Zeig mir meinen Plan“)

**Ablauf der Bildschirme**
1. **Vorlage wählen** – Kacheln je Branche, jede mit Mini-Vorschau einer Woche.
2. **Lebende Vorschau** – der Bildschirm ist geteilt: links fünf Regler (Schichten, Gruppen, Rhythmus,
   Mindestbesetzung, Bundesland), rechts der **echte Schichtplan** mit Beispielpersonen, der sich sofort ändert.
3. **Arten ansehen** – Liste der Arten aus der Vorlage als farbige Kürzel im Beispielplan; antippen = umbenennen
   oder abschalten.
4. **Eigene Leute einsetzen** – Tabelle hochladen; die Beispielpersonen werden ersetzt.
5. **Übernehmen** – „So starten“ legt alles an. Danach Einrichtungs-Liste wie in A.

**Datenmodell:** wie A. Die Vorschau rechnet im Browser mit denselben Regeln wie die Live-Demo (die gibt es schon –
`demo_create` kann als Grundlage dienen).

| Vorteile | Nachteile |
|---|---|
| größter Aha-Effekt, verkauft das Produkt | Vorschau ist aufwendig und muss dieselbe Logik zeigen wie die Datenbank |
| Fehler in der Einrichtung fallen sofort auf | passt schlecht auf kleine Bildschirme |
| wenig Text nötig | Urlaubsregeln und Datenschutz kommen kaum vor |

**Aufwand:** XL (2 Wochen) · **Risiko:** mittel (doppelte Logik Browser/Datenbank).

### Vergleich und Empfehlung

| | A · Kurz-Start | B · Leitfaden | C · Vorlage mit Vorschau |
|---|---|---|---|
| Dauer für das Unternehmen | 5 Min. | 20–30 Min. | 10 Min. |
| Aufwand | L | XL | XL |
| Braucht bewegliche Arten | nein | ja | nein (schöner mit) |
| Datenschutz-Entscheidungen bewusst | später (Liste) | ja | später (Liste) |
| Handy-tauglich | ja | bedingt | bedingt |
| Risiko | gering | mittel | mittel |

**Empfehlung: A jetzt, die Kapitel aus B als Vertiefung in der Einrichtungs-Liste.**
Das Unternehmen startet in fünf Minuten und sieht danach eine Liste mit offenen Punkten. Jeder Punkt öffnet das
passende Kapitel aus B – mit Erklärung. Pflicht-Punkte (Bundesland, zweiter Administrator, Sichtbarkeit von
Abwesenheitsgründen) blockieren das Einladen der Mitarbeiter, bis sie erledigt sind. Die Vorschau aus C lohnt
sich später als Verkaufsargument auf der öffentlichen Seite.

---

## 6. Reihenfolge (Vorschlag)

| Schritt | Inhalt | Aufwand |
|---|---|---|
| 1 | Bundesland als Pflicht, Vorgaben sicher stellen (kein automatischer Verfall, keine eigene Genehmigung) | S |
| 2 | Arten mit eigenen Namen, Kürzeln, Farben (Variante 1) | M |
| 3 | Kurz-Start mit drei Vorlagen (deine, 3-Schicht, Tagschicht) und Einrichtungs-Liste | L |
| 4 | Gruppen und Qualifikationen frei einstellbar | L |
| 5 | Arten mit Verhaltensklassen und Zeitkonten (Variante 2), Umzug deines Betriebs | XL |
| 6 | Kapitel aus B als Vertiefung; weitere Vorlagen | L |
| 7 | Import-Assistent für Excel/CSV mit Prüfung | L |

## 7. Offene Fragen an dich

1. Welche Branchen willst du zuerst ansprechen? (bestimmt die ersten drei Vorlagen)
2. Sollen Unternehmen eigene Arten **anlegen** können (Variante 2) – oder reichen eigene Namen (Variante 1) für das erste Jahr?
3. Soll der Assistent blockieren, bis die Pflicht-Punkte erledigt sind, oder nur erinnern?
4. Braucht es einen Import aus anderen Programmen (Excel reicht den meisten)?
