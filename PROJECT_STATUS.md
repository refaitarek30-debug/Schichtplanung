# Projektstatus – für den nächsten Claude-Agenten

Diese Datei ist die Übergabe. Lies sie zuerst, bevor du irgendetwas änderst.
Das README.md daneben ist die Nutzerdokumentation (Einrichtung, Testanleitung,
Sicherheitsprüfung je Phase) – diese Datei hier ist der Arbeitsstand.

## Was das Projekt ist

Urlaubs- und Schichtplanungs-App für einen Produktionsbetrieb (Muster
Produktion GmbH), gedacht als mandantenfähiges SaaS. Next.js 16 / React 19 /
TypeScript / Tailwind / Supabase. Läuft **ohne** Supabase-Konfiguration im
Demo-Modus (Beispieldaten aus `src/lib/demo-data.ts`) und schaltet automatisch
auf echte Daten um, sobald `NEXT_PUBLIC_SUPABASE_URL` und
`NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind. Dieses Dual-Mode-Prinzip zieht
sich durch die ganze App – siehe „Architekturprinzip" unten, unbedingt
beibehalten.

## Stand nach Phase 1–7 (abgeschlossen, funktioniert, getestet)

- **Phase 1:** Designsystem, Rollenmodell, Navigation, Dashboard, Kalender,
  Urlaubsantrag mit Live-Besetzungsprüfung – alles auf Demo-Daten.
- **Phase 2:** Supabase-Anbindung, Anmeldung, Passwort-Reset, Profile, Rollen
  (`employee` / `shift_leader` / `admin`), Mandantentrennung über
  `company_id`, Row Level Security, geschützte Routen (Middleware +
  Server-Layout), Mitarbeiterübersicht auf echten Daten, Mitarbeiter anlegen
  + einladen.
- **Phase 3:** Urlaubskonto (`leave_balances_view`, berechnet, keine manuell
  änderbaren Spalten), Urlaubsanträge, serverseitige Tagesberechnung per
  Trigger (Client-Wert wird verworfen), atomare Genehmigung/Ablehnung gegen
  Race Conditions, Zurückziehen, Benachrichtigungstabelle.
- **Phase 4:** Echte Besetzungsberechnung (`staffing_snapshot`,
  `staffing_for_day`, `staffing_range`, `staffing_month_overview`,
  `check_leave_staffing_impact`, erweiterte `shift_leave_overlap`) als
  Postgres-Funktionen, live verdrahtet in Besetzungsseite, Kalender, Meine
  Schichten und im Genehmigungsbereich. Urlaubssperren (`staffing_rules`,
  Trigger blockiert Anträge serverseitig). Abwesenheiten erfassen/löschen.
  Benachrichtigungs-Glocke mit ungelesen-Status.
- **Phase 5:** Schichtrotation über `shift_assignments` – eine Zeile pro
  `(employee_id, date)` überschreibt für genau diesen Tag die feste
  Zuordnung. `effective_shift_id()` löst das auf, alle
  Besetzungsfunktionen aus Phase 4 nutzen sie automatisch (weicher
  Fallback, kein harter Schnitt). Verwaltung auf `/schichten`
  (Rotations-Editor, nur Führung).

- **Phase 6:** Rollierende Schichtmuster (`rotation_patterns`). Zyklus als
  Kette von Blöcken inkl. Freiblöcken (`shift: null`), Mitarbeitende hängen
  mit `rotation_offset_days` versetzt daran. `shift_assignments.shift_id` ist
  jetzt nullable = „ausdrücklich frei". `effective_shift_id()` löst die
  Rangfolge Ausnahme > Muster > feste Zuordnung auf; alle
  Besetzungsfunktionen aus Phase 4 profitieren automatisch.
  `my_shift_plan()` speist „Meine Schichten" – damit ist die in Phase 5
  notierte Lücke geschlossen.

- **Phase 7:** Selbstständige Firmenregistrierung (`register_company()`,
  einzige Funktion im Schema mit `anon`-Zugriff) über `/registrieren` –
  eine Website-Adresse für beliebig viele Unternehmen. Großer, klickbarer
  Kalender (`date-range-calendar.tsx`) ersetzt die kleinen nativen
  Datumsfelder im Urlaubsantrag, in Demo- und Live-Formular.

Alle sieben Phasen sind im README unter „Sicherheitsprüfung" und
„Testanleitung" je Phase dokumentiert. Migrationen liegen unter
`supabase/migrations/`, Reihenfolge ist die Dateinummer (0001 → 0013).

## WICHTIG: Vercel/GitHub-Chaos dieser Session – bitte lesen

Es gab in dieser Session sehr viel Verwirrung mit mehreren Vercel-Projekten
und sogar zwei verschiedenen GitHub-Konten. **Nur dieser eine Stand zählt:**

- GitHub: `refaitarek30-debug/ready`
- Vercel-Projekt: `ready`, Scope **`tarek-refai`** (NICHT `tarek-refai1` –
  sieht ähnlich aus, ist aber ein anderes Konto mit einem toten Projekt)
- Live-Domain: `https://ready-tarek-refai.vercel.app`
- Admin-Login: `refaitarek30@gmail.com`, Unternehmen inzwischen umbenannt
  zu „Röhm GmbH" (companies.id `43fc7bfa-8c8d-4210-94ea-8c1e7e3fd553`)

