-- Lasttest: Messung der teuersten Aufrufe.
--
-- ENTWURF aus dem Review vom 10.11.2026. NICHT ausgeführt.
-- NUR im Testprojekt nach seed-testmandant.sql ausführen.
-- Braucht psql (Kommandozeile) – die Befehle mit \ laufen nicht im SQL-Editor des Dashboards.
--
-- So wird gemessen: Das Skript tut so, als wäre ein bestimmtes Konto angemeldet
-- (wie es die Schnittstelle macht), und ruft dann die Funktionen auf.
-- Bitte unten die Konto-ID des Test-Administrators eintragen.

-- 1) Konto-ID des Test-Administrators (aus auth.users im TESTPROJEKT)
\set konto '00000000-0000-0000-0000-000000000000'

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'konto', 'role', 'authenticated')::text, true);

-- 2) Grunddaten für die Aufrufe
select auth_company_id() as firma \gset
select date_trunc('month', current_date)::date as monat_von,
       (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date as monat_bis,
       date_trunc('year', current_date)::date as jahr_von,
       (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date as jahr_bis \gset

-- 3) Messungen. Wichtig ist jeweils die Zeile „Execution Time“.
--    Die Parameterlisten können sich seit dem Review geändert haben – bei einem
--    Fehler die Signatur mit  \df+ public.<name>  nachsehen.

\echo '--- Takt (aenderungsstand)'
explain (analyze, buffers) select * from public.aenderungsstand();

\echo '--- Schichtplan, 5 Wochen (shift_plan_grid)'
explain (analyze, buffers) select * from public.shift_plan_grid(:'firma', :'monat_von'::date, 35);

\echo '--- Schichtplan, ganzes Jahr'
explain (analyze, buffers) select * from public.shift_plan_grid(:'firma', :'jahr_von'::date, 365);

\echo '--- Besetzung über einen Monat (staffing_range)'
explain (analyze, buffers) select * from public.staffing_range(:'firma', :'monat_von'::date, 31);

\echo '--- Urlaubskonten des Teams (team_leave_balances)'
explain (analyze, buffers) select * from public.team_leave_balances(extract(year from current_date)::int);

\echo '--- Urlaubskonto-Ansicht, alle Personen des Unternehmens'
explain (analyze, buffers) select * from public.leave_balances_view where year = extract(year from current_date)::int;

\echo '--- Auswertung eines Jahres (absence_report)'
explain (analyze, buffers) select * from public.absence_report(extract(year from current_date)::int, null);

\echo '--- Offene Anträge (Tabelle direkt, wie die Oberfläche)'
explain (analyze, buffers) select * from public.leave_requests where status = 'pending' order by start_date;

\echo '--- Abwesenheiten eines Monats (Tabelle direkt)'
explain (analyze, buffers) select * from public.absences where date between :'monat_von'::date and :'monat_bis'::date order by date;

\echo '--- Mitarbeiterliste (Tabelle direkt) – liefert die Schnittstelle höchstens 1.000 Zeilen?'
select count(*) as zeilen_gesamt from public.employees;

rollback;

-- Auswertung:
--   über 8.000 ms  = läuft in Produktion in die Zeitgrenze (Fehler beim Nutzer)
--   über 1.000 ms  = spürbar langsam
--   Zeilen > 1.000 = die Schnittstelle schneidet ab (siehe P-02)
