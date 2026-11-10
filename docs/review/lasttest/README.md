# Lasttest-Skripte (Entwurf, nicht ausgeführt)

**Diese Skripte dürfen nicht gegen die Live-Datenbank laufen.** Sie wurden im Review nur angelegt, nicht gestartet
und nicht getestet. Vor dem ersten Lauf bitte durchlesen.

## Wozu

Die Hochrechnung in `../04-performance-robustheit.md` (ein Mandant mit 2.000 Mitarbeitern) soll durch eine echte
Messung ersetzt werden.

## Ablauf

1. **Eigenes Supabase-Projekt anlegen** (z. B. „shiftnexo-lasttest“, Region wie die Live-Datenbank, gleiche
   Instanzgröße wie später in Produktion). Kein Live-Schlüssel, keine echten Daten.
2. Alle Migrationen aus `supabase/migrations/` einspielen (`supabase db push` gegen das Testprojekt).
3. `seed-testmandant.sql` im SQL-Editor des **Testprojekts** ausführen. Das Skript bricht ab, wenn es echte
   Unternehmen findet.
4. `messung.sql` mit `psql` (Kommandozeile, Verbindungsadresse des **Testprojekts**) ausführen und die Zeiten
   notieren (Zeile „Execution Time“). Im SQL-Editor des Dashboards läuft dieses Skript nicht.
5. Optional `k6-lesen.js` für gleichzeitige Zugriffe: braucht die Adresse des **Testprojekts**, dessen
   öffentlichen Schlüssel und ein Testkonto aus Schritt 3.
6. Optional `lighthouse.sh` gegen eine **Vorschau-Adresse** von Vercel, die auf das Testprojekt zeigt.
7. Testprojekt danach löschen.

## Zielwerte (Vorschlag)

| Aufruf | Ziel bei 2.000 Mitarbeitern |
|---|---|
| Schichtplan einer Gruppe, 5 Wochen | unter 500 ms |
| Besetzung eines Monats | unter 1 s |
| Urlaubskonten des Teams | unter 1 s |
| Auswertung eines Jahres | unter 3 s oder als Hintergrundauftrag |
| Takt (`aenderungsstand`) | unter 30 ms |
| 95 % aller Aufrufe unter 300 gleichzeitigen Nutzern | unter 800 ms |

## Sicherungen im Skript

- Abbruch, wenn es ein Unternehmen gibt, das nicht „LASTTEST …“ heißt und keine Demo ist.
- Abbruch, wenn die Bestätigung `set lasttest.bestaetigt = 'ja'` fehlt.
- Alle erzeugten Namen sind erfunden („Test 0001 Person“).
