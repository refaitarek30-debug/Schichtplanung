# Berechtigungskonzept ShiftNexo

Stand: 13.11.2026 · wer darf was sehen und ändern

## Grundsatz
Jede Person sieht nur, was sie für ihre Aufgabe braucht. Die Regeln setzt die Datenbank selbst durch (Zugriffsregeln je Zeile) – nicht nur die Oberfläche. Jeder Betrieb ist vollständig vom anderen getrennt.

## Rollen im Betrieb

| | Mitarbeiter | Schichtleitung | Administration |
|---|---|---|---|
| Eigener Plan, eigener Urlaub, eigenes Konto | sehen, Anträge stellen | wie Mitarbeiter | wie Mitarbeiter |
| Schichtplan des Betriebs | sehen | sehen, bearbeiten | sehen, bearbeiten |
| Urlaubsanträge anderer | nein | sehen und entscheiden für die eigene Gruppe | alle |
| Eigener Urlaubsantrag entscheiden | nein | nur wenn der Betrieb es erlaubt (Schalter), sonst Administration | ja |
| Stammdaten von Beschäftigten | nein | nur von Mitarbeitern bearbeiten, nicht von Leitung oder Administration | alle |
| Geburtsdatum (für Altersfreizeit) | nur das eigene | sehen | sehen |
| Grund einer Abwesenheit | nur der eigene | je nach Einstellung des Betriebs | sehen |
| Änderungsprotokoll | nein | sehen | sehen |
| Anmeldeprotokoll, Fehlermeldungen | nein | nein | nein (nur Betreiber bei Vorfällen) |
| Auswertung Ausfall/Anwesenheit | nein | nein | nur Summen ohne Namen |
| Zugänge vergeben, Passwort-Code erzeugen | nein | für Mitarbeiter (wird protokolliert) | ja (wird protokolliert) |
| Regeln und Einstellungen des Betriebs | nein | nein | ja |
| Gesperrten Zugang freischalten, Zwei-Faktor zurücksetzen | nein | nein | ja (wird protokolliert) |
| Lesen, ob ein Hinweis gelesen wurde | nein | nein | nein |

## Anmeldung
- Zwei-Faktor-Anmeldung ist Pflicht für Schichtleitung und Administration, freiwillig für Mitarbeiter. Die Datenbank gibt ohne bestätigten Code keine Firmendaten heraus.
- Nach fünf falschen Passwörtern oder Codes ist der Zugang gesperrt, bis die Administration freischaltet.

## Was niemand kann
- Gesundheitsangaben speichern: Freitextfelder lehnen sie ab.
- Passwörter anderer sehen. Ein Passwort-Code gilt 24 Stunden; die Person wird benachrichtigt, und der Vorgang steht im Protokoll.
- Ein Konto übernehmen, das die Person bereits selbst eingerichtet hat.
- Leistung oder Verhalten auswerten: Es gibt keine Auswertung je Person über Arbeitsgeschwindigkeit, Anmeldezeiten oder Ähnliches.

## Privatbereich
Der private Kalender einer Person gehört nur ihr. Der Betrieb – auch die Administration – sieht davon nichts. Geteilt wird nur, was die Person selbst mit Partner, Familie oder Freunden teilt.

## Betreiber
Der Betreiber von ShiftNexo hat technischen Zugriff für Betrieb, Sicherung und Fehlersuche (AV-Vertrag). Zugriffe erfolgen nur dafür und nur auf Weisung. Die Betreiber-Seite zeigt nur Zählwerte je Firma und verlangt die Zwei-Faktor-Anmeldung. Ein Notfallzugang darf nur lesen; jede Öffnung wird festgehalten (`docs/notfallplan.md`).

**Betreiber-Konsole (ab 0223):** eigener Bereich unter `/plattform`, getrennt von Betrieb und Privat. Ein reines Betreiber-Konto (ohne eigenen Betrieb) landet nach der Anmeldung direkt dort. Weitere Personen nimmt nur jemand mit vollem Zugriff ins Team auf – mit dem Recht „voller Zugriff“ oder „nur lesen“. Es bleibt immer mindestens eine Person mit vollem Zugriff, und niemand ändert das eigene Recht. Jede Aktion aus der Konsole (Aufnehmen, Entfernen, Rechte, Entsperren, Zwei-Faktor zurücksetzen, Passwort-Code, Löschen) steht im Betreiber-Protokoll mit Zeitpunkt und ausführender Person – ohne Inhalte und ohne betroffene Personen.

## Kontrolle
- Jede Änderung an Plan, Anträgen, Zugängen und Regeln steht im Änderungsprotokoll (24 Monate).
- Rechte werden bei Rollenwechsel oder Austritt sofort wirksam; ab dem Tag nach dem Austritt gibt es keinen Zugang mehr.
- Dieses Konzept wird bei jeder Änderung an Rollen geprüft.
