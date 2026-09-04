# Schichtplan – Urlaubs- und Schichtplanung

MVP für einen Produktionsbetrieb, angelegt als mandantenfähiges SaaS-Produkt.
Der Unterschied zu einem normalen Urlaubskalender: die Anwendung prüft bei jedem
Urlaubswunsch automatisch, ob die Mindestbesetzung der betroffenen Schicht hält.

- **Phase 1 (fertig)** – Designsystem, Rollenmodell, Navigation, Dashboard,
  Kalender, Urlaubsantrag mit Live-Besetzungsprüfung.
- **Phase 2 (fertig)** – Supabase, Anmeldung, Passwort-Reset, Profile, Rollen,
  Mandantentrennung, Row Level Security, geschützte Routen, Mitarbeiterübersicht
  auf echten Daten.
- **Phase 3 (fertig)** – Urlaubskonto, Urlaubsanträge und Genehmigungsworkflow
  vollständig in der Datenbank, mit atomarer Genehmigung und serverseitiger
  Tagesberechnung.
- **Phase 4 (nächste)** – Schichtzuordnung und automatische Besetzungsprüfung
  auf echten Daten.

## Schnellstart

```bash
npm install
cp .env.example .env.local     # ausfüllen – oder weglassen für den Demo-Modus
npm run dev
```

Ohne `.env.local` startet die Anwendung im **Demo-Modus**: keine Anmeldung, alle
Ansichten laufen auf Beispieldaten, oben rechts lässt sich die Rolle umschalten.
Sobald `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind,
schaltet die Anwendung automatisch auf echte Anmeldung und echte Daten um.

Weitere Befehle: `npm run build`, `npm run start`, `npm run typecheck`.

## Environment-Variablen

| Variable | Pflicht | Zweck |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja (Live-Modus) | Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja (Live-Modus) | öffentlicher Schlüssel, durch RLS abgesichert |
| `SUPABASE_SERVICE_ROLE_KEY` | nur für Einladungen | Auth-Admin-API, **ausschließlich serverseitig** |
| `NEXT_PUBLIC_SITE_URL` | optional | feste Basis-URL für Einladungs- und Passwortlinks |

Der Service-Role-Key wird nur in `src/lib/supabase/server.ts` gelesen und niemals
in Client-Code importiert. `.env.local` steht in `.gitignore`.

## Einrichtung Schritt für Schritt

1. **Supabase-Projekt erstellen** auf supabase.com, Region Frankfurt.
2. **SQL ausführen** im SQL-Editor, in dieser Reihenfolge:
   `0001_core.sql`, `0002_rls.sql`, `0003_planning.sql`,
   optional `0004_seed_demo.sql` für Beispieldaten, dann `0006_leave_workflow.sql`
   (Urlaubskonto, Anträge, Genehmigung – siehe Phase 3 unten),
   `0007_shift_staffing.sql` (echte Besetzung, Urlaubssperren – siehe Phase 4)
   `0008_shift_rotation.sql` (Schichtrotation – siehe Phase 5),
   `0009_rotation_patterns.sql` (rollierende Muster – siehe Phase 6),
   optional `0010_seed_rotation.sql` (fertiges 28-Tage-Muster als Beispiel)
   und zwingend `0011_harden_function_grants.sql` (Ausführungsrechte, siehe
   Kasten unten – ohne diese Migration sind die RPC-Funktionen unangemeldet
   aufrufbar).

> **Wichtig zu Ausführungsrechten in Supabase:** `REVOKE EXECUTE ... FROM
> PUBLIC` allein genügt nicht. Supabase vergibt `EXECUTE` zusätzlich direkt
> an die Rollen `anon` und `authenticated`; ein Entzug nur gegen `PUBLIC`
> lässt die Funktionen weiterhin unangemeldet über `/rest/v1/rpc/...`
> erreichbar. `0011_harden_function_grants.sql` entzieht deshalb gegen
> `anon` **und** `public` und berechtigt nur `authenticated` gezielt neu.
> Nach dem Einspielen prüfen: Supabase → Advisors → Security darf keine
> `anon_security_definer_function_executable`-Warnung mehr zeigen.
3. **Environment eintragen**: `.env.example` nach `.env.local` kopieren, URL und
   Anon Key aus *Project Settings → API* einsetzen.
4. **Anwendung starten**: `npm run dev`.
5. **Ersten Admin erstellen**: in Supabase unter *Authentication → Users* einen
   Benutzer anlegen (Auto Confirm an), dann in `supabase/migrations/0005_first_admin.sql`
   die E-Mail eintragen und das Skript ausführen.
6. **Testmitarbeiter erstellen**: entweder über den Seed aus Schritt 2 oder per
   `insert into employees (…)`. Die Einladung verschickt später die Anwendung.
7. **Login testen**: `/login` aufrufen, anmelden. Ohne Anmeldung leitet jede
   geschützte Route auf `/login?weiter=…` um.

Für Passwort- und Einladungslinks unter *Authentication → URL Configuration*
`http://localhost:3000/auth/callback` (und die Produktions-URL) als Redirect-URL
eintragen.

## Aufbau

```
middleware.ts               Session-Refresh + Routenschutz (erste Verteidigungslinie)
src/
  app/
    (auth)/                 Anmeldebereich ohne Sidebar
      login/                Login-Formular
      passwort-vergessen/   Reset-Link anfordern
      passwort-neu/         neues Passwort setzen
    auth/callback/          tauscht Einladungs-/Reset-Code gegen Session
    (app)/                  angemeldeter Bereich, serverseitig geschützt
      dashboard, kalender, urlaub, meine-schichten,
      besetzung, urlaubsantraege, antraege (Alias), mitarbeiter,
      schichten, regeln, einstellungen, profil
  components/
    layout/                 Sidebar, mobile Navigation, Topbar, Modus-Hinweis
    ui/                     Card, Badge, Button, Input, Alert, Skeleton, EmptyState
    dashboard/ calendar/ leave/
  context/session.tsx       Session im Client: Rolle, Profil, Unternehmen
  lib/
    supabase/               Client (Browser), Server, Middleware, Konfiguration, Typen
    auth/                   Server-Session und Server Actions
    data/employees.ts       Mitarbeiterzugriff mit Demo-Fallback
    staffing.ts             Besetzungsprüfung (unverändert aus Phase 1)
    errors.ts               technische Fehler → verständliche Sätze
supabase/migrations/        0001 Kern · 0002 RLS · 0003 Planung · 0004 Seed · 0005 Admin
                             0006 Urlaubskonto, Anträge, Genehmigung (Phase 3)
```

