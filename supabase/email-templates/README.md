# E-Mail-Vorlagen für Supabase Auth

Diese Texte gehören in Supabase unter **Authentication → Emails**. Sie
ersetzen die englischen Standardvorlagen.

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
   Mails auf localhost.

4. **Authentication → Policies:**
   „Leaked password protection" einschalten (Abgleich mit bekannten
   Datenlecks).

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
