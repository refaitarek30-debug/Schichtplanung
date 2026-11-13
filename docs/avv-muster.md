# Vertrag über die Verarbeitung personenbezogener Daten im Auftrag

> **Ersetzt.** Maßgeblich ist der in der Anwendung veröffentlichte Vertrag unter `/avv`
> (Quelle: `app/(rechtliches)/avv/page.tsx`, Fassung siehe `src/lib/legal/version.ts`). Dieses
> Dokument bleibt nur als Druckvorlage für individuelle Verträge; seine Angaben zu Inaktivitätsfrist
> („30 Minuten“ → tatsächlich 10 Minuten) und Vercel-Region (→ `dub1`) waren veraltet.

**Muster nach Art. 28 DSGVO — Vorlage, kein unterschriftsreifes Dokument.**

Diese Vorlage legt der Betreiber von Schichtplan jedem Kunden-Unternehmen
vor, bevor es produktiv geht. Die gelb gedachten Stellen — hier als
`[ … ]` markiert — sind vor der Unterzeichnung auszufüllen. Vor dem ersten
echten Einsatz sollte eine fachkundige Stelle den Text prüfen; er ist
sorgfältig, aber keine Rechtsberatung.

---

## Zwischen

**Verantwortlicher** (nachfolgend „Auftraggeber")

- Firma: `[ Name des Kunden-Unternehmens ]`
- Anschrift: `[ Straße, Hausnummer, PLZ, Ort ]`
- Vertreten durch: `[ Name, Funktion ]`

**und**

**Auftragsverarbeiter** (nachfolgend „Auftragnehmer")

- Firma: `[ Name oder Firma des Betreibers ]`
- Anschrift: `[ Straße, Hausnummer, PLZ, Ort ]`
- Vertreten durch: `[ Name, Funktion ]`

---

## § 1 Gegenstand und Dauer

(1) Der Auftragnehmer stellt dem Auftraggeber die Anwendung **Schichtplan**
zur Schicht- und Urlaubsplanung als internetgestützten Dienst zur Verfügung.
Gegenstand dieses Vertrags ist die Verarbeitung personenbezogener Daten, die
der Auftragnehmer dabei im Auftrag des Auftraggebers vornimmt.

(2) Die Verarbeitung erfolgt ausschließlich im Rahmen des zugrunde liegenden
Hauptvertrags (Nutzungs- bzw. Dienstvertrag vom `[ Datum ]`).

(3) Die Dauer entspricht der Laufzeit des Hauptvertrags. Der Vertrag endet
automatisch mit dessen Beendigung; die Pflichten aus § 10 (Löschung und
Rückgabe) bestehen darüber hinaus fort.

(4) Der Auftraggeber kann diesen Vertrag jederzeit ohne Einhaltung einer Frist
kündigen, wenn ein schwerwiegender Verstoß des Auftragnehmers gegen
datenschutzrechtliche Vorschriften oder gegen diesen Vertrag vorliegt.

## § 2 Art und Zweck der Verarbeitung

**Art der Verarbeitung:** Erheben, Erfassen, Organisieren, Ordnen, Speichern,
Anpassen, Auslesen, Abfragen, Verwenden, Löschen und Vernichten
personenbezogener Daten mittels automatisierter Verfahren.

**Zweck der Verarbeitung:**

- Planung und Darstellung von Schichten, Rotationsgruppen und Einzelzuweisungen
- Beantragung, Prüfung und Genehmigung von Urlaub und Freischichten (V-Tagen)
- Führung der Urlaubs- und Freischichtkonten je Kalenderjahr
- Erfassung von Abwesenheiten (Urlaub, Freischicht, frei, krank)
- Prüfung der Mindest- und Sollbesetzung je Schicht und Tag
- Einrichtung, Verwaltung und Absicherung der Benutzerzugänge

Eine Verarbeitung zu eigenen Zwecken des Auftragnehmers — insbesondere zu
Werbe-, Analyse- oder Profilbildungszwecken oder zur Weitergabe an Dritte —
findet nicht statt.

## § 3 Kategorien betroffener Personen

- Beschäftigte des Auftraggebers, deren Arbeitszeit über die Anwendung
  geplant wird
- Führungskräfte des Auftraggebers (Schichtleitung, Betriebsleitung)
- Benutzer mit administrativen Rechten beim Auftraggeber

## § 4 Kategorien personenbezogener Daten

**Stammdaten**
Vor- und Nachname, E-Mail-Adresse, Telefonnummer, Personalnummer, Abteilung,
Rolle in der Anwendung, Qualifikationen, Status aktiv/inaktiv.

**Planungs- und Abwesenheitsdaten**
Schichtzuordnung, Rotationsgruppe, tagesgenaue Schichtzuweisungen,
Urlaubsanspruch, genommene, geplante und beantragte Urlaubstage, Restansprüche,
V-Tage-Konto, Urlaubsanträge mit Zeitraum, Art, Status, Entscheidung und
freiwilligem Kommentar, Abwesenheiten mit Grund.

**Zugangs- und Protokolldaten**
E-Mail-Adresse und Passwort-Hash, Zeitpunkt der letzten Anmeldung und
Aktivität, technische Protokolle der eingesetzten Dienstleister
(IP-Adresse, Zeitstempel, aufgerufener Pfad, Browserkennung).

**Besondere Kategorien nach Art. 9 DSGVO**
Die Anwendung speichert zu Krankheit ausschließlich die **Tatsache der
Abwesenheit** in der Kategorie „krank". Diagnosen, ärztliche Bescheinigungen
oder sonstige Gesundheitsangaben sieht die Anwendung nicht vor und sind vom
Auftraggeber auch nicht einzutragen — etwa in Freitextfeldern wie dem
Kommentar zu einem Urlaubsantrag. Soweit die Kategorie „krank" als
Gesundheitsdatum im Sinne des Art. 9 DSGVO zu werten ist, erfolgt die
Verarbeitung auf Grundlage von Art. 9 Abs. 2 lit. b DSGVO i. V. m.
§ 26 Abs. 3 BDSG.

## § 5 Weisungsrecht des Auftraggebers

(1) Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich auf
dokumentierte Weisung des Auftraggebers. Dieser Vertrag und die Nutzung der
Anwendung durch den Auftraggeber stellen die Erstweisung dar.

(2) Weitere Weisungen erteilt der Auftraggeber in Textform an
`[ Kontaktadresse des Auftragnehmers ]`. Mündlich erteilte Weisungen sind
unverzüglich in Textform zu bestätigen.

(3) Der Auftragnehmer informiert den Auftraggeber unverzüglich, wenn er der
Auffassung ist, dass eine Weisung gegen die DSGVO oder andere
Datenschutzvorschriften verstößt. Er ist berechtigt, die Ausführung der
betreffenden Weisung bis zu deren Bestätigung oder Änderung auszusetzen.

(4) Weisungsberechtigt auf Seiten des Auftraggebers sind:
`[ Name, Funktion, Kontakt ]`

## § 6 Pflichten des Auftragnehmers

Der Auftragnehmer verpflichtet sich,

1. Daten ausschließlich im Rahmen dieses Vertrags und der Weisungen zu
   verarbeiten;
2. alle zur Verarbeitung befugten Personen zur Vertraulichkeit zu
   verpflichten oder deren gesetzliche Verschwiegenheitspflicht
   sicherzustellen (Art. 28 Abs. 3 lit. b DSGVO);
3. die technischen und organisatorischen Maßnahmen nach § 8 zu treffen und
   während der Vertragslaufzeit aufrechtzuerhalten;
4. den Auftraggeber bei der Erfüllung von Betroffenenrechten zu unterstützen
   (§ 9);
5. den Auftraggeber bei Datenschutz-Folgenabschätzungen und vorherigen
   Konsultationen nach Art. 35 und 36 DSGVO zu unterstützen;
6. den Auftraggeber unverzüglich zu informieren, wenn eine Aufsichtsbehörde
   beim Auftragnehmer Maßnahmen ergreift, die den Auftraggeber betreffen
   könnten;
7. dem Auftraggeber alle Informationen zur Verfügung zu stellen, die zum
   Nachweis der Einhaltung der Pflichten aus Art. 28 DSGVO erforderlich sind,
   und Überprüfungen nach § 11 zu ermöglichen;
8. nach Beendigung der Verarbeitung nach Wahl des Auftraggebers alle Daten
   herauszugeben oder zu löschen (§ 10);
9. ein Verzeichnis aller Verarbeitungstätigkeiten im Auftrag nach Art. 30
   Abs. 2 DSGVO zu führen.

## § 7 Unterauftragsverarbeiter

(1) Der Auftraggeber stimmt der Beauftragung der nachfolgend genannten
Unterauftragsverarbeiter zu:

| Unternehmen | Sitz | Leistung | Ort der Verarbeitung |
|---|---|---|---|
| Supabase, Inc. | San Francisco, USA | Datenbank, Authentifizierung, Dateiablage | Region `eu-west-1` — Irland, EU |
| Vercel, Inc. | San Francisco, USA | Auslieferung der Anwendung, Serverfunktionen | Region `[ iad1 — Washington D.C., USA / fra1 — Frankfurt, EU ]` |

(2) Die eigentlichen Stamm-, Planungs- und Abwesenheitsdaten werden
ausschließlich in der Datenbank bei Supabase in Irland gespeichert.

(3) **Übermittlung in Drittländer.** Soweit ein Unterauftragsverarbeiter
Daten außerhalb der EU/des EWR verarbeitet, geschieht dies auf Grundlage
eines Angemessenheitsbeschlusses (EU-US Data Privacy Framework) oder der
Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO nebst
ergänzenden Maßnahmen.

> **Hinweis an den Betreiber:** In Vercel lässt sich die Region der
> Serverfunktionen auf `fra1` (Frankfurt) umstellen. Dann entfällt die
> Drittlandübermittlung vollständig. Vor der Unterzeichnung bitte
> entscheiden und die Tabelle entsprechend eindeutig ausfüllen — ein
> Vertrag, der beide Möglichkeiten offenlässt, ist kein Vertrag.

(4) Der Auftragnehmer schließt mit jedem Unterauftragsverarbeiter einen
Vertrag, der diesem mindestens dieselben Pflichten auferlegt, die ihn
selbst aus diesem Vertrag treffen.

(5) Der Auftragnehmer informiert den Auftraggeber mindestens **vier Wochen**
vorher in Textform über beabsichtigte Änderungen der eingesetzten
Unterauftragsverarbeiter. Der Auftraggeber kann der Änderung innerhalb von
zwei Wochen aus wichtigem datenschutzrechtlichem Grund widersprechen; in
diesem Fall steht ihm ein Sonderkündigungsrecht nach § 1 Abs. 4 zu.

(6) Nicht als Unterauftragsverarbeitung gelten Nebenleistungen wie
Telekommunikationsdienste oder Postversand.

## § 8 Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

Der Auftragnehmer trifft die in der **Anlage TOM** (`docs/toms.md`) beschriebenen
Maßnahmen. Kurzfassung:

- **Zugang:** persönliche Konten, Passwörter nur als Hash; Zwei-Faktor-Anmeldung
  (Pflicht für Administration, Schichtleitung und Betreiber, in der Datenbank
  durchgesetzt); Sperre nach 5 Fehlversuchen bis zur Freischaltung durch die
  Administration; automatische Abmeldung nach Inaktivität je nach Rolle
  (Administration 15 Minuten, Schichtleitung 8 Stunden, Mitarbeiter 12 Stunden).
- **Zugriff und Trennung:** Mandantentrennung in der Datenbank (Row Level Security),
  Rollenmodell, keine Auswertung je Person, keine Lesebestätigung.
- **Weitergabe:** nur verschlüsselt (TLS, HSTS); keine Dritten außer § 7.
- **Eingabe:** Änderungsprotokoll ohne Gesundheitsinhalte (24 Monate).
- **Verfügbarkeit:** nächtliche, zusätzlich verschlüsselte Vollsicherung (14 Tage),
  regelmäßige Wiederherstellungsprobe.
- **Betreiber:** Übersicht nur mit Zählwerten und Zwei-Faktor-Anmeldung; Zugriff auf
  Inhalte nur auf Weisung; Vorgänge werden protokolliert.
- **Überprüfung:** automatische Tests vor jeder Veröffentlichung, Prüfskripte für die
  Zugriffsregeln, jährliche Überprüfung der Anlage.

> Der Auftragnehmer überprüft und aktualisiert diese Maßnahmen fortlaufend.
> Änderungen sind zulässig, solange das Schutzniveau nicht unterschritten
> wird.

## § 9 Betroffenenrechte

(1) Der Auftragnehmer unterstützt den Auftraggeber mit geeigneten
technischen und organisatorischen Maßnahmen dabei, Anträge betroffener
Personen auf Auskunft, Berichtigung, Löschung, Einschränkung,
Datenübertragbarkeit und Widerspruch zu erfüllen.

(2) Wendet sich eine betroffene Person unmittelbar an den Auftragnehmer,
leitet dieser das Anliegen unverzüglich an den Auftraggeber weiter und
beantwortet es nicht selbst.

(3) Der Auftragnehmer berichtigt, löscht oder schränkt die Verarbeitung von
Daten nur auf Weisung des Auftraggebers ein.

## § 10 Löschung und Rückgabe nach Vertragsende

(1) Nach Beendigung des Hauptvertrags gibt der Auftragnehmer nach Wahl des
Auftraggebers alle Daten in einem gängigen maschinenlesbaren Format heraus
oder löscht sie.

(2) Der Auftraggeber teilt seine Wahl innerhalb von **30 Tagen** nach
Vertragsende in Textform mit. Ohne Mitteilung werden die Daten nach Ablauf
weiterer **30 Tage** gelöscht.

(3) Sicherungskopien werden im Rahmen der üblichen Aufbewahrungszyklen des
Dienstleisters automatisch überschrieben.

(4) Gesetzliche Aufbewahrungspflichten bleiben unberührt. Für Daten, die
danach weiter aufbewahrt werden müssen, gilt dieser Vertrag fort.

## § 11 Nachweise und Überprüfung

(1) Der Auftragnehmer weist die Einhaltung der Pflichten aus diesem Vertrag
auf Anfrage nach — vorrangig durch Selbstauskunft, Dokumentation der
Maßnahmen nach § 8 oder Zertifikate und Prüfberichte der
Unterauftragsverarbeiter.

(2) Reichen diese Nachweise nicht aus, kann der Auftraggeber nach
rechtzeitiger Ankündigung (mindestens zwei Wochen) zu üblichen
Geschäftszeiten eine Überprüfung vornehmen oder durch einen zur
Verschwiegenheit verpflichteten Prüfer vornehmen lassen. Der Prüfer darf
kein Wettbewerber des Auftragnehmers sein.

(3) Überprüfungen finden höchstens einmal jährlich statt, es sei denn, es
besteht ein konkreter Anlass.

## § 12 Meldung von Verletzungen des Schutzes personenbezogener Daten

(1) Der Auftragnehmer informiert den Auftraggeber **unverzüglich, spätestens
innerhalb von 24 Stunden** nach Kenntniserlangung über jede Verletzung des
Schutzes personenbezogener Daten.

(2) Die Meldung enthält, soweit bekannt: Art der Verletzung, betroffene
Kategorien und ungefähre Zahl betroffener Personen und Datensätze,
wahrscheinliche Folgen sowie ergriffene und vorgeschlagene Maßnahmen.

(3) Der Auftragnehmer unterstützt den Auftraggeber bei dessen Meldepflichten
nach Art. 33 und 34 DSGVO. Die Meldung an die Aufsichtsbehörde und die
Benachrichtigung betroffener Personen obliegen dem Auftraggeber.

## § 13 Haftung

Es gilt Art. 82 DSGVO. Im Übrigen richtet sich die Haftung nach den
Regelungen des Hauptvertrags.

## § 14 Schlussbestimmungen

(1) Änderungen und Ergänzungen bedürfen der Textform. Das gilt auch für die
Änderung dieser Formklausel.

(2) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der
übrigen Bestimmungen unberührt.

(3) Bei Widersprüchen zwischen diesem Vertrag und dem Hauptvertrag gehen die
Regelungen dieses Vertrags vor, soweit es um die Verarbeitung
personenbezogener Daten geht.

(4) Es gilt deutsches Recht.

---

**Ort, Datum:** `[ … ]`

| Auftraggeber | Auftragnehmer |
|---|---|
| &nbsp; | &nbsp; |
| `[ Unterschrift, Name, Funktion ]` | `[ Unterschrift, Name, Funktion ]` |

---

## Noch zu erledigen, bevor dieses Muster verwendet wird

- [ ] Alle `[ … ]`-Stellen ausfüllen
- [ ] In § 7 die Vercel-Region **eindeutig** festlegen (siehe Hinweis dort)
- [ ] Prüfen, ob ein Datenschutzbeauftragter zu benennen ist (§ 38 BDSG)
- [ ] Muster durch eine fachkundige Stelle prüfen lassen
- [ ] Auftragsverarbeitungsverträge mit Supabase und Vercel selbst
      abschließen und ablegen — ohne die trägt dieses Muster nicht
