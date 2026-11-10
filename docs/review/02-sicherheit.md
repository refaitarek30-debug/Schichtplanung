# 02 – Sicherheit

Stand: 10. November 2026 · rein lesende Prüfung · keine Secrets in diesem Dokument.

**Schweregrade:** kritisch = vor dem Start beheben · mittel = vor dem SaaS-Start beheben · klein = kann später.
**Aufwand:** S = bis ½ Tag · M = 1–2 Tage · L = mehrere Tage.

---

## Kurzfassung

Das Fundament ist solide: Jede der 68 Tabellen hat Row Level Security, die Rolle `anon` (nicht angemeldet) hat auf
keine Tabelle Zugriff, alle 300 Funktionen mit erhöhten Rechten haben einen festen Suchpfad, und in keiner Policy
oder Funktion wurde ein Weg von einem Unternehmen in ein anderes gefunden. Der Service-Role-Key wird nur auf dem
Server benutzt.

Es gibt **einen kritischen Fund** (S-01) und zwei mittlere Lücken in den Schreibrechten (S-02, S-03). Alle drei
betreffen nicht fremde Unternehmen, sondern das, was Führungskräfte **innerhalb** ihres Unternehmens tun können.

| Nr. | Fund | Schwere |
|---|---|---|
| S-01 | Führung kann sich mit Zugangslink oder Passwort-Code in das Konto einer Person einloggen – auch in deren Privatbereich | **kritisch** |
| S-02 | Schichtleitung kann per direkter Schnittstelle fast alle Stammdaten ändern (auch Konten sperren) | mittel |
| S-03 | Führung kann Urlaubsanträge direkt ändern, vorbei an der Genehmigungs-Funktion | mittel |
| S-04 | Benachrichtigungs-Mails übernehmen Text ungeprüft als HTML | mittel |
| S-05 | Keine Zwei-Faktor-Anmeldung; Schutz vor geleakten Passwörtern aus; Mindestlänge 8 | mittel |
| S-06 | Verweise auf Mitarbeiter/Schichten sind nicht an das Unternehmen gebunden | klein |
| S-07 | Große Angriffsfläche: 194 Funktionen mit erhöhten Rechten; Testrest in Produktion | klein |
| S-08 | Registrierung ohne Captcha; Unternehmen entsteht vor der Mail-Bestätigung | klein |
| S-09 | Anmelde-Bremse fällt bei Störung auf „erlauben“; keine Bremse für Zugangslinks und Codes | klein |
| S-10 | Support-Code für Privatkonten über eine unbestätigte Kontaktadresse | klein |
| S-11 | Inaktivitäts-Abmeldung beruht auf einem Cookie im Browser | klein |
| S-12 | Content-Security-Policy erlaubt Inline-Skripte; HSTS ohne Preload | klein |
| S-13 | Kleinigkeiten: Salz für Hashes, Löschen ohne Passwort, veraltete `middleware.ts` | klein |

---

## Was geprüft wurde und in Ordnung ist

**Mandantentrennung (RLS)**
- 68 von 68 Tabellen haben RLS eingeschaltet. `anon` hat auf **keine** Tabelle Rechte.
- 30 Tabellen haben RLS ohne Policy – sie sind nur über Funktionen erreichbar. Das ist gewollt und sicher.
- Jede Policy beginnt mit `company_id = (select auth_company_id())`. Die Hilfsfunktionen lesen Firma, Rolle und
  Mitarbeiter aus dem **eigenen aktiven Profil** (`profiles where id = auth.uid() and active`).
- Die einzige Ansicht (`leave_balances_view`) läuft mit den Rechten des Aufrufers (`security_invoker`).
- Alle Funktionen mit `p_company_id` prüfen, dass es das eigene Unternehmen ist.
- Schutz-Trigger verhindern, dass jemand die eigene Rolle, Firma oder den eigenen Mitarbeiter-Bezug ändert
  (`profiles_guard_self_identity`, `employees_guard_role_change`).