Neu in Phase 3:

```
src/lib/
  leave-days.ts              Arbeitstage-Vorschau im Client (spiegelt calculate_leave_days())
  data/leave.ts               Lesezugriffe: eigene Anträge, Führungsansicht, Urlaubskonto, Überschneidung
  auth/leave-actions.ts       Server Actions: beantragen, zurückziehen, genehmigen/ablehnen
src/components/leave/
  live-leave-request-form.tsx Antragsformular mit Live-Prüfung gegen echtes Kontingent
  live-balance-card.tsx       Urlaubskonto aus leave_balances_view
  live-request-list.tsx       eigene Anträge inkl. Zurückziehen mit Bestätigung
  review-panel.tsx            Genehmigungsbereich: Suche, Filter, Genehmigen, Ablehnen mit Grund
```

## Datenmodell

`companies` → `shifts` → `employees` → `profiles` (1:1 zu `auth.users`).

Bewusst getrennt: **`employees`** sind Personalstammdaten und existieren auch ohne
Login. **`profiles`** ist der angemeldete Benutzer und verweist über `employee_id`
auf den Stammsatz. Dadurch lassen sich Mitarbeiter anlegen, lange bevor sie einen
Zugang bekommen. Jede Tabelle trägt `company_id`; darauf setzt die Mandantentrennung auf.

Vorbereitet für Phase 3/4: `leave_balances`, `leave_requests`, `absences`,
`holidays`, `staffing_rules`, `announcements`, `shift_assignments` sowie
`audit_logs` für die spätere Protokollierung (wer hat genehmigt, wer hat geändert).

## Sicherheit

Drei Ebenen, absichtlich getrennt:

1. **Middleware** – ohne Session Umleitung auf `/login`. Nutzt `getUser()`, das
   das Token gegen Supabase prüft, nicht das Cookie.
2. **Server-Layout** – `(app)/layout.tsx` lädt das Profil serverseitig und leitet
   um, wenn keins existiert oder das Konto deaktiviert ist.
3. **Row Level Security** – die eigentliche Grenze. Selbst mit gültigem Token und
   direktem API-Zugriff liefert die Datenbank nur Zeilen des eigenen Unternehmens.

Durchgespielte Fälle:

| Frage | Ergebnis |
| --- | --- |
| Sieht Mitarbeiter A die Personaldaten von B? | Nein. `employees`-Select erlaubt nur den eigenen Satz; Führung sieht das Unternehmen. |
| Sieht Unternehmen A Daten von Unternehmen B? | Nein. Jede Policy vergleicht `company_id = auth_company_id()`. |
| Kann ein Employee Admin-Funktionen aufrufen? | Nein. Schreibpolicies verlangen `is_admin()`; die Buttons sind zusätzlich ausgeblendet. |
| Kann ein Schichtleiter Unternehmensdaten ändern? | Nein. `companies`-Update ist auf Admins beschränkt. |
| Kann ein Mitarbeiter sich selbst zum Admin machen? | Nein. Die Update-Policy auf `profiles` erzwingt unveränderte `role`, `company_id` und `active`. |
| Kommt ein Ausgeloggter ans Dashboard? | Nein – Middleware, Layout und RLS greifen unabhängig voneinander. |
| Sind die Schlüssel sicher? | Anon Key ist öffentlich und durch RLS gedeckt; der Service-Role-Key wird nur serverseitig gelesen. |
| Funktioniert Session-Ablauf? | Die Middleware erneuert Tokens; schlägt das fehl, folgt die Umleitung auf `/login`. |

Bewusste Entscheidung: Namen und Rollen der Kolleginnen und Kollegen sind innerhalb
des Unternehmens lesbar (`profiles`-Select), weil Kalender und Schichtübersicht sie
brauchen. Gründe von Abwesenheiten sind es nicht – die sieht nur die Führung.

Auf Next.js 16 aktualisiert; die in Next 14 gemeldete Middleware-Schwachstelle ist
damit ausgeschlossen. Das ist relevant, weil die Middleware hier Teil des Auth-Wegs ist.

## Phase 3 – Urlaubskonto, Urlaubsanträge, Genehmigungsworkflow

### Wie die Berechnung funktioniert

`requested_days` wird **niemals** aus dem Client übernommen. Der Trigger
`leave_requests_compute_days` (vor jedem Insert/Update von `start_date`,
`end_date`, `half_day_period`) rechnet den Wert serverseitig über
`calculate_leave_days()` neu: Wochenenden fallen raus, `holidays` des
Unternehmens (oder unternehmensübergreifende Einträge mit `company_id is null`)
werden abgezogen, ein halber Tag zählt nur bei einem eintägigen Antrag als 0,5.
Das Formular zeigt vorab dieselbe Rechnung über `src/lib/leave-days.ts` –
das ist reine UX, nicht die Quelle der Wahrheit.

`remaining_days` steht nirgends als Spalte, die man versehentlich verstellen
könnte. `leave_balances_view` berechnet es live aus `entitlement + carried_over
- used_days - planned_days - pending_days`, wobei `used_days` bereits
vergangene genehmigte Anträge zählt und `planned_days` künftige – exakt wie
`leaveBalance()` in `src/lib/staffing.ts`, nur serverseitig verbindlich.

### Genehmigen, Ablehnen, Zurückziehen – atomar

Alle drei laufen ausschließlich über Postgres-Funktionen
(`decide_leave_request`, `withdraw_leave_request`), nicht über direkte
UPDATEs. Jede Funktion aktualisiert mit `where status = 'pending'` – das ist
in Postgres eine einzige atomare Anweisung. Klicken zwei Schichtleiter
gleichzeitig auf "Genehmigen", gewinnt eine Transaktion; die zweite bekommt
null betroffene Zeilen und damit den Fehler „Der Antrag wurde bereits
entschieden.“ statt eines stillen doppelten Verbrauchs. `decide_leave_request`
prüft vor dem Genehmigen zusätzlich `remaining_days >= 0`, damit ein Antrag im
Rennfall nicht genehmigt wird, wenn das Kontingent zwischenzeitlich nicht mehr
reicht. Beide Funktionen schreiben in `audit_logs` und `notifications`.

