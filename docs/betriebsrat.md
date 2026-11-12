# ShiftNexo – Unterlage für den Betriebsrat

Stand: 12. November 2026 · Datenschutzerklärung Fassung 2.32

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
| Auswertung (Ausfall, Anwesenheit) – nur Summen ohne Namen, je Schicht erst ab 5 Personen | – | – | ja |
| Anmeldeprotokoll und Fehlermeldungen | – | – | – (im Betrieb nicht einsehbar) |
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
  fehlgeschlagene Anmeldungen, angezeigte Fehlermeldungen. Im Betrieb **für
  niemanden einsehbar** – auch nicht für die Administration. Es dient allein dem
  Betreiber zur Aufklärung von Sicherheitsvorfällen und Störungen. Löschung nach
  90 Tagen.
- **Auswertung**: Ausfall und Anwesenheit nur als **Summen ohne Namen** – je
  Schicht erst ab fünf Personen, sonst nur für den ganzen Betrieb; unter fünf
  Personen im Betrieb gar nicht. Einzelne Personen sind nicht erkennbar.
- Es wird **nicht** protokolliert, welche Seiten jemand aufruft oder worauf
  geklickt wird.
- **Meine Zahlen** (freiwillig, nur für die Person selbst): Jede Person kann
  für sich ansehen, wie viele Sonntage, Feiertage und Nächte sie gearbeitet hat,
  längste Serie, freie Wochenenden und Vergleich mit dem Vorjahr. Die Zahlen
  werden beim Öffnen aus dem eigenen Plan errechnet, **nicht gespeichert** und
  sind für niemanden sonst sichtbar – auch nicht für Schichtleitung oder
  Administration. Es gibt keinen Vergleich zwischen Personen.

**Zur Mitbestimmung (§ 87 Abs. 1 Nr. 6 BetrVG):** Eine Auswertung je Person
gibt es nicht, und das Anmeldeprotokoll kann im Betrieb niemand einsehen. Die
Fehlzeiten-Leiste (früher gegangen / später gekommen) ist seit dem 12.11.2026
**abgeschaltet**: Neue Einträge sind weder in der Anwendung noch in der
Datenbank möglich. Ein einzelner älterer Eintrag aus der Testphase bleibt
bestehen und wird weiter mit dem V-Konto verrechnet.

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
  Die Datenbank wird jede Nacht verschlüsselt gesichert (14 Tage Aufbewahrung);
  eine monatliche Probe prüft, dass sich die Sicherung öffnen lässt.

## 7. Vorschläge für die Betriebsvereinbarung

1. Zweckbindung: Planung und Urlaub – keine Leistungs- oder Verhaltenskontrolle.
2. Anmeldeprotokoll: kein Zugriff im Betrieb; Auswertung nur als Summen ohne Namen.
3. Fehlzeiten-Leiste bleibt abgeschaltet; eine Wiedereinführung nur nach Zustimmung des Betriebsrats.
4. Löschfristen wie oben; keine längere Aufbewahrung ohne Anlass.
5. Information der Beschäftigten über die Datenschutzerklärung (Fassung 2.32).
6. Änderungen an Rollen und Protokollen nur nach Information des Betriebsrats.
