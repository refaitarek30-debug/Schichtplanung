-- Lasttest: ein Mandant mit 2.000 Personen und 3 Jahren Daten.
--
-- ENTWURF aus dem Review vom 10.11.2026. NICHT ausgeführt, NICHT getestet.
-- NUR in einem eigenen, leeren Testprojekt ausführen – NIEMALS in der Live-Datenbank.
--
-- Vorher im selben Fenster bestätigen:
--   set lasttest.bestaetigt = 'ja';
--
-- Das Skript legt an:
--   1 Unternehmen „LASTTEST 2000“, 5 Schichtgruppen (A–E), 3 Schichten,
--   2.000 Personen, je Person und Tag eine Schichtzuordnung für 3 Jahre
--   (≈ 2,2 Mio. Zeilen), ≈ 30 Urlaubstage je Person und Jahr als Anträge,
--   ≈ 8 Kranktage je Person und Jahr.
--
-- Trigger sind während des Befüllens ausgeschaltet (sonst läuft es Stunden
-- und verschickt Benachrichtigungen). Danach werden sie wieder eingeschaltet.

do $$
begin
  if coalesce(current_setting('lasttest.bestaetigt', true), '') <> 'ja' then
    raise exception 'Abbruch: Bitte zuerst  set lasttest.bestaetigt = ''ja'';  ausführen – und nur im Testprojekt.';
  end if;
  if exists (
    select 1 from public.companies c
     where not coalesce(c.is_demo, false) and c.name not like 'LASTTEST%'
  ) then
    raise exception 'Abbruch: In dieser Datenbank gibt es echte Unternehmen. Das ist kein Testprojekt.';
  end if;
end $$;

set session_replication_role = replica;  -- Trigger aus (nur für dieses Fenster)

do $$
declare
  firma uuid;
  frueh uuid; spaet uuid; nacht uuid;
  von date := date_trunc('year', current_date)::date - interval '1 year';
  bis date := (date_trunc('year', current_date) + interval '2 years' - interval '1 day')::date;
begin
  insert into public.companies (name, avv_accepted_at, terms_accepted_at, business_confirmed_at, setup_completed_at)
  values ('LASTTEST 2000', now(), now(), now(), now())
  returning id into firma;

  insert into public.company_settings (company_id, state) values (firma, 'NW');

  insert into public.shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values (firma, 'Frühschicht', 'F', '06:00', '14:00', '#F59E0B', 60, 80, '{0,1,2,3,4,5,6}') returning id into frueh;
  insert into public.shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values (firma, 'Spätschicht', 'S', '14:00', '22:00', '#16A34A', 60, 80, '{0,1,2,3,4,5,6}') returning id into spaet;
  insert into public.shifts (company_id, name, short_name, start_time, end_time, color, minimum_staff, target_staff, weekdays)
  values (firma, 'Nachtschicht', 'N', '22:00', '06:00', '#2F5BEA', 60, 80, '{0,1,2,3,4,5,6}') returning id into nacht;

  -- 2.000 Personen, gleichmäßig auf A–E verteilt
  insert into public.employees (company_id, personnel_number, first_name, last_name, role, vacation_days, v_days,
                                rotation_team, shift_worker, entry_date, active)
  select firma, to_char(20000 + n, 'FM00000'), 'Test ' || to_char(n, 'FM0000'), 'Person',
         case when n <= 5 then 'admin' when n <= 45 then 'shift_leader' else 'employee' end::public.app_role,
         30, 12,
         (array['A','B','C','D','E'])[1 + (n % 5)]::public.rotation_team,
         true, von, true
  from generate_series(1, 2000) n;

  -- Urlaubskonten für 3 Jahre
  insert into public.leave_balances (company_id, employee_id, year, entitlement, carried_over, v_entitlement)
  select firma, e.id, j, 30, 3, 12
  from public.employees e
  cross join generate_series(extract(year from von)::int, extract(year from bis)::int) j
  where e.company_id = firma;

  -- Schichtzuordnung je Person und Tag: 2 Früh, 2 Spät, 2 Nacht, 4 frei (10-Tage-Rhythmus, je Gruppe versetzt)
  insert into public.shift_assignments (company_id, employee_id, shift_id, date)
  select firma, e.id,
         case ((d - von) + 2 * (ascii(e.rotation_team::text) - 65)) % 10
           when 0 then frueh when 1 then frueh
           when 2 then spaet when 3 then spaet
           when 4 then nacht when 5 then nacht
         end,
         d
  from public.employees e
  cross join lateral (select g::date as d from generate_series(von, bis, interval '1 day') g) tage
  where e.company_id = firma
    and ((d - von) + 2 * (ascii(e.rotation_team::text) - 65)) % 10 < 6;

  -- Urlaub: je Person und Jahr 3 Blöcke à 10 Tage, über das Jahr gestreut; 80 % genehmigt, 20 % offen
  insert into public.leave_requests (company_id, employee_id, start_date, end_date, requested_days, status, kind)
  select firma, e.id, start, start + 9, 6,
         (case when (hashtext(e.id::text || start::text) % 5) = 0 then 'pending' else 'approved' end)::public.leave_status,
         'urlaub'::public.leave_kind
  from public.employees e
  cross join generate_series(extract(year from von)::int, extract(year from bis)::int) j
  cross join generate_series(0, 2) b
  cross join lateral (
    select make_date(j, 1, 1) + ((abs(hashtext(e.id::text || j::text || b::text)) % 100) + b * 115) as start
  ) s
  where e.company_id = firma;

  -- Krank: je Person und Jahr 8 einzelne Tage
  insert into public.absences (company_id, employee_id, date, type)
  select distinct firma, e.id,
         make_date(j, 1, 1) + (abs(hashtext(e.id::text || j::text || k::text)) % 360),
         'krank'::public.absence_type
  from public.employees e
  cross join generate_series(extract(year from von)::int, extract(year from bis)::int) j
  cross join generate_series(1, 8) k
  where e.company_id = firma
  on conflict do nothing;

  raise notice 'Fertig. Unternehmen: %', firma;
end $$;

set session_replication_role = origin;   -- Trigger wieder an

analyze public.employees;
analyze public.shift_assignments;
analyze public.leave_requests;
analyze public.absences;
analyze public.leave_balances;

-- Kontrolle
select
  (select count(*) from public.employees e join public.companies c on c.id = e.company_id where c.name = 'LASTTEST 2000') as personen,
  (select count(*) from public.shift_assignments a join public.companies c on c.id = a.company_id where c.name = 'LASTTEST 2000') as zuordnungen,
  (select count(*) from public.leave_requests r join public.companies c on c.id = r.company_id where c.name = 'LASTTEST 2000') as antraege,
  (select count(*) from public.absences a join public.companies c on c.id = a.company_id where c.name = 'LASTTEST 2000') as abwesenheiten,
  pg_size_pretty(pg_database_size(current_database())) as groesse;

-- Hinweis: Für die Messung braucht es ein Konto, das zu diesem Unternehmen gehört
-- (Administrator „Test 0001 Person“). Im Testprojekt über Authentication → Users ein
-- Konto anlegen und in public.profiles mit der Person verknüpfen. Die Spalten von
-- companies/employees können sich seit dem Review geändert haben – Fehlermeldungen
-- beim Einfügen zeigen, welche Pflichtspalte fehlt.
