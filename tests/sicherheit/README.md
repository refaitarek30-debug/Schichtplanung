# Sicherheitstest

Greift die **echte Datenbankstruktur** an – ohne echte Daten – und schlägt fehl,
sobald ein Angreifer an fremde Daten kommt oder sie ändern kann.

## Was geprüft wird

Firma A und die Privatperson P bekommen in **jeder** Tabelle Zeilen mit der Markierung
„KANARIE“ in allen Textfeldern. Vertrauliche Felder eines Kollegen (Krankheitsnotiz,
Geburtsdatum, Telefon, private Termine, Mitteilungen …) tragen „GEHEIM“.

Fünf Angreifer probieren **jede Tabelle** (lesen, ändern, löschen, fremde Zeile anlegen)
und **jede Funktion**, die sie aufrufen dürfen – mit den IDs aus Firma A als Argumenten
und mit ihren eigenen IDs:

| Angreifer | Darf nicht |
|---|---|
| nicht angemeldet | irgendetwas sehen oder ändern |
| Mitarbeiter fremde Firma | Daten von Firma A oder P sehen/ändern |
| Administration fremde Firma | dito |
| reines Privatkonto | dito |
| Kollege in Firma A | vertrauliche Felder („GEHEIM“) sehen, fremde Daten ändern |

Dazu gezielte Versuche, Rechte auszuweiten (sich selbst zum Admin machen, Firma
wechseln, eigenen Urlaub genehmigen, als Schichtleitung Admin-Daten ändern …).

Dazu je 10 Versuche, ein **fremdes Konto zu übernehmen** (`kontouebernahme.sql`) – von der
Betriebsseite (Passwort-Codes raten, Codes für fremde/höhere Konten erzeugen, Zwei-Faktor
zurücksetzen oder überspringen, Beitritts-Codes raten, Konto umhängen) und von der Privatseite
(Partner-, Abo-, Verbindungs- und Gruppen-Links raten, Wiederherstellungs-E-Mail/-Code,
Lohnzettel, fremde Termine).

Der Test prüft sich selbst: Eingebaute Lücken (offene Funktion, zu weite Regel,
fremdes Löschen) findet er sofort.

## Ausführen

```bash
# Postgres 16/17 erreichbar, z. B. PGHOST=localhost PGUSER=postgres
tests/sicherheit/pruefen.sh
```

Läuft automatisch bei jeder Änderung (GitHub Actions → Tests → „sicherheit“).

## Dateien

- `supabase-ersatz.sql` – Nachbildung von auth, storage, cron, net, vault und den Rollen
- `schema-stand.sql` – Aufbau der Live-Datenbank (nur Struktur), Stand siehe Kopfzeile
- `aufbau.sh` – baut die Prüf-Datenbank: Ersatz + Stand + alle neueren Migrationen
- `angriff.sql` – Testdaten und Angriffe auf Tabellen/Funktionen
- `kontouebernahme.sql` – Versuche, fremde Konten zu übernehmen
- `erlaubt.txt` – begründete Ausnahmen (derzeit keine)
- `stand-auslesen.sql` – erzeugt `schema-stand.sql` neu (nur lesend, im Supabase-SQL-Editor)

## Stand neu auslesen

Nach dem Einspielen neuer Migrationen: `stand-auslesen.sql` im SQL-Editor ausführen,
das Ergebnis als `schema-stand.sql` speichern (Kopfzeile mit der letzten Migration
anpassen) und den öffentlichen Anon-Schlüssel durch `OEFFENTLICHER_ANON_SCHLUESSEL`
ersetzen.
