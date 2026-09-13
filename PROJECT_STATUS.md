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

## Stand nach Phase 1–9 (abgeschlossen, funktioniert, getestet)

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

- **Phase 8:** Urlaubstage werden nach dem TATSÄCHLICHEN Schichtplan
  gezählt (`calculate_leave_days_for_employee()`) statt stur Mo–Fr – wichtig,
  weil Schichtarbeiter am Wochenende arbeiten und dafür Urlaub nehmen müssen.
  Qualifikationen je Mitarbeiter als Enum-Array (Labor, Lager, Messwarte,
  Labor mit B-Schein, Anlagenfahrer), Mehrfachauswahl. `my_shift_leave()`
  zeigt jedem, wer aus der eigenen Schicht Urlaub hat (mit Namen, nur
  `leave_requests`, keine Krankheitsgründe). Dashboard-Begrüßung nutzt jetzt
  `profile.firstName` statt der Demo-Persona.

- **Phase 9:** Schichtgruppen A/B/C/D (`employees.rotation_team`) statt
  fester Schicht – im Rotationsbetrieb hat niemand eine feste Schicht.
  `rotation_offset_days` wird per Trigger automatisch aus der Gruppe
  abgeleitet und ist nicht mehr von Hand verstellbar. Mitarbeiter
  nachträglich bearbeitbar (`EditEmployeePanel`), erlaubt für Schichtleitung
  UND Admin – aber die Rollenvergabe bleibt Admin-only, erzwungen durch
  Trigger `employees_guard_role_change()`, nicht nur durch ausgegraute
  Felder. Mitarbeiter auch endgültig löschbar (`deleteEmployee()`, nur
  Admin, blockiert wenn noch ein Login existiert). `who_is_absent()` zeigt
  Admin/Schichtleitung im Kalender-Tagesdetail namentlich, wer fehlt.
  Qualifikation umbenannt zu `b_schein_verantwortlich`, Label gekürzt auf
  „B-Schein".

Alle neun Phasen sind im README unter „Sicherheitsprüfung" und
„Testanleitung" je Phase dokumentiert. Migrationen liegen unter
`supabase/migrations/`, Reihenfolge ist die Dateinummer (0001 → 0014).

## FALLE: `user` vs. `profile` im Session-Context

`useSession()` liefert BEIDES, und das ist eine echte Stolperfalle:
- `profile` = die echte angemeldete Person aus `profiles` (Live-Modus)
- `user` = eine **Demo-Persona** aus `demo-data.ts`, an der noch die
  Phase-1-Planungsansichten hängen

Für alles, was den angemeldeten Menschen betrifft (Name, Anrede, E-Mail,
Rolle), IMMER `profile` verwenden. `user.firstName` im Live-Modus zeigt den
falschen Namen – genau dieser Fehler steckte bis Phase 8 auf dem Dashboard.

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

## Phase 11–12 (September 2026) – Nachtrag

**Repo/Deployment aktuell:** GitHub `refaitarek30-debug/Schichtplanung`,
Vercel-Projekt `ready` (Scope `tarek-refai`), Supabase `ehmphogahhqytscdwtla`.
Der Hinweis weiter oben auf `refaitarek30-debug/ready` ist überholt.

**Aufgeräumt (0.20.0):** Der Code lag lange doppelt im Repo – einmal im
Wurzelverzeichnis, einmal unter `src/`. Der tote Zweig ist jetzt weg. Gültig
ist: Seiten unter `app/`, alles andere unter `src/` (`@/*` zeigt in
`tsconfig.json` auf `./src/*`). `tailwind.config.ts` durchsucht beide.
Bitte nicht wieder eine zweite Kopie anlegen.

**0.17.0** – Besetzungszeile „Ist/Min" je Schichtgruppe im Schichtplan (rot bei
Unterschreitung), Dashboard-Kacheln „Krank gesamt" und „V-Tage gesamt" statt
der Karte „Besetzung heute", Empfehlung Urlaub/V-Tag aus `suggest_leave_kind()`
im Urlaubsformular. Bugfix: `fetchMyLeaveBalance()` hatte die `v_*`-Spalten gar
nicht abgefragt, das V-Konto war deshalb immer 0.

