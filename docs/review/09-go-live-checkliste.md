# 09 – Go-live-Checkliste

Stand: 10. November 2026

Die App läuft bereits in deinem Betrieb. „Go-live“ heißt hier: **fremde Unternehmen arbeiten produktiv damit.**
Die Liste hat drei Stufen:

- **Stufe 1 – Blocker:** muss erledigt sein, bevor das erste fremde Unternehmen echte Daten einträgt.
  Die mit ★ markierten Punkte gelten **schon jetzt** für deinen eigenen Betrieb.
- **Stufe 2 – Vorher tun:** sollte vor dem öffentlichen Start erledigt sein.
- **Stufe 3 – Später:** kann nach dem Start folgen.

**Aufwand:** S = bis ½ Tag · M = 1–2 Tage · L = 3–5 Tage · XL = mehr als eine Woche.
**Art:** 🖱 = du im Dashboard (Anleitung unten) · 💻 = Änderung am Code/an der Datenbank (nach deiner Entscheidung) · 📄 = Dokument.

Bezeichnungen in den Dashboards können sich leicht geändert haben – wenn ein Menüpunkt anders heißt, ist er meist
unter demselben Oberpunkt zu finden.

---

## Stufe 1 – Blocker

| Nr. | Was | Warum | Art | Aufwand | Verweis |
|---|---|---|---|---|---|
| B1 ★ | **Zugang der Führung zu fremden Konten schließen** | Schichtleitung/Administration können sich als andere Person anmelden, bis in den Privatbereich mit Lohnabrechnungen | 💻 | S–M | S-01 |
| B2 ★ | **Datensicherung herstellen und Wiederherstellung einmal proben** | keine automatische Sicherung im kostenlosen Tarif; eigene Sicherung seit 29.10. defekt | 🖱 + 💻 | M | P-07 |
| B3 | **Bezahlte Tarife** bei Supabase und Vercel | Sicherungen, Zusagen, Sicherheitsfunktionen; kostenloser Vercel-Tarif nur nicht-kommerziell | 🖱 | S | P-12 |
| B4 | **Verträge zur Auftragsverarbeitung** mit Supabase, Vercel, Mail-Dienst nachweisbar abschließen | du sagst deinen Kunden im AV-Vertrag zu, dass sie bestehen | 🖱 + 📄 | S | D-08 |
| B5 ★ | **Schreibrechte der Schichtleitung begrenzen** (Stammdaten, Anträge) | per direkter Schnittstelle sind Konten sperrbar und Entscheidungen umgehbar | 💻 | S–M | S-02, S-03 |
| B6 ★ | **Überwachung von außen und Alarm bei fehlgeschlagener Sicherung** | Ausfälle fallen sonst nur durch Anrufe auf | 🖱 | S | P-08 |
| B7 ★ | **Einstellungen der Anmeldung prüfen** (Bestätigungs-Mail, Adressen, Passwortlänge, Mail-Versand) | per Abfrage nicht prüfbar; falsche Einstellung öffnet Lücken | 🖱 | S | S-05 |
| B8 ★ | **Zwei-Faktor für deine eigenen Konten** (Supabase, Vercel, GitHub, Mail-Dienst, Domain) | wer eines davon übernimmt, hat alle Daten aller Unternehmen | 🖱 | S | S-05 |
| B9 | **Vorschau-Umgebungen absichern** | Vorschau-Adressen sind derzeit ohne Anmeldung erreichbar; prüfen, ob sie auf die Live-Datenbank zeigen | 🖱 | S | – |
| B10 | **Löschfristen festlegen** (mindestens dokumentiert, mit Erinnerung an die Administration) | Krankheitstage und Daten Ausgeschiedener bleiben sonst unbegrenzt | 📄 + 💻 | M | D-02 |
| B11 | **Verarbeitungsverzeichnis aktualisieren**, eigenes Verzeichnis für den Privatbereich | Stand 22.10., Mail-Dienst und Dateispeicher fehlen | 📄 | S | D-08 |
| B12 | **Mails ohne persönliche Inhalte** (oder HTML maskieren) | Urlaubsdaten in Mails; eingeschleuste Links möglich | 💻 | S | S-04, D-07 |
| B13 | **Ablauf bei Datenpannen** schriftlich (72 Stunden, wer meldet wem) | Pflicht aus AV-Vertrag und DSGVO | 📄 | S | D-08 |

---

## Stufe 2 – Vorher tun

