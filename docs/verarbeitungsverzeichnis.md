# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 Abs. 2 DSGVO)

Stand: 22. Oktober 2026 · Betreiber: Tarek Oussama Refai

Dieses Verzeichnis gilt für die Tätigkeit als **Auftragsverarbeiter**: ShiftNexo verarbeitet
Beschäftigtendaten im Auftrag der Betriebe (Verantwortliche). Es muss nicht veröffentlicht
werden, aber auf Verlangen der Aufsichtsbehörde (LDI NRW) vorgelegt werden können.
Bei Änderungen (neuer Dienstleister, neue Datenart) aktualisieren und das Datum anpassen.

## 1. Auftragsverarbeiter

- Tarek Oussama Refai, Herselerstraße 9, 53332 Bornheim
- E-Mail shiftfornexo@gmail.com · Telefon +49 174 3376978
- Datenschutzbeauftragter: nicht benannt (keine Pflicht nach Art. 37 DSGVO / § 38 BDSG)

## 2. Verantwortliche (Kunden)

Jeder Betrieb, der sich registriert und den AVV (`/avv`) bestätigt. Namen, Zeitpunkt der
Bestätigung und Fassung stehen in der Datenbank (Tabelle `companies`, Felder `name`,
`avv_accepted_at`, `avv_version`). Aktuelle Liste für den Nachweis:

```sql
select name, avv_accepted_at, avv_version, terms_accepted_at, is_demo
from public.companies
where coalesce(is_demo, false) = false
order by avv_accepted_at;
```

Die Demo-Firmen (Live-Demo mit Beispieldaten) sind keine Verantwortlichen.

## 3. Kategorien der Verarbeitung im Auftrag

| Tätigkeit | Daten | Betroffene |
|---|---|---|
| Schichtplanung und Besetzung | Name, Personalnummer, Schichtgruppe, Rotationsmuster, Ein- und Austritt, Rolle | Beschäftigte des Kunden |
| Urlaub, Zeitausgleich (V-Tage), Altersfreizeit | Anträge, Zeiträume, Entscheidungen, Konten, Geburtsdatum (für Altersfreizeit) | Beschäftigte |
| Abwesenheiten (Krankheit, Schulung u. a.) | Art und Zeitraum der Abwesenheit, kurze Notiz (höchstens 200 Zeichen), **Gesundheitsdatum Art. 9 DSGVO** (nur „krank“, keine Diagnose) | Beschäftigte |
| Zugang und Anmeldung | E-Mail, Passwort-Hash, Anmeldeprotokoll, Geräteangabe | Beschäftigte mit Zugang |
| Benachrichtigungen | Empfänger, Betreff, Text, Status; Push-Abonnement (nur mit Erlaubnis) | Beschäftigte |
| Änderungsprotokoll | Wer hat wann was geändert (ohne Gesundheitsinhalte) | Beschäftigte |

Nicht Teil dieses Verzeichnisses: das private Kalenderkonto ohne Betrieb (Betreiber ist dort
selbst Verantwortlicher, siehe Datenschutzerklärung 8a) und das Kundenkonto der registrierenden
Person (eigene Verantwortung des Betreibers).

## 4. Unterauftragsverarbeiter und Drittlandübermittlung

| Dienstleister | Zweck | Ort | Garantie |
|---|---|---|---|
| Supabase (Supabase Pte. Ltd. / Inc.) | Datenbank, Anmeldung | Region eu-west-1 (Irland) | DPA mit Standardvertragsklauseln (Modul 2), Transfer-Folgenabschätzung vom 14.03.2025 |
| Vercel, Inc. | Auslieferung, Serverfunktionen | Region dub1 (Dublin) | DPA in den Bedingungen, EU-US Data Privacy Framework |
| GitHub, Inc. | Aufbewahrung der verschlüsselten nächtlichen Sicherung (14 Tage) | USA | DPA in den Bedingungen; Inhalt mit AES-256 verschlüsselt, Schlüssel nur beim Betreiber |
| Mailversand | noch offen | – | nach Klärung ergänzen |
| Push-Dienste der Gerätehersteller | Benachrichtigung, nur mit Erlaubnis der Person | weltweit | Inhalt verschlüsselt |

Supabase setzt eigene Unterauftragnehmer ein (u. a. AWS, Google Cloud, Fly.io, Cloudflare,
Upstash). Aktuelle Liste: supabase.com/legal/customer-resources/subprocessor-list. Dort
„Benachrichtigungen“ abonnieren, damit Änderungen rechtzeitig auffallen.

## 5. Fristen zur Löschung

- Stammdaten, Pläne, Abwesenheiten: solange der Kunde die Anwendung nutzt; Löschung durch den Kunden
- Demo-Bereiche: 24 Stunden · Ratenbegrenzung: 1 Tag · Postausgang: 30 Tage
- Benachrichtigungen: 180 Tage · Kommentare im Plan: 12 Monate nach dem Tag
- Anmeldeprotokoll und Fehlermeldungen: 90 Tage · Änderungsprotokoll: 24 Monate
- Verschlüsselte Sicherungen bei GitHub: 14 Tage
- Nach Vertragsende: Herausgabe oder Löschung nach Wahl des Kunden (AVV § 10)

## 6. Technische und organisatorische Maßnahmen (Art. 32)

- Verschlüsselte Übertragung (HTTPS, HSTS), Sicherheits-Header
- Mandantentrennung und Rollenrechte direkt in der Datenbank (Row Level Security)
- Passwörter nur als Hash; Begrenzung von Anmelde-, Zurücksetzen- und Registrierungsversuchen
- Automatische Abmeldung (Administration 15 Min., Schichtleitung 8 Std., Mitarbeiter 12 Std.)
- Voreinstellungen schützen: Gründe für Kollegen aus, Krankheit privat, keine Gesundheitsfreitexte
- Änderungs- und Anmeldeprotokoll ohne Gesundheitsinhalte
- Nächtliche verschlüsselte Datensicherung (GitHub Actions), Wiederherstellung siehe `datensicherung.md`
- Automatisierte Prüfskripte für Zugriffsregeln und Mandantentrennung
- Sicherheitsvorfälle werden dem Kunden unverzüglich gemeldet (Art. 33/34)
