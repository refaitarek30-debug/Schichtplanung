-- Schulferien als eigene Tabelle.
--
-- Nicht in `holidays`: dort gilt `unique (company_id, date)`, ein Eintrag
-- je Tag. Der Ostermontag läge also im Streit mit den Osterferien. Ferien
-- sind außerdem Zeiträume, keine einzelnen Tage, und sie sind kein Grund,
-- nicht zu arbeiten -- sie werden nur angezeigt.
--
-- Die Zeiträume stehen als Vorlage mit company_id = null bereit und
-- gelten damit für jedes Unternehmen der passenden Region. Ein Betrieb
-- kann eigene Einträge ergänzen; das Feld `region` hält den Weg für
-- weitere Bundesländer offen.

create table if not exists school_holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies (id) on delete cascade,
  region text not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (company_id, region, name, start_date)
);

comment on table school_holidays is
  'Schulferien je Bundesland. company_id null = Vorlage für alle. '
  'Rein darstellend -- die Besetzungs- und Urlaubsberechnung fasst sie nicht an.';

create index if not exists school_holidays_zeitraum_idx
  on school_holidays (region, start_date, end_date);

alter table school_holidays enable row level security;

drop policy if exists "Ferien lesen" on school_holidays;
create policy "Ferien lesen" on school_holidays
  for select using (company_id is null or company_id = auth_company_id());

drop policy if exists "Ferien pflegt Admin" on school_holidays;
create policy "Ferien pflegt Admin" on school_holidays
  for all using (company_id = auth_company_id() and is_admin())
  with check (company_id = auth_company_id() and is_admin());

-- Zeiträume 2026 für Nordrhein-Westfalen, übernommen aus der
-- Excel-Referenz 2026-Schichtplan-PP-Sep.xlsm (Zeilen 77-82). Bewusst
-- nicht aus dem Gedächtnis ergänzt: was dort nicht steht, steht auch
-- hier nicht.
insert into school_holidays (company_id, region, name, start_date, end_date)
values
  (null, 'NW', 'Weihnachtsferien', date '2026-01-01', date '2026-01-06'),
  (null, 'NW', 'Osterferien',      date '2026-03-30', date '2026-04-11'),
  (null, 'NW', 'Pfingstferien',    date '2026-05-26', date '2026-05-26'),
  (null, 'NW', 'Sommerferien',     date '2026-07-20', date '2026-09-01'),
  (null, 'NW', 'Herbstferien',     date '2026-10-17', date '2026-10-31'),
  (null, 'NW', 'Weihnachtsferien', date '2026-12-23', date '2026-12-31')
on conflict (company_id, region, name, start_date) do nothing;

-- Ferienzeiträume, die einen Zeitraum berühren -- für die Anzeige im
-- Schichtplan. Liefert die Vorlagen der eigenen Region plus eigene
-- Einträge des Unternehmens.
create or replace function school_holidays_for_range(p_from date, p_to date)
returns table (name text, start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select f.name, f.start_date, f.end_date
    from school_holidays f
    join company_settings cs on cs.company_id = auth_company_id()
   where (f.company_id is null and f.region = cs.state
          or f.company_id = auth_company_id())
     and f.start_date <= p_to
     and f.end_date   >= p_from
   order by f.start_date;
$$;

revoke execute on function school_holidays_for_range(date, date) from public, anon;
grant execute on function school_holidays_for_range(date, date) to authenticated;
