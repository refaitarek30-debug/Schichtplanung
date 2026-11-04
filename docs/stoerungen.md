# Störungen finden und festhalten

Wenn jemand meldet „bei mir kam ein technischer Fehler“, steht fast immer schon
etwas im Protokoll. Diese Seite sagt, wo, und was man danach tut.

## 1. Zuerst fragen

- **Wer** (Name) und **wann** (Uhrzeit, Tag)?
- **Auf welcher Seite**, mit welchem Gerät?
- Der genaue Text der Meldung, am besten als Bild.

**Zeitzone beachten:** Das Protokoll in der App zeigt die Uhrzeit des
**Geräts**, auf dem man es öffnet – wer im Ausland nachsieht, sieht andere
Uhrzeiten als die Kollegen im Werk. Die Datenbank rechnet in UTC, im Winter
also eine Stunde früher als in Deutschland (6:41 Uhr in Deutschland = 5:41 UTC),
im Sommer zwei Stunden früher. Immer erst auf deutsche Zeit umrechnen.

## 2. Das Protokoll der App (zuerst hier schauen)

**Automatische Einträge:** Manche Zeilen entstehen, ohne dass jemand etwas
ändert – etwa „hat das Konto 2027 geändert: V-Tage Vorjahr 0,7 → 0“ kurz nach
dem Öffnen der Urlaubsseite. Die App rechnet den Übertrag ins nächste Jahr neu,
solange das Vorjahr läuft, und schreibt dabei die Person ein, die gerade die Seite
geöffnet hat. Die Person hat nichts eingegeben (Beispiel 4.11.2026).

Die App schreibt Fehler selbst mit: Menü → Protokoll (nur Administration),
Kategorie **Fehler**. Dort steht Person, Uhrzeit, Seite und der Text.

| Eintrag | Bedeutung |
|---|---|
| `fehler.anzeige` | Die Person hat eine rote Fehlermeldung gesehen (z. B. „Urlaubssperre“). Meist eine Regel, kein Defekt. |
| `fehler.absturz` | Ein technischer Fehler im Browser, den sonst niemand mitbekommt. |

Dieselben Einträge in der Datenbank:

```sql
select (created_at at time zone 'Europe/Berlin') as zeit, actor_id, action, payload
from audit_logs
where action like 'fehler.%' and created_at >= now() - interval '7 days'
order by created_at desc;
```

## 3. Häufige Texte und was sie heißen

| Text | Ursache | Was tun |
|---|---|---|
| `An unexpected response was received from the server.` | Der Server hat auf eine Aktion mit etwas Unlesbarem geantwortet (Fehlerseite der Plattform, Zeitüberschreitung, kurzer Netzaussetzer). **Direkt nach der Anmeldung** lädt die App die Seite deshalb einmal selbst neu und schreibt „Seite einmal automatisch neu geladen“ ins Protokoll. | Einzeln auftretend: nichts. Taucht es bei derselben Person oder auf derselben Seite mehrfach auf: Vercel-Protokolle (Punkt 5) prüfen. |
| `Anmeldung: Der Server antwortete nicht lesbar …` | Beim Anmelden kam keine lesbare Antwort. Die App hat die Zielseite direkt geladen (die Anmeldung wird nie doppelt abgeschickt). | Wie oben. Steht die Person danach angemeldet da, ist alles gut. |
| `Failed to find Server Action …` | Die Seite war noch offen, als eine neue Version live ging. | Seite neu laden. Kein Fehler im Code. |
| `Script error.`, `ResizeObserver loop …`, `AbortError` | Browser-Eigenheiten. Werden schon nicht mitgeschrieben. | – |

## 4. Supabase (Datenbank, Anmeldung)

Supabase → Projekt → **Logs**. Dort nach Zeit (UTC!) filtern:

- **Auth**: Anmeldungen, abgelaufene Sitzungen.
- **Postgres**: Fehler in Funktionen (`ERROR`).
- **API Edge**: Anfragen mit Status 4xx/5xx.

Die Meldung `Warp server error: Thread killed by timeout manager` in den
PostgREST-Logs ist harmlos (eine Verbindung wurde geschlossen).

## 5. Vercel (Server der App)

Vercel → Projekt → **Logs** oder **Runtime Logs**.

**Wichtig:** Im aktuellen Tarif (Hobby) bleiben diese Protokolle **nur eine
Stunde** erhalten. Eine Störung von heute Morgen ist am Nachmittag dort schon
weg. Deshalb zuerst das Protokoll der App (Punkt 2) und die Supabase-Logs
(bis 24 Stunden) lesen. Wer es genauer braucht, stellt auf Pro um (1 Tag) oder
richtet einen Log-Drain ein.

## 6. Eine Störung festhalten

Bei jeder Störung, die mehr als einmal vorkam oder jemanden aufgehalten hat,
kurz notieren (z. B. in einer Notiz oder einem GitHub-Issue):

1. Wann (mit Zeitzone), wer, welche Seite, welches Gerät.
2. Was der Eintrag im App-Protokoll sagt.
3. Ob es ein Einzelfall war oder wieder auftrat.
4. Was getan wurde und ob danach alles lief.

Vorfälle, die **personenbezogene Daten** betreffen (falsche Person sieht Daten,
Zugang für Fremde), werden dem Kunden unverzüglich gemeldet (siehe
`docs/verarbeitungsverzeichnis.md`, Art. 33/34 DSGVO). Die Meldefrist an die
Aufsichtsbehörde beträgt 72 Stunden – im Zweifel früh rechtlichen Rat holen.

## Beispiel: 2.11.2026, 4:41 Uhr (deutsche Zeit)

Matthias Lipfert (Schichtleitung, Windows/Edge) meldete sich an und bekam
sechs Sekunden später `An unexpected response was received from the server.`
auf der Startseite. Einzelfall in 14 Tagen, keine neue Version zu dem
Zeitpunkt live, keine Fehler in den Datenbank-Protokollen; die App arbeitete
sofort weiter. Wahrscheinlich ein kurzer Aussetzer der Verbindung. Daraufhin
eingebaut: einmaliges automatisches Neuladen direkt nach der Anmeldung und
ein Eintrag im Protokoll.
