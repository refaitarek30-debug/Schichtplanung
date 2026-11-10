# 11 – Stand der Umsetzung

Hier wird abgehakt, was aus dem Review umgesetzt ist. Neueste oben.

| Fund | Was | Datum | Pull Request | Migration |
|---|---|---|---|---|
| S-04, D-06, D-07, D-11, L-02 | Mails ohne Inhalte; keine Gesundheitsangaben in Freitexten; Glocke nur an Zuständige; Sperre gegen doppelte Anträge | 10.11.2026 | #204 | 0210 |
| S-02, S-03 | Schichtleitung bearbeitet nur Mitarbeiter; direkte Änderung von Anträgen durch die Führung entfällt | 10.11.2026 | #203 | 0209 |
| S-01 (Folge) | Eigener Wiederherstellungs-Code für alle; Freigabe-Code der Verwaltung nur für reine Betriebskonten, mit Protokoll und Benachrichtigung | 10.11.2026 | #203 | 0208 |
| S-01, D-01 | Zugangslink und Passwort-Code nur für Konten ohne eigenes Passwort; Erzeugen wird protokolliert | 10.11.2026 | #203 | 0207 |
| D-10 (teilweise) | Lohnabrechnungen abgeschaltet | 10.11.2026 | #203 | 0206 |

## Offen – als Nächstes

| Fund | Was | Wer |
|---|---|---|
| P-07 | Datensicherung: Ursache gefunden – bei GitHub fehlen die Geheimnisse `SUPABASE_DB_URL` und `BACKUP_PASSWORT` | du (Anleitung `docs/datensicherung.md`) |
| S-05 | Zwei-Faktor für Supabase, Vercel, GitHub, Brevo; Passwortlänge 12 | du (`09-go-live-checkliste.md`, B7/B8) |
| P-08 | Überwachung von außen | du (B6) |
| D-05 | Geburtsdatum nur für die Administration | Code |
| L-03 | „Heute“ in deutscher Zeit | Code |
| L-01, L-04, L-05 | Besetzung bei Genehmigung, eigene Anträge, Verfall Resturlaub | Code, teils Entscheidung |
| D-02, D-04 | Löschfristen, Datenkopie | Code + Entscheidung |
| D-08 | Unterlagen (Verzeichnis, Löschkonzept, Pannen-Ablauf) | Entwurf durch mich, Prüfung extern |
| – | Datenschutzerklärung: Lohnabrechnungen herausnehmen, neue Mails und Codes beschreiben | Code (Rechtstext mit neuer Fassung) |
