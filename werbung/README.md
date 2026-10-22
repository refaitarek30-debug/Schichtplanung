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
| 01 | „Welche Schicht hab ich nächsten Samstag?" (ohne Stimme) | fertig |
| 02 | „Ein ganzes Jahr Schichten in 10 Sekunden" (Schichtfolge) | fertig, mit Stimme |
| 03 | „Wann hast du frei?" (Partner sieht die Schichten) | fertig, mit Stimme |
| 04 | „Wie viele Nachtschichten hattest du dieses Jahr?" (Zählen) | fertig, mit Stimme |
| 05 | „Urlaub eintragen? So geht's am schnellsten" (Pinsel) | fertig, mit Stimme |
| 06 | „Schichtarbeiter, hört auf mit Zetteln!" (Samstag antippen) | fertig, mit Stimme |

## Folgen mit Stimme (02–06)

Jede Folge ist eine Datei `NN-name/folge.mjs`: Aufhänger oben, Sätze mit Aktion.
Die Stimme kommt offline aus Piper (Stimme „Thorsten“, de_DE). Die Aufnahme bedient
die App im Takt der Sätze, der Schnitt legt Stimme, Untertitel und am Ende „ShiftNexo“ darüber.

```
PIPER=…/piper STIMME=…/de_DE-thorsten-high.onnx PLAYWRIGHT_PATH=… \
  node werbung/werkzeug/aufnehmen.mjs werbung/02-schichtfolge ./roh
node werbung/werkzeug/bauen.mjs werbung/02-schichtfolge ./roh werbung/02-schichtfolge/video.mp4
```

Beispieldaten passend starten: 02 mit `LEER=1` (leerer Kalender), 03 mit `PARTNER=1` (Lea verbunden).
Die App läuft dafür als Produktions-Build auf Port 3123 gegen den Beispieldaten-Server.
