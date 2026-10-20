# Betrieb-Demo (Querformat, ca. 28 s)

Für die Betriebsseite, LinkedIn oder zum Zeigen am Laptop. Aufgenommen in der Live-Demo auf shiftnexo.de (nur Beispieldaten).

| Szene | Bild | Text |
|-------|------|------|
| 1 | Dashboard, Maus über „Offene Anträge“ und „Kritische Tage“ | Alles auf einen Blick: Anträge, kritische Tage, Krankenstand. |
| 2 | Schichtplan, Gruppe A aufklappen | Der Schichtplan für alle Gruppen. |
| 3 | Zelle anklicken, Auswahl Früh/Spät/Nacht | Schicht ändern mit einem Klick. |
| 4 | Urlaubsanträge mit Warnung „Mindestbesetzung gefährdet“ | Jeder Antrag wird gegen die Mindestbesetzung geprüft. |
| 5 | Besetzung je Schicht | Besetzung je Schicht: zugeordnet, Soll, Mindest. |
| Ende | Endkarte | Der Schichtplan für euren Betrieb. Kostenlos testen. · Pilot starten · shiftnexo.de/betriebe |

Aufnahme: `PLAYWRIGHT_PATH=… STATE=<demo-anmeldung.json> OUT=./roh node aufnahme.mjs`
Schnitt: `node bauen.mjs ./roh ./video.mp4`