**0.18.0** – Engpassliste auf `/besetzung` entfernt. „Mein Team" zeigt die
ganze Belegschaft nach Schichtgruppe mit Qualifikationen. Migration 0024:
`set_leave_for_day()` löst einen einzelnen Tag aus einem bestehenden Antrag
heraus, damit U→V umschaltbar ist. Migration 0025: Tabelle `announcements`,
gepflegt auf `/regeln`, angezeigt auf dem Dashboard zusammen mit aktiven
Urlaubssperren. Migration 0026: Jahresübertrag für Urlaub UND V-Tage,
Verfall am 31.03., angelegt beim ersten Zugriff über `ensure_leave_balance()`.

**0.18.1** – „Frei" im Schichtplan ist weiß statt rot.

**0.19.0** – PWA: `app/manifest.ts`, Icons und `sw.js` unter `public/`,
Registrierung im Root-Layout, Installationshinweis im AppShell. Der Service
Worker speichert bewusst KEINE Seiten zwischen (angemeldete, personenbezogene
Inhalte), nur `/_next/static/`, Bilder und die Offline-Seite.

**0.20.0** – Migration 0027: `decide_leave_request()` prüft beim Genehmigen
das Konto, das zur Art des Antrags gehört – V-Tag-Anträge gehen nicht mehr
durch, wenn die V-Tage aufgebraucht sind. Dazu der große Aufräumer: der tote
Verzeichnisbaum (`lib/`, `components/`, `context/`, `src/app/`), die beim
Hochladen im Wurzelverzeichnis gelandeten Dateien und die versehentlich
eingecheckten ZIP-Dateien sind entfernt – 123 Dateien.

**0.21.0** – Sicherheit, Feiertage, Aussehen.

- Migration 0028 schließt eine ausnutzbare Lücke: `handle_new_user()` hatte
  `company_id` und `role` aus den Client-Metadaten übernommen. Da der
  Anmelde-Endpunkt öffentlich ist, konnte sich jeder angemeldete Mitarbeiter
  ein zweites Konto als Administrator der eigenen Firma anlegen. Jetzt
  kommen Firma und Rolle aus `employees`, abgeglichen über die E-Mail.
  **Das steht und fällt mit der Bestätigungsmail** – siehe
  `supabase/email-templates/README.md`.
- Migration 0029/0030: Feiertage werden je Bundesland berechnet
  (`german_holidays()`, Ostern nach Gauß) und bei der Registrierung
  automatisch angelegt. Vorher standen nur elf Tage für 2027 in der
  Datenbank und die Urlaubsberechnung zählte Feiertage als Arbeitstage.
- Schriftart: die Anwendung lief ohne eigene Schrift
  (`const inter = { variable: "" }` war ein nie ausgefüllter Platzhalter).
  Jetzt IBM Plex Sans/Mono über `next/font`.
- Dunkelmodus: alle Farben liegen als RGB-Kanäle in `app/globals.css`,
  `tailwind.config.ts` nennt nur noch die Namen. Folgt der Systemeinstellung.
  Keine festen Hex-Werte mehr in Komponenten.
- Export: Monat oder Jahr, auf dem Handy über das Teilen-Menü.
- Schichtplan: Monat direkt anspringbar.

**0.22.0** – Aufräumen der Beispieldaten, automatische Verteilung auf
Urlaubs- und V-Tage vorbereitet (Migration 0031: `employees.shift_worker`,
`is_premium_day()`).

**0.23.0** – Migration 0032: `submit_leave_auto()` / `preview_leave_auto()`.
Der Mitarbeiter wählt nur den Zeitraum, das System verteilt: Sonn-, Feiertage
und Nächte auf Urlaub (dort hängen die Zuschläge), alles andere auf V-Tage.
Ist ein Konto leer, wandert der Rest auf das andere. Dazu: Schichten im
Urlaubskalender, dichtere Handy-Ansicht im Schichtplan, Dunkelmodus als
Schalter in den Einstellungen.

