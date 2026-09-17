# Arbeitsauftrag: Security-, Datenschutz- und Production-Hardening

**Repository:** `refaitarek30-debug/Schichtplanung`
**Stand der Anwendung bei Auftragserteilung:** Migrationen bis `0063`, zwei
Unternehmen produktiv (Demo Chemie GmbH, Röhm GmbH), Live-Betrieb auf Vercel
mit Supabase-Projekt `ehmphogahhqytscdwtla`.

---

## 0. Bevor du irgendetwas änderst

Die Anwendung ist **weit entwickelt und produktiv**. Es arbeiten echte Daten
darin, und es gibt nur **eine** Datenbank – es existiert keine getrennte
Entwicklungsinstanz. Jede Migration, die du anwendest, wirkt sofort auf den
Live-Bestand.

**Harte Regeln, die über allem stehen:**

1. **Nichts neu bauen, was funktioniert.** Prüfe zuerst, ob es eine Funktion
   schon gibt. Parallele oder doppelte Logik ist ein Fehler, keine Lösung.
2. **Keine bestehende Funktionalität brechen.** Keine Seite, keine Rolle,
   keine Berechtigung, kein Datensatz darf verschwinden.
3. **Migrationen rückwärtskompatibel.** `add column if not exists` statt
   `create table`, neue Spalten mit Vorgabewert, keine Spalte umbenennen
   oder löschen, ohne dass der laufende Code sie nicht mehr braucht. Der
   alte Code muss nach der Migration weiterlaufen, denn Datenbank und
   Auslieferung sind nie exakt gleichzeitig aktuell.
4. **Jede Änderung an einer bestehenden Funktion zuerst begründen**, dann
   minimal-invasiv umsetzen.
5. **Destruktive Tests laufen in einer Transaktion**, die am Ende absichtlich
   abbricht (`do $$ … raise exception … $$`). Danach den Bestand nachzählen
   und in der Dokumentation belegen, dass er unverändert ist.
6. **Bei Unklarheit nicht raten.** Melde dich mit einer konkreten Frage.
7. **Entwicklung auf dem vereinbarten Branch.** Niemals ohne ausdrückliche
   Erlaubnis nach `main` pushen.

**Lies zuerst:**

- `PROJECT_STATUS.md` – enthält die Geschichte des Projekts, bekannte Fallen
  und die Architekturprinzipien. Insbesondere den Abschnitt zu
  `user` vs. `profile` und die Hinweise zum Testen von SQL-Migrationen.
- `supabase/migrations/` – 64 Dateien, chronologisch. `0002_rls.sql` ist die
  Grundlage der Mandantentrennung.
- `src/lib/supabase/` – Client, Server-Client, Konfiguration.
- `middleware.ts` – entscheidet, welche Pfade eine Sitzung voraussetzen.

---

## Phase 1 – Audit (nur lesen, nichts ändern)

Ziel: ein belastbares Bild, **bevor** irgendetwas angefasst wird. Das
Ergebnis dieser Phase ist ein Bericht, kein Code.

### 1.1 Mandantentrennung und RLS

Ausgangslage, die du verifizieren und vertiefen sollst: 23 Tabellen im
Schema `public`, **alle mit aktiviertem RLS**. Genau eine Tabelle hat RLS
aktiv, aber **keine einzige Policy**: `platform_admins`. Kläre, ob das
Absicht ist (dann gehört ein Kommentar an die Tabelle) oder eine Lücke.

Für **jede** Tabelle zu beantworten:

- Welche Policies gibt es je Kommando (`select`, `insert`, `update`,
  `delete`)? Fehlt ein Kommando, ist es standardmäßig verboten – prüfe, ob
  der Code das weiß.
- Enthält jede Policy eine Einschränkung auf `auth_company_id()`? Eine
  Policy ohne Mandantenbezug ist ein Befund, auch wenn sie sonst richtig
  aussieht.
- Haben `update`-Policies einen `with_check`? Ohne ihn kann eine Zeile aus
  dem eigenen Mandanten in einen fremden geschoben werden.
- Deckt sich die Policy mit dem, was die Oberfläche annimmt?

### 1.2 SECURITY DEFINER und Grants

