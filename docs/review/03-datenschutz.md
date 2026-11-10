# 03 – Datenschutz (DSGVO)

Stand: 10. November 2026 · **Keine Rechtsberatung.** Diese Datei beschreibt, was die Anwendung technisch tut, und
wo aus meiner Sicht Lücken zur DSGVO bestehen. Die rechtliche Bewertung gehört zu einer Fachperson
(Datenschutzberatung, Anwalt).

**Schweregrade:** kritisch = vor dem Start beheben · mittel = vor dem SaaS-Start beheben · klein = kann später.

---

## Kurzfassung

Vieles ist bereits überdurchschnittlich gelöst: datensparsame Voreinstellungen (Gründe für Kollegen aus, „krank“
nur mit Freigabe sichtbar), keine Diagnosen, kurze Fristen für Protokolle, EU-Standort, Mandantentrennung in der
Datenbank, Lohnabrechnungen nur mit Einwilligung.

Für „100 % Datenschutz“ fehlen vor allem vier Dinge:

| Nr. | Fund | Schwere |
|---|---|---|
| D-01 | Führung kann in fremde Konten – inklusive Privatbereich und Lohnabrechnungen | **kritisch** (= S-01) |
| D-02 | Keine Löschfristen für Krankheitstage, Anträge, Schichten und ausgeschiedene Personen | **kritisch** für SaaS, heute mittel |
| D-03 | Keine Sicherung mit geprüfter Wiederherstellung (Verfügbarkeit, Art. 32) | **kritisch** (= P-07) |
| D-04 | Kein Export der eigenen Daten / keine Auskunft auf Knopfdruck (Art. 15, 20) | mittel |
| D-05 | Schichtleitung sieht Krankheit und Geburtsdatum **aller** Personen im Unternehmen | mittel |
| D-06 | Freitextfelder können Gesundheitsangaben enthalten | mittel |
| D-07 | Mails enthalten Name, Urlaubszeitraum und Kommentar – an alle Führungskräfte und den Mail-Dienst | mittel |
| D-08 | Unterlagen veraltet oder unvollständig (Verarbeitungsverzeichnis, Löschkonzept, Berechtigungskonzept, AV-Verträge) | mittel |
| D-09 | Datenschutz-Folgenabschätzung nicht dokumentiert | mittel |
| D-10 | Betreiber kann technisch alle Daten lesen, auch Lohnabrechnungen | klein–mittel |
| D-11 | Benachrichtigung über neue Anträge geht an alle Führungskräfte | klein |

---

## 1. Welche personenbezogenen Daten gibt es

### Betriebsbereich (du bist Auftragsverarbeiter, das Unternehmen ist verantwortlich)

| Daten | Tabelle | Besonderheit |
|---|---|---|
| Name, Personalnummer, E-Mail, Telefon, Abteilung, Schichtgruppe, Ein-/Austritt, Azubi-Merkmal, Qualifikationen | `employees` | Stammdaten |
| Geburtsdatum (freiwillig, für Altersfreizeit/Sonderurlaub) | `personal_details` | eigene Tabelle, erzwungene RLS |
| Rolle, Anmelde-E-Mail, Ansichts-Einstellungen | `profiles` | |
| Schichten je Tag | `shift_assignments`, Rotationsmuster | |
| Urlaubsanträge mit Zeitraum, Art, **Kommentar**, Entscheidung, Ablehnungsgrund | `leave_requests` | Freitext |
| Abwesenheiten: Urlaub, **krank**, Schulung, Sonderurlaub, Altersfreizeit, Bildungsurlaub, Sonstiges, mit **Notiz** | `absences` | „krank“ = Gesundheitsdatum (Art. 9); Trigger gegen medizinische Texte vorhanden |
| Fehlzeiten in Stunden (früher gegangen, später gekommen) mit **Notiz** | `fehlzeiten` | geeignet zur Verhaltenskontrolle |
| Urlaubs- und V-Tage-Konten | `leave_balances` | |
| Kommentare im Plan | `plan_kommentare` | Freitext, ganze Firma liest |
| Benachrichtigungen, Mail-Postausgang | `notifications`, `email_outbox` | enthalten Namen und Zeiträume |
| Änderungsprotokoll, Anmeldeprotokoll, Fehlermeldungen | `audit_logs` | wer hat wann was getan; Gerätetyp |
| Datenschutz-Einstellungen der Person | `privacy_settings` | |
| Push-Abonnements | `push_abos` | Geräte-Adresse beim Hersteller |