Alle anderen Vercel-Projekte (`schichtplaneer-claude`, `schichtplan-live_1`,
`schicht` unter `refaitarek7-max`) sind tot, ignorieren, nicht anfassen.

**Nach dieser Session muss der Nutzer den aktualisierten Code noch selbst
nach `refaitarek30-debug/ready` pushen** (git push, dann bei Vercel
automatisch neu bauen lassen oder manuell redeployen) – das SQL ist bereits
live in Supabase (Migrationen 0012 und 0013 direkt über den Connector
angewendet), aber der Next.js-Code aus dieser Session (Phase 7) lag zum
Sessionende nur lokal in der Sandbox vor.

**Diese Designentscheidung wurde in Phase 5 bereits umgesetzt** (nicht mehr
offen): Besetzung nutzt `effective_shift_id(employee_id, date)` –
`shift_assignments`, falls eine Zeile für den Tag existiert, sonst die feste
Zuordnung `employees.shift_id`. Kein harter Schnitt, wie ursprünglich hier
angekündigt.

## Was beim Testen dieser Session gefunden und behoben wurde

Diese Session hat `supabase/migrations/0007_shift_staffing.sql` nicht nur
gelesen, sondern **echt gegen eine lokale Postgres-16-Instanz getestet**
(siehe „So testest du SQL-Migrationen wirklich" unten – der Aufwand lohnt
sich, hier wurden vier reale Fehler gefunden, die beim bloßen Lesen
durchgerutscht wären):

1. `staffing_for_day`: Spaltenkonflikt durch `snap.*` in Kombination mit
   zusätzlichen Spalten (`s.id, s.name, snap.*` ergab mehr Spalten als die
   `RETURNS TABLE`-Signatur erlaubte).
2. `staffing_month_overview`: `generate_series(...)::date` lieferte
   `timestamp with time zone` statt `date` an der falschen Stelle im
   `RETURNS TABLE`.
3. Beide durch explizite Spaltenlisten statt `.*` und `::date`-Cast am
   richtigen Ort behoben.
4. **Sicherheitslücke:** Alle Berechtigungsprüfungen nutzten `<>` statt
   `IS DISTINCT FROM`. Bei `NULL` (z. B. eine Session ohne zugehörige
   `profiles`-Zeile) wertet `IF spalte <> NULL THEN` als *falsch* aus – die
   Prüfung hätte also gerade dann nicht ausgelöst, wenn sie am wichtigsten
   gewesen wäre. Zusätzlich fehlte `REVOKE EXECUTE FROM PUBLIC` – PostgreSQL
   vergibt `EXECUTE` auf neue Funktionen sonst automatisch an `PUBLIC`
   (in Supabase: auch an `anon`, also unangemeldete Zugriffe). Beides ist in
   `0007_shift_staffing.sql` Abschnitt 8 behoben, mit Regressionstest.

