# Werbung für TikTok (Privat)

Kurze Hochformat-Videos (1080x1920), die zeigen, wie ShiftNexo ein Schichtproblem löst.
Die App wird mit Beispieldaten aufgenommen, nie mit echten Konten oder echten Personen.

## So entsteht ein Video

1. Beispieldaten-Server starten: `node werbung/beispieldaten-server.mjs` (Port 5457, Max Muster mit Beispiel-Schichtfolge).
2. App gegen diesen Server bauen und starten:
   `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5457 NEXT_PUBLIC_SUPABASE_ANON_KEY=testkey npm run build && npx next start -p 3123`
   (Produktions-Build, damit kein Entwicklungs-Knopf im Bild steht.)
3. Aufnehmen: `BASE=http://localhost:3123 OUT=./roh node werbung/NN-name/aufnahme.mjs`
4. Schneiden und Text einblenden: `node werbung/NN-name/bauen.mjs ./roh werbung/NN-name/video.mp4`

Benötigt: Node, Playwright (Chromium) und ffmpeg. Die Videodateien selbst liegen nicht im Repository.

## Regeln

- Nur Beispieldaten, keine echten Namen, keine Firmennamen.
- Nur zeigen, was die App heute kann.
- Ohne Musik exportieren; den Ton legt man in TikTok selbst darunter.
- Bezahlte Werbung erst mit Gewerbe und vollständigem Impressum.

## Folgen

| Nr | Problem | Stand |
|----|---------|-------|
| 01 | „Welche Schicht hab ich nächsten Samstag?" | fertig (Version 2, mit Wischen, Tippen, Untertiteln) |
| 02 | Schicht getauscht und vergessen (eigener Eintrag) | offen |
| 03 | Partner weiß nie, wann ich Spät habe (Teilen) | offen |
| 04 | Stunden und Überstunden im Blick (Auswertung) | offen |
| 05 | Urlaub planen ohne Überschneidung | offen |