### Privatbereich (du bist selbst verantwortlich)

| Daten | Tabelle / Ort |
|---|---|
| Spitzname, freiwillige Kontakt-E-Mail, Bundesland, Wochenstunden | `privat_konten` |
| Eigene Schichten, Schichtarten, Rotation, abweichende Zeiten | `privat_tage`, `privat_schichtarten`, `privat_tag_zeiten` |
| Termine, To-dos, Geburtstage anderer Personen | `kalender_termine`, `kalender_todos` |
| Freigaben an Partner, Gruppen, verbundene Konten | `kalender_personen`, Verbindungs-Tabellen |
| **Lohnabrechnungen** (Bild/PDF) – nur mit ausdrücklicher Einwilligung | Speicher-Bucket `lohnzettel` |
| Lohn, Zuschläge, Jobs | **nur im Browser** des Geräts, nicht auf dem Server |

### Technische Daten

- Anmelde-Bremse: IP und E-Mail nur als gesalzener Hash, Löschung nach 1 Tag.
- Server-Protokolle bei Vercel und Supabase (IP-Adresse, Zeit, Adresse der Anfrage) – Dauer je nach Tarif.

---

## 2. Wer sieht was (Ist-Stand)

| Daten | Person selbst | Kollegen | Schichtleitung | Administration | Betreiber (du) |
|---|---|---|---|---|---|
| Eigener Plan, eigene Anträge, eigenes Konto | ja | – | ja (ganze Firma) | ja | technisch ja |
| Schichtplan der anderen | – | ja (Namen und Schichten) | ja | ja | technisch ja |
| Abwesenheit mit Grund (Urlaub, Schulung …) | ja | nur mit Freigabe, sonst „abwesend“ | ja | ja | technisch ja |
| **Krank** | ja | nur mit Freigabe der Person | **ja, alle Schichten** | ja | technisch ja |
| Kranktage je Person (Auswertung) | eigene | – | – | ja | technisch ja |
| Fehlzeiten in Stunden | eigene | – | – | ja | technisch ja |
| Geburtsdatum | ja | – | **ja, alle** | ja | technisch ja |
| Urlaubskonto | eigenes | – | ja | ja | technisch ja |
| Änderungsprotokoll | – | – | ja | ja | technisch ja |
| Anmeldeprotokoll, Fehlermeldungen | – | – | – | nur freigeschaltete Person | technisch ja |
| Privatbereich (Kalender, Lohnabrechnungen) | ja | – | **nein – aber siehe D-01** | **nein – aber siehe D-01** | technisch ja (D-10) |

„Technisch ja“ heißt: Mit dem Service-Schlüssel und dem Datenbank-Zugang kann der Betreiber alles lesen. Das ist bei
jedem SaaS so – es muss aber im AV-Vertrag stehen, auf das Nötige beschränkt und protokolliert sein.

---

## D-01 · Zugriff der Führung auf fremde Konten (kritisch)

Ausführlich in `02-sicherheit.md`, S-01. Datenschutz-Sicht:

- Das Unternehmen (Verantwortlicher für den Betriebsbereich) erhält Zugriff auf Daten, für die **du** verantwortlich
  bist (Privatbereich) und für die es keine Rechtsgrundlage hat.
- Lohnabrechnungen können Religionszugehörigkeit (Kirchensteuer) und Gesundheitsangaben enthalten.
- Wäre das bekannt und würde es ausgenutzt, wäre es voraussichtlich eine meldepflichtige Datenpanne (Art. 33).