Ausgangslage: **79 Funktionen mit `security definer`**, davon **0 ohne
gesetzten `search_path`** – das ist gut und muss so bleiben.

Kritischer Punkt, den du prüfen musst: **10 Funktionen sind für die Rolle
`anon` ausführbar**, also für nicht angemeldete Aufrufer:

```
calculate_leave_days, discard_unclaimed_company, effective_shift_id,
employees_absent_on, leave_block_for_range, leave_requests_check_overlap,
register_company, rotation_cycle_length, rotation_shift_for, shift_runs_on
```

Für jede dieser Funktionen zu klären:

- Ist der Zugriff für `anon` **fachlich nötig**? `register_company` ja –
  die Registrierung erfolgt ohne Anmeldung. `leave_requests_check_overlap`
  ist eine Trigger-Funktion und braucht überhaupt kein `EXECUTE`-Recht.
- Nimmt die Funktion eine `employee_id` oder ein Datum entgegen und liefert
  Daten zurück, ohne selbst `auth_company_id()` zu prüfen? Dann ist sie mit
  `security definer` ein **Datenleck**: RLS greift nicht, und der Aufrufer
  muss nur eine UUID erraten oder kennen. Prüfe insbesondere
  `employees_absent_on`, `effective_shift_id`, `calculate_leave_days` und
  `rotation_shift_for`.
- Entziehe überflüssige Rechte (`revoke execute … from anon`) statt die
  Funktion umzubauen, wo das reicht.

Ebenso zu prüfen: **83 Funktionen sind für `authenticated` ausführbar.**
Jede davon muss entweder selbst eine Berechtigungsprüfung enthalten
(`is_leadership()`, `is_admin()`, Vergleich mit `auth_company_id()`) oder
ausschließlich auf Daten arbeiten, die der Aufrufer ohnehin sehen darf.

Ebenfalls prüfen: `information_schema.role_table_grants` zeigt direkte
Tabellenrechte für `anon` und `authenticated`. Kläre, welche davon nötig
sind – bei einer Anwendung, die fast alles über RPC macht, sollten direkte
Schreibrechte die Ausnahme sein.

### 1.3 Rollen- und Cross-Tenant-Tests

Es gibt vier Rollen: `employee`, `shift_leader`, `admin` und die
Betreiber-Sicht (`platform_admins`, Seite `/plattform`).

Baue eine **wiederholbare Testmatrix**. Für jede Rolle und jede relevante
Tabelle/Funktion: darf lesen? darf schreiben? Und für jede Kombination
zusätzlich: **was passiert beim Zugriff auf einen fremden Mandanten?**

Der Cross-Tenant-Test ist der wichtigste Teil dieses Auftrags. Vorgehen:

```sql
perform set_config('request.jwt.claims',
  json_build_object('sub', <auth-uid>, 'role', 'authenticated')::text, true);
```

**Die Claims müssen innerhalb desselben DO-Blocks gesetzt werden**, sonst
erreichen sie die `security definer`-Funktionen nicht. Das ist in
`PROJECT_STATUS.md` dokumentiert und hat schon einmal Zeit gekostet.

Zu testen ist mindestens: ein Konto aus Unternehmen A versucht
Personaldaten, Schichtplan, Urlaubsanträge, Abwesenheiten, Qualifikationen
und Auswertungen aus Unternehmen B zu lesen und zu schreiben – direkt über
die Tabelle **und** über jede RPC, die eine ID entgegennimmt.

Jeder dieser Tests muss **fehlschlagen**. Ein Test, der nichts zurückgibt,
ist nicht dasselbe wie ein Test, der abgelehnt wird – unterscheide beides
im Bericht.

### 1.4 Krankheitsdaten

Krankheitsdaten sind Gesundheitsdaten nach Art. 9 DSGVO und brauchen die
engste Sichtbarkeit im ganzen System.

Aktueller Stand, den du prüfen und bewerten sollst: `shift_plan_grid()`
liefert für jeden Tag einen `absence_code`, darunter `K` für krank. Die
Funktion gibt Zeilen zurück für