| Nr. | Was | Warum | Art | Aufwand | Verweis |
|---|---|---|---|---|---|
| V1 | Sperre gegen gleichzeitige Anträge und Genehmigungen | doppelte Anträge, Unterbesetzung | 💻 | S | L-01, L-02, L-09 |
| V2 | „Heute“ in deutscher Zeit rechnen | falscher Tag in der Nachtschicht und an Neujahr | 💻 | M | L-03 |
| V3 | Unterbesetzung nur mit bewusster Bestätigung genehmigen | Mindestbesetzung ist sonst nur Anzeige | 💻 | S–M | L-01 |
| V4 | Eigene Anträge nicht selbst genehmigen (Vorgabe für neue Unternehmen) | Vier-Augen-Prinzip | 💻 | S | L-04 |
| V5 | Verfall des Resturlaubs einstellbar, Vorgabe „kein automatischer Verfall“ | rechtlich heikel | 💻 | M | L-05 |
| V6 | Bundesland als Pflichtfrage | falsche Feiertage | 💻 | S | L-08 |
| V7 | Zwei-Faktor für den Betreiber-Zugang in der App, freiwillig für Administratoren | Betreiber-Zugang kann Unternehmen löschen | 💻 | M | S-05 |
| V8 | Captcha bei Registrierung und Demo; Aufräumen unbestätigter Registrierungen | Missbrauch | 🖱 + 💻 | S–M | S-08 |
| V9 | Geburtsdatum nur für die Administration | Datensparsamkeit | 💻 | S | D-05 |
| V10 | Schutz vor Gesundheitsangaben in allen Freitextfeldern | Art. 9 | 💻 | S | D-06 |
| V11 | Schriftlicher Ablauf für Auskunft und Datenkopie; Gesamtexport je Unternehmen | Art. 15, 20; Vertragsende | 📄 + 💻 | M | D-04 |
| V12 | Warnung, wenn eine Liste abgeschnitten wurde (über 1.000 Zeilen) | stille Fehler bei großen Mandanten | 💻 | S | P-02 |
| V13 | Mail-Versand gegen Doppelversand sperren | doppelte Mails | 💻 | S | P-10 |
| V14 | Gesamtgrenze für Lohnabrechnungen je Person | Speicher läuft voll | 💻 | S | P-13 |
| V15 | Fehler-Dienst mit EU-Standort; tägliche Prüf-Abfrage | Fehler bleiben unsichtbar | 🖱 + 💻 | M | P-08 |
| V16 | Globale Fehlerseite | Nutzer sehen sonst eine Standardseite | 💻 | S | P-14 |
| V17 | Lasttest im Testprojekt fahren | Hochrechnung durch Messung ersetzen | 🖱 | M | P-01 |
| V18 | Eigenes **Testprojekt** für Vorschau und Tests (getrennt von den Live-Daten) | Änderungen gefahrlos ausprobieren | 🖱 | M | – |
| V19 | Testfunktion `zz_test_…` entfernen, Suchpfad von `_beitritt_code` setzen | Advisor-Meldungen | 💻 | S | S-07 |
| V20 | Schichtplan auch ohne Netz lesbar | Notbetrieb | 💻 | M | P-09 |
| V21 | Unterlage für den Betriebsrat und Vorlage für die Folgenabschätzung fertigstellen (mit Fachperson) | Kunden mit Betriebsrat brauchen sie | 📄 | M | D-09 |
| V22 | Rechtstexte prüfen lassen (Nutzungsbedingungen, AV-Vertrag, Datenschutzerklärung, Impressum) | außerhalb dieser technischen Prüfung | 📄 | extern | – |

---

## Stufe 3 – Später

| Nr. | Was | Aufwand | Verweis |
|---|---|---|---|
| S1 | Rollenmodell mit einstellbaren Rechten (Tagschichtmeister, Verwaltung) | XL in Stufen | `06-rollen-entwuerfe.md` |
| S2 | Frei einstellbare Abwesenheits- und Tagesarten, Zeitkonten | XL | `05-onboarding-entwuerfe.md` |
| S3 | Einrichtungs-Assistent mit Vorlagen | L–XL | `05-onboarding-entwuerfe.md` |
| S4 | Automatische Löschung und Anonymisierung je Unternehmen einstellbar | M–L | D-02 |
| S5 | „Meine Daten herunterladen“ in der App | M | D-04 |
| S6 | Vorberechnete Tagestabelle für Plan und Auswertung | L | P-01 |
| S7 | Seitenweises Laden der Listen | M–L | P-02 |
| S8 | Wiederherstellung auf den Zeitpunkt (PITR) | 🖱 S | P-07 |
| S9 | Verweise an das Unternehmen binden (zusammengesetzte Schlüssel) | M | S-06 |
| S10 | Automatischer Test „jede Funktion prüft Rechte“ | M | S-07 |
| S11 | Fehlende Indizes, Policies zusammenlegen | M | P-06 |
| S12 | CSP mit Nonce, HSTS-Preload | M | S-12 |
| S13 | Lohnabrechnungen im Browser verschlüsseln | L | D-10 |
| S14 | `middleware.ts` auf `proxy.ts` umstellen | S | S-13 |
| S15 | Halbe Tage, regionale Feiertage, Sommerzeit bei Zeitkonten | M | L-06, L-08, L-11 |