**Service-Role-Key und Secrets**
- Der Schlüssel wird nur in `src/lib/supabase/server.ts` gelesen und an 12 Server-Stellen benutzt
  (Einladung, Registrierung, Anmelde-Bremse, Betreiber-Bereich, Erinnerungen). Er hat **kein** `NEXT_PUBLIC_`-Präfix
  und landet nicht im Browser-Paket.
- `grantAccess` ist absichtlich **keine** Server-Aktion – sonst könnte jeder sich einen Zugang erzeugen.
- Kein Secret im Repository gefunden. Das Geheimnis für den Erinnerungs-Aufruf liegt im Supabase-Vault und wird
  zeitkonstant verglichen.

**Anmeldung und Links**
- Einladungs- und Passwort-Links zeigen auf eine Adresse aus der Server-Konfiguration, nicht aus dem
  Anfrage-Header (kein „Host-Header“-Angriff).
- Ein Link wird erst nach einem Klick auf einen Knopf eingelöst (POST) – Mail-Scanner verbrauchen ihn nicht.
- Weiterleitungen nach der Anmeldung werden geprüft (`safeInternalPath`), kein offener Redirect.
- Die Antwort bei „Passwort vergessen“ und bei der Registrierung verrät nicht, ob es ein Konto gibt.
- Anmelde-Bremse in der Datenbank: 40 Versuche je IP und 10 je Adresse in 10 Minuten; Passwort-Reset 3 je Stunde;
  Registrierung 5 je IP und Stunde. IP und Adresse werden nur als gesalzener Hash gespeichert und nach einem Tag gelöscht.

**Browser-Schutz**
- XSS: React maskiert alle Ausgaben. `dangerouslySetInnerHTML` gibt es nur an drei Stellen (QR-Code aus der
  eigenen Bibliothek, Design-Skript) – ohne Nutzereingaben.
- CSRF: Server-Aktionen von Next.js prüfen die Herkunft; Cookies sind `SameSite=Lax`.
- Kopfzeilen: CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy,
  Permissions-Policy, HSTS (2 Jahre, mit Subdomains).

**Öffentliche Links (Partner-Kalender, Kalender-Abo)**
- Schlüssel mit 192 Bit Zufall. Sechs Funktionen sind ohne Anmeldung aufrufbar, alle prüfen den Schlüssel.

---

## S-01 · Führung kann sich in das Konto einer Person einloggen (kritisch)

**Was passiert – Weg 1 (Zugangslink):**
`inviteEmployee` → `grantAccess` → `createInviteLink` (`src/lib/auth/invite.ts`). Hat die Person schon ein Konto,
erzeugt der Server einen **Passwort-Link** für dieses Konto und **zeigt ihn der Führungskraft an**. Wer den Link
öffnet, ist als diese Person angemeldet. Das Passwort muss dafür nicht geändert werden – die Person merkt nichts.
Erlaubt ist das der Administration für alle und der Schichtleitung für Mitarbeiter.

**Weg 2 (Passwort-Code):**
`passwort_code_fuer_mitarbeiter` gibt der Führung einen Einmal-Code für das Konto einer Person. Mit Code und
E-Mail-Adresse kann man sich als diese Person anmelden (`passwortMitCode`).

**Warum das kritisch ist:**
1. Seit „ein Konto für Betrieb und Privat“ (Migration 0194) hängt am selben Konto der **Privatbereich**:
   privater Kalender, Freigaben an Partner und – mit Einwilligung – **Lohnabrechnungen** (Art. 9 DSGVO).
   Eine Schichtleitung kommt so an private Daten ihrer Leute.
2. Im Namen der Person lassen sich Anträge stellen oder zurücknehmen. Im Protokoll steht dann die Person selbst.
3. Das **Erzeugen** von Link oder Code wird nicht protokolliert (keine Trigger auf `passwort_codes`,
   kein `write_audit` in `grantAccess`). Die Person bekommt keine Nachricht.