- die Führung: **alle** Personen des Unternehmens,
- einen Mitarbeiter: sich selbst **und die gesamte eigene Schichtgruppe**.

Das heißt: **jeder Mitarbeiter sieht, an welchen Tagen seine elf
Kolleginnen und Kollegen krank waren** – über vier Wochen im Plan und über
den Export. Bewerte, ob das für den Betrieb nötig ist. Fachlich braucht die
Schichtgruppe die Information „dieser Platz ist unbesetzt", nicht den
Grund.

Prüfe außerdem:

- `absences.note` – ein Freitextfeld. Wer liest es? Steht dort etwas, das
  über die Tatsache der Abwesenheit hinausgeht?
- `absence_report()` und die Auswertungsseite: bekommt eine Schichtleitung
  personenscharfe Krankheitszahlen, und braucht sie die?
- Die Dashboard-Kachel „Krank gesamt" – ist sie auf die eigene Person
  begrenzt?
- Den Export im Schichtplan: welche Codes landen in der Datei?

### 1.5 Demo-Modus in Produktion

Das ist ein konkretes Risiko, kein theoretisches. In
`src/lib/supabase/config.ts` steht sinngemäß:

```ts
export const sessionMode: "demo" | "live" = isSupabaseConfigured ? "live" : "demo";
```

und in `app/(app)/layout.tsx` wird daraufhin `<SessionProvider mode="demo">`
gerendert. Der Demo-Modus hat einen **Rollenumschalter**
(`setRole` in `src/context/session.tsx`), mit dem sich jeder zur
Administration machen kann.

Das bedeutet: **fehlt in Produktion eine Umgebungsvariable, fällt die
Anwendung stillschweigend in den Demo-Modus** – mit frei wählbarer Rolle,
ohne Anmeldung. Es gibt zwar keine echten Daten zu sehen, aber es ist ein
Zustand, den eine produktive Anwendung nie einnehmen darf.

Audit: Wo überall wird auf `mode === "demo"` verzweigt? Was ist in diesem
Zustand erreichbar?

### 1.6 Service-Role-Zugriffe

`SUPABASE_SERVICE_ROLE_KEY` umgeht RLS vollständig. Er wird verwendet in:

- `src/lib/supabase/server.ts`
- `src/lib/auth/invite.ts`

Für jede Stelle zu klären:

- Läuft der Code **garantiert** nur serverseitig? Ein `"use server"` oder
  ein Server-Modul allein genügt nicht als Beweis – prüfe die Importkette
  bis zu jeder Client-Komponente.
- Wird vor dem Zugriff geprüft, **wer** ihn auslöst und **für welchen
  Mandanten**? Ein Service-Role-Client, der eine vom Aufrufer gelieferte ID
  ungeprüft benutzt, hebelt die gesamte Mandantentrennung aus.
- Ist der Schlüssel in `.env*`, in Logs oder in Fehlermeldungen sichtbar?

### 1.7 Audit-Logging

Die Tabelle `audit_logs` existiert bereits, enthält aber **12 Einträge mit
genau einer Aktionsart: `leave.approved`**. Das Gerüst steht, die Abdeckung
fehlt.

Erhebe: Welche Vorgänge sind protokollierwürdig, und welche davon werden
heute nicht erfasst? Mindestens zu erwarten: Rollenänderungen,
Anlegen/Deaktivieren von Personen, Zugriff auf Abwesenheiten,
Löschvorgänge, Änderungen an Urlaubskonten, Einladungen, Registrierung und
Verwerfen eines Unternehmens.

Prüfe auch: Wer darf `audit_logs` lesen? Wer darf schreiben? Ein
Protokoll, das der Protokollierte selbst ändern kann, ist keines.

### 1.8 Sitzung, Cookies, Security-Header

`next.config.mjs` enthält derzeit **keine** Header-Konfiguration:

```js
const nextConfig = { reactStrictMode: true };
```

Zu prüfen und zu bewerten: `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options` bzw. `frame-ancestors`,
`Permissions-Policy`.

Dazu die Sitzung selbst: Cookie-Flags (`HttpOnly`, `Secure`, `SameSite`),
die Sitzungsdauer, das Verhalten von `middleware.ts` bei abgelaufener
Sitzung, und ob die automatische Abmeldung nach 30 Minuten
(`sp_letzte_aktivitaet`, siehe Datenschutzerklärung) tatsächlich greift.

