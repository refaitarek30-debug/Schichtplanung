-- =============================================================
-- Phase 8 · Qualifikationen, schichtgerechte Urlaubstage,
--            Urlaubsübersicht der eigenen Schicht
-- =============================================================

-- ---------------------------------------------------------------
-- 1) Urlaubstage nach TATSÄCHLICHEM Schichtplan zählen
--
-- Bisher: Montag–Freitag, Wochenende zählt nie. Das ist für
-- Bürobetrieb richtig, für Schichtbetrieb aber falsch: wer nach dem
-- 4-Schicht-Muster am Samstag und Sonntag eingeteilt ist, muss für
-- diese Tage auch Urlaub nehmen – sonst bekäme er sie geschenkt.
--
-- Neu: gezählt wird jeder Tag, an dem die Person laut effektivem Plan
-- (Tagesausnahme > Rotationsmuster > feste Zuordnung) arbeiten würde.
-- Freitage aus dem Muster und Feiertage zählen nicht. Für Personen
-- ganz ohne Schichtzuordnung bleibt es beim bisherigen Mo–Fr-Verhalten.
-- ---------------------------------------------------------------

create or replace function calculate_leave_days_for_employee(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date,
  p_half_day_period half_day_period
)
returns numeric(4, 1) language plpgsql stable security definer set search_path = public as $$
declare
  emp employees;
  d date;
  s shifts;
  day_shift uuid;
  counted int := 0;
begin
  select * into emp from employees where id = p_employee_id;
  if emp.id is null then
    return 0;
  end if;

  -- Ohne jede Schichtzuordnung: klassisch Mo–Fr ohne Feiertage.
  if emp.shift_id is null and emp.rotation_pattern_id is null then
    select count(*) into counted
    from generate_series(p_start_date, p_end_date, interval '1 day') as day
    where extract(isodow from day) < 6
      and not exists (
        select 1 from holidays h
        where h.date = day::date
          and (h.company_id = emp.company_id or h.company_id is null)
      );
  else
    d := p_start_date;
    while d <= p_end_date loop
      day_shift := effective_shift_id(p_employee_id, d);
      if day_shift is not null then
        select * into s from shifts where id = day_shift;
        -- shift_runs_on() prüft Wochentage der Schicht UND Feiertage.
        if s.id is not null and shift_runs_on(s, d) then
          counted := counted + 1;
        end if;
      end if;
      d := d + 1;
    end loop;
  end if;

  if p_half_day_period is not null and counted = 1 then
    return 0.5;
  end if;

  return counted::numeric(4, 1);
end;
$$;

-- Trigger auf die neue, mitarbeiterbezogene Berechnung umstellen.
create or replace function leave_requests_set_computed_days()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.end_date < new.start_date then
    raise exception 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  end if;

  new.requested_days := calculate_leave_days_for_employee(
    new.employee_id, new.start_date, new.end_date, new.half_day_period
  );
  new.half_day := new.half_day_period is not null;

  if new.requested_days <= 0 then
    raise exception 'In diesem Zeitraum hast du keinen eingeplanten Arbeitstag.';
  end if;

  return new;
end;
$$;

revoke execute on function calculate_leave_days_for_employee(uuid, date, date, half_day_period)
  from public, anon;
grant execute on function calculate_leave_days_for_employee(uuid, date, date, half_day_period)
  to authenticated;

-- ---------------------------------------------------------------
-- 2) Qualifikationen je Mitarbeiter (mehrfach auswählbar)
-- ---------------------------------------------------------------

do $$ begin
  create type qualification as enum (
    'labor', 'lager', 'messwarte', 'labor_b_schein', 'anlagenfahrer'
  );
exception when duplicate_object then null; end $$;

alter table employees
  add column if not exists qualifications qualification[] not null default '{}';

comment on column employees.qualifications is
  'Mehrfachauswahl: welche Tätigkeiten die Person ausüben darf. '
  'Grundlage für spätere Prüfungen wie "mindestens ein Anlagenfahrer je Schicht".';

create index if not exists employees_qualifications_idx
  on employees using gin (qualifications);

-- ---------------------------------------------------------------
-- 3) Wer aus MEINER Schicht hat wann Urlaub?
--
-- Mitarbeitende dürfen die Namen ihrer direkten Schichtkolleginnen und
-- -kollegen samt Urlaubszeitraum sehen – das ist genau die Information,
-- die man zum eigenen Planen braucht. Bewusst NICHT enthalten: der Grund
-- einer krankheitsbedingten Abwesenheit (bleibt der Führung vorbehalten)
-- und alles außerhalb der eigenen Schicht.
-- ---------------------------------------------------------------

create or replace function my_shift_leave(p_from date, p_to date)
returns table (
  employee_id uuid,
  employee_name text,
  start_date date,
  end_date date,
  status leave_status,
  is_me boolean
) language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
  my_shift uuid;
  my_pattern uuid;
begin
  if me is null then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Zeitraum ungültig.';
  end if;

  select e.shift_id, e.rotation_pattern_id into my_shift, my_pattern
  from employees e where e.id = me;

  return query
  select
    r.employee_id,
    e.first_name || ' ' || e.last_name,
    r.start_date,
    r.end_date,
    r.status,
    (r.employee_id = me)
  from leave_requests r
  join employees e on e.id = r.employee_id
  where e.company_id = auth_company_id()
    and e.active
    and r.status in ('approved', 'pending')
    and r.start_date <= p_to
    and r.end_date >= p_from
    -- eigene Schicht: gleiche feste Zuordnung ODER gleiches Rotationsmuster
    and (
      (my_shift is not null and e.shift_id = my_shift)
      or (my_pattern is not null and e.rotation_pattern_id = my_pattern)
      or r.employee_id = me
    )
  order by r.start_date, e.last_name;
end;
$$;

revoke execute on function my_shift_leave(date, date) from public, anon;
grant execute on function my_shift_leave(date, date) to authenticated;