Es wurde nicht geprüft, ob das je ausgenutzt wurde – die Möglichkeit besteht.

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | **Link/Code nur für Konten, die sich noch nie angemeldet haben.** Danach hilft nur „Passwort vergessen“ per E-Mail an die Person selbst oder ihr eigener Wiederherstellungs-Code. | schließt die Lücke vollständig | Personen ohne E-Mail-Postfach brauchen einen anderen Weg (siehe C) | S–M | gering |
| B | Link/Code bleibt, aber: Eintrag im Protokoll, sofortige Nachricht an die Person (App + Push), neues Passwort wird erzwungen, alle anderen Sitzungen werden beendet. | bleibt praktisch im Schichtalltag | Übernahme bleibt möglich, nur sichtbar | M | mittel |
| C | Wie B, aber **gesperrt für Konten mit Privatbereich**; dort nur Selbsthilfe. | schützt die sensibelsten Daten | Logik je Kontoart | M | gering |
| D | Konten trennen: Betriebszugang und Privatbereich wieder als zwei Anmeldungen. | saubere Trennung der Verantwortung | macht 0194 rückgängig, Umzug bestehender Konten | L | hoch |

**Empfehlung:** A als Sofortmaßnahme (dazu Protokoll-Eintrag beim Erzeugen). Für Personen ohne E-Mail zusätzlich
B + C als bewusst eingeschalteter Weg je Unternehmen – Standard **aus**. In der Unterlage für den Betriebsrat
ist der heutige Stand offen benannt (`08-betriebsrat.md`).

---

## S-02 · Schichtleitung kann fast alle Stammdaten direkt ändern (mittel)

> **Korrektur (10.11.2026, nach dem Review):** Das Bearbeiten-Formular bot der Schichtleitung diese Felder ganz offen an – auch bei Administratoren. Es war also keine versteckte Lücke über die Schnittstelle, sondern eine fehlende Begrenzung. Behoben in Pull Request #203: Die Schichtleitung bearbeitet nur noch Personen mit Rolle Mitarbeiter (Migration 0209).

**Was passiert:** Die Policy „Personaldaten aendert auch Schichtleitung“ erlaubt der Rolle `shift_leader` ein UPDATE
auf **alle Spalten** von `employees` im eigenen Unternehmen. Die Rolle `authenticated` hat Schreibrecht auf alle
Spalten; geschützt ist per Trigger nur `role`. Die Oberfläche zeigt weniger – aber wer die Schnittstelle direkt
anspricht (Browser-Konsole reicht), kann:

- `active = false` setzen → der Trigger `employees_sync_profile_active` sperrt den Zugang der Person.
  **Das geht auch bei Administratoren.** Nur die eigene Sperrung ist verhindert.
- `exit_date` setzen → der stündliche Job `austritte_vollziehen` beendet den Zugang (die letzte Administration bleibt geschützt).
- `vacation_days`, `v_days` ändern → wird ins Urlaubskonto übernommen.
- E-Mail, Personalnummer, Eintrittsdatum, Schichtgruppe, Azubi-Merkmal ändern.

Alles wird protokolliert (`employees_audit`). Es bleibt im eigenen Unternehmen.

| Variante | Beschreibung | Vorteile | Nachteile | Aufwand | Risiko |
|---|---|---|---|---|---|
| A | Schutz-Trigger erweitern: Schichtleitung darf nur eine feste Liste von Spalten ändern. | schnell, kein Umbau der Oberfläche | Liste muss gepflegt werden | S | gering |
| B | Policy entfernen; Änderungen der Schichtleitung nur über eine Funktion mit festen Feldern. | klarste Lösung, gut testbar | Oberfläche muss die Funktion nutzen | M | mittel |
| C | Spaltenrechte in der Datenbank (`GRANT UPDATE (spalten)`). | Standardmittel | gilt für alle Rollen gleich, Admin braucht dann Funktionen | M | mittel |

**Empfehlung:** A sofort, B zusammen mit dem neuen Rollenmodell (`06-rollen-entwuerfe.md`) – dort wird ohnehin
je Recht geprüft.

