# Notfallplan ShiftNexo

Stand: 13.11.2026 · Was passiert, wenn der Betreiber (Tarek Refai) nicht erreichbar ist?

ShiftNexo wird von einer Person entwickelt und betrieben. Damit ein Ausfall dieser
Person den Betrieb nicht blind macht, gibt es **zwei versiegelte Umschläge** mit
getrennten Rechten.

| | Umschlag A „Notfallzugang – nur lesen“ | Umschlag B „Wiederherstellung“ |
|---|---|---|
| Wer verwahrt ihn | Vertrauensperson beim Kunden, z. B. Head of IT | Vertrauensperson des Betreibers (Familie, Steuerberater oder Notar) – **nicht** beim Kunden |
| Was kann man damit | Betreiber-Seite öffnen und sehen, was los ist: Firmen, Zählwerte, gesperrte Konten | Sicherung entschlüsseln, Daten herausgeben, App abschalten |
| Was kann man nicht | ändern, löschen, Codes erzeugen, Zugänge freischalten, Inhalte von Plänen lesen | – (volle Rechte, deshalb getrennt) |
| Protokoll | Jede Öffnung wird festgehalten und dem Betreiber angezeigt | Zugriffe stehen in den Protokollen von Supabase, Vercel und GitHub |

---

## Umschlag A: Notfallzugang (nur lesen)

**Inhalt (vom Betreiber ausgefüllt):**

| | |
|---|---|
| Adresse | https://shiftnexo.de/login, danach https://shiftnexo.de/plattform |
| E-Mail des Notfallkontos | ______________________________ |
| Passwort | ______________________________ |
| Zwei-Faktor-Schlüssel (zum Abtippen in eine Authenticator-App) | ______________________________ |
| Erstellt am / Unterschrift Betreiber | ______________________________ |

**Wann öffnen?** Nur wenn die App nicht funktioniert oder sich merkwürdig verhält
**und** der Betreiber länger als 24 Stunden nicht erreichbar ist.

**So geht's:**
1. Authenticator-App (z. B. Microsoft Authenticator) → „Konto hinzufügen“ →
   „Schlüssel manuell eingeben“ → Name „ShiftNexo Notfall“, Schlüssel aus dem Umschlag.
2. https://shiftnexo.de/login mit E-Mail und Passwort anmelden, dann den 6-stelligen
   Code aus der App eingeben.
3. https://shiftnexo.de/plattform öffnen. Oben steht „Notfallzugang – nur lesen“.
4. Nachsehen:
   - Sind Firma und Mitarbeiterzahl noch da? Gibt es neue Anmeldungen?
   - Sind Konten gesperrt (Abschnitt „Sperre und Zwei-Faktor“)? Freischalten kann die
     **Administration des Betriebs** selbst unter Verwaltung → Mitarbeiter.
5. Ist die ganze Seite nicht erreichbar: Störungsseiten der Anbieter prüfen –
   https://status.supabase.com und https://www.vercel-status.com.
6. Ergebnis kurz notieren (wann, was gesehen) und den Betreiber informieren, sobald er
   erreichbar ist. Bei Verdacht, dass Fremde Daten gesehen haben: Datenschutzbeauftragten
   sofort informieren (Meldefrist 72 Stunden).

Nach dem Öffnen: Umschlag nicht wiederverwenden. Der Betreiber ändert danach Passwort
und Schlüssel und stellt einen neuen Umschlag aus.

---

## Umschlag B: Wiederherstellung

**Inhalt (vom Betreiber ausgefüllt):**

| | |
|---|---|
| Passwort der Datensicherung (`BACKUP_PASSWORT`) | ______________________________ |
| GitHub-Zugang (Repository, Sicherungen) | ______________________________ |
| Supabase-Zugang (Datenbank) | ______________________________ |
| Vercel-Zugang (App) | ______________________________ |
| Zwei-Faktor-Wiederherstellungscodes der drei Dienste | ______________________________ |
| Erstellt am / Unterschrift Betreiber | ______________________________ |

**Wann öffnen?** Nur wenn der Betreiber dauerhaft ausfällt (z. B. Krankheit, Tod) oder
der Vertrag endet und die Daten herausgegeben werden müssen (AVV § 10).

**Was dann zu tun ist** – am besten mit einer IT-Fachkraft:
1. **Daten herausgeben:** Neueste Sicherung bei GitHub → Actions → „Datensicherung“
   herunterladen und nach `docs/datensicherung.md` entschlüsseln. Die Datei enthält alle
   Daten aller Kunden – nur die Daten des jeweiligen Kunden herausgeben.
2. **App abschalten:** Vercel → Projekt → Settings → „Pause Project“. Die Daten bleiben
   in der Datenbank erhalten.
3. **Daten löschen** (nach Herausgabe und Absprache mit dem Kunden): Supabase → Projekt
   → Settings → „Delete project“. Sicherungen bei GitHub löschen sich nach 14 Tagen selbst.
4. Kunden informieren (Kontakt der Administration und des Datenschutzbeauftragten).

---

## Einrichten (für den Betreiber)

1. Ein eigenes Konto für den Notfallzugang anlegen, z. B. als Privatkonto mit einer
   eigenen E-Mail-Adresse. Kein Betriebskonto.
2. In Supabase → SQL Editor eintragen:
   ```sql
   insert into public.platform_admins (user_id, notiz, nur_lesen)
   select id, 'Notfallzugang', true from auth.users where email = '<adresse>';
   ```
3. Mit dem Konto anmelden und unter /plattform die Zwei-Faktor-Anmeldung einrichten.
   Dabei „Schlüssel zum Abtippen zeigen“ und den Schlüssel in Umschlag A schreiben.
   Prüfen: Oben steht „Notfallzugang – nur lesen“.
4. Umschläge ausfüllen, versiegeln, auf dem Siegel unterschreiben, übergeben.
   Übergabe kurz schriftlich bestätigen lassen.
5. **Einmal im Jahr** prüfen: Ist der Notfallzugang noch eingetragen? Lässt sich die
   Sicherung öffnen (GitHub → Actions → „Sicherung prüfen“)? Sind die Zugänge in
   Umschlag B noch aktuell?

Auf der Betreiber-Seite steht oben, wann der Notfallzugang zuletzt benutzt wurde.
Steht dort ein Zeitpunkt, den niemand angekündigt hat: Passwort und Schlüssel sofort
ändern und den Notfallzugang neu ausstellen.
