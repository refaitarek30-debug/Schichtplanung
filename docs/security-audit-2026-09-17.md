# Sicherheitsaudit und Hardening — 17.09.2026

Durchgeführt nach `docs/auftrag-security-datenschutz-hardening.md`.
Stand vor Beginn: Migrationen bis `0063`. Umgesetzt in `0064` plus
Änderungen an `next.config.mjs`, `src/lib/supabase/config.ts` und
`src/context/session.tsx`.

**Kurzfassung: Die Mandantentrennung hält.** Von den vermuteten Risiken hat
sich eines bestätigt — Krankheitsdaten waren für Kollegen sichtbar. Drei
weitere Punkte waren offen, aber weniger schlimm als befürchtet.

---

## 1. Was geprüft wurde, und wie

Jede Aussage unten ist gemessen, nicht gelesen. Alle schreibenden Tests
liefen in einer Transaktion, die am Ende absichtlich abbricht.

### 1.1 Ein methodischer Fehler, der fast durchgerutscht wäre

Der erste Cross-Tenant-Test meldete schwere Lecks: ein Admin aus Firma A
konnte 50 Personaldatensätze, 295 Abwesenheiten und 289 Urlaubsanträge aus
Firma B lesen und sogar die fremde Firma umbenennen.

**Dieses Ergebnis war wertlos.** Die Verbindung lief als privilegierte
Rolle, die RLS grundsätzlich umgeht. Das Setzen von
`request.jwt.claims` ändert nur, was `auth.uid()` liefert — es schaltet
RLS nicht ein.

Der Test wurde mit `set_config('role', 'authenticated', true)` wiederholt
und um eine **Gegenprobe** ergänzt: der Zugriff auf die *eigene* Firma
muss gelingen, sonst misst der Test nur, dass alles kaputt ist.

Wer diese Tests wiederholt, muss beides tun. Ohne Rollenwechsel ist jedes
Ergebnis falsch-positiv, ohne Gegenprobe jedes Ergebnis falsch-negativ.

### 1.2 Cross-Tenant (Rolle `authenticated`, Demo Chemie → Röhm GmbH)

| Versuch | Ergebnis |
|---|---|
| Personaldaten lesen | blockiert |
| Abwesenheiten lesen | blockiert |
| Urlaubsanträge lesen | blockiert |
| Logins lesen | blockiert |
| Firmenzeile lesen | blockiert |
| Person ändern | blockiert |
| Firma umbenennen | blockiert |
| *Gegenprobe: eigene Firma* | *lesbar (50 Zeilen) — Test misst korrekt* |

Zusätzlich über die `security definer`-Funktionen, die eine fremde ID
entgegennehmen: `shift_plan_grid` → „keine Berechtigung",
`plan_set_shift`, `create_absence_range`, `set_leave_for_day` →
„Mitarbeiter nicht gefunden", `set_shift_qualification_need` → „Schicht
nicht gefunden", `set_employee_order` → 0 Zeilen geändert.

### 1.3 Anonymer Zugriff über die echte REST-Schnittstelle

Getestet mit dem öffentlichen Schlüssel gegen die Live-API:

| Versuch | Ergebnis |
|---|---|
| `discard_unclaimed_company` auf Röhm GmbH | `false` — nichts gelöscht |
| `employees_absent_on` | permission denied |
| `effective_shift_id` | permission denied |
| Tabelle `employees` direkt | permission denied |
| Tabelle `absences` direkt | permission denied |

**Kein anonymer Datenzugriff möglich.**

### 1.4 RLS-Bestand

- 23 Tabellen im Schema `public`, **alle mit aktiviertem RLS**.
- **Keine einzige `update`/`insert`-Policy ohne `with_check`** — damit
  kann keine Zeile aus dem eigenen Mandanten in einen fremden geschoben
  werden.
- Genau eine Tabelle mit RLS und ohne Policy: `platform_admins`. Das ist
  der gewollte Zustand (vollständig gesperrt, Zugriff nur über
  `security definer`), war aber nirgends festgehalten.

### 1.5 SECURITY DEFINER

79 Funktionen, **alle mit gesetztem `search_path`**. Das ist die wichtigste
Einzelmaßnahme gegen Schema-Angriffe und war bereits erfüllt.

