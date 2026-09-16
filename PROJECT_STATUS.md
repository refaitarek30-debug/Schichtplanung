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

**0.25.1** – `tsconfig.json` prüft nur noch `app/`, `src/` (ohne das tote
`src/app/`), `middleware.ts` und `tailwind.config.ts`. Vorher stand dort
`**/*.ts` – also wirklich jede Datei im Repo, auch die, die beim Hochladen
über die GitHub-Oberfläche versehentlich im Wurzelverzeichnis landen. Genau
daran sind an einem Tag vier Builds gescheitert: eine verirrte `client.ts`
neben `package.json` sucht ihr `./config` direkt daneben, findet nichts, und
der Typcheck bricht ab, obwohl die Datei von keiner Zeile der Anwendung
benutzt wird. Jetzt kann solcher Streuverlust den Build nicht mehr umwerfen –
er wird einfach ignoriert. Aufräumen sollte man trotzdem.

**Weiter offen:** Bestätigungsmail und eigener Mailversand in Supabase
einschalten (Anleitung liegt bei – jetzt Komfort, nicht mehr Voraussetzung),
E-Mail bei Urlaubsanträgen,
Einrichtungsweg für neue Firmen, Navigation zusammenlegen (Kalender in
Schichtplan, drei Verwaltungsseiten in eine), Demo-Modus ausbauen.

---

## 0.26 – Drei stille Fehler aus dem Betrieb

Alle drei waren in den Supabase-Logs sichtbar, aber nicht als Absturz: die
Anwendung hat in jedem Fall etwas anderes angezeigt, statt zu melden, dass
sie gerade keine Antwort bekommt.

**Urlaub ohne Schichtzuordnung** (`0038_workday_without_shift.sql`).
`preview_leave_auto()` und `submit_leave_auto()` haben jeden Tag
übersprungen, an dem `effective_shift_id()` null liefert. Wer keiner Schicht
und keinem Rotationsmuster zugeordnet ist – Verwaltung, Betriebsleitung und
**jeder frisch eingeladene Mitarbeiter, der noch keine Schicht hat** – hatte
damit nie einen Arbeitstag. Im Formular stand „In diesem Zeitraum hast du
keinen eingeplanten Arbeitstag" und der Knopf blieb grau; Urlaub war für
diese Personen gar nicht beantragbar. Der vorhandene Zweig
`if not e.shift_worker then art := 'urlaub'` war nie erreichbar.
`calculate_leave_days_for_employee()` kannte den Fall längst und rechnete
Montag bis Freitag ohne Feiertage – die beiden Stellen widersprachen sich.
Diese Regel heißt jetzt `is_planned_workday()` und wird in Vorschau,
Einreichung und Empfehlung gleich verwendet. `suggest_leave_kind()` hat
„freier Tag" ebenfalls allein daran festgemacht, dass keine Schicht
hinterlegt ist, und empfiehlt ohne Schichtsystem jetzt Urlaub statt V-Tage
(die es dort nicht gibt).

Nebenbefund: `current_rotation_pattern()` ist seit `0019` bei **jedem**
Aufruf mit `column reference "id" is ambiguous` abgebrochen – der
Rückgabespalte `id` stand ein unqualifiziertes `select id from shifts`
gegenüber. Der Mustereditor hat den Fehler stillschweigend abgefangen und
deshalb immer leer geöffnet, statt das vorhandene Muster zu zeigen.

**Mitteilungen** (`0039_announcements_columns_and_role_sync.sql`).
`0003` hat `announcements` ohne `active` und `updated_at` angelegt. `0025`
wollte die Tabelle mit beiden Spalten anlegen, benutzt aber
`create table if not exists` – die Tabelle gab es schon, also passierte
nichts. Die Anwendung fragt seither `select … active … where active = true`
ab und bekommt 400 zurück. Auf der Regeln-Seite stand „Die Daten konnten
nicht geladen werden.", auf dem Dashboard blieben die Mitteilungen still
leer; in 24 Stunden 105 fehlgeschlagene Abrufe. Der Trigger
`announcements_updated_at` existierte ebenfalls schon und hätte jedes UPDATE
mit „record new has no field updated_at" abgebrochen – Zurückziehen einer
Mitteilung war also auch kaputt. Drei seit Tagen gespeicherte Mitteilungen
sind jetzt sichtbar.

*Lehre für künftige Migrationen:* `create table if not exists` ist kein
Ersatz für `alter table … add column if not exists`. Eine Tabelle, die es in
einer früheren Migration schon gibt, nimmt keine neuen Spalten an.

**Rolle ohne Wirkung** (dieselbe Migration). Geprüft wird überall
`profiles.role` (`auth_role`, `is_admin`, `is_leadership`), geändert wird in
der Mitarbeiterverwaltung aber `employees.role` – `updateEmployee()` fasst
`profiles` nie an. Wer in der Liste auf „Administrator" gestellt wurde,
blieb deshalb ohne Adminrechte: die Oberfläche zeigte eine Rolle, die es in
der Berechtigung nicht gab. Der neue Trigger `employees_sync_profile_role`
zieht das Profil nach und lässt Rollenwechsel nur durch die Administration
zu (`auth.uid() is not null and not is_admin()` → Abbruch); ohne
angemeldeten Nutzer, also bei Wartung per SQL, greift die Bremse bewusst
nicht. Die Triggerfunktion ist aus der REST-Schnittstelle entzogen, sonst
meldet der Linter sie zu Recht als anonym aufrufbare SECURITY DEFINER-
Funktion.

**Demo-Konten (Demo Chemie GmbH).** Drei Zugänge, alle bestätigt:

| Konto | Rolle | Person |
|---|---|---|
| `admin@demo-chemie.de` | Admin | Sabine Wagner, Betriebsleitung |
| `admin2@demo-chemie.de` | Admin | Thomas Keller, Betriebsleitung |
| `mitarbeiter@demo-chemie.de` | Mitarbeiter | Jonas Brandt, Produktion |

Jonas Brandt stand auf `employees.role = 'admin'`, ohne dass die Berechtigung
je gefolgt wäre (siehe oben) – er ist wieder Mitarbeiter, damit die Demo
beide Sichten zeigt.

**Advisor nach den Migrationen:** keine neue Warnung. Die bestehenden
`SECURITY DEFINER`-Meldungen sind die absichtlichen RLS-Helfer.
`auth_leaked_password_protection` steht weiterhin offen – das ist ein
Schalter im Supabase-Dashboard (Authentication → Policies), kein Code.

**Von Hand zu erledigen:** Leaked-Password-Protection in Supabase
einschalten.

---

## Phase A – Rechtliches

Ohne diese Seiten darf keine fremde Firma echte Beschäftigtendaten
eintragen. Krankheitstage sind eine besondere Datenkategorie nach Art. 9
DSGVO – das ist in Deutschland harte Voraussetzung, kein Komfort.

**`/impressum`** und **`/datenschutz`** – neuer Routenbereich
`app/(rechtliches)/` mit eigenem Layout. Nicht unter `(app)` (setzt eine
Sitzung voraus) und nicht unter `(auth)` (zweispaltiges Anmeldelayout);
beide Seiten sind ohne Anmeldung erreichbar, weil die Middleware nur
umleitet, was in `PROTECTED_PREFIXES` steht.

