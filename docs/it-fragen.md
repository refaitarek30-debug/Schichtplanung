# Fragen der IT – mit Antworten

Stand: 25.11.2026 · ShiftNexo (shiftnexo.de)

Typische Fragen aus einer Lieferanten- bzw. Sicherheitsprüfung eines Unternehmens.
Jede Antwort beschreibt, was **heute** umgesetzt ist. Was noch fehlt, steht ehrlich dabei
(„Offen“) – mit dem geplanten Weg.

---

## A. Daten und Hosting

**1. Wo werden die Daten gespeichert?**
In der EU: Datenbank und Anmeldung bei Supabase im Rechenzentrum Irland (AWS eu-west-1),
die Web-Anwendung bei Vercel in Dublin. Ein Umzug nach Frankfurt (Supabase eu-central-1,
Vercel fra1) ist vorbereitet und dauert wenige Stunden. Betrieb auf eigenen Servern ist
ebenfalls möglich (Frage 30).

**2. Welche Daten werden verarbeitet?**
Name, dienstliche E-Mail, Personalnummer (optional), Schichtgruppe, Schichtplan,
Urlaubsanträge und -konten, Abwesenheiten (bei Krankheit nur „krank“, **keine Diagnose**),
Geburtsdatum (nur für Altersfreizeit, nur für die Leitung sichtbar), Qualifikationen.
Keine Gesundheitsdaten im Sinne einer Diagnose, keine Lohndaten im Betrieb, keine Standortdaten.

**3. Gehen Daten in Länder außerhalb der EU?**
Gespeichert wird nur in der EU. Supabase und Vercel sind US-Unternehmen; mit beiden bestehen
Verträge zur Auftragsverarbeitung mit EU-Standardvertragsklauseln. Bei eigenem Betrieb
(Frage 30) entfällt das.

**4. Wer kann die Daten sehen?**
- Beschäftigte: den eigenen Plan, Kollegen nur mit deren Einwilligung (getrennt für die eigene
  und andere Schichtgruppen), keine vertraulichen Felder anderer.
- Schichtleitung/Administration: ihren Betrieb, je nach Rolle.
- Betreiber: nur ein Notfallzugang, **nur lesend**, jeder Zugriff wird protokolliert und ist
  für den Betrieb einsehbar.
- Anbieter (Supabase, Vercel): nur im Rahmen der Auftragsverarbeitung (Wartung, Support).

**5. Sind die Daten verschlüsselt?**
- Übertragung: nur HTTPS (TLS 1.2+), HSTS mit zwei Jahren, keine unverschlüsselten Verbindungen.
- Speicherung: Datenträgerverschlüsselung AES-256 beim Anbieter.
- Sicherungen: zusätzlich mit eigenem Schlüssel (AES-256), den der Anbieter nicht kennt.
- Mitteilungen aufs Handy: Ende-zu-Ende verschlüsselt (Web-Push, RFC 8291).
- Geheimnisse (Codes, Links, Geräte-Merkzeichen): nur als Prüfwert (SHA-256) gespeichert.

## B. Zugriff und Anmeldung

**6. Wie melden sich Nutzer an?**
Persönliches Konto mit Passwort (mindestens 10 Zeichen; häufige Passwörter, Zahlenreihen
und der eigene Name werden abgelehnt) und Zwei-Faktor-Anmeldung (TOTP-App).
Zwei-Faktor ist **Pflicht für Administration und Schichtleitung** – die Datenbank selbst gibt
ohne bestätigten Code keine Firmendaten heraus, auch nicht über die Schnittstelle.

**7. Gibt es eine Sperre bei falschen Passwörtern?**
Ja: nach 5 Fehlversuchen (Passwort oder Code) ist das Konto gesperrt, bis die Administration
freischaltet. Zusätzlich Begrenzung der Versuche je IP-Adresse und je Konto.
*Offen:* Wer die Anmelde-Schnittstelle des Anbieters direkt (an der App vorbei) aufruft,
unterliegt dort der Begrenzung des Anbieters, nicht der Sperre der App. Lösung: CAPTCHA-Schutz
und Passwortregeln direkt beim Anmeldedienst einschalten (in Arbeit, siehe Einrichtungsplan).
Konten mit Zwei-Faktor sind davon nicht betroffen – ohne Code keine Daten.