---

## S-03 · Urlaubsanträge direkt änderbar (mittel)

**Was passiert:** Die UPDATE-Policy auf `leave_requests` verlangt nur „Führung im selben Unternehmen“; die neue Zeile
muss den Status „offen“ haben. Damit kann jede Führungskraft – auch die Schichtleitung einer **anderen** Schicht –
per direkter Schnittstelle:

- einen genehmigten oder abgelehnten Antrag auf „offen“ zurücksetzen,
- Zeitraum oder Art eines offenen Antrags ändern.

Das geht an `decide_leave_request` und an der Regel „nur eigene Schicht“ (`darf_urlaub_entscheiden`) vorbei.
Die Trigger (Tage berechnen, Überlappung, Kontingent, Protokoll) greifen weiterhin.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | UPDATE-Policy für Führung entfernen. Entscheiden, Zurücknehmen, Ändern nur über die vorhandenen Funktionen. | S–M | mittel (prüfen, ob die Oberfläche irgendwo direkt schreibt) |
| B | Policy einengen: nur eigene Schicht und nur wenn der alte Status „offen“ ist. | S | gering |
| C | Trigger, der Statuswechsel außerhalb der Funktionen ablehnt. | S | gering |

**Empfehlung:** A, mit einem Test, der genau diese direkten Aufrufe versucht.

---

## S-04 · Mails übernehmen Text ungeprüft als HTML (mittel)

**Was passiert:** `notify_leave_submitted` baut den HTML-Teil der Mail durch Aneinanderhängen:
Name der Person, Kommentar zum Antrag und Firmenname werden **unmaskiert** eingesetzt. Wer in den Kommentar
`<a href="…">Hier genehmigen</a>` schreibt, bekommt diesen Link in die Mail an alle Führungskräfte.
Skripte laufen in Mail-Programmen nicht – aber Täuschungs-Links und Zählpixel sind möglich.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Hilfsfunktion `html_maskieren()` und überall anwenden. | S | gering |
| B | Mails ohne persönliche Inhalte: „Es gibt einen neuen Antrag – bitte in der App ansehen.“ | S | gering |
| C | HTML-Teil weglassen, nur Text senden. | S | gering |

**Empfehlung:** B. Das löst zugleich den Datenschutz-Fund D-07 (Urlaubsdaten gehen heute per Mail an alle
Führungskräfte und an den Mail-Dienst).

---

## S-05 · Anmeldung: kein zweiter Faktor, schwache Passwortregeln (mittel)

- In `auth.mfa_factors` steht kein einziger Eintrag – niemand nutzt eine Zwei-Faktor-Anmeldung, auch nicht die
  Administration und nicht der Betreiber-Zugang (`/plattform`, kann Unternehmen löschen).
- Der Supabase-Schutz „Leaked Password Protection“ ist aus (Supabase-Advisor).
- Mindestlänge 8 Zeichen, keine weitere Regel.

| Variante | Beschreibung | Aufwand | Risiko |
|---|---|---|---|
| A | Zwei-Faktor (TOTP-App) als **Pflicht für den Betreiber-Zugang**, freiwillig für Administratoren. | M | gering |
| B | Zusätzlich Pflicht für alle Administratoren, je Unternehmen einstellbar. | M–L | mittel (Support-Aufwand bei verlorenem Gerät) |
| C | Nur Passwortregeln verschärfen: 12 Zeichen, Leak-Prüfung an. | S | gering |

**Empfehlung:** C sofort (zwei Klicks im Dashboard, siehe Checkliste), A vor dem SaaS-Start, B als Option.
Hinweis: Die Leak-Prüfung gibt es bei Supabase erst ab dem Pro-Tarif.

---

## S-06 · Verweise nicht an das Unternehmen gebunden (klein)