Im Impressum sind die Pflichtangaben nach § 5 DDG **bewusst offen
gelassen** und gelb markiert. Eine erfundene Anschrift ist schlimmer als
eine fehlende, weil sie wie eine echte aussieht. Ein sichtbarer Kasten oben
sagt, dass die Seite noch nicht vollständig ist.

Die Datenschutzerklärung ist ein Entwurf auf Grundlage dessen, was die
Anwendung tatsächlich verarbeitet – Felder, Rollen, Cookie-Namen und
Speicherorte sind aus dem Schema und der Projektkonfiguration übernommen,
nicht aus einer Vorlage. Sie trennt sauber zwischen zwei Verantwortlichen:
für Beschäftigtendaten ist die Kunden-Firma verantwortlich, der Betreiber
ist insoweit nur Auftragsverarbeiter.

Zwei Punkte, die aus der Konfiguration kommen und unangenehm, aber richtig
sind:

- Die Datenbank liegt bei Supabase in `eu-west-1` (Irland, EU).
- Die Vercel-Serverfunktionen laufen in `iad1` (Washington, D.C., USA).
  Das ist eine Drittlandübermittlung und steht als solche im Text. Lässt
  sich in Vercel auf `fra1` (Frankfurt) umstellen; dann entfällt der
  Abschnitt. Für deutsche Kunden mit Betriebsrat ist das regelmäßig ein
  Thema.

**`docs/avv-muster.md`** – Muster-Auftragsverarbeitungsvertrag nach Art. 28
DSGVO mit allen Mindestinhalten, Unterauftragsverarbeitern (Supabase,
Vercel) namentlich und einer Checkliste am Ende. Kein UI-Bestandteil,
sondern die Vorlage, die jeder Kunden-Firma vor dem Produktivgang vorgelegt
wird.

**Footer** – `LegalFooter` hängt im App-Shell (alle angemeldeten Seiten),
im Anmeldelayout (Login, Registrierung, Passwort vergessen) und im
Rechtliches-Layout. Gerade auf der Registrierung ist er Pflicht: dort
werden bereits personenbezogene Daten erhoben.

**Zustimmung bei der Registrierung** (`0040_avv_consent.sql`) – neue Spalte
`companies.avv_accepted_at` und eine Pflicht-Checkbox im
Registrierungsformular. Der Zeitstempel entsteht in `register_company()`,
nicht im Browser: was der Client schickt, ist kein Nachweis. Ohne
Zustimmung bricht die Funktion mit einer verständlichen Meldung ab. Die
beiden bestehenden Firmen haben `avv_accepted_at = null` – Altbestand von
vor der Einführung, in der Betreiber-Übersicht (Phase D) sichtbar zu
machen.

**Nebenbefund: Selbstregistrierung war seit `0030` komplett kaputt.**
`register_company()` gibt eine Spalte `company_id` zurück; `0030` hat eine
Zeile `insert into company_settings … on conflict (company_id) do nothing`
hinzugefügt. Die Inferenzklausel wird als Ausdruck geparst und kollidiert
mit dem Rückgabeparameter – jede Registrierung ist seitdem mit
`column reference "company_id" is ambiguous` abgebrochen. Kein Unternehmen
konnte sich seit `0030` mehr anlegen; aufgefallen ist es nur, weil die neue
Fassung getestet wurde. Ersetzt durch eine eindeutige `if not exists`-
Prüfung.

*Dasselbe Muster wie bei `current_rotation_pattern()` in 0.26: ein
`returns table (id …)` oder `(company_id …)` macht jeden unqualifizierten
Spaltenverweis im Funktionsrumpf zur Zeitbombe. Bei neuen Funktionen mit
Rückgabetabelle künftig jede Spalte im Rumpf qualifizieren.*

**Advisor nach den Migrationen:** keine neue Warnung.
`register_company` bleibt als einziger anonym aufrufbarer Einstiegspunkt
gewollt – ohne ihn könnte sich kein neues Unternehmen anlegen.
`auth_leaked_password_protection` steht weiterhin offen (Phase F.1).

### Von Hand zu erledigen – Tarek

1. **Impressum ausfüllen.** Alle gelb markierten Stellen in
   `app/(rechtliches)/impressum/page.tsx`. Eine unvollständige
   Anbieterkennzeichnung ist abmahnfähig. Ohne das keinen echten Kunden
   aufschalten.
2. **Datenschutzerklärung ergänzen.** Name, Anschrift und Kontaktadresse in
   `app/(rechtliches)/datenschutz/page.tsx`; prüfen, ob ein
   Datenschutzbeauftragter zu benennen ist (§ 38 BDSG, ab 20 Personen).
3. **Entscheiden: Vercel-Region.** `iad1` (USA) beibehalten und die
   Drittlandübermittlung dokumentieren – oder auf `fra1` (Frankfurt)
   umstellen und die betreffenden Abschnitte streichen. Die Entscheidung
   muss in Datenschutzerklärung *und* AVV gleich lauten.
4. **AVV-Muster** (`docs/avv-muster.md`) ausfüllen und durch eine
   fachkundige Stelle prüfen lassen.
5. **Eigene AVV mit Supabase und Vercel abschließen** und ablegen – ohne
   die trägt das eigene Muster nicht.
6. **Leaked Password Protection** in Supabase einschalten (Authentication →
   Policies).

---

## Phase B – E-Mail-Zustellung

In den Einstellungen stand seit `0020` ein Schalter **„E-Mail bei neuem
Urlaubsantrag"** – verschickt wurde aber nie eine. Die Einstellung war ein
Versprechen, das die Anwendung nicht gehalten hat. Die Glocke in der App
lief, die Mail gab es schlicht nicht.

### Postausgang statt Versand im Trigger

`0041_email_outbox.sql` legt die Tabelle `email_outbox` an. Der Trigger
`leave_requests_notify_leadership()` schreibt dort je eine Zeile, die Edge
Function `mail-versand` holt sie ab und verschickt sie per SMTP.

Warum nicht direkt im Trigger senden: ein Trigger läuft in derselben
Transaktion wie der Urlaubsantrag. Ein ausgehender HTTP-Aufruf darin hängt
das Beantragen von Urlaub an die Erreichbarkeit des Mailservers – ist der
langsam oder weg, scheitert der Antrag. Die Zeile dagegen kann nicht
scheitern.

Der zweite, ebenso wichtige Grund: solange kein eigener SMTP-Versand
eingerichtet ist, **sammeln sich die Zeilen sichtbar an, statt lautlos
verloren zu gehen**.

### Wer die Mail bekommt

Die Schichtleitung der **eigenen Rotationsgruppe** plus die Administration
– nicht alle Schichtleiter. Bei vier Schichten bekämen sonst acht Personen
jeden Antrag, und nach einer Woche liest das niemand mehr. Die Glocke geht
weiterhin an die gesamte Führung, die kostet nichts. Wer den Antrag selbst
stellt, bekommt keine Mail.

### Edge Function `mail-versand`

Liegt unter `supabase/functions/mail-versand/` und ist auf dem Projekt
deployt (`verify_jwt: true`). Verhalten:

- höchstens 25 Mails je Aufruf, damit die Laufzeit kurz bleibt
- bis zu 5 Versuche je Zeile – ein kurzer Ausfall des Mailservers soll
  keine Nachricht kosten; danach `status = 'fehler'` mit Begründung
- **ohne SMTP-Secrets** tut sie bewusst nichts, gibt HTTP 200 und einen
  klaren Hinweis zurück und lässt die Zeilen offen stehen. Das ist keine
  Störung, sondern ein noch nicht erledigter Einrichtungsschritt.

Live geprüft: Testzeile eingefügt, Funktion aufgerufen, Antwort war
`{"offen":1,"gesendet":0,"hinweis":"SMTP ist nicht eingerichtet …"}`, Zeile
blieb offen. Testzeile wieder entfernt.

### Sichtbar in der Anwendung

Neue Karte **Einstellungen → Mailversand** (nur Administration, nur
Live-Modus): wie viele Nachrichten warten, versendet und gescheitert sind,
wann zuletzt versendet wurde und woran es zuletzt lag – dazu die
Einrichtungsschritte.

Damit ist Punkt B.1 besser gelöst als mit einem festen Hinweistext: ob in
Supabase SMTP hinterlegt ist, lässt sich über die Schnittstelle **nicht**
abfragen (geprüft – es gibt keinen solchen Endpunkt). Ob Nachrichten liegen
bleiben, schon. Stauen sich offene Zeilen, läuft der Versand nicht.

`supabase/email-templates/README.md` ist um den ganzen Ablauf, die fünf
Secrets, den Cron-Schritt und den Wortlaut der Benachrichtigung ergänzt.

**Advisor nach der Migration:** eine neue Meldung, `email_outbox_status()`
in der Liste der von angemeldeten Nutzern aufrufbaren SECURITY
DEFINER-Funktionen. Gewollt und ungefährlich: die Funktion prüft intern
`is_admin()` und liefert nur Zählwerte des eigenen Unternehmens, keine
Inhalte. Keine neue anonym aufrufbare Funktion.

### Von Hand zu erledigen – Tarek

1. **Supabase → Edge Functions → Secrets**: `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` setzen.
2. **Supabase → Integrations → Cron**: einen Auftrag anlegen, der
   `mail-versand` minütlich aufruft. Ohne diesen Schritt bleiben die
   Nachrichten im Postausgang stehen.
3. **Supabase → Authentication → Emails → SMTP Settings**: denselben Zugang
   auch dort hinterlegen (gilt für Bestätigungs- und Einladungsmails, ein
   getrennter Weg).

Punkt 1 und 2 lassen sich an der Karte *Einstellungen → Mailversand*
kontrollieren: sobald beide stehen, geht „wartet" auf 0 und der Status auf
*läuft*.

---

## Phase C – Einrichtungsassistent für neue Firmen

Bisher endete die Registrierung im Dashboard: Standard-Feiertage aus
Nordrhein-Westfalen, drei Schichten, kein Schichtmuster, ein einziger
Personalstammsatz. Was zu tun ist, stand nirgends – es verteilte sich auf
drei Verwaltungsseiten, die man erst finden muss.

`/einrichtung` führt jetzt in drei Schritten durch dieselben Funktionen,
die es schon gibt. Der Assistent richtet nichts Eigenes ein; sein Zweck ist
die **Reihenfolge**: ohne Feiertage rechnet die Urlaubsberechnung falsch,
ohne Schichtmuster steht der Plan leer, ohne Mitarbeiter gibt es nichts zu
planen.

- **Schritt 1 Feiertage** – Bundesland wählen, `set_company_state()`
  erzeugt die Feiertage der nächsten drei Jahre.
- **Schritt 2 Schichtsystem** – erst die Frage Schichtbetrieb ja/nein. Bei
  Nein ist der Schritt erledigt (Montag bis Freitag, jeder Arbeitstag
  kostet einen Urlaubstag). Bei Ja: Anzahl der Rotationsgruppen, Startdatum
  und die Blöcke eines Durchlaufs, dazu drei Vorlagen (Konti mit vier
  Gruppen, drei Schichten mit drei Gruppen, zwei Schichten mit zwei).
- **Schritt 3 Mitarbeiter** – Stand des Teams und ein knappes Formular mit
  Name, E-Mail, Schichtgruppe und Rolle. Bewusst nur das Nötigste; wer
  zwanzig Leute anlegt, will nicht zwanzigmal durch zehn Felder. Alles
  Weitere steht unter Mitarbeiter.

Die Kopfzeile zeigt je Schritt einen Haken, sobald der Punkt erledigt ist
(`setup_state()`), und lässt sich zum Springen benutzen.

### Wie man hineinkommt – und wieder heraus

- Nach erfolgreicher Registrierung leitet `registerCompany()` direkt nach
  `/einrichtung` statt aufs Dashboard.
- Ist die Einrichtung offen, steht oben auf dem Dashboard ein Streifen, der
  dorthin führt. **Bewusst ein Hinweis und keine Zwangsumleitung:** wer
  sich anmeldet, um schnell etwas nachzusehen, soll nicht in einem
  Assistenten landen, aus dem er sich erst herausklicken muss. Der Streifen
  fängt die Fälle ab, in denen jemand abgebrochen hat oder erst die
  Bestätigungsmail abwarten musste.
- Unter Einstellungen gibt es eine Karte, die den Assistenten jederzeit
  wieder öffnet – auch nach Abschluss.
- `setupCompletedAt` kommt aus derselben Abfrage wie Profil und
  Unternehmen (`getAppSession`), kostet also keine zusätzliche Runde zur
  Datenbank.

### Bestandsfirmen

`0042_setup_wizard.sql` setzt `setup_completed_at` für alle bestehenden
Unternehmen auf ihr Anlagedatum. Röhm GmbH und Demo Chemie GmbH haben ihre
Feiertage und ihr Schichtsystem von Hand eingerichtet – sie werden nicht
nachträglich in den Assistenten gezwungen. Aufrufen können sie ihn
weiterhin selbst.

### Nebenbefund: vier Gruppen waren fest verdrahtet

`save_rotation_pattern()` hat `team_offset_days` immer als
`round(Zyklus / 4)` berechnet – vier Rotationsgruppen waren damit
stillschweigend vorausgesetzt. Ein Betrieb mit drei oder zwei Gruppen bekam
einen Versatz, der nicht zu seinem Modell passt, ohne dass irgendwo etwas
davon stand. Die Funktion nimmt jetzt `p_teams` entgegen (Vorgabewert 4,
damit der bestehende dreiargumentige Aufruf unverändert weiterläuft).

### Nebenbefund im eigenen Code, gleich behoben

Die erste Fassung der Seite kannte nur zwei Zustände – offen und
abgeschlossen. Ließ sich der Stand nicht laden, behauptete sie,
die Einrichtung sei fertig. Beim Durchklicken im Browser aufgefallen und in
drei Zustände aufgeteilt: offen, abgeschlossen, unbekannt.