### 1.9 Löschung und Datenexport

Die Datenschutzerklärung (`app/(rechtliches)/datenschutz/page.tsx`) sagt
zu, dass Daten nach Vertragsende **herausgegeben oder gelöscht** werden und
dass Betroffene Auskunft und Löschung verlangen können. Technisch gibt es
dafür bislang nichts.

Erhebe in dieser Phase nur: Welche Tabellen enthalten personenbezogene
Daten? Welche Fremdschlüssel hängen daran, und mit welcher Löschregel
(`on delete cascade`, `set null`, `restrict`)? Achtung, hier gibt es eine
bekannte Falle: `profiles.employee_id` ist `on delete set null` – beim
Löschen einer Person verliert der zugehörige Login seine Verknüpfung
stillschweigend.

### Ergebnis Phase 1

Ein Bericht `docs/security-audit-<datum>.md` mit:

- einer Tabelle je Befund: **Fundort, Schwere, Wirkung, Empfehlung**,
- Schweregrade begründet, nicht geraten,
- einer klaren Trennung zwischen „belegt" und „vermutet",
- einer Liste der Fragen, die du **nicht** ohne fachliche Entscheidung
  klären kannst.

**Danach anhalten und den Bericht vorlegen.** Erst nach Freigabe Phase 2.

---

## Phase 2 – Umsetzung

Reihenfolge nach Schwere, nicht nach Bequemlichkeit. Jede Maßnahme einzeln
committen, damit sie einzeln zurückgenommen werden kann.

### 2.1 Mandantentrennung schließen

Fehlende Policies ergänzen, fehlende `with_check` nachrüsten, überflüssige
Grants entziehen. Jede Änderung mit einem Cross-Tenant-Test belegen, der
**vorher** fehlschlägt und **nachher** greift.

### 2.2 Krankheitsdaten minimieren

Vorschlag zur Umsetzung, den du bewerten und dann abstimmen sollst:

- Für Mitarbeiter, die **nicht** Führung sind, liefert `shift_plan_grid()`
  bei fremden Zeilen nur noch „abwesend" (`A`) statt der Art. Der eigene
  Eintrag bleibt vollständig sichtbar.
- Die Führung sieht weiterhin `K`, weil sie Ausfälle disponieren muss.
- `absences.note` wird auf Führung und die betroffene Person begrenzt.

**Das ist eine fachliche Entscheidung mit Auswirkung auf den Betrieb.**
Setze sie nicht ohne Rückfrage um, aber bereite sie vollständig vor.

### 2.3 Demo-Modus in Produktion hart abschalten

Der Demo-Modus darf ausschließlich in der Entwicklung erreichbar sein.
Umsetzung so, dass ein **fehlender Schlüssel in Produktion einen Fehler
auslöst statt eines stillen Rückfalls**. Ein Build oder Start ohne die
nötigen Umgebungsvariablen soll in Produktion scheitern, nicht
weiterlaufen.

Der Rollenumschalter darf in Produktion unter keinen Umständen erreichbar
sein – auch nicht, wenn jemand den Zustand im Browser manipuliert. Die
Berechtigung hängt ohnehin an `profiles.role` in der Datenbank; stelle
sicher, dass der Umschalter serverseitig folgenlos bleibt.

### 2.4 Service-Role absichern

Jeder Aufruf mit Service-Role erhält eine ausdrückliche Prüfung: Wer ruft
auf, welche Rolle, welcher Mandant. Wo möglich, ersetze den
Service-Role-Zugriff durch eine `security definer`-Funktion mit eigener
Prüfung – die ist enger und liegt näher an den Daten.

### 2.5 Audit-Logging vervollständigen

Einheitliche Schreibfunktion, damit das Protokoll überall gleich aussieht.
Erfasst werden mindestens die in 1.7 genannten Vorgänge, jeweils mit
handelnder Person, Mandant, Zeitpunkt, Aktion und betroffenem Objekt.

