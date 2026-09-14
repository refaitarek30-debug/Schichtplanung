# E-Mail-Vorlagen für Supabase Auth

Diese Texte gehören in Supabase unter **Authentication → Emails**. Sie
ersetzen die englischen Standardvorlagen.

## Wichtig vorweg: Einladungen hängen nicht mehr am Mailversand

Der eingebaute Postversand von Supabase ist ausdrücklich nur zum
Ausprobieren gedacht: wenige Mails pro Stunde, und je nach Projekt gehen sie
ausschließlich an Adressen, die im Supabase-Projekt als Teammitglied
eingetragen sind. Genau daran sind die Einladungen an Kollegen gescheitert –
in den Auth-Protokollen tauchte gar kein Versand auf.

Seit 0.25.0 erzeugt die Anwendung deshalb bei jeder Einladung **zusätzlich
einen Link**, der ohne Mail funktioniert. Er erscheint direkt über der
Mitarbeiterliste, lässt sich mit einem Klick kopieren und über den gewohnten
Weg weitergeben. Der eigene SMTP-Versand unten bleibt der bequemere Weg,
aber er ist keine Voraussetzung mehr dafür, dass jemand einen Zugang bekommt.

## Vorher einschalten

1. **Authentication → Sign In / Providers → Email:**
   „Confirm email" **einschalten**. Ohne diese Bestätigung kann sich jemand
   mit der E-Mail-Adresse eines Kollegen anmelden – und weil die Zuordnung
   zu Firma und Rolle seit Migration 0028 über genau diese Adresse läuft,
   hängt die ganze Absicherung daran.

2. **Authentication → Emails → SMTP Settings:**
   Eigenen Versand hinterlegen. Der eingebaute Versand von Supabase ist auf
   wenige Mails pro Stunde begrenzt und nur zum Ausprobieren gedacht – bei
   einer Firma mit 80 Einladungen reicht das nicht.
   Absender: eine Adresse auf der eigenen Domain, nicht gmail.

3. **Authentication → URL Configuration:**
   Site URL auf die Live-Adresse setzen, sonst zeigen die Links in den
   Mails auf localhost. Unter „Redirect URLs" zusätzlich
   `https://<deine-adresse>/auth/callback` und
   `https://<deine-adresse>/auth/weiter` eintragen – ohne diese beiden
   Einträge landet ein Klick in der Mail auf der Startseite statt beim
   Passwort-Setzen. (Der kopierbare Link aus der Anwendung funktioniert
   auch ohne diesen Eintrag, weil er direkt auf die eigene Adresse zeigt.)

4. **Authentication → Policies:**
   „Leaked password protection" einschalten (Abgleich mit bekannten
   Datenlecks).

## Benachrichtigungen aus der Anwendung (nicht Supabase Auth)

Die Vorlagen weiter unten gelten nur für **Auth-Mails** – Bestätigung,
Einladung, Passwort. Fachliche Nachrichten wie „neuer Urlaubsantrag"
verschickt Supabase Auth nicht; die stellt die Anwendung selbst zu.

Der Weg dorthin:

1. Jemand beantragt Urlaub.
2. Ein Trigger schreibt für die zuständige Schichtleitung und die
   Administration je eine Zeile in die Tabelle `email_outbox`. Das passiert
   in derselben Transaktion – die Nachricht kann also nicht verloren gehen,
   wenn gerade kein Mailserver erreichbar ist.
3. Die Edge Function `mail-versand` holt offene Zeilen ab und verschickt
   sie per SMTP.

**Wer die Mail bekommt:** die Schichtleitung der eigenen Rotationsgruppe
plus die Administration – nicht alle Schichtleiter. Bei vier Schichten
bekämen sonst acht Personen jeden Antrag, und nach einer Woche liest das
niemand mehr. Die Glocke in der Anwendung geht weiterhin an die gesamte
Führung.

**Abschaltbar** unter Einstellungen → Benachrichtigungen (firmenweit, nur
Administration). Die Glocke bleibt davon unberührt.

### Einrichten