**Empfehlung:** wie S-01 – Variante A sofort.

---

## D-02 · Keine Löschfristen für die Kerndaten (kritisch für SaaS)

**Was passiert:** `retention_cleanup` löscht jede Nacht Protokolle, Benachrichtigungen, Kommentare und den
Postausgang. **Nicht** gelöscht werden: Krankheitstage, Urlaubsanträge samt Kommentaren, Schichtzuordnungen,
Fehlzeiten und die Stammdaten ausgeschiedener Personen. Sie bleiben, bis die Administration die Person von Hand
endgültig löscht (`mitarbeiter_endgueltig_loeschen`). Das Verarbeitungsverzeichnis sagt dazu nur „solange der Kunde
die Anwendung nutzt“.

**Warum das ein Problem ist:** Art. 5 Abs. 1 e DSGVO (Speicherbegrenzung). Krankheitstage von vor fünf Jahren braucht
niemand für die Schichtplanung. Auf der anderen Seite gibt es Aufbewahrungspflichten (z. B. Urlaubsnachweise,
Arbeitszeitnachweise 2 Jahre, steuerlich Relevantes länger) – deshalb muss die Frist je Datenart einstellbar sein.

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | **Feste Fristen** für alle: z. B. Krankheit 12 Monate nach Jahresende, Anträge und Schichten 3 Jahre, ausgeschiedene Personen 6 Monate nach Austritt anonymisieren. | einfach, klar erklärbar | passt nicht für jedes Unternehmen | M | mittel (Löschen ist endgültig) |
| B | **Fristen je Unternehmen einstellbar** mit sinnvollen Vorgaben und Unter-/Obergrenzen. Vor dem ersten Lauf Vorschau „das würde gelöscht“. | passt für alle, Unternehmen bleibt verantwortlich | mehr Oberfläche | M–L | mittel |
| C | **Anonymisieren statt löschen**: Name und Personalnummer werden ersetzt, Zahlen für die Statistik bleiben. | Auswertungen bleiben | Anonymisierung muss wirklich unumkehrbar sein | M–L | mittel |
| D | Nur Erinnerung an die Administration („12 Personen sind seit über 6 Monaten ausgeschieden“). | kein automatisches Löschen | hängt am Menschen | S | gering |

**Empfehlung:** B mit C für ausgeschiedene Personen; D als Sofortmaßnahme. Die Fristen gehören ins Löschkonzept
und in die Betriebsvereinbarung.

---

## D-03 · Sicherung und Wiederherstellung (kritisch)

Ausführlich in `04-performance-robustheit.md`, P-07. Kurz: Die Datenbank läuft im kostenlosen Supabase-Tarif ohne
automatische Sicherungen, und die eigene nächtliche Sicherung nach GitHub schlägt seit dem 29.10.2026 fehl.
Im AV-Vertrag sagst du den Unternehmen Verfügbarkeit und Wiederherstellbarkeit zu (Art. 32 Abs. 1 b und c).

---

## D-04 · Auskunft und Datenübertragbarkeit (mittel)

**Was passiert:** Es gibt nur einen CSV-Export des Schichtplans. Es gibt keine Funktion „Meine Daten herunterladen“
und keine „Auskunft für Person X“ für die Administration. Bei einer Anfrage nach Art. 15 müsste jemand die Daten
von Hand aus der Datenbank ziehen – das wärst du als Auftragsverarbeiter, auf Zuruf des Unternehmens.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Knopf im Profil: „Meine Daten herunterladen“ (JSON + lesbare PDF/CSV) – Stammdaten, Anträge, Abwesenheiten, Konto, Protokoll-Einträge über mich. | M | gering |
| B | Zusätzlich für die Administration: „Auskunft für Person erzeugen“, mit Protokoll-Eintrag. | M | gering |
| C | Schriftlicher Ablauf: Anfrage geht an dich, du lieferst binnen x Tagen per SQL-Skript. | S | mittel (hängt an dir) |
| D | Gesamtexport je Unternehmen (alle Tabellen) – auch für den Fall der Kündigung (AV-Vertrag: Herausgabe). | M | gering |