### Was noch Demo-Daten sind

Angemeldet laufen **Urlaubskonto, Urlaubsanträge und der Genehmigungsworkflow
bereits vollständig auf echten Supabase-Daten** – das ist der komplette
Workflow aus Abschnitt „Abschluss“ der Phase-3-Spezifikation. Was weiterhin
Beispieldaten zeigt (mit Hinweisbanner): die Besetzungs-Heatmap auf Kalender
und Besetzungsseite sowie „Meine Schichten“, weil die konkrete
Schichtzuordnung erst in Phase 4 real abgebildet wird. Der Kalender zeigt
darunter zusätzlich eine echte Liste der eigenen bzw. unternehmensweiten
Urlaubsanträge.

### Bekannte Einschränkungen

- **Kein eigener Detail-Dialog pro Antrag.** Zeitraum, Tage, Kommentar,
  Ablehnungsgrund und Status stehen direkt in der Listenzeile – funktional
  identisch zu einer Detailansicht, nur ohne eigene Route.
- **Überschneidungsprüfung ist bewusst einfach.** `shift_leave_overlap()`
  zählt Kolleginnen und Kollegen derselben Schicht mit sich überschneidendem
  Urlaub, prüft aber noch nicht gegen die tatsächliche Mindestbesetzung –
  das kommt mit der echten Schichtzuordnung in Phase 4/5, wie in der
  Spezifikation vorgesehen.
- **Urlaubssperren** sind als Konzept vorbereitbar über `staffing_rules`
  (aus Phase 2), aber in Phase 3 noch nicht mit dem Antragsformular verknüpft.
- **Benachrichtigungen** landen in der `notifications`-Tabelle inklusive RLS,
  haben aber noch keine eigene Oberfläche (kein Glöckchen-Dropdown mit
  echten Einträgen) – das war laut Spezifikation für Phase 3 auch nur
  „vorzubereiten“, nicht vollständig umzusetzen.

### Testanleitung

Mit `0004_seed_demo.sql` eingespielten Daten und mindestens zwei Logins
(ein `employee`, ein `shift_leader` oder `admin` derselben Firma):

| # | Schritt | Erwartung |
| - | --- | --- |
| 1 | Als Mitarbeiter Mo–Fr beantragen | 5 Urlaubstage |
| 2 | Mo–So beantragen | 5 Urlaubstage (Wochenende zählt nicht) |
| 3 | Zeitraum über einen Feiertag auf einem Werktag beantragen | ein Tag weniger als die reine Werktagszahl |
| 4 | Antrag über mehr Tage als `remaining_days` stellen | Formular blockiert den Absenden-Button, Server lehnt zusätzlich ab |
| 5 | Antrag absenden | Status `pending`, taucht sofort in „Meine Anträge“ auf |
| 6 | Als Führung öffnen und genehmigen | Status `approved`, `reviewed_by`/`reviewed_at` gesetzt, Urlaubskonto aktualisiert sich |
| 7 | Anderen Antrag ablehnen ohne Grund | Blockiert mit Fehlermeldung |
| 8 | Ablehnen mit Grund | Status `rejected`, Mitarbeiter sieht den Grund |
| 9 | Als Mitarbeiter eigenen `pending`-Antrag zurückziehen | Bestätigungsdialog, danach Status `withdrawn` |
| 10 | Denselben Antrag zweimal in zwei Tabs gleichzeitig genehmigen | eine Tab meldet Erfolg, die andere „bereits entschieden“ |
| 11 | Mit zweitem Unternehmen aus `0004_seed_demo.sql` einloggen | sieht keine Anträge des ersten Unternehmens |

### Sicherheitsprüfung Phase 3

| Frage | Ergebnis |
| --- | --- |
| Kann ein Mitarbeiter fremde Anträge lesen? | Nein – `leave_requests`-Select verlangt `employee_id = auth_employee_id()` oder Führungsrolle. |
| Kann ein Mitarbeiter einen fremden Antrag genehmigen/ablehnen/zurückziehen? | Nein – beide Funktionen prüfen `is_leadership()` bzw. `employee_id = auth_employee_id()` vor dem UPDATE. |
| Kann sich ein Mitarbeiter selbst mehr Urlaubstage geben? | Nein – `leave_balances` ist nur für Admin beschreibbar; `remaining_days` ist ohnehin eine berechnete View, keine Spalte. |
| Kann der Client die Tagesanzahl manipulieren? | Nein – der Trigger überschreibt `requested_days` serverseitig unabhängig vom gesendeten Wert. |
| Verhindert die Datenbank doppelte Genehmigung? | Ja – atomares `UPDATE … WHERE status = 'pending'`, geprüft in Testfall 10. |
| Bleibt die Mandantentrennung gewahrt? | Ja – jede Funktion und jede Policy vergleicht zusätzlich `company_id = auth_company_id()`. |
| Muss eine Ablehnung begründet werden? | Ja – sowohl ein Check Constraint (`rejection_reason_required`) als auch die Funktion selbst verlangen einen nicht-leeren Grund. |

## Phase 4 – Schichtzuordnung, Schichtplanung, automatische Besetzungsprüfung

### Wie die Besetzung berechnet wird

Bewusste Designentscheidung: Besetzung läuft **nicht** über `shift_assignments`
(datumsgenaue Zuordnung) – die Tabelle bleibt für eine spätere Rotationsplanung
vorbereitet, aber leer. Stattdessen zählt für jeden Tag, an dem eine Schicht
läuft (`shifts.weekdays`, abzüglich Feiertagen), einfach jeder aktive
Mitarbeiter mit `employees.shift_id = <Schicht>` als zugeordnet, minus
genehmigtem Urlaub und erfassten Abwesenheiten an diesem Tag. Das ist exakt
dieselbe Logik wie `employeesOfShift()`/`staffingFor()` aus der Phase-1-Demo,
nur jetzt als Postgres-Funktionen:

- `staffing_snapshot(shift_id, date)` – eine Schicht, ein Tag.
- `staffing_for_day(company_id, date)` / `staffing_range(company_id, from, days)`
  – alle Schichten eines oder mehrerer Tage in einem Aufruf (Besetzungsband,
  Engpassliste).