**8. Anmeldung mit dem Firmenkonto (SSO, Microsoft Entra ID)?**
*Offen, umsetzbar:* SAML 2.0 bzw. OpenID Connect über den Anmeldedienst (ab Supabase Pro).
Dann gelten Ihre Passwort-, MFA- und Austrittsregeln automatisch.

**9. Wird man automatisch abgemeldet?**
Ja, nach Inaktivität: Administration 15 Minuten, Schichtleitung 8 Stunden, Mitarbeitende
12 Stunden. Die Prüfung läuft auf dem Server.

**10. Was passiert beim Austritt?**
Mit dem Austrittsdatum wird der Zugang automatisch beendet; Daten werden nach den Fristen
des Löschkonzepts gelöscht. Lange ungenutzte Konten werden der Administration gemeldet.

## C. Trennung der Mandanten und Rechte

**11. Wie ist sichergestellt, dass ein Betrieb nicht die Daten eines anderen sieht?**
Die Trennung liegt **in der Datenbank** (PostgreSQL Row Level Security): Jede Zeile trägt die
Unternehmenskennung, jede Abfrage wird auf das Unternehmen der angemeldeten Person begrenzt –
unabhängig davon, was die Oberfläche tut. Geschäftsregeln (Genehmigen, Tauschen, Urlaubstage)
laufen als geprüfte Datenbankfunktionen.

**12. Wie wird das geprüft?**
Ein automatischer Sicherheitstest (`tests/sicherheit`) greift bei **jeder Änderung** die echte
Datenbankstruktur an: Fünf Angreifer (nicht angemeldet, fremde Firma als Mitarbeiter und als
Administration, Privatkonto, Kollege) versuchen an alle 76 Tabellen und alle aufrufbaren
Funktionen zu kommen – rund 20.000 Aufrufe, mit den Kennungen des Opfers als Argument.
Dazu 15 gezielte Versuche, Rechte auszuweiten (sich selbst zum Admin machen, Firma wechseln,
eigenen Urlaub genehmigen …). Ergebnis: **keine offenen Funde**. Der Test findet nachweislich
absichtlich eingebaute Lücken.

**13. Können Mitarbeitende sich mehr Rechte geben?**
Nein. Rollen vergibt nur die Administration – durchgesetzt per Datenbank-Trigger. Die
Schichtleitung kann nur Personen mit der Rolle „Mitarbeiter“ bearbeiten (Test, Frage 12).

**14. Gibt es eine Leistungs- oder Verhaltenskontrolle?**
Nein. Keine Auswertungen je Person, keine Ranglisten, kein Tracking. Für den Betriebsrat
liegen Unterlagen für eine Betriebsvereinbarung vor (`docs/betriebsrat.md`).

## D. Betrieb, Sicherung, Verfügbarkeit

**15. Wie wird gesichert?**
Jede Nacht eine vollständige Sicherung (Rollen, Aufbau, Daten), verschlüsselt mit eigenem
Schlüssel, 14 Tage aufbewahrt; einmal im Monat automatisch geprüft, ob sie sich öffnen lässt.
Mit Supabase Pro zusätzlich tägliche Sicherung beim Anbieter (7 Tage), auf Wunsch
Wiederherstellung auf die Minute genau.
*Offen:* Die eigene Sicherung liegt verschlüsselt bei GitHub (USA); Umzug zu einem Speicher
in Deutschland geplant.

**16. Wie schnell ist man nach einem Ausfall wieder da? (RPO/RTO)**
Datenverlust höchstens seit der letzten Sicherung (heute bis zu 24 Stunden, mit
Point-in-Time-Recovery Minuten). Wiederherstellung in eine neue Datenbank: wenige Stunden
(Ablauf in `docs/datensicherung.md`, `docs/notfallplan.md`).

**17. Gibt es eine zugesagte Verfügbarkeit (SLA)?**
*Offen:* Im kostenlosen Tarif nicht. Mit den bezahlten Tarifen bzw. per Vertrag vereinbar.
Der Plan bleibt auf dem Handy offline lesbar, auch wenn der Dienst kurz nicht erreichbar ist.

**18. Was wird protokolliert?**
Änderungen am Plan, an Anträgen, Konten und Rollen (wer, was, wann), Anmeldungen und
Fehlversuche, jeder Zugriff des Betreibers. Protokolle haben feste Löschfristen.
*Offen:* Automatische Alarmierung bei auffälligem Verhalten (z. B. sehr viele Abfragen).