**Empfehlung:** C sofort als dokumentierter Ablauf, A + D vor dem SaaS-Start, B danach.
Für den Privatbereich gilt dasselbe (dort bist du selbst auskunftspflichtig).

---

## D-05 · Schichtleitung sieht Krankheit und Geburtsdatum aller (mittel)

**Was passiert:** Die Policies auf `absences` und `personal_details` erlauben der Führung das Lesen für das **ganze
Unternehmen**. Eine Schichtleitung der Schicht A sieht „krank“ und das Geburtsdatum der Leute in Schicht D.
Auch die Benachrichtigungen und die Zurücksetz-Möglichkeiten gelten firmenweit.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Sicht der Schichtleitung auf die eigene Schicht/Gruppe begrenzen (Policy mit `darf_urlaub_entscheiden`). | M | mittel (Vertretungen müssen weiter gehen) |
| B | Geburtsdatum nur für die Administration; Schichtleitung sieht nur „Altersfreizeit ja/nein“. | S | gering |
| C | Über das neue Rollenmodell je Recht einstellbar („sieht Krankheit: eigene Schicht / alle / nein“). | L | mittel |

**Empfehlung:** B sofort, A oder C mit dem Rollenmodell.

---

## D-06 · Freitextfelder (mittel)

Freitext gibt es in `leave_requests.reason`, `leave_requests.rejection_reason`, `absences.note`, `fehlzeiten.notiz`
und `plan_kommentare.text`. Auf `absences` verhindert ein Trigger medizinische Begriffe – gut. Auf den anderen
Feldern nicht. Menschen schreiben „Arzttermin wegen Rücken“ in den Kommentar zum Urlaubsantrag.

**Hinweis auf einen Widerspruch in den eigenen Unterlagen:** `docs/betriebsrat.md` sagt „keine Freitexte“,
`docs/verarbeitungsverzeichnis.md` nennt „kurze Notiz (höchstens 200 Zeichen)“.

**Varianten:** A) Denselben Schutz-Trigger auf alle Freitextfelder (S). B) Freitext bei Abwesenheiten ganz
entfernen, stattdessen feste Auswahl (S–M). C) Hinweistext am Feld: „Bitte keine Gesundheitsangaben“ (S).
**Empfehlung:** A + C; B bei Krankheit.

---

## D-07 · Inhalte in E-Mails (mittel)

Die Mail „Neuer Antrag“ enthält Name, Zeitraum, Zahl der Tage und den Kommentar. Sie geht an alle
Administratoren und an die Schichtleitungen der Gruppe – und über den Mail-Dienst (laut `PROJECT_STATUS.md` Brevo).
Mails sind nicht Ende-zu-Ende geschützt und liegen danach in privaten Postfächern.

**Varianten:** A) Mail ohne Inhalt: „Es gibt einen neuen Antrag – bitte in der App ansehen“ (S).
B) Mail nur an die zuständige Person (S–M). C) So lassen und im AV-Vertrag nennen.
**Empfehlung:** A (löst auch S-04).

---

## D-08 · Unterlagen (mittel)

