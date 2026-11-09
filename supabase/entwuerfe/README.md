# Entwürfe

SQL-Dateien, die **noch nicht angewendet** sind und nicht freigegeben wurden.
Sie liegen bewusst nicht in `supabase/migrations/`, damit ein späteres
Datenbank-Update sie nicht versehentlich ausführt.

Freigegeben wird eine Datei erst nach Probelauf und Zustimmung: dann wird sie
in `supabase/migrations/` verschoben und angewendet.

| Datei | Inhalt |
|---|---|
| `rollen_zusatzrechte.sql` (Nummer bekommt sie erst beim Anwenden) | Zusatzrollen (z. B. Tagschichtmeister) mit drei Rechten, „Entscheidung ändern“, „aktiv“ nur noch mit Recht |
