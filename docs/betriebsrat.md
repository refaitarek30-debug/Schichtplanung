# ShiftNexo – Unterlage für den Betriebsrat

Stand: 9. November 2026 · Datenschutzerklärung Fassung 2.27

Diese Unterlage beschreibt, was die Anwendung tatsächlich tut – wer was sieht,
was gespeichert wird und wie lange. Sie ersetzt keine Rechtsberatung und keine
Betriebsvereinbarung; sie ist die Grundlage dafür.

## 1. Zweck

Schichtplanung, Urlaubs- und Abwesenheitsverwaltung, Besetzung je Schicht,
Mitteilungen an die Belegschaft. Keine Zeiterfassung, keine Lohnabrechnung,
keine automatisierten Entscheidungen: Über jeden Antrag entscheidet ein Mensch
(Art. 22 DSGVO findet keine Anwendung).

## 2. Rollen und Rechte

| | Mitarbeiter | Schichtleitung | Administration |
|---|---|---|---|
| Eigenen Plan und Schichtplan ansehen | ja | ja | ja |
| Urlaub beantragen | ja | ja | ja |
| Plan ändern, Krank/Schulung eintragen | – | ja | ja |
| Urlaubsanträge entscheiden | – | ja | ja |
| Urlaubssperren anlegen/entfernen | – | ja | ja |
| Mitteilungen und Hinweise senden | – | ja | ja |
| Änderungsprotokoll (wer hat was geändert) | – | ja | ja |
| Auswertung (Ausfall, Kranktage je Person) | – | – | ja |
| Anmeldeprotokoll und Fehlermeldungen | – | – | nur ausdrücklich freigeschaltete Person |
| Rollen vergeben, Mitarbeiter anlegen/löschen | – | – | ja |

Rollen vergibt ausschließlich die Administration. Die Rechte werden in der
Datenbank durchgesetzt (Row Level Security), nicht nur in der Oberfläche.

## 3. Welche Daten

- Stammdaten: Name, Personalnummer, Abteilung, Schichtgruppe, Eintritt/Austritt,
  freiwillig Geburtsdatum (für Altersfreizeit/Sonderurlaub).
- Planung: Schichten, Schichtwechsel, Urlaub, V-Tage, Altersfreizeit, Schulung.
- Krankheit: nur „krank“ mit Datum – **keine Diagnosen, keine Freitexte**.
  Kolleginnen und Kollegen sehen „krank“ nur, wenn die Person es selbst
  freigibt; sonst steht dort „abwesend“.
- Anmeldung: E-Mail, Passwort nur als Prüfwert (Hash).

## 4. Protokolle (Leistungs- und Verhaltenskontrolle)

- **Änderungsprotokoll**: wer wann was geändert hat (Plan, Anträge, Konten,
  Stammdaten). Sichtbar für Schichtleitung und Administration. Inhalte von
  Kommentaren und Krankmeldungen stehen nicht darin. Löschung nach 24 Monaten.
- **Anmeldeprotokoll**: Anmeldung/Abmeldung mit Zeit und grobem Gerätetyp,
  fehlgeschlagene Anmeldungen, angezeigte Fehlermeldungen. Sichtbar **nur** für
  eine ausdrücklich freigeschaltete Person der Administration. Löschung nach
  90 Tagen.
- Es wird **nicht** protokolliert, welche Seiten jemand aufruft oder worauf
  geklickt wird.

**Zur Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG):** Anmeldeprotokoll,
Auswertung (Kranktage je Person) und die Fehlzeiten-Leiste (früher gegangen /
später gekommen; derzeit Testphase, nur Administration) sind geeignet,
Verhalten oder Leistung zu überwachen. Wir schlagen vor, Zweck, Zugriff und
Auswertungsverbot in einer Betriebsvereinbarung festzulegen.

## 5. Austritt

- Am Tag nach dem letzten Arbeitstag endet der Zugang zum Betrieb automatisch
  (stündliche Prüfung, deutsche Zeit). Im Änderungsprotokoll steht ein Eintrag.
- Die Person landet beim nächsten Anmelden im kostenlosen Privatbereich. Mit
  ihr gehen nur eigene Termine, To-dos und eigene Einträge; Schichten, Krank-
  und Urlaubsanträge bleiben beim Unternehmen. Der Betrieb sieht vom
  Privatbereich nichts. Die Person kann den Privatbereich jederzeit löschen.
- Wird das Austrittsdatum entfernt oder verschoben, ist der Zugang wieder offen.

## 6. Speicherort und Sicherheit

- Datenbank: Supabase, Region eu-west-1 (Irland, EU). Anwendung: Vercel,
  Region Dublin. Verträge zur Auftragsverarbeitung bestehen
  (siehe `docs/verarbeitungsverzeichnis.md`).
- Verschlüsselte Übertragung (HTTPS), Rechte in der Datenbank, automatische
  Abmeldung bei Inaktivität, Ratenbegrenzung gegen Passwort-Durchprobieren.
  Die tägliche Datensicherung nach GitHub schlägt seit dem 29.10.2026 fehl und
  muss vor der Vorlage repariert sein.

## 7. Vorschläge für die Betriebsvereinbarung

1. Zweckbindung: Planung und Urlaub – keine Leistungs- oder Verhaltenskontrolle.
2. Zugriff auf Anmeldeprotokoll und Auswertung: namentlich festgelegte Personen.
3. Fehlzeiten-Leiste: Zweck und Nutzung festlegen oder abschalten.
4. Löschfristen wie oben; keine längere Aufbewahrung ohne Anlass.
5. Information der Beschäftigten über die Datenschutzerklärung (Fassung 2.27).
6. Änderungen an Rollen und Protokollen nur nach Information des Betriebsrats.