| Unterlage | Stand | Was fehlt |
|---|---|---|
| Verarbeitungsverzeichnis (`docs/verarbeitungsverzeichnis.md`) | 22.10.2026 | Mail-Dienst steht als „noch offen“; Lohnabrechnungen/Speicher, Push-Warteschlange, Fehlzeiten, Qualifikationen fehlen. Es deckt nur die Rolle als Auftragsverarbeiter ab – für den Privatbereich brauchst du ein **eigenes** Verzeichnis als Verantwortlicher (Art. 30 Abs. 1). |
| AV-Vertrag mit Kunden (`/avv`, `docs/avv-muster.md`) | vorhanden, Fassung wird je Unternehmen gespeichert | Liste der Unterauftragnehmer aktuell halten (Mail-Dienst!). Ablauf für Änderungen (Ankündigung, Widerspruchsfrist) festlegen. |
| AV-Verträge mit **deinen** Dienstleistern | laut Verzeichnis: Supabase und Vercel „bestehen“ | Bitte prüfen, ob sie wirklich **abgeschlossen** sind (bei Supabase muss das DPA im Dashboard angefordert und unterschrieben werden). Mail-Dienst: AV-Vertrag abschließen. GitHub: nur wenn die Sicherung dort bleibt. |
| Löschkonzept | fehlt | je Datenart: Frist, Auslöser, wer löscht, wie nachgewiesen wird (siehe D-02) |
| Berechtigungskonzept | fehlt als Dokument | Rollen, Rechte, wer vergibt, wie oft geprüft wird (Grundlage: `06-rollen-entwuerfe.md`) |
| Technische und organisatorische Maßnahmen | Abschnitt im Verzeichnis | als eigene Anlage zum AV-Vertrag, mit Sicherung, Notfallplan, Schlüsselwechsel |
| Ablauf bei Datenpannen | `docs/stoerungen.md` beschreibt Störungen | 72-Stunden-Meldung, wer entscheidet, Vorlage für die Meldung an Kunden |
| Datenschutzerklärung | Fassung 2.27, wird versioniert | aktuell; nach den Änderungen aus diesem Review anpassen |

---

## D-09 · Datenschutz-Folgenabschätzung (mittel)

Eine Folgenabschätzung (Art. 35) ist nötig, wenn eine Verarbeitung „voraussichtlich ein hohes Risiko“ hat. Hier
kommen mehrere Merkmale zusammen: Beschäftigte (abhängige Personen), Gesundheitsdaten („krank“), Daten, die zur
Verhaltenskontrolle taugen (Fehlzeiten, Protokolle), und im Privatbereich Lohnabrechnungen. Die Liste der
Aufsichtsbehörden (DSK-„Muss-Liste“) nennt umfangreiche Verarbeitung von Beschäftigtendaten mit
Überwachungspotenzial.

Verantwortlich für die Folgenabschätzung im Betriebsbereich ist das **Unternehmen** – du solltest als Anbieter
aber eine fertige Vorlage mitliefern. Für den Privatbereich mit Lohnabrechnungen bist du selbst zuständig.

**Varianten:** A) Vorlage für Kunden + eigene Folgenabschätzung für den Privatbereich, mit Fachperson erstellt (M, extern).
B) Schwellenwert-Prüfung dokumentieren („warum keine Folgenabschätzung nötig ist“) (S). **Empfehlung:** A.

---

## D-10 · Zugriff des Betreibers (klein–mittel)

Du kannst mit dem Datenbank-Zugang alles lesen, auch die Lohnabrechnungen im Speicher (dort serverseitig
verschlüsselt, aber mit dem Service-Schlüssel abrufbar). Zugriffe über das Supabase-Dashboard werden in der App
nicht protokolliert.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Lohnabrechnungen **im Browser verschlüsseln**, bevor sie hochgeladen werden (Schlüssel aus einem eigenen Passwort der Person). Dann kann niemand außer der Person sie lesen. | L | mittel (Passwort weg = Dateien weg) |
| B | Schriftliche Regel: Zugriff nur bei Störung, nur nach Auftrag, mit Eintrag in ein Zugriffsbuch. Zwei-Faktor für Supabase, Vercel, GitHub. | S | gering |
| C | Support-Zugriff nur nach Freigabe durch das Unternehmen (Schalter „Support darf 24 Stunden zugreifen“). | M | gering |

**Empfehlung:** B sofort, C vor dem SaaS-Start, A wenn die Lohnabrechnungen ein Kernmerkmal werden.

---

## D-11 · Benachrichtigungen an alle Führungskräfte (klein)

Die In-App-Benachrichtigung „Neuer Antrag“ geht an **alle** Schichtleitungen und Administratoren, nicht nur an
die zuständigen. **Empfehlung:** auf die Zuständigen begrenzen (dieselbe Regel wie beim Mail-Versand).

