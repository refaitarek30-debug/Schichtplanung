-- =============================================================
-- Phase 5 · Schichtrotation
--
-- Baut auf 0001–0007 auf. `shift_assignments` (seit 0001 angelegt, bisher
-- ungenutzt) bekommt jetzt Bedeutung: eine Zeile für (employee_id, date)
-- überschreibt für genau diesen Tag die statische Zuordnung
-- `employees.shift_id`. Ohne Zeile gilt weiterhin die alte, feste
-- Zuordnung – das ist der in PROJECT_STATUS.md angekündigte weiche
-- Übergang, kein harter Schnitt.
-- =============================================================

-- ---------------------------------------------------------------
-- 1) Effektive Schicht eines Mitarbeiters an einem Tag
-- ---------------------------------------------------------------

create or replace function effective_shift_id(p_employee_id uuid, p_date date)
returns uuid language sql stable as $$
  select coalesce(
    (select shift_id from shift_assignments
     where employee_id = p_employee_id and date = p_date),
    (select shift_id from employees where id = p_employee_id)
  );
$$;

-- ---------------------------------------------------------------
-- 2) Besetzungsberechnung auf effektive Zuordnung umstellen
--
-- Nur der Filter ändert sich (statt `e.shift_id = s.id` jetzt
-- `effective_shift_id(e.id, p_date) = s.id`) – Signatur, Rückgabeform und
-- Berechtigungsprüfung bleiben exakt wie in 0007_shift_staffing.sql.
-- ---------------------------------------------------------------

create or replace function staffing_snapshot(p_shift_id uuid, p_date date)
returns table (
  shift_id uuid,
  date date,
  target smallint,
  minimum smallint,
  planned int,
  absent int,
  present int,
  status staffing_status
) language plpgsql stable security definer set search_path = public as $$
declare
  s shifts;
  v_planned int;
  v_absent int;
begin
  select * into s from shifts where id = p_shift_id;
  if s.id is null then
    raise exception 'Schicht nicht gefunden.';
  end if;
  if s.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  select count(*) into v_planned from employees e
  where e.active and e.company_id = s.company_id
    and effective_shift_id(e.id, p_date) = s.id;

  select count(*) into v_absent from employees e
  where e.active and e.company_id = s.company_id
    and effective_shift_id(e.id, p_date) = s.id
    and e.id in (select employee_id from employees_absent_on(p_date));

  return query select
    s.id, p_date, s.target_staff, s.minimum_staff,
    v_planned, v_absent, v_planned - v_absent,
    case
      when v_planned - v_absent < s.minimum_staff then 'critical'::staffing_status
      when v_planned - v_absent < s.target_staff then 'warn'::staffing_status
      else 'ok'::staffing_status
    end;
end;
$$;

-- `check_leave_staffing_impact` löst die Schicht jetzt pro Tag effektiv auf,
-- statt einmalig die feste Zuordnung des Mitarbeiters anzunehmen – wichtig,
-- falls jemand für einzelne Tage einer anderen Schicht zugeteilt ist.
create or replace function check_leave_staffing_impact(
  p_employee_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  date date,
  present int,
  target smallint,
  minimum smallint,
  status staffing_status
) language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
  s shifts;
  d date;
  day_shift_id uuid;
  base record;
  already_absent boolean;
  adjusted_present int;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then
    return;
  end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    day_shift_id := effective_shift_id(p_employee_id, d);
    if day_shift_id is not null then
      select * into s from shifts where id = day_shift_id;
      if s.id is not null and s.target_staff > 0 and shift_runs_on(s, d) then
        select * into base from staffing_snapshot(s.id, d);
        select exists(
          select 1 from employees_absent_on(d) a where a.employee_id = p_employee_id
        ) into already_absent;
        adjusted_present := base.present - case when already_absent then 0 else 1 end;

        return query select
          d, adjusted_present, base.target, base.minimum,
          case
            when adjusted_present < base.minimum then 'critical'::staffing_status
            when adjusted_present < base.target then 'warn'::staffing_status
            else 'ok'::staffing_status
          end;
      end if;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- 3) Zuordnung setzen / entfernen
--
-- Direkte INSERT/UPDATE/DELETE-Zugriffe auf `shift_assignments` sind
-- bereits per RLS auf Führung beschränkt (0002_rls.sql, Policy
-- "Schichtzuordnung pflegt Führung"). Diese Funktion ist nur eine bequeme,
-- atomare Upsert-Hülle (ein Mitarbeiter hat pro Tag höchstens eine
-- Zuordnung – `unique (employee_id, date)` erzwingt das schon).
-- ---------------------------------------------------------------

create or replace function assign_shift(
  p_employee_id uuid,
  p_shift_id uuid,
  p_date date
)
returns shift_assignments language plpgsql security invoker as $$
declare
  result shift_assignments;
  emp employees;
  target_shift shifts;
begin
  select * into emp from employees where id = p_employee_id;
  select * into target_shift from shifts where id = p_shift_id;

  if emp.id is null or target_shift.id is null then
    raise exception 'Mitarbeiter oder Schicht nicht gefunden.';
  end if;
  if emp.company_id is distinct from target_shift.company_id then
    raise exception 'Mitarbeiter und Schicht gehören zu unterschiedlichen Unternehmen.';
  end if;

  insert into shift_assignments (company_id, employee_id, shift_id, date)
  values (emp.company_id, p_employee_id, p_shift_id, p_date)
  on conflict (employee_id, date)
  do update set shift_id = excluded.shift_id
  returning * into result;

  return result;
end;
$$;

revoke execute on function assign_shift(uuid, uuid, date) from public;
grant execute on function assign_shift(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------
-- 4) Übersicht für die Rotationsplanung
--
-- Zuordnungen eines Zeitraums, mit aufgelöstem Namen – für die
-- Wochenansicht in der Admin-Oberfläche. Nur Führung (dieselbe Begründung
-- wie bei staffing_for_day: Zuordnung anderer Personen ist kein Datum, das
-- ein einzelner Mitarbeiter über sich selbst hinaus sehen soll).
-- ---------------------------------------------------------------

create or replace function shift_assignments_for_range(
  p_company_id uuid,
  p_from date,
  p_to date
)
returns table (
  id uuid,
  employee_id uuid,
  employee_name text,
  default_shift_id uuid,
  shift_id uuid,
  shift_name text,
  date date
) language plpgsql stable security definer set search_path = public as $$
begin
  if p_company_id is distinct from auth_company_id() or not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  select
    sa.id, e.id, e.first_name || ' ' || e.last_name,
    e.shift_id, sa.shift_id, s.name, sa.date
  from shift_assignments sa
  join employees e on e.id = sa.employee_id
  join shifts s on s.id = sa.shift_id
  where sa.company_id = p_company_id
    and sa.date between p_from and p_to
  order by sa.date, e.last_name;
end;
$$;

revoke execute on function shift_assignments_for_range(uuid, date, date) from public;
grant execute on function shift_assignments_for_range(uuid, date, date) to authenticated;

comment on table shift_assignments is
  'Tagesgenaue Ausnahme von der festen Schichtzuordnung (employees.shift_id). '
  'Eine Zeile für (employee_id, date) gilt nur für diesen einen Tag – siehe '
  'effective_shift_id(). Ohne Zeile bleibt die feste Zuordnung maßgeblich.';