**Keine Inhalte protokollieren, die selbst schutzbedürftig sind** – dass
jemand eine Krankmeldung erfasst hat, gehört ins Protokoll, die Diagnose
nicht (die Anwendung speichert ohnehin keine).

`audit_logs` wird für Mandanten nur lesbar, nie änderbar.

### 2.6 Header und Sitzung

Security-Header in `next.config.mjs` ergänzen. Die CSP muss zu den
tatsächlich verwendeten Quellen passen – Supabase, Vercel, eingebundene
Schriften. **Erst im Vorschau-Deployment prüfen, ob die Anwendung damit
noch vollständig funktioniert**, bevor es nach Produktion geht. Eine zu
strenge CSP, die den Schichtplan leert, ist schlimmer als keine.

### 2.7 Löschung und Export vorbereiten

Technisch vorbereiten, nicht scharf schalten:

- Eine Funktion, die alle personenbezogenen Daten **einer Person** als
  strukturierten Export liefert (Art. 15 und 20 DSGVO).
- Eine Funktion, die alle Daten **eines Unternehmens** exportiert
  (Auftragsverarbeitungsvertrag, Vertragsende).
- Ein dokumentierter Löschweg je Fall, der die Fremdschlüssel in der
  richtigen Reihenfolge berücksichtigt und **vorher sagt, was er löschen
  wird**.

Beides zunächst ohne Oberfläche, nur als geprüfte Funktion mit
Berechtigungsprüfung.

---

## Phase 3 – Tests und Nachweis

- **Cross-Tenant-Testsuite** als wiederholbares SQL-Skript im Repository,
  das bei jedem Durchlauf beweist, dass kein Mandant an fremde Daten kommt.
- **Rollentests** je Rolle gegen jede geschützte Funktion.
- `npx tsc --noEmit` und `npx next build` müssen sauber durchlaufen.
- `npm run lint` ist **projektweit defekt**, seit `next lint` in Next 16
  entfallen ist. Das ist vorbestehend. Entweder auf ESLint direkt
  umstellen – dann als eigener Commit – oder im Bericht ausdrücklich als
  nicht ausgeführt kennzeichnen. **Nicht stillschweigend übergehen.**
- `get_advisors(security)` und `get_advisors(performance)` vorher und
  nachher, mit Gegenüberstellung.
- Für jede Verhaltensänderung ein Vorher-Nachher-Beleg aus der laufenden
  Datenbank.

---

## Phase 4 – Dokumentation

Am Ende ein Bericht mit genau diesen Punkten:

1. **Was wurde geprüft** – Umfang und Methode, auch das, was ohne Befund
   blieb.
2. **Was wurde geändert** – je Änderung: Datei bzw. Migration, Grund,
   Wirkung.
3. **Welche Datenbankänderungen** – Migrationsnummern und was sie tun.
4. **Testergebnisse** – die Cross-Tenant-Matrix als Tabelle, nicht als
   Fließtext.
5. **Verbleibende Risiken** – ausdrücklich benannt, mit Einschätzung,
   warum sie offen sind.
6. **Fachliche Entscheidungen**, die der Betrieb treffen muss.
7. **Was bewusst nicht gemacht wurde** und warum.

Ergänze `PROJECT_STATUS.md` um einen Abschnitt, der den Sicherheitsstand
beschreibt, damit der nächste Durchlauf nicht bei null anfängt.

---

## Abnahmekriterien

Der Auftrag gilt als erfüllt, wenn:

- kein Mandant über irgendeinen Weg an Daten eines anderen kommt, belegt
  durch die Testsuite,
- keine Funktion mehr für `anon` ausführbar ist, die es nicht sein muss,
- der Demo-Modus in Produktion nachweislich nicht erreichbar ist,
- Krankheitsdaten nur noch die Personen erreichen, die sie fachlich
  brauchen,
- jeder schutzbedürftige Vorgang im Protokoll steht,
- Build und Typecheck sauber sind,
- der Bericht vorliegt und die offenen Punkte ehrlich benennt.

**Ein Befund, der gefunden und offen dokumentiert wurde, ist ein Erfolg.
Ein Befund, der weggeräumt wurde, ohne dass jemand davon erfährt, ist ein
Fehler.**