---

## 3. Auftragsverarbeiter und Datenstandort

| Dienst | Zweck | Standort | Offene Punkte |
|---|---|---|---|
| **Supabase** | Datenbank, Anmeldung, Dateispeicher, Edge-Funktion für Mails | Region `eu-west-1` (Irland). Anbieter mit US-Mutter. | DPA abgeschlossen? Tarif „Free“ – keine Sicherungen, keine zugesagte Verfügbarkeit. |
| **Vercel** | Auslieferung der Seiten, Server-Funktionen | Funktionen in `dub1` (Dublin). Statische Dateien und der erste Empfang der Anfrage laufen weltweit über das Vercel-Netz; Protokolle beim US-Anbieter. | DPA gilt über die Bedingungen; Tarif prüfen (der kostenlose Tarif ist nur für nicht-kommerzielle Nutzung). |
| **Mail-Dienst (Brevo)** | Benachrichtigungen, Bestätigungs- und Passwort-Mails | Brevo (Sendinblue) ist ein französischer Anbieter, Verarbeitung in der EU. | Im Verzeichnis nachtragen; AV-Vertrag im Brevo-Konto abschließen; Absender-Domain mit SPF/DKIM/DMARC absichern. |
| **GitHub** | verschlüsselte Sicherung (14 Tage) | USA | Sicherung ist defekt. Inhalt ist verschlüsselt – trotzdem Drittland; besser EU-Speicher. |
| **Push-Dienste** (Apple, Google, Mozilla) | Benachrichtigungen aufs Gerät | weltweit | Inhalt ist verschlüsselt; in der Datenschutzerklärung genannt. Texte kurz halten (kein „krank“ in Push-Texten). |
| **Texterkennung (Tesseract)** | Screenshot-Import | läuft **im Browser**, keine Übertragung | – |

Nicht geprüft werden konnte: welche Unterauftragnehmer Brevo und Vercel aktuell einsetzen, und ob die Verträge
unterschrieben vorliegen. Das steht in der Checkliste als Aufgabe für dich.

---

## 4. Protokollierung

| Protokoll | Inhalt | Wer sieht es | Frist |
|---|---|---|---|
| Änderungsprotokoll | wer hat wann was geändert (ohne Gesundheitsinhalte) | Schichtleitung, Administration | 24 Monate |
| Anmeldeprotokoll | An-/Abmeldung, Art des Zugangs, grober Gerätetyp, fehlgeschlagene Anmeldungen | freigeschaltete Person der Administration | 90 Tage |
| Fehlermeldungen | angezeigte Fehler | wie oben | 90 Tage |
| Anmelde-Bremse | Hash von IP und Adresse | niemand (nur Server) | 1 Tag |

**Lücken:** Erzeugen von Zugangslinks und Passwort-Codes (S-01), Support-Zugriffe des Betreibers (D-10),
Lesezugriffe auf Auswertungen (wer hat sich die Kranktage angesehen?). Letzteres ist für den Betriebsrat oft
wichtig – als Variante im Rollenmodell vorgesehen.

---

## 5. Was gut gelöst ist (für die Unterlagen)

- Voreinstellungen schützen: Gründe für Kollegen aus, Krankheit privat.
- Einwilligungen werden mit Zeitpunkt und Fassung gespeichert und lassen sich widerrufen (`privacy_settings`).
- Lohn und Zuschläge bleiben auf dem Gerät.
- Demo-Daten verschwinden nach 24 Stunden; gelöschte Unternehmen liegen 14 Tage im Papierkorb und werden dann endgültig entfernt.
- Bei Austritt endet der Zugang automatisch; eigene Termine gehen mit in den Privatbereich, Betriebsdaten bleiben beim Unternehmen.
- Fassungen von Nutzungsbedingungen, AV-Vertrag und Datenschutzerklärung werden je Unternehmen festgehalten.