**0.24.0** – Migration 0033/0034: Jahreswechsel. Nicht genutzte Tage werden
übertragen und gelten bis zum 31.03., die Konten für das Folgejahr entstehen
automatisch, sobald jemand dorthin plant. `team_leave_balances()` zeigt der
Führung Rest-Urlaub und Rest-V-Tage je Mitarbeiter unter „Mein Team".
Kleinere Legende im Schichtplan.

**0.25.0** – Einladungen, die ankommen. Der Auslöser: „Mitarbeiter einladen"
endete in „Deine Sitzung ist abgelaufen", und es kam nie eine Mail an. Zwei
unabhängige Ursachen, beide behoben.

1. *Die Sitzung starb im Betrieb.* `createClient()` legte bei jedem Aufruf
   einen neuen Browser-Client an – 67 Stellen, jede mit eigenem Zeitgeber zum
   Erneuern des Tokens. Supabase dreht beim Erneuern das Token weiter und
   erklärt das alte für ungültig; die parallelen Zeitgeber haben sich
   gegenseitig abgeschossen („Refresh Token Not Found" im Auth-Protokoll,
   danach jedes Mal eine neue Anmeldung von Hand). Jetzt gibt es genau einen
   Client je Browser-Tab (`src/lib/supabase/client.ts`) und eine gemerkte
   Identität (`src/lib/supabase/identity.ts`) statt `getUser()` + Profil-
   Abfrage in jeder Datenfunktion. Das waren über 500 `/user`-Aufrufe je
   Stunde.
2. *Der Mailversand war nie eine verlässliche Zustellung.* Der eingebaute
   Versand von Supabase ist zum Ausprobieren gedacht: wenige Mails pro
   Stunde, je nach Projekt nur an Adressen des Projektteams. Deshalb hängt
   das Einrichten eines Zugangs nicht mehr daran. `grantAccess()` in
   `src/lib/auth/invite.ts` versucht die Mail **und** erzeugt immer einen
   Link, der über `generateLink` den rohen `hashed_token` nimmt und direkt
   auf `/auth/callback` zeigt. Der Link steht kopierbar über der
   Mitarbeiterliste (`InviteLinkCard`).

Dazu:

- `app/auth/callback/route.ts` kann jetzt alle drei Link-Sorten einlösen:
  `?code=` (im Browser begonnen), `?token_hash=` (auf dem Server erzeugt) und
  – über die neue Zwischenseite `app/auth/weiter` – die Angaben hinter dem
  Rautezeichen, die Supabase in seinen eigenen Mails mitschickt. Vorher
  konnte die Stelle nur die erste Sorte; jeder Klick in einer Einladungsmail
  wäre bei „Der Link ist ungültig" gelandet.
- Mitarbeiter anlegen richtet den Zugang gleich mit ein, wenn eine
  E-Mail-Adresse dabeisteht. Das „Einladen" hinterher war zu leicht zu
  übersehen.
- Für bestehende Zugänge gibt es „Neuer Zugangslink" – hilft, wenn jemand
  nicht mehr hereinkommt.
- `grantAccess()` steht bewusst in einer Datei **ohne** `"use server"`.
  Als Server-Aktion wäre sie aus dem Browser mit beliebigen Angaben
  aufrufbar gewesen und hätte Zugänge zu fremden Firmen erzeugt.

**Weiter offen:** Bestätigungsmail und eigener Mailversand in Supabase
einschalten (Anleitung liegt bei – jetzt Komfort, nicht mehr Voraussetzung),
E-Mail bei Urlaubsanträgen,
Einrichtungsweg für neue Firmen, Navigation zusammenlegen (Kalender in
Schichtplan, drei Verwaltungsseiten in eine), Demo-Modus ausbauen.