**Lehre für künftige Phasen:** bei jeder neuen `SECURITY DEFINER`-Funktion,
die eine eigene Berechtigungsprüfung statt RLS nutzt: `IS DISTINCT FROM`
statt `<>`/`=` bei sicherheitsrelevanten Vergleichen, und am Ende der
Migration `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO
authenticated` nicht vergessen.

## So testest du SQL-Migrationen wirklich (nicht nur lesen)

In dieser Sandbox ist `apt-get install postgresql` möglich
(`archive.ubuntu.com`/`security.ubuntu.com` sind erlaubte Netzwerk-Domains).
Kurzfassung, falls eine künftige Session das wiederholen will:

```bash
apt-get update && apt-get install -y postgresql postgresql-contrib
service postgresql start
su postgres -c "createdb schichtplan_test"
```

Dann Supabase minimal nachbauen (`auth`-Schema, `auth.users`-Tabelle,
`auth.uid()`-Funktion, die aus einer Session-Variable liest, eine
`authenticated`-Rolle mit `NOSUPERUSER NOLOGIN`), Migrationen der Reihe nach
mit `psql -v ON_ERROR_STOP=1 -f <datei>` einspielen, dann pro Test:

```sql
set role authenticated;
select set_config('request.jwt.claim.sub', '<uuid-des-testbenutzers>', false);
-- danach ganz normale Abfragen/RPC-Aufrufe, RLS greift wie in Supabase
```

Wichtig: **der Postgres-Dienst überlebt keine Sandbox-Pause zuverlässig**
(„down" nach einer Unterbrechung, obwohl die Daten auf der Platte erhalten
bleiben) – vor dem Weiterarbeiten immer erst `service postgresql start`
prüfen, sonst laufen Testabfragen mit einer alten, leeren Verbindung ins
Leere.

## Architekturprinzip, das für JEDE neue Phase gilt

1. **SQL zuerst.** Neue fachliche Logik (Berechnung, Prüfung, atomare
   Zustandsänderung) gehört in eine Postgres-Funktion, nicht in den Client.
   Grund: der Client ist nicht vertrauenswürdig, RLS+Funktionen sind die
   einzige echte Sicherheitsgrenze. Siehe `calculate_leave_days()` und
   `decide_leave_request()` in `0006_leave_workflow.sql`,
   `staffing_snapshot()` in `0007_shift_staffing.sql` als Vorbild.
2. **Zwei Pfade in jeder Seite.** `const { mode } = useSession()` und dann
   `mode === "live" ? <LiveComponent /> : <DemoComponent />`. Die
   Demo-Komponenten aus Phase 1 bleiben unverändert bestehen – niemals
   Demo-Code löschen oder umbauen, nur danebenstellen. Beispiel:
   `src/app/(app)/meine-schichten/page.tsx` (DemoView/LiveView nebeneinander).
3. **Lesen über den Browser-Client, Schreiben über Server Actions.**
   Muster: `src/lib/data/*.ts` (liest via `createClient()` aus
   `@/lib/supabase/client`, RLS greift automatisch) und
   `src/lib/auth/*-actions.ts` (Server Actions mit `"use server"`, nutzen
   `createClient()` aus `@/lib/supabase/server`). Nicht vermischen.
4. **`DataModeNotice`-Banner pflegen.** In
   `src/components/layout/data-mode-notice.tsx` steht `PLANNING_PATHS` –
   aktuell leer, weil nach Phase 4 keine Planungsseite mehr auf Demo-Daten
   läuft. Sobald eine künftige Phase eine neue Seite einführt, die zunächst
   nur teilweise live ist, den Pfad dort eintragen und nach Fertigstellung
   wieder entfernen.
