# Datensicherung

Der kostenlose Supabase-Tarif macht keine automatische Sicherung. Deshalb sichert
`.github/workflows/datensicherung.yml` jede Nacht die ganze Datenbank:
Rollen, Aufbau (Schema) und Daten. Die Datei wird verschlüsselt und 14 Tage
unter GitHub → Actions → „Datensicherung“ aufbewahrt.

## Einmal einrichten

Unter GitHub → Repository → Settings → Secrets and variables → Actions zwei
„Repository secrets“ anlegen:

| Name | Inhalt |
|------|--------|
| `SUPABASE_DB_URL` | Supabase → Projekt → „Connect“ → **Session pooler** → die URI, mit eingesetztem Datenbank-Passwort |
| `BACKUP_PASSWORT` | ein eigenes, langes Passwort nur für die Sicherungen – gut aufbewahren, ohne es lässt sich nichts wiederherstellen |

Das Datenbank-Passwort steht unter Supabase → Project Settings → Database. Wer es
nicht mehr weiß, setzt es dort neu; die App selbst nutzt es nicht.

Danach unter Actions → „Datensicherung“ → „Run workflow“ einmal von Hand
starten und prüfen, dass der Lauf grün wird.

## Prüfen, ob die Sicherung taugt (ein Klick)

Eine Sicherung, die sich nicht öffnen lässt, ist keine. Deshalb gibt es die Probe
`.github/workflows/sicherung-pruefen.yml`:

1. GitHub → Repository → **Actions** → links **„Sicherung prüfen“**.
2. Rechts **„Run workflow“** → grüner Knopf **„Run workflow“**.
3. Nach etwa einer Minute ist der Lauf **grün** (alles gut) oder **rot** (etwas stimmt nicht).

Die Probe holt die neueste Sicherung, entschlüsselt sie mit `BACKUP_PASSWORT` und zählt
die Zeilen je Tabelle. Im Protokoll stehen nur Tabellennamen und Anzahlen, keine Inhalte.
Sie läuft außerdem von selbst am 1. jedes Monats. Wird sie rot, schickt GitHub eine Mail.

Rot heißt meistens: `BACKUP_PASSWORT` wurde geändert (alte Sicherungen lassen sich dann
nicht mehr öffnen) oder die nächtliche Sicherung ist ausgefallen.

Die Probe spielt nichts in eine Datenbank ein. Das vollständige Einspielen steht unten
und sollte einmal im Jahr in ein leeres Supabase-Testprojekt geübt werden.

## Wiederherstellen

1. Artefakt herunterladen und entpacken.
2. Entschlüsseln: `gpg -d shiftnexo-JJJJ-MM-TT.tar.gz.gpg > sicherung.tar.gz && tar -xzf sicherung.tar.gz`
3. In eine (neue) Datenbank einspielen:
   ```
   psql --single-transaction -v ON_ERROR_STOP=1 \
     --file sicherung/rollen.sql --file sicherung/schema.sql \
     --command 'SET session_replication_role = replica' --file sicherung/daten.sql \
     --dbname "<verbindungs-uri>"
   ```
   (Vorgehen nach der Supabase-Anleitung „Backup and restore using the CLI“.)
