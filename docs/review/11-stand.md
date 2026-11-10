# 11 – Stand der Umsetzung

Hier wird abgehakt, was aus dem Review umgesetzt ist. Neueste oben.

| Fund | Was | Datum | Pull Request | Migration |
|---|---|---|---|---|
| L-03, S-07, P-14 | „Heute“ in deutscher Zeit (25 Funktionen + Urlaubskonto-Ansicht); Testfunktion entfernt; eigene Fehlerseite | 10.11.2026 | #206 | 0212 |
| L-01, L-04 | „Trotzdem genehmigen?“ bei Unterbesetzung (Vermerk im Protokoll, ohne Grund); Schalter „Eigene Anträge der Schichtleitung“ (aus = Administration entscheidet) | 10.11.2026 | #207 | 0213 |
| D-08 (teilweise) | Rechtstexte ohne Platzhalter: Datenschutzerklärung 2.28, AV-Vertrag 1.4, Brevo, Kalender-Verantwortung | 10.11.2026 | #205 | 0211 |
| P-07 | Datensicherung läuft wieder (Geheimnisse bei GitHub eingetragen, Testlauf grün) | 10.11.2026 | – | – |
| S-04, D-06, D-07, D-11, L-02 | Mails ohne Inhalte; keine Gesundheitsangaben in Freitexten; Glocke nur an Zuständige; Sperre gegen doppelte Anträge | 10.11.2026 | #204 | 0210 |
| S-02, S-03 | Schichtleitung bearbeitet nur Mitarbeiter; direkte Änderung von Anträgen durch die Führung entfällt | 10.11.2026 | #203 | 0209 |
| S-01 (Folge) | Eigener Wiederherstellungs-Code für alle; Freigabe-Code der Verwaltung nur für reine Betriebskonten, mit Protokoll und Benachrichtigung | 10.11.2026 | #203 | 0208 |
| S-01, D-01 | Zugangslink und Passwort-Code nur für Konten ohne eigenes Passwort; Erzeugen wird protokolliert | 10.11.2026 | #203 | 0207 |
| D-10 (teilweise) | Lohnabrechnungen abgeschaltet | 10.11.2026 | #203 | 0206 |

## Offen – als Nächstes

| Fund | Was | Wer |
|---|---|---|
| P-07 | Probe-Wiederherstellung in einem Testprojekt | du + ich |
| S-05 | Zwei-Faktor für Supabase, Vercel, GitHub, Brevo; Passwortlänge 12 | du (`09-go-live-checkliste.md`, B7/B8) |
| P-08 | Überwachung von außen | du (B6) |
| D-05 | Geburtsdatum nur für die Administration | Code |
| L-05 | Verfall Resturlaub | vom Nutzer verworfen (nicht nötig) |
| D-02, D-04 | Löschfristen, Datenkopie | Code + Entscheidung |
| D-08 | Unterlagen (Verzeichnis, Löschkonzept, Pannen-Ablauf) | Entwurf durch mich, Prüfung extern |
| – | Brevo-AV-Vereinbarung als PDF ablegen (Anhang 3 der Brevo-Nutzungsbedingungen) | du |