Die Policies prüfen die `company_id` der **eigenen Zeile**, nicht, ob der darin genannte Mitarbeiter oder die Schicht
zum selben Unternehmen gehört. Beispiel: Eine Administration könnte `profiles.employee_id` oder
`shift_assignments.employee_id` auf die ID eines Mitarbeiters eines anderen Unternehmens setzen – wenn sie diese
zufällige ID kennen würde. Praktisch kaum ausnutzbar (IDs sind nicht erratbar und nirgends sichtbar), aber es
fehlt die zweite Sicherung.

**Varianten:** A) Zusammengesetzte Fremdschlüssel `(company_id, employee_id)` (M, sauberste Lösung).
B) Trigger, der die Firma des Verweises prüft (S–M). C) So lassen. **Empfehlung:** A für die fünf Kerntabellen
(`profiles`, `shift_assignments`, `absences`, `leave_requests`, `leave_balances`), vor dem SaaS-Start.

---

## S-07 · Große Angriffsfläche durch Funktionen (klein)

194 Funktionen mit erhöhten Rechten sind für angemeldete Personen aufrufbar. Jede einzelne muss Rolle und Firma
selbst prüfen. Eine Stichprobe und eine automatische Suche fanden keine ohne Prüfung (acht delegieren an geprüfte
Funktionen). Bei dieser Menge ist ein Fehler in einer künftigen Funktion aber nur eine Frage der Zeit.

Dazu aus den Supabase-Advisors:
- `zz_test_shift_plan_grid_neu` – Testfunktion in Produktion (nicht aufrufbar, sollte trotzdem weg).
- `_beitritt_code` – einzige Funktion ohne festen Suchpfad.
- `pg_net` liegt im Schema `public`.

**Varianten:** A) Automatischer Test in der Pipeline: jede neue Funktion muss eine Auth-Prüfung enthalten oder auf
einer Ausnahmeliste stehen (M). B) Funktionen in ein eigenes Schema verschieben, das nicht automatisch freigegeben
ist; nur ausdrücklich freigegebene landen in der Schnittstelle (L). C) Jährliche Durchsicht von Hand.
**Empfehlung:** A; die drei Advisor-Punkte nebenbei bereinigen.

---

## S-08 · Registrierung (klein)

- Kein Captcha. Die Bremse (5 je IP und Stunde) hält einzelne Angreifer auf, kein Botnetz.
- Das Unternehmen wird angelegt, **bevor** die E-Mail-Adresse bestätigt ist. Jemand kann mit fremden Adressen
  leere Unternehmen erzeugen. Anmelden kann er sich damit nicht.
- Privatkonten haben keine E-Mail-Adresse (Spitzname) – also auch keinen Nachweis und keine Bremse je Person.

**Varianten:** A) Captcha (Cloudflare Turnstile ist in Supabase eingebaut) für Registrierung und Demo (S–M).
B) Unternehmen erst nach Bestätigung anlegen (M). C) Nächtliches Aufräumen unbestätigter Registrierungen nach
7 Tagen (S). **Empfehlung:** A + C.

---

## S-09 · Bremsen (klein)

- Fällt die Zähltabelle aus, wird die Anmeldung **erlaubt** (bewusst, damit ein Ausfall nicht alle aussperrt).
  Supabase selbst bremst zusätzlich.
- Für das Erzeugen von Zugangslinks, Passwort-Codes und Beitritts-Codes gibt es keine Bremse.
- Beitritts-Code: 8 Zeichen aus 32 (40 Bit), 7 Tage gültig, ohne Zähler für Fehlversuche in `beitritt_annehmen`.

**Varianten:** A) Bremse auch für diese Aktionen (S). B) Fehlversuche bei Beitritts-Codes zählen wie bei
Passwort-Codes (5 Versuche, dann 15 Minuten Pause) (S). **Empfehlung:** A + B.

---

## S-10 · Support-Code für Privatkonten (klein)