### 1.6 Rolle „einfacher Mitarbeiter"

| Prüfung | Ergebnis |
|---|---|
| Fremde Abwesenheiten direkt lesen | blockiert |
| Fremde Notizen lesen | keine lesbar |
| Krankmeldung erfassen | abgewiesen |
| Personaldaten ändern | blockiert |
| **Kranktage der Kollegen im Plan** | **3 Zellen sichtbar** |

---

## 2. Befunde und was daraus wurde

### Befund 1 — Krankheitsdaten für Kollegen sichtbar · **behoben**

`shift_plan_grid()` läuft als `security definer` und zeigt einem
Mitarbeiter bewusst die ganze eigene Schichtgruppe. Darin enthalten war
der Code `K`. Gemessen: **drei Krank-Zellen von Kollegen** in vier Wochen,
über zehn fremde Zeilen. Über die Tabelle `absences` kam niemand an die
Daten — RLS hielt dort. Das Leck war ausschließlich diese eine Funktion.

Krankheit ist ein Gesundheitsdatum nach Art. 9 DSGVO. Die Schichtgruppe
braucht für die Planung „dieser Platz ist unbesetzt", nicht den Grund.

**Geändert in 0064:** Bei fremden Zeilen sehen Nicht-Führungskräfte `A`
(abwesend) statt `K`. Die Führung sieht weiterhin `K`, weil sie Ausfälle
disponieren muss. Jede Person sieht ihren eigenen Eintrag unverändert.

Urlaub, V-Tag und Schulung bleiben bewusst sichtbar — das ist
Planungswissen und kein Gesundheitsdatum.

| Nachweis | Vorher | Nachher |
|---|---|---|
| Mitarbeiter sieht fremde `K` | 3 | **0** |
| Stattdessen `A` bei Kollegen | – | 3 |
| Führung sieht `K` | 21 | **21** |
| Eigene Krankmeldung für sich selbst | `K` | **`K`** |

### Befund 2 — Demo-Modus als stiller Rückfall · **behoben**

`sessionMode` war `isSupabaseConfigured ? "live" : "demo"`. Fehlte in
Produktion eine Umgebungsvariable, fiel die Anwendung **stillschweigend**
in den Demo-Modus — mit Rollenumschalter, ohne Anmeldung. Es waren keine
echten Daten zu sehen, aber es hätte niemand bemerkt.

**Geändert:** In echter Produktion bricht der Start jetzt mit einer
klaren Meldung ab, statt umzuschalten. Der Rollenumschalter ist in jeder
gebauten Auslieferung inaktiv.

**Dabei habe ich mir selbst ein Bein gestellt** und es gehört in diesen
Bericht: Die Sperre hing zuerst an `NODE_ENV`. Das steht beim Bauen
*immer* auf `production` — der erste Build brach prompt ab. Jeder lokale
Build und jede CI wäre damit kaputt gewesen. Die Sperre hängt jetzt an
`VERCEL_ENV`, das nur Vercel selbst setzt.

### Befund 3 — Zehn Funktionen für `anon` ausführbar · **entschärft**

Funktionen bekommen in PostgreSQL standardmäßig `EXECUTE` für PUBLIC.
Dadurch standen zehn Funktionen auch nicht angemeldeten Aufrufern offen.

**Das war weniger schlimm als zunächst angenommen** — und das gehört
ebenso in den Bericht, weil ich es vorher schärfer formuliert hatte:
Sieben der zehn laufen als `security invoker`, dort greift RLS. Gemessen
liefern sie alle „permission denied". Gefährlich wäre nur
`security definer` ohne eigene Prüfung gewesen, und das traf auf keine zu.

`discard_unclaimed_company` ist `security definer`, löscht aber nur, wenn
**kein Login** an der Firma hängt **und** sie jünger als 15 Minuten ist.
Gegen eine echte Firma getestet: `false`, nichts gelöscht.

**Geändert in 0064:** Acht überflüssige Rechte entzogen, von 10 auf 5.
Offen bleiben nur `register_company` und `discard_unclaimed_company` —
beide braucht die Registrierung ohne Anmeldung — mit einem Kommentar an
der Funktion, warum das so ist.