- `staffing_month_overview(company_id, year, month)` – schlechtester Status je
  Tag, für die Kalender-Heatmap, ohne 31 Einzelabfragen.
- `check_leave_staffing_impact(employee_id, start, end)` – rechnet die
  antragstellende Person testweise als abwesend ein (wie `checkLeaveImpact()`
  aus Phase 1), Tag für Tag.
- `shift_leave_overlap(employee_id, start, end)` – fasst das für die
  Live-Prüfung im Antragsformular zusammen: Anzahl überschneidender
  Kolleginnen/Kollegen, Anzahl kritischer Tage, schlechtester Status.

### Warum einige dieser Funktionen `SECURITY DEFINER` sind

`absences` und `leave_requests` sind per RLS für normale Mitarbeitende auf die
eigenen Zeilen beschränkt – der Grund einer Abwesenheit bleibt privat. Für die
reine Besetzungszahl ("wie viele sind da") ist das zu eng: eine Schichtleitung
muss die ganze Schicht sehen, ein Mitarbeiter braucht beim Beantragen
zumindest die Gesamtzahl überschneidender Abwesenheiten. Die sechs Funktionen
oben sind deshalb `SECURITY DEFINER` und übernehmen die Berechtigungsprüfung
**selbst** (`auth_company_id()`, `is_leadership()`), statt sich auf RLS zu
verlassen – sie geben aber ausschließlich aggregierte Zahlen zurück, nie
einzelne Mitarbeiter-IDs oder Abwesenheitsgründe.