5. **Typen für Supabase-Zeilen** kommen in
   `src/lib/supabase/database.types.ts` (Row-Typen + `Database`-Interface
   inkl. `Functions` für RPC-Signaturen). Eigene, vom Demo-Typ unabhängige
   Typen für „echte" Daten kommen nach `src/lib/types.ts` mit Präfix `Live…`
   (siehe `LiveLeaveRequest`, `LiveStaffingSnapshot`) – NICHT die Demo-Typen
   (`LeaveRequest`, `Employee` aus `demo-data.ts`) umbenennen oder erweitern,
   das würde Phase-1-Code brechen.
6. **Migrationsnummer weiterzählen**, nicht in bestehende Dateien schreiben.
   Nächste freie Nummer: `0008`.
7. **Bei neuen `SECURITY DEFINER`-Funktionen**: `IS DISTINCT FROM` statt
   `<>` bei Berechtigungsprüfungen, und `REVOKE EXECUTE ... FROM PUBLIC` /
   `GRANT EXECUTE ... TO authenticated` am Ende der Migration. Siehe Abschnitt
   oben – das ist keine Stilfrage, sondern in dieser Session eine echte
   Mandanten-Lücke gewesen.

## Bekannte, bewusste Lücken (nicht versehentlich vergessen)

- Kein eigener Detail-Dialog pro Urlaubsantrag (Infos stehen inline in der
  Listenzeile).
- Einladungs-Mail (`inviteEmployee` in `src/lib/auth/actions.ts`) braucht
  `SUPABASE_SERVICE_ROLE_KEY` – ungetestet ohne echtes Supabase-Projekt.
- Benachrichtigungen haben eine Glocke mit Liste und „gelesen"-Status, aber
  keine eigene Verwaltungsseite oder Filter.
- `shift_assignments` (datumsgenaue Zuordnung) bleibt unbefüllt – siehe
  Designentscheidung oben.
- „Mein Team" zeigt Mitarbeitenden (Rolle `employee`) im Live-Modus bewusst
  keine Kollegenliste mehr (RLS auf `employees` beschränkt Nicht-Führung auf
  die eigene Zeile, seit Phase 2) – Unterschied zum Demo-Modus, wo das
  Phase-1-Verhalten unverändert bleibt.
- „Drei Wochen im Überblick" auf „Meine Schichten" lädt die Besetzung Tag für
  Tag parallel (`Promise.all`), keine gebündelte Funktion dafür.
- Rotationsmuster lassen sich noch nicht über die Oberfläche anlegen oder
  bearbeiten – nur per SQL (`0010_seed_rotation.sql` als Vorlage) bzw. lesen.
  Datenschicht (`fetchRotationPatterns`, `rotation_preview`) ist vorhanden,
  ein Editor fehlt.
- Die Zuordnung Mitarbeiter → Muster/Versatz (`rotation_pattern_id`,
  `rotation_offset_days`) ist ebenfalls nur per SQL setzbar.

## Mögliche nächste Phase: Tauschbörse & Benachrichtigungs-UI

Kein vom Nutzer bestätigter Auftrag, nur eine Idee, falls gefragt wird, was
als Nächstes sinnvoll wäre (siehe auch README, Abschnitt „Nächste mögliche
Phase"):
1. Tauschbörse für Schichten (`shift_swap_requests`, ähnliches Muster wie
   `leave_requests`).
2. Eigene Verwaltungsseite für Benachrichtigungen.
3. „Meine Schichten" (Mitarbeiteransicht) um die eigene Rotationsausnahme
   ergänzen – wird aktuell nur in der Besetzungsberechnung berücksichtigt,
   nicht in der eigenen Tagesliste. Datenquelle existiert schon
   (`shift_assignments`, RLS erlaubt Mitarbeitenden das Lesen der eigenen
   Zeilen), es fehlt nur die Anzeige.

## Nützliche Befehle

```bash
npm install
npm run dev          # Demo-Modus, kein .env.local nötig
npm run typecheck    # npx tsc --noEmit
npm run build
```

Vor `npm run build` in der Sandbox: `Inter`-Font-Import kurz aus
`src/app/layout.tsx` entfernen (kein Zugriff auf fonts.googleapis.com),
danach zurückspielen. Für den Live-Modus-Build reichen Dummy-Werte für
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` als
Umgebungsvariablen beim Build-Aufruf.