---

# Anleitungen für die Dashboards

## B2 · Datensicherung

### a) Tägliche Sicherung bei Supabase einschalten (kommt mit dem Pro-Tarif, siehe B3)
1. https://supabase.com/dashboard öffnen, Projekt **Schichtplan** wählen.
2. Links **Database** → **Backups**.
3. Unter **Scheduled backups** sollte ab dem Pro-Tarif jeden Tag ein Eintrag erscheinen. Am nächsten Tag nachsehen.

### b) Wiederherstellung proben (einmal jetzt, dann alle drei Monate)
1. In **Database** → **Backups** den Reiter **Restore to new project** öffnen.
2. Die jüngste Sicherung wählen, als Namen z. B. `wiederherstellung-probe` eingeben, starten.
3. Warten, bis das neue Projekt bereit ist. Dort **Table Editor** öffnen und prüfen: Gibt es `companies`,
   `employees`, `leave_requests` mit plausibler Zeilenzahl?
4. Datum und Ergebnis in `docs/datensicherung.md` notieren.
5. Das Probe-Projekt wieder löschen: **Project Settings** → **General** → ganz unten **Delete project**.
   (Es enthält echte Daten.)

### c) Eigene Sicherung reparieren
1. https://github.com/refaitarek30-debug/Schichtplanung → Reiter **Actions** → links **Datensicherung**.
2. Den letzten roten Lauf öffnen und die Fehlermeldung ansehen.
3. Die Meldung an mich weitergeben – die Reparatur ist eine Code-Änderung und braucht deine Freigabe.

### d) Alarm bei fehlgeschlagener Sicherung
1. GitHub oben rechts auf dein Bild → **Settings** → **Notifications**.
2. Bei **Actions** einschalten: **Send notifications for failed workflows only**, Zustellung per E-Mail.

## B3 · Tarife

### Supabase
1. https://supabase.com/dashboard → oben links die Organisation **ShiftNexo** wählen.
2. **Billing** → **Subscription** → **Change subscription plan** → **Pro**.
3. Zahlungsmittel hinterlegen. Unter **Billing** → **Cost Control** ein **Spend Cap** eingeschaltet lassen,
   damit keine unerwarteten Kosten entstehen.
4. Danach B2 a), B7 Schritt 5 und 6 erledigen (die Funktionen sind erst jetzt verfügbar).

### Vercel
1. https://vercel.com → oben links Team **Tarek Refai** → **Settings** → **Billing**.
2. Steht dort **Hobby**: auf **Upgrade to Pro** gehen.
3. Unter **Settings** → **Billing** → **Spend Management** eine Obergrenze setzen (z. B. 50 $), mit Benachrichtigung.

## B4 · Verträge zur Auftragsverarbeitung

| Dienst | Wo |
|---|---|
| Supabase | Dashboard → Organisation → **Settings** → **Legal Documents** (bzw. **Documents**) → **Data Processing Addendum** anfordern und unterschreiben. Die unterschriebene PDF ablegen. |
| Vercel | Der Vertrag (DPA) ist Teil der Bedingungen des Pro-Tarifs: https://vercel.com/legal/dpa – als PDF speichern, Datum notieren. |
| Brevo | Im Brevo-Konto unter **Konto** → **Datenschutz / DSGVO** bzw. in den Allgemeinen Bedingungen; die Vereinbarung zur Auftragsverarbeitung als PDF speichern. |
| GitHub | Nur nötig, solange die Sicherung dort liegt: https://github.com/customer-terms |

Alle vier PDFs mit Datum in einen Ordner „AV-Verträge“ legen und im Verarbeitungsverzeichnis eintragen.

## B6 · Überwachung von außen

1. Bei einem Dienst wie **UptimeRobot** oder **Better Stack** ein kostenloses Konto anlegen.
2. Neuen Monitor anlegen: Typ **HTTPS**, Adresse `https://shiftnexo.de/api/version`, Abstand 5 Minuten.
3. Als Alarm deine E-Mail und, wenn möglich, SMS oder App-Meldung eintragen.
4. Zweiten Monitor für `https://shiftnexo.de/login` anlegen (prüft, ob die Seite ausgeliefert wird).
5. Test: Monitor kurz auf eine falsche Adresse stellen – kommt der Alarm an?

Hinweis: `/api/version` prüft nicht die Datenbank. Eine eigene Prüfseite dafür ist als V15 vorgesehen.

## B7 · Einstellungen der Anmeldung (Supabase)

1. Dashboard → Projekt **Schichtplan** → links **Authentication**.
2. **URL Configuration**:
   - **Site URL** muss `https://shiftnexo.de` sein.
   - Unter **Redirect URLs** dürfen nur eigene Adressen stehen (`https://shiftnexo.de/**`, `https://www.shiftnexo.de/**`).
     Einträge mit `localhost` oder `*.vercel.app` entfernen, wenn sie nicht gebraucht werden.