**19. Wie wird mit Sicherheitsvorfällen umgegangen?**
Ablauf für Datenpannen mit Meldung innerhalb von 72 Stunden (`docs/datenpanne.md`),
Notfallplan für Ausfall des Betreibers (`docs/notfallplan.md`).

## E. Entwicklung und Schwachstellen

**20. Wie wird entwickelt?**
Quellcode versioniert in GitHub; jede Änderung läuft vor der Veröffentlichung durch:
Typprüfung, Lint, Build, rund 400 Browser-Tests und den Sicherheitstest (Frage 12).
Datenbankänderungen nur über versionierte Migrationen.

**21. Wie werden Schwachstellen in Bibliotheken behandelt?**
Automatische Prüfung (`npm audit`): derzeit **0 bekannte Schwachstellen**. Wöchentliche
Update-Vorschläge (Dependabot), die erst nach allen Tests übernommen werden.

**22. Sicherheits-Header und Browser-Schutz?**
Content-Security-Policy: Skripte nur von der eigenen Adresse, Verbindungen nur zur eigenen
Adresse und zur Datenbank (Daten können also nicht an fremde Server abfließen),
`frame-ancestors 'none'` gegen Einbetten; dazu HSTS, `X-Content-Type-Options: nosniff`,
strikte Referrer-Policy, Permissions-Policy. Cookies `Secure` und `SameSite=Lax`; das
Merkzeichen für vertraute Geräte zusätzlich `HttpOnly`.
*Offen:* Die Richtlinie erlaubt noch eingebettete Skripte (`'unsafe-inline'`, von Next.js
benötigt); Umstellung auf Einmal-Schlüssel (Nonces) ist geplant.

**23. Gab es einen Penetrationstest?**
*Offen:* Noch kein externer. Ein Test durch Ihre IT oder einen beauftragten Dienstleister an
einer Testumgebung mit erfundenen Daten ist ausdrücklich willkommen.

**24. Was, wenn der Entwickler ausfällt?**
Standardtechnik (Next.js, PostgreSQL), vollständig dokumentiert, Code und Datenbankaufbau
reproduzierbar im Repository. Notfallplan mit hinterlegten Zugängen für eine Vertretung.

## F. Datenschutz

**25. Welche Unterlagen gibt es?**
Vertrag zur Auftragsverarbeitung (Muster), TOM nach Art. 32, Datenschutz-Folgenabschätzung,
Verarbeitungsverzeichnis, Berechtigungskonzept, Löschkonzept, Datensicherungskonzept,
Vorgehen bei Datenpannen, Notfallplan, Unterlagen für den Betriebsrat.

**26. Werden Daten für andere Zwecke genutzt?**
Nein. Keine Werbung, kein Tracking, keine Weitergabe, keine KI-Auswertung von Daten.

**27. Können Betroffene ihre Daten bekommen bzw. löschen lassen?**
Ja: „Meine Daten“ lädt alle eigenen Daten herunter; Löschung nach Löschkonzept.

**28. Wie lange werden Daten aufbewahrt?**
Feste Fristen je Datenart, automatische Löschung per Zeitplan (`docs/loeschkonzept.md`).

## G. Einbindung

**29. Anbindung an Microsoft 365 / SharePoint / Teams?**
Kalender in Outlook per Abo-Link: vorhanden. SSO, Export nach SharePoint und Meldungen
in Teams über Microsoft Graph: umsetzbar (je wenige Tage).

**30. Kann die Anwendung auf eigenen Servern laufen?**
Ja. Supabase ist Open Source (Docker), die Anwendung ein Node.js-Container. Benötigt:
Linux-VM (Richtwert 4 vCPU, 8–16 GB RAM), Reverse-Proxy mit TLS, SMTP-Relay; für
Mitteilungen aufs Handy ausgehend HTTPS zu Apple/Google.

**31. Gibt es eine Schnittstelle zu anderen Systemen (z. B. SAP, Shiftconnector)?**
Die Datenbank bietet eine REST-Schnittstelle, die dieselben Rechte erzwingt wie die App.
Anbindungen an SAP oder Shiftconnector sind möglich, sobald deren Schnittstelle vorliegt.

**32. Wie kommen wir wieder heraus (Exit)?**
Vollständiger Export der Datenbank (Standard-PostgreSQL) jederzeit möglich.