### Befund 4 — Keine Security-Header · **behoben**

`next.config.mjs` enthielt nur `reactStrictMode`. Ergänzt: CSP,
HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`.

Die CSP ist an den echten Bedarf angepasst: Supabase über `connect-src`
inklusive `wss:` für Realtime, `'unsafe-inline'` für die
Hydration-Skripte von Next.js, `'unsafe-eval'` nur in der Entwicklung.

**Ungeprüft im Browser.** Der Build läuft, aber ob Plan, Anmeldung und
Auswertung mit dieser CSP vollständig funktionieren, ist noch nicht
belegt — siehe offene Punkte.

### Befund 5 — Protokoll fast leer · **behoben**

`audit_logs` gab es mit 12 Einträgen und genau einer Aktionsart
(`leave.approved`).

**Geändert in 0064:** Einheitliche Schreibfunktion `write_audit()` und
Trigger für Rollenwechsel, Aktivieren/Deaktivieren, Anlegen von Personen
sowie Anlegen und Löschen von Abwesenheiten.

Nachgewiesen: ein Rollenwechsel schreibt sofort
`employee.role_changed {"von": "employee", "nach": "shift_leader"}`.

**Bewusst nicht protokolliert** wird der Inhalt schutzbedürftiger Daten.
Dass jemand eine Krankmeldung erfasst hat, steht im Protokoll — die Notiz
dazu nicht.

---

## 3. Bestand nach allen Tests

| | |
|---|---|
| Firmen | 2 |
| Mitarbeiter | 100 |
| Abwesenheiten | 374 |
| Urlaubsanträge | 335 |
| Für `anon` ausführbare Funktionen | 10 → **5** |

Die Testrolle von Ingo Bachmann steht wieder auf `employee`, und im
Protokoll findet sich **kein** `employee.role_changed` und **kein**
`absence.created` — genau die hätten die Tests geschrieben. Der Rollback
hat also gehalten.

`npx tsc --noEmit` und `npx next build` laufen sauber.

---

## 4. Offene Punkte

1. **CSP im Browser prüfen.** Der Build sagt nichts darüber, ob die
   Richtlinie im Betrieb etwas blockiert. Vor der Produktion im
   Vorschau-Deployment durchklicken: Anmeldung, Schichtplan, Auswertung,
   Export. Eine zu strenge CSP, die den Plan leert, ist schlimmer als
   keine.
2. **Lösch- und Exportkonzept.** Noch nicht angefasst. Die
   Datenschutzerklärung sagt Auskunft, Herausgabe und Löschung zu;
   technisch gibt es dafür nichts. Bekannte Falle:
   `profiles.employee_id` ist `on delete set null` — beim Löschen einer
   Person verliert der Login stillschweigend seine Verknüpfung. Genau das
   ist in dieser Sitzung schon einmal passiert.
3. **Service-Role-Aufrufe.** `src/lib/auth/invite.ts` und
   `src/lib/supabase/server.ts` wurden gelesen, aber die Importkette bis
   zu jeder Client-Komponente ist nicht lückenlos nachverfolgt.
4. **`npm run lint` ist projektweit defekt**, seit `next lint` in Next 16
   entfallen ist. Vorbestehend, in diesem Durchgang **nicht ausgeführt**
   und nicht repariert.
5. **Sitzungsdauer.** Die automatische Abmeldung nach 30 Minuten
   (`sp_letzte_aktivitaet`) ist in der Datenschutzerklärung zugesagt, aber
   nicht gemessen worden.
6. **Betreiber-Rolle.** Die Seite `/plattform` und `platform_admins`
   wurden nicht gegen Missbrauch getestet.

---

## 5. Fachliche Entscheidungen für den Betrieb

1. **Sieht die Schichtgruppe künftig `A` statt `K`** — ist das für die
   Disposition ausreichend? Umkehrbar durch Entfernen einer einzigen
   `case`-Verzweigung in `0064`.
2. **Urlaub bleibt für Kollegen sichtbar.** Falls auch das zu viel ist,
   greift dieselbe Stelle.
3. **Wer darf das Protokoll lesen?** Derzeit nur die Administration des
   eigenen Unternehmens. Ein Betriebsrat hätte kein Leserecht.