3. **Sign In / Providers** → **Email**:
   - **Confirm email**: an.
   - **Secure email change**: an. **Secure password change**: an.
   - **Minimum password length**: auf **12** stellen (heute prüft die App 8).
4. **Emails** → **SMTP Settings**: Eigener Versand (Brevo) muss eingetragen sein; Absender mit eigener Domain.
5. *(ab Pro-Tarif)* **Sign In / Providers** → **Email** bzw. **Attack Protection**:
   **Prevent use of leaked passwords** einschalten.
6. *(ab Pro-Tarif)* **Sessions**: **Time-box user sessions** (z. B. 30 Tage) und **Inactivity timeout**
   (z. B. 7 Tage) setzen. Vorher mit mir abstimmen – das wirkt zusammen mit der Abmeldung in der App.
7. **Rate Limits**: Werte ansehen und notieren; die Vorgaben sind in Ordnung.
8. **Attack Protection** → **Bot and Abuse Protection**: für V8 (Captcha) vormerken – erst einschalten, wenn die
   App das Captcha anzeigt, sonst kann sich niemand mehr anmelden.

### Absender-Domain absichern (beim Domain-Anbieter und in Brevo)
1. In Brevo: **Absender, Domains & dedizierte IPs** → **Domains** → `shiftnexo.de` → **Authentifizieren**.
2. Brevo zeigt DNS-Einträge (DKIM, DMARC). Diese beim Domain-Anbieter unter **DNS** eintragen.
3. Zurück in Brevo auf **Prüfen**. Beide Haken müssen grün sein.

## B8 · Zwei-Faktor für deine Konten

| Konto | Wo |
|---|---|
| Supabase | Bild oben rechts → **Account preferences** → **Security** → **Multi-factor authentication** → App hinzufügen |
| Vercel | Bild oben rechts → **Account Settings** → **Authentication** → **Two-Factor Authentication** |
| GitHub | **Settings** → **Password and authentication** → **Two-factor authentication** |
| Brevo | **Profil** → **Sicherheit** → **Zwei-Faktor-Authentifizierung** |
| Domain-Anbieter, E-Mail-Postfach | in den Sicherheitseinstellungen des jeweiligen Anbieters |

Für jedes Konto die **Wiederherstellungs-Codes** ausdrucken und sicher verwahren. Eine Authenticator-App
verwenden, keine SMS.

## B9 · Vorschau-Umgebungen (Vercel)

1. https://vercel.com → Projekt **ready** → **Settings** → **Deployment Protection**.
2. **Vercel Authentication** einschalten, Geltung **Standard Protection** (schützt alle Vorschau-Adressen).
   Danach kann eine Vorschau nur öffnen, wer in deinem Vercel-Team angemeldet ist.
3. **Settings** → **Environment Variables**: bei `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` ansehen,
   für welche Umgebungen sie gelten. Steht dort auch **Preview**, arbeiten Vorschauen mit den Live-Daten.
   Ziel (V18): Für **Preview** die Werte eines eigenen Testprojekts eintragen. **Werte nie in einen Chat kopieren.**

## Regelmäßige Aufgaben (Vorschlag)

| Wie oft | Was |
|---|---|
| täglich (automatisch) | Sicherung; Alarm bei Fehler |
| wöchentlich | Supabase → **Advisors** → **Security** und **Performance** ansehen |
| monatlich | Speicher und Datenverkehr in Supabase und Vercel; Postausgang; fehlgeschlagene Aufgaben |
| vierteljährlich | Wiederherstellung proben; Liste der Administratoren je Unternehmen; Unterauftragnehmer-Listen der Dienstleister |
| jährlich | Schlüssel wechseln (Service-Schlüssel, Push-Schlüssel, Erinnerungs-Geheimnis); Rechtstexte und Verzeichnis prüfen |
| bei jedem Personalwechsel bei dir | Zugänge zu Supabase, Vercel, GitHub, Brevo prüfen |

## Wenn ein Schlüssel bekannt geworden sein könnte

1. Supabase → **Project Settings** → **API Keys**: neuen geheimen Schlüssel erzeugen, alten widerrufen.
2. Vercel → **Settings** → **Environment Variables**: `SUPABASE_SERVICE_ROLE_KEY` ersetzen, danach **Redeploy**.
3. Prüfen: Anmeldung, Einladung, Registrierung, Erinnerungen.
4. Hinweis: Die Anmelde-Bremse nutzt diesen Schlüssel als Salz – nach dem Wechsel beginnen die Zähler neu (unkritisch).
5. Vorfall dokumentieren; prüfen, ob eine Meldung nach Art. 33 DSGVO nötig ist.