Zwei Härtungen, die sich erst beim Testen gegen eine echte Datenbank gezeigt
haben (siehe „Wie das getestet wurde" unten):

1. Alle Berechtigungsprüfungen verwenden `IS DISTINCT FROM` statt `<>`. Bei
   `<>` wertet `IF ... THEN` eine `NULL`-Bedingung als *falsch* aus – bei
   einer Session ohne zugehörige `profiles`-Zeile (z. B. während einer
   Deaktivierung) wäre `auth_company_id()` `NULL`, und `spalte <> NULL`
   ergibt ebenfalls `NULL`, wodurch die Prüfung stillschweigend durchgelassen
   worden wäre. `IS DISTINCT FROM` liefert immer ein echtes `true`/`false`.
2. `EXECUTE` auf alle sechs Funktionen ist explizit von `PUBLIC` entzogen und
   nur an `authenticated` vergeben. PostgreSQL gewährt `EXECUTE` auf neue
   Funktionen sonst standardmäßig an `PUBLIC` – in Supabase schließt das die
   Rolle `anon` ein, also unangemeldete Zugriffe über die REST/RPC-Schnittstelle.

### Urlaubssperren

Nutzen die schon in Phase 2 angelegte `staffing_rules`-Tabelle
(`key = 'urlaubssperre'`, `value = {"start", "end", "reason"}`,
`shift_id = null` bedeutet unternehmensweit). Ein Trigger
(`leave_requests_check_block`) prüft bei jedem Insert/Update von
Start-/Enddatum gegen `leave_block_for_range()` und lehnt den Antrag mit dem
hinterlegten Grund ab – serverseitig, nicht nur im Formular. Verwaltung unter
„Regeln" → „Urlaubssperren" (nur Admin legt an/entfernt, alle im Unternehmen
sehen die Liste).

### Was neu dazugekommen ist

```
supabase/migrations/0007_shift_staffing.sql   Besetzungsfunktionen, Urlaubssperren-Trigger, Rechte-Härtung
src/lib/
  data/staffing.ts          Besetzung lesen (staffing_for_day, staffing_range, staffing_month_overview, …)
  data/absences.ts          Abwesenheiten lesen (RLS: eigene bzw. Führung sieht alle)
  auth/absence-actions.ts   Abwesenheit erfassen/löschen (Führung)
  data/staffing-rules.ts    Urlaubssperren lesen
  auth/staffing-rule-actions.ts  Urlaubssperren anlegen/löschen (Admin)
  data/notifications.ts     Benachrichtigungen lesen, als gelesen markieren
src/components/
  dashboard/live-coverage-strip.tsx   Besetzungsband mit echten Daten
  calendar/live-month-calendar.tsx    Kalender mit echten Ampeln (Führung) bzw. eigenen Anträgen (Mitarbeiter)
  leave/add-absence-form.tsx          Abwesenheit erfassen (Besetzungsseite)
  leave/leave-blocks-card.tsx         Urlaubssperren verwalten (Regeln-Seite)
  layout/notification-bell.tsx        Glocke mit echten, ungelesen markierten Benachrichtigungen
```

Live umgestellt: `/besetzung`, `/kalender`, `/meine-schichten` sowie die
Besetzungsprüfung im Genehmigungsbereich (`/urlaubsanträge`) vor dem
Genehmigen/Ablehnen. Der `DataModeNotice`-Hinweis für „noch Demo-Daten" ist
damit für alle Planungsseiten leer – nur der generelle Demo-Modus-Hinweis
(ganz ohne Supabase-Konfiguration) bleibt bestehen.

### Bekannte Einschränkungen

- **„Mein Team" zeigt Mitarbeitenden im Live-Modus keine Kollegenliste mehr.**
  Die `employees`-Tabelle ist per RLS für Nicht-Führung auf die eigene Zeile
  beschränkt (seit Phase 2, bewusst so gebaut). Der Demo-Modus zeigt das Team
  weiterhin wie in Phase 1 – ein echter Unterschied zwischen den Modi, keine
  vergessene Anbindung.
- **`shift_assignments` bleibt leer.** Rotationsplanung (wer arbeitet an
  welchem konkreten Tag in welcher Schicht, abweichend von der festen
  Zuordnung) ist nicht Teil von Phase 4.
- **„Drei Wochen im Überblick" auf „Meine Schichten"** lädt die Besetzung
  Tag für Tag parallel (`Promise.all`) statt in einem Aufruf – bei sehr vielen
  gleichzeitigen Nutzern ließe sich das mit einer eigenen
  `staffing_snapshot_range(shift_id, …)`-Funktion bündeln.
- **Benachrichtigungen** haben eine Glocke mit Liste und „gelesen"-Status,
  aber keine eigene Verwaltungsseite oder Filter.

### Testanleitung

Mit `0004_seed_demo.sql`-Daten und mindestens drei Logins (zwei `employee`
derselben Schicht, ein `shift_leader` oder `admin`):

| # | Schritt | Erwartung |
| - | --- | --- |
| 1 | Besetzungsseite als Führung öffnen | Besetzungsband und Engpassliste zeigen echte Zahlen aus `employees`/`leave_requests`/`absences` |
| 2 | Abwesenheit („Krankheit") für einen Mitarbeiter erfassen | Besetzung an dem Tag sinkt sofort um 1 |
| 3 | Kalender als Führung öffnen, Monat mit Engpass ansehen | Tag ist rot/gelb markiert, Tagesdetail zeigt present/target/minimum je Schicht |
| 4 | Kalender als Mitarbeiter öffnen | keine Ampelfarben, nur eigene Urlaubstage markiert |
| 5 | „Meine Schichten" als Mitarbeiter öffnen | eigene nächste Schichttage, Besetzung der eigenen Schicht, kein Kollegenzugriff über RLS hinaus |
| 6 | Urlaubsantrag stellen, der die Mindestbesetzung reißen würde | Formular zeigt „Mindestbesetzung wird unterschritten." vor dem Absenden |
| 7 | Als Führung denselben Antrag öffnen | Genehmigungsbereich zeigt dieselbe Warnung mit betroffenen Tagen, bevor entschieden wird |
| 8 | Urlaubssperre unter „Regeln" anlegen (z. B. Weihnachten) | Antrag in diesem Zeitraum wird sofort mit Grund abgelehnt |
| 9 | Genehmigten Antrag beobachten | Benachrichtigungsglocke zeigt neuen Eintrag, Punkt verschwindet nach Öffnen |
| 10 | Mitarbeiter aus zweitem Unternehmen versucht, Besetzung des ersten abzurufen | RPC lehnt mit „Du hast keine Berechtigung für diesen Bereich." ab |

### Sicherheitsprüfung Phase 4

Alle Zeilen wurden **tatsächlich gegen eine lokale Postgres-16-Instanz mit
nachgebautem Supabase-Umfeld** geprüft (echtes `auth.users`/`auth.uid()`,
echte `authenticated`-Rolle, echte RLS-Auswertung), nicht nur gelesen.

| Frage | Ergebnis |
| --- | --- |
| Sieht ein Mitarbeiter die Besetzung des ganzen Unternehmens? | Nein – `staffing_for_day`/`staffing_range`/`staffing_month_overview` verlangen `is_leadership()`. |
| Sieht ein Mitarbeiter die eigene Schichtbesetzung? | Ja, bewusst – aggregierte Zahl, keine Namen; entspricht dem Phase-1-Verhalten im Antragsformular. |
| Kann Unternehmen B die Besetzung von Unternehmen A abrufen? | Nein – jede Funktion vergleicht `company_id` gegen `auth_company_id()`, getestet mit einem zweiten Unternehmen. |
| Kann eine Session ohne `profiles`-Zeile (z. B. während Deaktivierung) die Prüfung umgehen? | Nein mehr – das war ein echter, beim Testen gefundener Fehler (`<>` statt `IS DISTINCT FROM`), jetzt behoben und regressionsgetestet. |
| Kann `anon` (unangemeldet) diese Funktionen überhaupt aufrufen? | Nein – `EXECUTE` ist von `PUBLIC` entzogen, nur `authenticated` hat es. |
| Blockiert eine Urlaubssperre zuverlässig, auch bei direktem Insert? | Ja – der Trigger sitzt auf der Tabelle, nicht im Frontend, getestet mit direktem `INSERT`. |
| Bleiben Ampel-Übergänge (7/7 → 6/7 → 5/7) korrekt? | Ja, mit echten genehmigten Anträgen durchgespielt. |
| Wird eine echte Race-Condition (zwei Genehmigungen gleichzeitig) weiterhin verhindert? | Ja – unverändert aus Phase 3, durch die Phase-4-Härtung nicht angetastet. |

## Phase 5 – Schichtrotation

### Wie es funktioniert

`shift_assignments` (seit Phase 2 angelegt, bis jetzt ungenutzt) bekommt
Bedeutung: eine Zeile für `(employee_id, date)` überschreibt für genau diesen
Tag die feste Zuordnung `employees.shift_id`. Die Postgres-Funktion
`effective_shift_id(employee_id, date)` löst das auf – erst
`shift_assignments`, sonst die feste Zuordnung. Alle Besetzungsfunktionen aus
Phase 4 (`staffing_snapshot`, `check_leave_staffing_impact`, …) nutzen sie
jetzt automatisch; kein harter Schnitt, sondern ein weicher Fallback, wie in
Phase 4 schon angekündigt.

- `assign_shift(employee_id, shift_id, date)` – setzt oder ersetzt eine
  Ausnahme (Upsert über `unique (employee_id, date)`), prüft, dass Mitarbeiter
  und Schicht zum selben Unternehmen gehören. Die eigentliche Berechtigung
  (nur Führung) erzwingt weiterhin RLS auf `shift_assignments`, nicht die
  Funktion selbst – bewusst `SECURITY INVOKER`, weil hier (anders als bei den
  aggregierenden Besetzungsfunktionen) kein Grund besteht, RLS zu umgehen.
- `shift_assignments_for_range(company_id, from, to)` – Übersicht mit
  aufgelöstem Namen, für die Rotationsverwaltung. `SECURITY DEFINER`, nur
  Führung.

### Was neu dazugekommen ist

```
supabase/migrations/0008_shift_rotation.sql
src/lib/data/rotation.ts            Zuordnungen eines Zeitraums lesen
src/lib/auth/rotation-actions.ts    zuordnen / entfernen
src/components/leave/rotation-editor.tsx   Verwaltung auf /schichten
```

`/schichten` zeigt jetzt im Live-Modus echte Zahlen (Zugeordnet/Soll/Mindest
aus `fetchShiftDetails()`/`fetchEmployees()`) statt Demo-Daten, plus den
Rotations-Editor darunter.

### Beim Testen gefunden

Zwei „Fehler", die sich beim genauen Hinsehen als Testdaten-Lücken
herausstellten, nicht als echte Bugs: ein Testmitarbeiter ohne zugehörige
`profiles`-Zeile bekam „Mitarbeiter oder Schicht nicht gefunden" statt einer
Berechtigungsmeldung – das ist tatsächlich RLS, die korrekt greift (kein
Profil → `auth_employee_id()` ist `NULL` → die Zeile ist für diese Session
unsichtbar), nur die Fehlermeldung ist unspezifisch. Mit einem echten Profil
verhielt sich alles wie erwartet. Gut zu wissen für den nächsten Test: immer
zuerst prüfen, ob der Testbenutzer eine vollständige Profil-Zeile hat, bevor
man ein unerwartetes Ergebnis als Bug einstuft.

### Testanleitung

| # | Schritt | Erwartung |
| - | --- | --- |
| 1 | Besetzung eines Tages ohne Ausnahme prüfen | zeigt die Zahlen der festen Zuordnung |
| 2 | Unter „Schichten" eine Mitarbeiterin für einen Tag einer anderen Schicht zuweisen | Herkunftsschicht sinkt an diesem Tag um 1, Zielschicht steigt um 1 |
| 3 | Denselben Tag noch einmal für dieselbe Person zuweisen (andere Schicht) | ersetzt die Zuordnung, keine doppelte Zeile |
| 4 | Anderer Tag ohne Zuordnung ansehen | unverändert, feste Zuordnung gilt weiter |
| 5 | Die umgeteilte Person prüft ihren eigenen Urlaub am Zuordnungstag | Live-Prüfung nutzt die neue Schicht, nicht die alte |
| 6 | Mitarbeiter (nicht Führung) versucht, sich selbst zuzuteilen | RLS blockiert |
| 7 | Zuordnung löschen | Zahlen kehren zur festen Zuordnung zurück |
| 8 | Admin von Unternehmen B versucht, für Unternehmen A zuzuteilen | scheitert, weil der Mitarbeiter für diese Session unsichtbar ist (RLS) |

### Sicherheitsprüfung Phase 5

Wieder echt gegen die lokale Postgres-Instanz getestet, nicht nur gelesen.

| Frage | Ergebnis |
| --- | --- |
| Kann ein Mitarbeiter sich selbst umteilen? | Nein – RLS auf `shift_assignments` verlangt Führung. |
| Kann Unternehmen B Mitarbeiter von Unternehmen A umteilen? | Nein – `assign_shift()` findet den fremden Mitarbeiter über RLS gar nicht erst. |
| Sieht ein Mitarbeiter die Rotationsübersicht anderer? | Nein – `shift_assignments_for_range()` verlangt `is_leadership()`. |
| Wirkt sich eine Ausnahme korrekt auf beide betroffenen Schichten aus? | Ja, geprüft: Herkunft −1, Ziel +1, am selben Tag. |
| Bleiben andere Tage unberührt? | Ja. |
| Übernimmt die Live-Urlaubsprüfung die neue Zuordnung? | Ja, Tag für Tag aufgelöst, nicht nur einmalig zu Beginn des Zeitraums. |

## Nächste mögliche Phase – Tauschbörse & Benachrichtigungs-UI

1. Mitarbeitende bieten eigene Schichttage zum Tausch an (neue Tabelle,
   z. B. `shift_swap_requests`), Führung bestätigt oder lehnt ab – ähnliches
   Muster wie `leave_requests`.
2. Eigene Verwaltungsseite für Benachrichtigungen (Filter, „alle als gelesen
   markieren", Einstellungen je Benachrichtigungstyp).
3. „Meine Schichten" so erweitern, dass eine eigene Rotationsausnahme auch
   in der Mitarbeiteransicht sichtbar wird (aktuell nur in der
   Besetzungsberechnung berücksichtigt, nicht in der eigenen Tagesliste).


## Phase 6 – Rollierende Schichtmuster (4-Schicht-Rotation)

### Das Muster

Abgebildet ist ein real gefahrenes 4-Schicht-Modell, das sich aus zwei
überlagerten Ketten ergibt:

- **Schichtfolge:** Früh → Spät → Nacht → Frei (wiederholt sich)
- **Blocklängen:** 2 → 2 → 3 Tage (wiederholt sich)

Weil 4 und 3 teilerfremd sind, ergeben sich 12 Blöcke = **28 Tage Zyklus**,
und jeder Schichttyp bekommt exakt 7 Tage pro Zyklus. Vier Teams fahren
dasselbe Muster mit 0/7/14/21 Tagen Versatz – dann ist an jedem Tag jede
Arbeitsschicht besetzt.

### Wie es gespeichert ist

`rotation_patterns` beschreibt den Zyklus als Kette von Blöcken:

```json
[{"shift": "<uuid>", "days": 2}, {"shift": null, "days": 2}, …]
```

`shift: null` ist ein **Freiblock**. `anchor_date` ist der Tag, an dem
Position 0 liegt; `employees.rotation_offset_days` verschiebt einzelne
Personen im Zyklus. Die Zykluslänge ist einfach die Summe aller `days` –
das Muster ist damit frei konfigurierbar, nicht auf 28 Tage festgenagelt.

### „Frei" ist jetzt ein echter Zustand

`shift_assignments.shift_id` ist nullable geworden. Das klingt nach einem
Detail, ist aber der Kern: eine Zeile mit `NULL` heißt **ausdrücklich frei**
und überschreibt auch ein Rotationsmuster, während eine *fehlende* Zeile
„keine Ausnahme" heißt. Ohne diese Unterscheidung könnte das System einen
geplanten freien Tag nicht von einem noch nicht eingeplanten Tag trennen.

Die Rangfolge löst `effective_shift_id(employee, date)` auf:

1. Tagesausnahme aus `shift_assignments` (kann „frei" sein)
2. Rotationsmuster, falls die Person eines hat (kann „frei" sein)
3. feste Zuordnung `employees.shift_id`

Alle Besetzungsfunktionen aus Phase 4 nutzen diese Funktion – die Rotation
wirkt sich also automatisch auf Besetzungsband, Kalenderampel, Engpassliste
und die Urlaubsprüfung aus, ohne dass dort etwas geändert werden musste.

### Neue Funktionen

- `rotation_shift_for(employee, date)` – was sagt das Muster für diesen Tag?
- `my_shift_plan(from, days)` – eigener Plan Tag für Tag, inklusive Freitagen.
  „Meine Schichten" zeigt damit endlich den tatsächlichen Plan statt einer
  festen Wochentagsannahme (das war die offene Lücke aus Phase 5).
- `rotation_preview(pattern, offset, from, days)` – Muster durchrechnen, auch
  wenn noch niemand daran hängt.

### Testanleitung

| # | Schritt | Erwartung |
| - | --- | --- |
| 1 | `0010_seed_rotation.sql` ausführen | Muster mit Zykluslänge 28 wird angelegt, Mitarbeitende auf 4 Teams verteilt |
| 2 | „Meine Schichten" öffnen | wechselnde Schichten je Tag statt einer festen; Karte „Nächste freie Tage" erscheint |
| 3 | Besetzungsseite ansehen | jede Arbeitsschicht ist an jedem Tag besetzt |
| 4 | Einen Tag per Rotations-Editor auf eine andere Schicht setzen | überschreibt das Muster nur für diesen Tag |
| 5 | Denselben Tag auf „frei" setzen | Person fällt an diesem Tag aus der Besetzung, Muster bleibt sonst unberührt |
| 6 | 28 Tage weiterblättern | Muster wiederholt sich exakt |

### Sicherheitsprüfung Phase 6

| Frage | Ergebnis |
| --- | --- |
| Sieht ein Mitarbeiter nur den eigenen Plan? | Ja – `my_shift_plan()` liest ausschließlich `auth_employee_id()`, kein Parameter für fremde Personen. |
| Kann ein fremdes Unternehmen ein Muster durchrechnen? | Nein – `rotation_preview()` prüft `company_id` gegen `auth_company_id()`, getestet. |
| Kann ein Mitarbeiter Muster ändern? | Nein – RLS auf `rotation_patterns` erlaubt Schreiben nur Admins. |
| Sind die neuen Funktionen für `anon` aufrufbar? | Nein – `EXECUTE` von `PUBLIC` entzogen, nur `authenticated`. |
| Überschreibt eine Tagesausnahme das Muster zuverlässig? | Ja, inklusive des Falls „ausdrücklich frei", getestet. |
| Stimmt das Muster mit dem realen Plan überein? | Ja – 42 Tage (28.12.2026–07.02.2027) Tag für Tag gegen den vorgegebenen Plan geprüft, lückenlos deckungsgleich. |

## Phase 7 – Mehrere Unternehmen, größerer Kalender

### Selbstständige Firmenregistrierung

Bisher wurde jedes Unternehmen (samt erstem Admin) von Hand per SQL angelegt.
Neu: eine öffentliche Seite **`/registrieren`**, über die sich ein neues
Unternehmen komplett selbstständig einrichtet – eine einzige Website-Adresse
für beliebig viele Firmen, mit vollständig getrennten Daten pro Firma.

**Wie es funktioniert:**

1. `register_company(name, vorname, nachname, email)` – eine Postgres-
   Funktion, die als einzige im ganzen Schema für `anon` freigegeben ist
   (bewusste, eng begrenzte Ausnahme). Legt `companies` + `employees`
   (Rolle `admin`) an und gibt beide IDs zurück.
2. Der Client ruft danach `supabase.auth.signUp()` auf, mit `company_id`
   und `employee_id` in den User-Metadaten.
3. Der bereits vorhandene Trigger `handle_new_user()` (aus Phase 2) liest
   diese Metadaten und legt automatisch das passende `profiles`-Profil an
   – exakt derselbe Mechanismus wie beim Einladen einzelner Mitarbeiter,
   kein neuer Code dafür nötig.

**Warum das die Mandantentrennung nicht gefährdet:** `register_company()`
erzeugt nur eine komplett neue, leere `company_id`. Alle bestehenden
RLS-Policies (`company_id = auth_company_id()`) greifen für das neue
Unternehmen genauso wie für jedes andere – echt getestet: eine frisch
registrierte Firma sieht nach dem Login ausschließlich sich selbst, nicht
die Mitarbeiter oder Daten anderer Unternehmen.

**Bekannte Einschränkung:** Schlägt `signUp()` nach erfolgreichem
`register_company()` fehl (z. B. E-Mail bereits vergeben), bleibt eine
„verwaiste" Firma mit einem Mitarbeiter ohne Login zurück. Für den Start
unkritisch (nur ungenutzte Zeilen, kein Sicherheitsproblem), aber ein Punkt
für später: entweder in einer Transaktion zusammenfassen oder verwaiste
Firmen nach einer Frist automatisch aufräumen. Ebenfalls offen: keine
Absicherung gegen automatisiertes Massen-Registrieren (Captcha o. Ä.).

### Größerer Kalender bei der Urlaubsauswahl

`src/components/leave/date-range-calendar.tsx` – eine große, klickbare
Monatsansicht ersetzt die kleinen nativen Datumsfelder im Urlaubsantrag
(Demo- und Live-Formular). Erster Klick setzt den Start, zweiter Klick
vervollständigt den Zeitraum; ein Klick vor dem Start tauscht automatisch
Start und Ende.

### Sicherheitsprüfung Phase 7

| Frage | Ergebnis |
| --- | --- |
| Kann `anon` außer `register_company()` noch etwas anderes aufrufen? | Nein – getestet, alle anderen Funktionen liefern „permission denied". |
| Sieht eine neu registrierte Firma Daten anderer Unternehmen? | Nein – mit einer zweiten, frisch registrierten Firma gegen die bestehende Testfirma geprüft: 0 fremde Mitarbeiter, 0 fremde Firmen sichtbar. |
| Kann sich jemand als Mitarbeiter einer fremden, bereits bestehenden Firma registrieren? | Nein – `register_company()` legt immer eine neue `company_id` an, es gibt keinen Parameter, um sich einer bestehenden Firma anzuschließen. |

## Phase 8 – Qualifikationen, schichtgerechte Urlaubstage, Schichturlaub

### Urlaubstage zählen jetzt nach dem echten Schichtplan

**Das war ein echter Rechenfehler, kein Wunsch:** Bisher wurden Urlaubstage
immer Montag–Freitag gezählt, Wochenenden nie. Für Bürobetrieb korrekt, für
Schichtbetrieb falsch – wer nach dem 4-Schicht-Muster am Samstag und Sonntag
eingeteilt ist, hätte diese Tage geschenkt bekommen.

Neu rechnet `calculate_leave_days_for_employee()` nach dem tatsächlichen Plan:
gezählt wird jeder Tag, an dem die Person laut effektiver Zuordnung
(Tagesausnahme → Rotationsmuster → feste Zuordnung) arbeiten würde.
Freitage aus dem Muster und Feiertage zählen nicht. Personen ganz ohne
Schichtzuordnung behalten das bisherige Mo–Fr-Verhalten.

Belegt durch Tests gegen eine echte Datenbank:

| Fall | Ergebnis |
| --- | --- |
| Arbeits-Wochenende (Sa+So Spätschicht) beantragt | 2 Urlaubstage (vorher: 0) |
| Zeitraum mit echtem Feiertag | Feiertag zählt weiterhin nicht |
| Mitarbeiter ohne Schicht/Muster, Mo–So beantragt | 5 Tage, unverändertes Verhalten |
| Zeitraum ganz ohne eingeplanten Arbeitstag | Antrag wird mit klarer Meldung abgelehnt |

### Qualifikationen (Mehrfachauswahl)

`employees.qualifications` (Postgres-Enum-Array): Labor, Lager, Messwarte,
Labor mit B-Schein, Anlagenfahrer. Als Checkboxen im Formular „Mitarbeiter
anlegen", als Badges in der Mitarbeiterliste. Serverseitig werden nur bekannte
Werte übernommen (`parseQualifications()`), beliebige Strings aus dem FormData
werden verworfen. GIN-Index vorhanden – Grundlage für spätere Regeln wie
„mindestens ein Anlagenfahrer je Schicht".

### Urlaub in der eigenen Schicht sichtbar

`my_shift_leave(von, bis)` zeigt jeder Person mit Namen, wer aus der eigenen
Schicht bzw. Rotationsgruppe im Zeitraum Urlaub hat (genehmigt und offen).
Eingebunden auf „Kalender" und „Meine Schichten".

Bewusst **nicht** enthalten: Abwesenheiten aus `absences` (Krankheit,
Schulung). Deren Grund bleibt der Führung vorbehalten – die Funktion liest
ausschließlich `leave_requests`.

### Dashboard zeigt den echten Namen

Behobener Fehler: die Begrüßung auf der Startseite nutzte `user.firstName` –
und `user` ist im Session-Context fest mit einer **Demo-Person** verknüpft.
Im Live-Modus stand dort also der falsche Name. Jetzt `profile.firstName`
(echtes Profil aus `profiles`). Restliche Oberfläche wurde auf dasselbe
Muster geprüft, Topbar und Sidebar waren bereits korrekt.

### Sicherheitsprüfung Phase 8

| Frage | Ergebnis |
| --- | --- |
| Sieht jemand Urlaub aus einer fremden Schicht? | Nein – `my_shift_leave()` filtert auf gleiche `shift_id` oder gleiches `rotation_pattern_id`, getestet. |
| Sieht ein fremdes Unternehmen etwas? | Nein – zusätzlich `company_id = auth_company_id()`, mit zweiter Firma getestet: 0 Treffer. |
| Kommt jemand ohne Personalstammsatz an die Daten? | Nein – Funktion bricht mit Berechtigungsfehler ab. |
| Sind die neuen Funktionen für `anon` erreichbar? | Nein – `EXECUTE` gegen `public` **und** `anon` entzogen. |
| Kann über das Formular eine unbekannte Qualifikation gesetzt werden? | Nein – serverseitige Positivliste, unbekannte Werte werden verworfen. |

## Phase 9 (Fortsetzung) – Löschen, „Wer fehlt heute"

### Mitarbeiter endgültig löschen

Bisher gab es nur „Deaktivieren". Neu: `deleteEmployee()`, ausschließlich
Admin. Sicherheitsbremse eingebaut: hat die Person bereits einen Login
(eine Zeile in `profiles`), wird das Löschen verweigert – `profiles.employee_id`
verweist per `ON DELETE SET NULL` auf die Mitarbeiterzeile, ein Hard-Delete
würde den Zugang sonst als Karteileiche ohne Personalstammsatz
zurücklassen. Erst deaktivieren bzw. Zugang entfernen, dann löschen.
Bestätigungsdialog in der Liste, da endgültig.

### „Wer fehlt heute" im Kalender, mit Namen

`who_is_absent(datum)` – zeigt Admin und Schichtleitung direkt in der
Tagesansicht des Kalenders, wer an diesem Tag fehlt: Name, Schicht, Grund
(Urlaub/Krankheit/Schulung/Sonstiges). Fasst genehmigten Urlaub und
`absences` zusammen. Getestet mit dem Grenzfall, dass eine Person am
selben Tag beides hat (Urlaub *und* Krankmeldung) – beides wird korrekt
angezeigt, nichts verschluckt.

### Befund zur Wochenend-Meldung

Direkt in der Produktivdatenbank nachgerechnet (nicht nur behauptet): für
den 5./6.9.2026 sind alle drei Schichten korrekt besetzt (Teams B/C/D
arbeiten Früh/Spät/Nacht, Team A hat laut Rotation frei). Der ursprüngliche
Eindruck „keine Mitarbeiter hinterlegt" kam vermutlich von einer veralteten,
nicht vollständig hochgeladenen Version des Codes.

## Phase 10 – Schichtplan-Matrix

Neue Seite `/schichtplan`: die gewohnte Excel-artige Übersicht.
Zeilen = Mitarbeiter, gruppiert nach Schichtgruppe A–D. Spalten = Tage.
Zellen zeigen das Kürzel (F/S/N), Freitage bleiben leer, Abwesenheiten
überlagern die Schicht.

| Kürzel | Bedeutung |
| --- | --- |
| F / S / N | Früh- / Spät- / Nachtschicht |
| U | Urlaub (genehmigt) |
| u | Urlaub beantragt, noch offen |
| K | Krank |
| FB | Schulung |
| (leer) | frei laut Rotationsmuster |

`shift_plan_grid(company_id, von, tage)` liefert die komplette Matrix in
**einem** Aufruf – bei 50 Personen × 28 Tagen wären es sonst 1400
Einzelabfragen.

**Bearbeiten nur für Schichtleitung und Admin:** Ein Klick auf eine Zelle
öffnet die Auswahl (Schicht zuweisen, auf Frei setzen, Krank, Schulung).
Mitarbeitende sehen dieselbe Matrix, können aber nichts anklicken – und die
Datenbank lässt Änderungen ohnehin nur mit Führungsrolle zu, das Ausblenden
der Klickfläche ist nur die freundliche Variante davon.