**Geprüft:** Migration angewendet; Assistent im Live-Modus gegen die echte
Datenbank durchgeklickt (angemeldet als `admin2@demo-chemie.de`), alle drei
Schritte laden und zeigen den richtigen Stand (22 Feiertage für NW, Muster
vorhanden, 50 Personen, 49 mit Gruppe). Die Einrichtungskennung der Demo
Chemie GmbH war dafür kurz geöffnet und ist wieder gesetzt.

**Advisor nach der Migration:** keine neue Warnung.

### Von Hand zu erledigen – Tarek

Nichts. Phase C ist vollständig in Code. Wer die Wirkung sehen will:
Einstellungen → Einrichtung → *Assistent öffnen*.

---

## Phase D – Betreiber-Übersicht

Jede Firma sieht ausschließlich sich selbst. Das ist richtig und bleibt so.
Der Betreiber braucht daneben eine eigene, streng getrennte Sicht über alle
Firmen hinweg – erreichbar unter `/plattform`, in keiner Navigation.

### Warum eine eigene Tabelle und keine weitere Rolle

Jede Zeile in `profiles` hängt an genau einer `company_id`. Eine Rolle
`platform_admin` dort wäre damit immer an eine Firma gebunden – und jede
Policy, die sie berücksichtigt, wäre ein Loch in der Mandantentrennung.
Deshalb `platform_admins (user_id, notiz, created_at)` **neben** dem
Mandantenmodell, nicht darin.

Die Tabelle hat RLS an und **keine einzige Policy**. Über die
REST-Schnittstelle ist sie damit für jeden leer; der
Service-Role-Schlüssel umgeht RLS und ist der einzige Weg hinein. Gepflegt
wird sie ausschließlich per SQL – es gibt bewusst keine Oberfläche, über
die sich jemand selbst eintragen könnte.

### Die Grenze steht in der Datenbank

`platform_overview()` gibt je Firma zurück: Name, Anlagedatum, aktiv,
AVV-Zustimmung, Einrichtungsstand, Zahl aktiver Mitarbeiter, Zahl der
Zugänge, letzte Anmeldung, Zahl der Urlaubsanträge und davon offene.

**Keine Namen von Beschäftigten, keine Adressen, keine Urlaubsinhalte,
keine Abwesenheitsgründe.** Was die Funktion nicht herausgibt, kann die
Seite auch nicht anzeigen – die Grenze steht damit in der Datenbank und
nicht erst in der Oberfläche, wo ein späterer Umbau sie versehentlich
verschieben könnte.

`platform_overview()` und `is_platform_admin()` sind für `public`, `anon`
und `authenticated` entzogen und nur für `service_role` freigegeben. Wäre
`is_platform_admin()` für Angemeldete aufrufbar, könnte jeder
durchprobieren, wer Betreiber ist – genau das soll die Seite ja verbergen.

Live geprüft, angemeldet als normaler Firmen-Admin:

| Aufruf | Ergebnis |
|---|---|
| `GET /rest/v1/platform_admins` | 403 permission denied |
| `POST /rest/v1/rpc/platform_overview` | 403 permission denied |
| `POST /rest/v1/rpc/is_platform_admin` | 403 permission denied |
| dieselbe Abfrage anonym | 401 |

### Die Seite

`app/plattform/page.tsx` ist eine Server Component außerhalb von `(app)` –
ohne Seitenleiste, ohne Navigationseintrag. Ablauf: angemeldeten Benutzer
holen, mit dem Service-Role-Client `is_platform_admin()` fragen, erst dann
`platform_overview()`.

**404 statt 403 in jedem Fehlerfall** – nicht angemeldet, kein Betreiber,
Supabase nicht konfiguriert, Service-Role-Schlüssel fehlt. Ein 403 wäre
eine Bestätigung, dass es die Seite gibt.

Der letzte Fall ist eine bewusste Entscheidung: fehlt der Schlüssel, lässt
sich die Berechtigung gar nicht prüfen. Dann gilt für alle dasselbe.
Lieber eine falsche 404 für den Betreiber als eine Fehlermeldung, die
Fremden die Existenz der Seite verrät. Geprüft: ohne Schlüssel bekommt
auch ein eingetragener Betreiber 404.

Eine zusätzliche client-seitige Prüfung gibt es nicht und wäre auch keine
Sicherheit: die Seite wird serverseitig gerendert, unbefugte Anfragen
erhalten nie Markup, das ein Client-Check noch verstecken müsste.

**Advisor nach der Migration:** keine neue Warnung.

### Von Hand zu erledigen – Tarek

**Sich selbst eintragen.** Ohne diesen Schritt ist `/plattform` auch für
dich eine 404 – so ist es gedacht.

```sql
insert into platform_admins (user_id, notiz)
select id, 'Betreiber' from auth.users where email = 'DEINE@ADRESSE';
```

Danach `https://ready-tarek-refai.vercel.app/plattform` aufrufen.
Wieder entfernen mit `delete from platform_admins where user_id = '…';`

---

## Phase E – Navigation zusammenlegen

Die Seitenleiste hatte elf Einträge, davon fünf für Dinge, die paarweise
zusammengehören. Jetzt sind es acht.

### Kalender in den Schichtplan

Beide Seiten zeigten **dieselben Daten aus zwei Richtungen**:

- **Plan je Person** – eine Zeile je Person über 28 Tage. Beantwortet „wer
  arbeitet wann" und ist für die Führung der Ort zum Ändern.
- **Monat** – ein Feld je Tag über einen Monat. Beantwortet „wie sieht der
  Monat aus" und zeigt je Tag die kritischste Besetzung aller Schichten.

Keine der beiden ersetzt die andere, zwei Navigationseinträge braucht es
dafür aber nicht. `/schichtplan` hat jetzt einen Ansichtswechsel; `/kalender`
leitet dorthin weiter (alte Lesezeichen, Startbildschirm, installierte PWA).

**Vor dem Löschen geprüft, was auf `/kalender` exklusiv war** – das war die
Vorgabe des Auftrags. Ergebnis:

| Bestandteil | Urteil |
|---|---|
| `LiveMonthCalendar` / `MonthCalendar` | **exklusiv** → übernommen |
| `ShiftLeaveList` („Urlaub in meiner Schicht") | steht schon auf `/meine-schichten` → nicht doppelt |
| `LiveLeaveOverview` (Antragsliste, nur lesen, max. 8) | schwächere Dublette von `LiveRequestList` auf `/urlaub` (eigene Anträge, mit Zurückziehen) bzw. `ReviewPanel` auf `/urlaubsantraege` (mit Entscheiden) → entfällt |

Nebenbei ein echter Gewinn: im Demo-Modus stand auf `/schichtplan` nur „im
Demo-Modus nicht verfügbar". Die Monatsansicht läuft auch ohne Supabase und
ist dort jetzt die Startansicht.

### Mitarbeiter, Schichten und Regeln zu einer Seite

Drei Einträge für Dinge, die man beim Einrichten ohnehin nacheinander
durchgeht. Jetzt `/verwaltung` mit drei Reitern. Der gewählte Bereich steht
in der Adresse (`?bereich=`), damit Lesezeichen, Neuladen und der
Zurück-Knopf funktionieren; gewechselt wird mit `router.replace`, damit das
Blättern zwischen Reitern nicht den Zurück-Knopf zumüllt.

Die Reiter sind nach Rolle gefiltert – die Schichtleitung sieht nur die
Mitarbeiter. Das ist Bequemlichkeit, **keine Absicherung**: die liegt
unverändert in den Server-Aktionen und in Row Level Security.

Die drei Seiten wurden als Ganzes nach `src/components/admin/` verschoben
(`git mv`, damit die Historie erhalten bleibt) und nur um ihre eigene
`PageHeader` erleichtert – sonst stünde der Titel zweimal. Ihre
Beschreibung und die Aktion („Mitarbeiter anlegen") bleiben über
`AdminViewHeader` erhalten.

**Eine Sache ist dabei weggefallen:** der Knopf „Schicht anlegen" in der
alten Kopfzeile von `/schichten`. Er hatte nie einen `onClick` – er sah aus
wie eine Funktion und war keine. In eine gemeinsame Kopfzeile mitgenommen
hätte er nur weiter in die Irre geführt.

### Alle Verweise nachgezogen

- Navigation: drei Einträge → einer, Kalender-Eintrag entfernt
- `middleware.ts`: `/verwaltung` in den geschützten Pfaden
- Zehn Server-Aktionen: `revalidatePath("/mitarbeiter" | "/schichten" |
  "/regeln")` → `"/verwaltung"`, doppelte Zeilen zusammengefasst
- Wo vorher `/kalender` neu geladen wurde, steht jetzt `/schichtplan`
- Links im Einrichtungsassistenten auf `/verwaltung?bereich=…`

Durchgeklickt im Live-Modus gegen die echte Datenbank: alle vier
Weiterleitungen landen richtig, die Reiter setzen die Adresse, keine
JS-Fehler.

### Eine Einschränkung bei der Prüfung

Die **Farben der Monatsansicht** konnte ich in dieser Umgebung nicht im
Browser bestätigen. `staffing_month_overview()` braucht serverseitig rund
1,6 Sekunden; der Proxy dieser Arbeitsumgebung bricht Browser-Anfragen ab,
die länger als etwa eine Sekunde dauern – ein reines
`fetch()` mit demselben Schlüssel scheitert nach 14 Sekunden, während
dasselbe per `curl` in 1,6 Sekunden mit HTTP 200 antwortet. Die kürzeren
Abfragen derselben Seite (Tagesdetail, „wer fehlt") laufen im Browser
durch und zeigen richtige Werte.

Geprüft habe ich deshalb die Datenquelle direkt: `staffing_month_overview`
liefert für September 2026 dreißig Tage, davon 27 ok, 2 knapp, 1 kritisch.
Der Code der Monatsansicht ist unverändert aus `/kalender` übernommen und
verhielt sich dort genauso.

**Advisor:** keine Migration in dieser Phase, keine neue Warnung.

### Von Hand zu erledigen – Tarek

Nichts. Beim ersten Öffnen nach dem Deployment kann die installierte PWA
noch die alte Navigation im Cache haben – einmal neu laden genügt.

---

## Nachtrag: Registrierung mit bereits vergebener Adresse

**Symptom:** „Ich habe keine Mail bekommen." Die Registrierung meldete
Erfolg und bat um Bestätigung der E-Mail-Adresse – es kam aber nie eine
Mail, und Anmelden war unmöglich.

**Ursache:** Supabase verrät absichtlich nicht, dass eine Adresse schon
vergeben ist, sonst könnte jeder über das Registrierungsformular
durchprobieren, wer hier ein Konto hat. Stattdessen antwortet `signUp()`
mit HTTP 200 und einem Scheinbenutzer: kein Fehler, keine Sitzung,
`identities` leer – und keine Mail. Im Auth-Protokoll steht die Aktion
`user_repeated_signup` mit Status 200.

`registerCompany()` kannte diesen Fall nicht. Da kein Fehler zurückkam,
lief die Funktion in den Erfolgszweig und behauptete, eine Mail sei
unterwegs. Das kurz zuvor von `register_company()` angelegte Unternehmen
blieb dauerhaft ohne jedes Profil stehen – aufgeräumt wurde bis dahin nur
im Fehlerzweig. So sind die Waisen „Muster GmbH" (14.09., 23:44) und
„muster 2" (15.09., 10:39) entstanden, beide aus Versuchen mit einer
Adresse, die bereits der Röhm GmbH gehört.

**Behoben in `src/lib/auth/company-actions.ts`:** ein leeres `identities`
wird jetzt als „Adresse bereits vergeben" erkannt. Das angelegte
Unternehmen wird über `discard_unclaimed_company()` sofort
zurückgenommen, und der Benutzer bekommt den wahren Grund zu lesen statt
eines Erfolgs, den es nicht gab.

Dass die Anwendung dem Anfragenden damit bestätigt, dass die Adresse
vergeben ist, ist hier bewusst in Kauf genommen: die Alternative wäre,
jemanden ins Leere laufen zu lassen, der sein eigenes Unternehmen anlegen
will. Die Registrierung erzeugt ohnehin sichtbare Zustände.

**Datenbank aufgeräumt:** „muster 2" gelöscht (0 Zugänge, für niemanden
erreichbar). Bestand jetzt: Röhm GmbH (2 Zugänge), Demo Chemie GmbH (3),
Tarek Firma (1).

**Mailversand funktioniert:** Die Registrierung von „Tarek Firma" um
10:42:38 mit einer noch freien Adresse hat die Bestätigungsmail 28
Millisekunden später ausgelöst, bestätigt wurde um 10:42:47, angemeldet um
10:43:21. Die Brevo-Einrichtung ist damit im Live-Betrieb bewiesen.

**Advisor:** keine Migration, keine neue Warnung.

### Von Hand zu erledigen – Tarek

Nichts. Wer sich registrieren will, braucht eine Adresse, die hier noch
kein Konto hat – `refaitarek7@gmail.com` und `refaitarek30@gmail.com`
gehören bereits zur Röhm GmbH.

---

## Nachtrag: V-Tage auf 0 setzen, Kachel ohne Konto, „Tagschicht"

### V-Tage ließen sich nicht auf 0 setzen

**Symptom:** In der Verwaltung die V-Tage auf 0 stellen und speichern –
danach stand wieder 27 da.

**Ursache:** eine einzige Zeile in `updateEmployee()`:

```ts
v_days: Number.parseFloat(String(formData.get("v_days") ?? "27").replace(",", ".")) || 27,
```

In JavaScript ist `0` falsy. `parseFloat("0") || 27` ergibt deshalb `27`.
Die 0 kam korrekt aus dem Formular, wurde korrekt geparst – und dann vom
Fallback wieder überschrieben, der eigentlich nur leere Eingaben abfangen
sollte. Beim *Anlegen* gab es den Fehler nicht, dort stand schon
`Number.isFinite(vDays) ? vDays : 27`, was mit 0 richtig umgeht.

**Behoben:** `v_days` wird wie `vacation_days` oben eingelesen und geprüft
(`Number.isFinite` und `>= 0`, sonst eine verständliche Fehlermeldung),
und beim Schreiben steht nur noch der geprüfte Wert.

### „Änderungen sollen überall zu sehen sein"

Die Weitergabe an die Urlaubskonten war bereits in Ordnung: der Trigger
`employees_entitlement_sync` schreibt jede Änderung von `vacation_days`
oder `v_days` sofort in `leave_balances` des laufenden Jahres. Blockiert
hat das nur der Fallback oben – es kam nie eine 0 in der Tabelle an, also
hatte der Trigger nichts zu tun. Dashboard und Urlaubsseite lesen live
über `leave_balances_view`, ohne Next-Cache dazwischen; nach dem
Speichern genügt ein Neuladen.

Am Datenbankstand geprüft: `v_days = 0` setzen → `v_entitlement` im Konto
2026 steht auf `0.0`, die Ansicht liefert denselben Wert. Beide Testläufe
liefen in einer Transaktion und wurden zurückgerollt.

### Keine V-Tage-Kachel ohne V-Konto

Dashboard und Urlaubsseite blenden das V-Tage-Feld jetzt aus, wenn es
nichts zu zeigen gibt.

Die Bedingung schaut bewusst nicht nur auf den Anspruch. Wird der
Anspruch auf 0 gesetzt, **nachdem** jemand schon V-Tage genommen hat,
steht das Konto im Minus – beim Testlauf mit einem echten Datensatz kam
`v_remaining = -5.0` heraus. Ein Minusstand darf nicht verschwinden.
Ausgeblendet wird deshalb nur ein Konto, auf dem nie etwas gebucht wurde:
kein Anspruch, kein Übertrag, nichts genommen, nichts beantragt, Rest
genau 0. Beide Fälle sind gegen die Datenbank geprüft.

Nebenbei repariert: der Hinweis „Übertragene Tage aus … verfallen am
31.03." stand innerhalb des V-Kastens, gilt aber auch für reinen
Urlaubsübertrag. Er steht jetzt daneben und verschwindet nicht mehr mit,
wenn jemand keine V-Tage hat.

### „Ohne Schichtgruppe" heißt jetzt „Tagschicht"

Umbenannt im Schichtplan-Raster, unter „Meine Schichten" und im
Erklärtext zur Feiertagsregel. Die Gruppe steht alphabetisch weiterhin
hinter „Schicht A"–„Schicht D".

**Advisor:** keine Migration, keine neue Warnung.

### Von Hand zu erledigen – Tarek

Nichts.

### Aufgefallen, nicht angefasst

`npm run lint` läuft nicht: das Skript ruft `next lint` auf, das es in
Next 16 nicht mehr gibt. Das bestand schon vor dieser Änderung und gehört
nicht hierher – sag Bescheid, wenn ich es auf ESLint umstellen soll.

---

## Nachtrag: Die Tagschicht arbeitet nicht am Wochenende

**Gemeldet:** „Die Tagschicht braucht an Sonn- und Feiertagen bzw.
Wochenende keinen Urlaubstag nehmen, das gilt nur für Schichtarbeiter."

### Ursache: zwei Antworten auf dieselbe Frage

Es gab zwei verschiedene Definitionen von „ist Schichtarbeiter":

| Wo | Wonach entschieden wurde |
|---|---|
| Auf welches Konto ein Tag gebucht wird (seit 0031) | `employees.shift_worker` |
| Welche Tage überhaupt Arbeitstage sind | `shift_id is not null or rotation_pattern_id is not null` |

Wer das Kennzeichen „Schichtarbeiter" **nicht** gesetzt hatte, aber
trotzdem eine Schichtgruppe zugewiesen bekam, fiel damit in die
Schichtlogik. Am echten Datenbestand nachgemessen, Sabine Wagner
(`shift_worker = false`, Gruppe C), Zeitraum 03.10.–11.10.2026:

| Tag | Feiertag | vorher „arbeitet" | jetzt |
|---|---|---|---|
| Sa 03.10. | ja | ja | nein |
| So 04.10. | – | ja | nein |
| Mo 05.10. | – | **nein** | ja |
| Di 06.10. | – | **nein** | ja |
| Mi–Fr | – | ja | ja |
| Sa 10.10. | – | ja | nein |
| So 11.10. | – | ja | nein |

Derselbe Zeitraum kostete sie **7 Urlaubstage statt 5** – und sie hatte
Montag und Dienstag „frei", obwohl sie Tagschicht fährt.

### Korrigiert

Ab jetzt entscheidet allein `shift_worker`. Eine Schichtgruppe an einer
Tagschichtkraft ist folgenlos, statt stillschweigend die Berechnung
umzustellen. Geändert in `0047_tagschicht_kein_wochenende.sql`:

- `calculate_leave_days_for_employee()` – die verbindliche Tageszahl
- `is_planned_workday()` – Vorschau und automatische Verteilung
- `effective_shift_id()` – die eigentliche Wurzel: das Rotationsmuster
  greift nicht mehr für Nicht-Schichtarbeiter
- `shift_plan_grid()` – die ausgegebene Gruppe folgt ebenfalls
  `shift_worker`
- `meine-schichten/page.tsx` – dieselbe Regel, weil die Seite die Spalte
  direkt liest

### Warum auch der Schichtplan

Die reine Urlaubskorrektur hätte einen Widerspruch hinterlassen: der Plan
hätte Sabine samstags und sonntags weiter im Dienst gezeigt und sie dort
zur Besetzung gezählt, während die Urlaubsrechnung sie als frei führt. Ein
Schichtleiter hätte sie als Sonntagsabdeckung gesehen, die es nicht gibt.
Deshalb geht die Korrektur bis auf `effective_shift_id()` – dann stimmen
Plan, Besetzung und Urlaub wieder überein.

Ein ausdrücklicher Eintrag in `shift_assignments` gilt weiterhin: setzt
die Schichtleitung jemanden von Hand auf einen Tag, ist das gewollt und
schlägt jede Automatik.

**Nicht angetastet:** die Sichtbarkeitsregel in `shift_plan_grid()`, die
entscheidet, wer wessen Plan sehen darf. Sabine sieht weiterhin den Plan
der Gruppe C. Das ist eine Frage der Berechtigung, nicht der Darstellung,
und sie hier stillschweigend zu verengen wäre die falsche Stelle.

### Geprüft

| Prüfung | Ergebnis |
|---|---|
| Sabine (Tagschicht, Gruppe C), 03.–11.10. | 7 → **5 Urlaubstage** |
| Lars Schunk (Schichtarbeiter, Gruppe C), gleicher Zeitraum | unverändert 7 |
| Schichtplan 14 Tage, 48 Schichtarbeiter | 504 geplante Zellen, unverändert |
| Schichtplan, 2 Tagschichtkräfte | 0 Einträge, Gruppe „Tagschicht" |
| Gruppen A–D | je 12 Personen |

Die Änderung an `effective_shift_id()` wirkt sich nachweislich nur auf
Zeilen mit `shift_worker = false` aus – davon gibt es in der ganzen
Datenbank drei. Für Schichtarbeiter ist der Code Zeile für Zeile
unverändert.

`tsc --noEmit` und `next build` laufen sauber durch.

**Advisor:** keine neue Warnung.

### Von Hand zu erledigen – Tarek

Prüf einmal in der Verwaltung, bei wem das Häkchen „Schichtarbeiter"
richtig steht – danach richtet sich jetzt alles. Sabine Wagner in der
Demo-Firma hat eine Schichtgruppe, fährt aber keine Schicht; die Gruppe
kannst du bei ihr entfernen, nötig ist es nicht mehr.

---

## Neue Unternehmen: keine erfundenen Vorgaben, eigener erster Schritt

### Nichts mehr voreingestellt

Bisher bekam jeder neu angelegte Mitarbeiter 30 Urlaubstage und 27 V-Tage,
weil das die Spaltenvorgaben waren. Für ein frisch registriertes
Unternehmen sind das erfundene Zahlen: niemand hat sie eingegeben, sie
sehen aber aus wie gepflegte Daten.

Umgestellt auf 0 – an vier Stellen, damit es keinen Weg gibt, auf dem
doch wieder eine Zahl entsteht:

| Wo | vorher | jetzt |
|---|---|---|
| `employees.vacation_days` / `v_days` | 30 / 27 | 0 / 0 |
| `leave_balances.entitlement` / `v_entitlement` | 30 / 27 | 0 / 0 |
| `register_company()` (Gründer) | Spaltenvorgabe | ausdrücklich 0 / 0 |
| Formular „Neuer Mitarbeiter" | 30 / 27 | 0 / 0 |

Bestehende Datensätze sind nicht betroffen – eine geänderte
Spaltenvorgabe wirkt nur auf neue Zeilen.

### Schritt 1: die eigenen Angaben

Der Assistent hat jetzt vier Schritte statt drei. Vorneweg steht, was
vorher gar nicht gefragt wurde: Abteilung, Urlaubsanspruch, V-Tage,
Schichtarbeiter ja/nein, Schichtgruppe und Qualifikationen der Person, die
das Unternehmen registriert hat.

Der Reihenfolgekonflikt dabei: der Schritt fragt nach der Schichtgruppe,
das Rotationsmuster entsteht aber erst in Schritt 3. Aufgelöst, weil die
Gruppen A–D im Programm festliegen – gewählt wird die Gruppe sofort, die
Verknüpfung zum Muster stellt `save_own_setup_profile()` her, sobald eines
da ist. Kommt das Muster später, zieht Schritt 3 sie über
`apply_rotation_to_all()` nach.

Geschrieben wird über eine eigene Funktion, nicht über das allgemeine
Mitarbeiterformular: `save_own_setup_profile()` fasst ausschließlich die
Zeile des angemeldeten Zugangs an (`auth_employee_id()`), nimmt keine
Mitarbeiter-ID von außen entgegen und ändert weder Rolle noch Status. Eine
Schichtgruppe an jemandem ohne Schichtbetrieb wird verworfen – genau die
Widersprüchlichkeit, die in 0047 die Urlaubsberechnung verdreht hatte.
Unbekannte Qualifikationen fallen weg, statt mit einer rohen
Datenbankmeldung zu platzen.

Die Fortschrittsanzeige hängt an einer eigenen Spalte
`employees.profile_confirmed_at`, nicht an den Werten: „0 Urlaubstage" ist
eine gültige Antwort, keine fehlende.

### Mitteilungen und Urlaubssperren unter Führung

Beide Karten lagen unter `Verwaltung → Regeln`, zwischen Planungsregeln
und Feiertagseinstellungen. Falscher Ort: Regeln stellt man einmal beim
Einrichten ein, eine Mitteilung schreibt man mitten im Tagesgeschäft.

Jetzt unter `Führung → Mitteilungen` – zwei Klicks näher, erreichbar für
Schichtleitung und Administration. Urlaubssperren bleiben wie vorher der
Administration vorbehalten.

Dass beides auf jedem Dashboard steht, war schon vorher so und ist
unverändert: das Dashboard zieht Mitteilungen und aktive Sperren für alle
Rollen.

### Geprüft

Neuregistrierung komplett durchgespielt, in einer Transaktion und
zurückgerollt:

| | |
|---|---|
| Rolle des Gründers | `admin` |
| Urlaubstage / V-Tage | 0 / 0 |
| Abteilung | leer |
| Profil bestätigt | nein → Schritt 1 steht offen |
| Schichten / Feiertage angelegt | 3 / 22 |

`save_own_setup_profile()` in drei Fällen geprüft: Schichtarbeiter mit
Gruppe B (Muster verknüpft), Tagschicht mit übergebener Gruppe C (Gruppe
und Muster verworfen), unbekannte Qualifikation `quatsch` (herausgefiltert).

`tsc --noEmit` und `next build` laufen sauber durch, 29 Seiten.

**Advisor:** keine neue Warnkategorie. Die neue Funktion erscheint in der
bekannten Liste der SECURITY-DEFINER-Funktionen für angemeldete Nutzer –
das ist die Bauweise dieser Anwendung, nicht ein neuer Befund.

### Von Hand zu erledigen – Tarek

Nichts. Beim nächsten Testdurchlauf einer Registrierung führt der
Assistent von selbst durch die vier Schritte.

---

## Phase 4 · Grundlage für Auswertung, Ersatzsuche und Ausbildung

Sechs Migrationen (0049–0054), alle auf dem Live-Projekt angewandt. Keine
Oberfläche berührt — das ist Phase 5.

### 0049 · Eintritt und Austritt

`employees` bekommt `entry_date`, `exit_date` und `is_apprentice`. Die
Prüfung steht **nicht** verstreut, sondern in einem Helfer
`is_employed_on()`, der an genau zwei Stellen greift:
`is_planned_workday()` und `effective_shift_id()`. Schichtplan, Besetzung
und Urlaubsberechnung lesen bereits durch diese beiden und erben die
Regel dadurch.

Leere Felder heißen „keine Grenze" — der bestehende Datenbestand verhält
sich unverändert.

Nachgemessen an der Demo-Firma, in Transaktionen und zurückgerollt:

| Prüfung | vorher | nachher |
|---|---|---|
| Arbeitstage Mai–Juli bei Eintritt 01.06./Austritt 30.06. | 70 | 23 |
| Urlaub 04.–08.05. (vor Eintritt) | 4,0 Tage | 0,0 Tage |
| Besetzung 15.07. nach Austritt 30.06. | 12 geplant | 11 geplant |
| Zeilen im Schichtplan 01.–14.07. | 50 Personen | 49 Personen |

Test 7 (vor Eintritt) und Test 8 (nach Austritt) liefern beide `false`,
ein Tag innerhalb `true`.

### 0050 · Qualifikationen als Daten

Drei Tabellen: `qualifications` (je Unternehmen frei anlegbar),
`employee_qualifications`, `shift_qualification_needs`. RLS nach dem
Muster der übrigen Tabellen.

Der Bestand wurde übernommen und Zeile für Zeile geprüft:

| | |
|---|---|
| alte Zuordnungen (Enum-Array) | 77 |
| neue Zuordnungen (Tabelle) | 77 |
| fehlen | 0 |
| zu viel | 0 |

`employees.qualifications` **bleibt stehen** und wird nicht mehr gelesen.
Sie ist der Rückweg, falls beim Übernehmen etwas übersehen wurde;
entfernt wird sie erst nach ausdrücklicher Freigabe.

### 0051 · Abwesenheitsarten

`absence_type` um `sonderurlaub`, `altersfreizeit` und `bildungsurlaub`
erweitert. `SE` (Seminar) aus der Excel wird auf die vorhandene Art
`schulung` abgebildet, statt ein zweites Konzept danebenzustellen.

### 0052 · Betriebsregeln

Vier Werte in die vorhandene `staffing_rules`, keine neue Tabelle:
Ruhezeit 11 h, maximale Einsatzdauer 8 h, 8 Stunden je Arbeitstag,
Zielwert der Gesundheitsrate 96 %. Gelesen über `company_rule_number()`,
wobei eine Regel je Schicht die betriebsweite sticht.

Die beiden Zeitwerte sind Vorgaben des Betriebs und erscheinen später in
der Oberfläche als solche, nicht als gesetzliche Vorschrift.

### 0053 · Schulferien

Eigene Tabelle `school_holidays`, **nicht** in `holidays`: dort gilt
`unique (company_id, date)`, der Ostermontag läge also im Streit mit den
Osterferien. Die sechs NRW-Zeiträume 2026 stammen aus der Excel-Referenz
(Zeilen 77–82) und sind nicht aus dem Gedächtnis ergänzt.

Rein darstellend — Besetzungs- und Urlaubsberechnung fassen sie nicht an.

### 0054 · Urlaubskonten korrigiert

Zwei Änderungen an `leave_balances_view`:

**Tagschichtkräfte verbrauchten keinen Urlaub.** Die Ansicht zählte einen
Tag nur bei `effective_shift_id(...) is not null`; seit 0047 haben
Tagschichtkräfte keine Schicht. Jetzt `is_planned_workday()` — dieselbe
Funktion, mit der auch der Antrag rechnet.

| Antrag 05.–09.10.2026, Tagschicht | vorher | nachher |
|---|---|---|
| `requested_days` laut Antrag | 5,0 | 5,0 |
| `view.planned_days` | 0 | 5 |
| `view.remaining_days` | 30,0 | 25,0 |

**V-Tage verfallen nicht mehr** am 31.03. Die Kappung bleibt für Urlaub.
Jonas Brandt: 27 Anspruch + 3 Übertrag − 5 genommen = 25 (vorher 22).

Gegenprobe über den ganzen Bestand: **0 negative Urlaubskonten, 0
negative V-Konten.**

**Advisor:** keine neue Warnkategorie. `tsc --noEmit` und `next build`
laufen sauber, 29 Seiten.

### Aufgefallen

In der Datenbank steht seit dem 15.09. eine Firma **Evonik AG** mit
`refaitarek7@gmail.com` — Tareks eigene Testregistrierung. Alle Tests
wurden ausdrücklich auf die Demo Chemie GmbH eingegrenzt, damit dort
nichts angefasst wird.

### Von Hand zu erledigen – Tarek

Nichts. Eintritts- und Austrittsfelder sowie die Qualifikationsverwaltung
bekommen in Phase 5 ihre Oberfläche.

---

## Phase 5 · Oberfläche für die neuen Daten

Eine Migration (0055) plus die Anwendungsseite. Die Auswertung und die
Ersatzsuche folgen in den Phasen 6 und 7.

### 0055 · Qualifikationen pflegen

Drei Funktionen, damit die Anwendung nicht in zwei Tabellen gleichzeitig
schreibt und dabei Berechtigungen selbst prüft:

- `set_employee_qualifications(person, schlüssel[])` — setzt den
  vollständigen Satz. Nimmt Schlüssel statt IDs entgegen, weil das
  Formular keine UUIDs kennt, und verwirft unbekannte still.
- `company_qualifications()` — der Katalog samt Anzahl der Mitarbeiter je
  Funktion.
- `save_qualification()` — anlegen und umbenennen. Der Schlüssel entsteht
  aus der Bezeichnung (`Kranführer (Halle 3)` → `kranfuehrer_halle_3`)
  und bleibt danach fest, weil die Zuordnungen daran hängen.

`save_own_setup_profile()` schreibt ebenfalls auf die neuen Tabellen.
Unverändert: nur die eigene Zeile, keine Mitarbeiter-ID von außen.

### Anwendung umgestellt

| Stelle | vorher | jetzt |
|---|---|---|
| Auswahlfeld im Formular | feste Liste im Programm | Katalog des Unternehmens |
| `createEmployee` / `updateEmployee` | schrieb `employees.qualifications` | `set_employee_qualifications()` |
| `fetchEmployees` | las die alte Spalte | liest `employee_qualifications` |
| Einrichtungsassistent | las die alte Spalte | liest die neue Tabelle |

Die Spalte `employees.qualifications` wird **nirgends mehr gelesen** —
nachgeprüft mit einer Suche über `src/` und `app/`. Sie bleibt als
Rückweg stehen, siehe 0050.

Nebenbei: `EmployeeRecord` führt jetzt neben den Schlüsseln auch die
Bezeichnungen. Vorher fiel die Anzeige bei einer selbst angelegten
Qualifikation auf den Schlüssel zurück und zeigte `staplerschein` statt
„Staplerschein". Geraten wird nichts — die Bezeichnung kommt aus
derselben Abfrage.

### Neue Felder im Mitarbeiterformular

Eintritt, Austritt und ein Kennzeichen für Auszubildende, in beiden
Formularen. Der Austritt vor dem Eintritt wird vor dem Speichern
abgefangen — die Datenbank hat dafür eine Prüfbedingung, die aber nur
eine rohe Meldung liefert.

### Qualifikationskatalog

Neue Karte unter `Verwaltung → Regeln`: anlegen, umbenennen,
deaktivieren, mit Anzahl der Mitarbeiter je Funktion. **Deaktivieren
statt löschen** — an einer Qualifikation hängen Zuordnungen und später
Besetzungsvorgaben; eine deaktivierte verschwindet aus neuen Formularen,
bestehende Zuordnungen bleiben nachvollziehbar.

### Ferien im Schichtplan

Der Tabellenkopf zeigt Ferientage mit dezentem Hintergrund, kleiner Marke
und Tooltip („Sommerferien (Schulferien)"). Eine Urlaubssperre ist das
stärkere Signal und sticht die Ferien — die sind nur ein Hinweis und
dürfen den Plan nicht überfärben.

### Geprüft

Am Live-Bestand, in Transaktionen und zurückgerollt:

| Prüfung | Ergebnis |
|---|---|
| Katalog lesen | 5 Einträge |
| Qualifikationen setzen, dabei ein unbekannter Schlüssel | nur die gültigen gespeichert |
| Neue Qualifikation „Kranführer (Halle 3)" | Schlüssel `kranfuehrer_halle_3` |
| Mitarbeiter mit Eintritt und Azubi-Kennzeichen | gespeichert, Qualifikationen korrekt |
| Ferien im Zeitraum 01.07.–30.09.2026 | Sommerferien 20.07.–01.09. |

`tsc --noEmit` und `next build` laufen sauber, 29 Seiten. Bestand nach
allen Tests unverändert: 77 Zuordnungen, 0 gepflegte Eintrittsdaten.

### Von Hand zu erledigen – Tarek

Eintritts- und Austrittsdaten sind leer und werden von Hand gepflegt —
solange sie leer sind, verhält sich alles wie bisher. Den
Qualifikationskatalog findest du unter `Verwaltung → Regeln`.