1. **Supabase → Edge Functions → Secrets** – diese fünf setzen:

   | Name | Beispiel |
   |---|---|
   | `SMTP_HOST` | `smtp.example.de` |
   | `SMTP_PORT` | `465` (implizites TLS) oder `587` (STARTTLS) |
   | `SMTP_USER` | Postfachname |
   | `SMTP_PASS` | Passwort bzw. App-Kennwort |
   | `SMTP_FROM` | `schichtplan@deine-domain.de` |

   `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase selbst –
   die müssen nicht angelegt werden.

2. **Supabase → Integrations → Cron** – einen Auftrag anlegen, der die
   Funktion `mail-versand` minütlich aufruft. Ohne diesen Schritt bleiben
   die Nachrichten im Postausgang stehen.

Solange Schritt 1 fehlt, läuft die Funktion trotzdem durch und meldet
zurück, dass SMTP nicht eingerichtet ist. Die Zeilen bleiben offen und
werden nachgeholt, sobald die Zugangsdaten stehen – es geht nichts
verloren.

### Kontrolle

Unter **Einstellungen → Mailversand** (nur Administration) steht, wie
viele Nachrichten warten, wie viele versendet wurden und woran der letzte
Versand gescheitert ist. Stauen sich offene Zeilen, ist der Versand nicht
eingerichtet oder der Cron-Auftrag fehlt.

### Text der Benachrichtigung

Der Text entsteht im Trigger `leave_requests_notify_leadership()`
(Migration `0041_email_outbox.sql`) und liegt nicht in Supabase, weil er
Werte aus dem Antrag einsetzt. Zur Ansicht:

Betreff: `Neuer Urlaubsantrag: <Name>`

```
Hallo <Vorname>,

<Name> hat Urlaub beantragt.
Zeitraum: 16.11.2026 bis 18.11.2026
Tage: 3
Kommentar: <falls angegeben>

Der Antrag liegt im Schichtplan zur Entscheidung bereit.

<Firma> · Schichtplan
```

Soll der Wortlaut geändert werden, gehört das in eine neue Migration, die
die Triggerfunktion ersetzt – nicht in die Supabase-Oberfläche.

## Vorlagen

### Confirm signup

Betreff: `Bitte bestätige deine E-Mail-Adresse`

```html
<h2>Willkommen beim Schichtplan</h2>
<p>Damit dein Zugang freigeschaltet wird, bestätige bitte diese
E-Mail-Adresse. Der Link gilt 24 Stunden.</p>
<p><a href="{{ .ConfirmationURL }}">E-Mail-Adresse bestätigen</a></p>
<p>Falls du dich nicht angemeldet hast, ignoriere diese Nachricht einfach –
ohne Bestätigung passiert nichts.</p>
```

### Invite user

Betreff: `Du wurdest zum Schichtplan eingeladen`

```html
<h2>Zugang zum Schichtplan</h2>
<p>Deine Schichtleitung hat dir einen Zugang eingerichtet. Über den Link
legst du dein Passwort fest und siehst danach deinen Schichtplan, dein
Urlaubskonto und kannst Urlaub beantragen.</p>
<p><a href="{{ .ConfirmationURL }}">Passwort festlegen</a></p>
<p>Der Link gilt 24 Stunden. Danach kann deine Schichtleitung eine neue
Einladung verschicken.</p>
```

### Reset password

Betreff: `Passwort zurücksetzen`

```html
<h2>Neues Passwort festlegen</h2>
<p>Über diesen Link kannst du ein neues Passwort für den Schichtplan
vergeben. Er gilt 60 Minuten.</p>
<p><a href="{{ .ConfirmationURL }}">Neues Passwort festlegen</a></p>
<p>Hast du das nicht angefordert, ändert sich nichts – dann kannst du diese
Nachricht löschen.</p>
```

### Change email address

Betreff: `Neue E-Mail-Adresse bestätigen`

```html
<h2>Adresse ändern</h2>
<p>Bestätige die neue Adresse, damit sie für deinen Zugang gilt.</p>
<p><a href="{{ .ConfirmationURL }}">Neue Adresse bestätigen</a></p>
```