`plattform_passwort_code` findet ein Privatkonto auch über die frei eingetragene, **unbestätigte** Kontaktadresse.
Wer eine fremde Adresse einträgt und beim Support anruft, wirkt wie deren Inhaber. Das Risiko liegt im Ablauf,
nicht in der Technik. **Empfehlung:** schriftliche Regel für dich als Betreiber („Code nur an die hinterlegte
Adresse schicken, nie am Telefon nennen“) und Protokoll-Eintrag bei jedem Support-Code.

---

## S-11 · Inaktivitäts-Abmeldung (klein)

Die Fristen (Administration 15 Minuten, Schichtleitung 8 Stunden, Mitarbeiter 12 Stunden, privat 30 Tage) werden
über ein Cookie gesteuert, das der Browser selbst setzen kann. Das schützt vor dem vergessenen Gerät in der
Messwarte – nicht vor einem Angreifer mit gestohlener Sitzung. Echte Sitzungsgrenzen (maximale Dauer,
Inaktivität) kann Supabase serverseitig erzwingen, allerdings erst ab dem Pro-Tarif.
**Empfehlung:** mit dem Tarifwechsel einschalten (siehe Checkliste).

---

## S-12 · Kopfzeilen (klein)

- Die CSP erlaubt `'unsafe-inline'` für Skripte (im Code begründet: Next.js braucht es ohne Nonce).
  Damit bremst die CSP eingeschleuste Skripte nicht. Da React alles maskiert, ist das Risiko gering.
- HSTS ohne `preload`.

**Varianten:** A) CSP mit Nonce (M, kann Seiten langsamer machen, weil sie nicht mehr statisch sind).
B) So lassen. **Empfehlung:** B bis zum SaaS-Start, dann A für die angemeldeten Bereiche.

---

## S-13 · Kleinigkeiten

- **Salz für Hashes:** Die Anmelde-Bremse nutzt den Service-Role-Key als Salz. Besser ein eigenes Geheimnis –
  sonst hängt die Bremse am Schlüsselwechsel. (S)
- **Privatkonto löschen:** verlangt das Wort „LÖSCHEN“, aber kein Passwort. Ein entsperrtes fremdes Handy reicht. (S)
- **`middleware.ts`:** In Next.js 16 heißt die Datei `proxy.ts`; die alte Form ist als veraltet markiert.
  Es gibt ein automatisches Umstell-Werkzeug. (S)
- **Feste Adresse:** `erinnerungen_anstossen` ruft `ready-flame.vercel.app` auf, nicht `shiftnexo.de`. Funktioniert,
  sollte aber aus einer Einstellung kommen. (S)

---

## Supabase-Advisors (Stand 10.11.2026)

| Meldung | Anzahl | Bewertung |
|---|---|---|
| RLS an, keine Policy | 30 | gewollt (nur über Funktionen erreichbar) |
| Funktion ohne festen Suchpfad | 1 (`_beitritt_code`) | beheben |
| Erweiterung in `public` | 1 (`pg_net`) | beheben, wenn möglich |
| Definer-Funktion für `anon` aufrufbar | 6 | gewollt (Partner-Link, Kalender-Abo) |
| Definer-Funktion für `authenticated` aufrufbar | 194 | systembedingt, siehe S-07 |
| Schutz vor geleakten Passwörtern aus | 1 | einschalten (Pro-Tarif) |
| Fremdschlüssel ohne Index | 29 | siehe `04-performance-robustheit.md` |
| Mehrere erlaubende Policies | 103 | siehe `04-performance-robustheit.md` |

---

## Was nicht oder nur in Stichproben geprüft wurde

- Die 334 Funktionen wurden mit einer automatischen Suche auf Auth-Prüfungen untersucht; im Detail gelesen wurden
  rund 40 (Urlaub, Besetzung, Anmeldung, Beitritt, Löschen).
- Die Einstellungen von Supabase Auth (Mail-Bestätigung, Sitzungsdauer, erlaubte Weiterleitungen) sind per SQL
  nicht lesbar – bitte in der Checkliste von Hand prüfen.
- Kein aktiver Angriffstest gegen die Live-Seite.
