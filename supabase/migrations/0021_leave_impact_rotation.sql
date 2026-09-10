-- =============================================================
-- Phase 13 · Urlaubs-Warnung rotationsfähig + offene Anträge zählen
--
-- Zwei Probleme der bisherigen check_leave_staffing_impact:
--   1. Sie stieg aus, wenn employees.shift_id NULL war – im Rotations-
--      betrieb also IMMER. Die Warnung griff dort nie.
--   2. Sie zählte nur genehmigten Urlaub, nicht bereits gestellte, noch
--      offene Anträge. Genau die will der Mitarbeiter aber sehen: "es
--      haben schon so viele frei / beantragt, dass es eng wird."
--
-- Neu: pro Tag die TATSÄCHLICHE Schicht (effective_shift_id), und in der
-- Anwesenheit werden offene Anträge mitgezählt (p_include_pending=true),
-- der eigene, gerade in Prüfung befindliche Antrag ausgenommen.
-- =============================================================

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
  day_shift uuid;
  planned int;
  absent int;
  adjusted_present int;
  already_counted boolean;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  d := p_start_date;
  while d <= p_end_date loop
    -- Die an diesem Tag TATSÄCHLICH geltende Schicht (Rotation/Ausnahme/fest)
    day_shift := effective_shift_id(p_employee_id, d);

    if day_shift is not null then
      select * into s from shifts where id = day_shift;
      if s.id is not null and s.target_staff > 0 and shift_runs_on(s, d) then

        -- Wie viele sind an diesem Tag dieser Schicht zugeordnet?
        select count(*) into planned from employees emp
        where emp.active and emp.company_id = e.company_id
          and effective_shift_id(emp.id, d) = day_shift;

        -- Wie viele davon fehlen – INKLUSIVE offener Anträge?
        select count(*) into absent from employees emp
        where emp.active and emp.company_id = e.company_id
          and effective_shift_id(emp.id, d) = day_shift
          and emp.id in (select employee_id from employees_absent_on(d, true));

        -- Ist die anfragende Person an dem Tag schon als abwesend gezählt?
        select exists(
          select 1 from employees_absent_on(d, true) a where a.employee_id = p_employee_id
        ) into already_counted;

        -- Anwesend = zugeordnet minus abwesend; falls die Person noch NICHT
        -- als abwesend zählt, ziehen wir sie für die Vorschau zusätzlich ab.
        adjusted_present := planned - absent - case when already_counted then 0 else 1 end;

        return query select
          d, adjusted_present, s.target_staff, s.minimum_staff,
          case
            when adjusted_present < s.minimum_staff then 'critical'::staffing_status
            when adjusted_present < s.target_staff then 'warn'::staffing_status
            else 'ok'::staffing_status
          end;
      end if;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- shift_leave_overlap nutzt check_leave_staffing_impact und die feste Schicht.
-- Auch hier: Kollegenzählung auf gleiche Schichtgruppe ODER gleiches Muster
-- erweitern, damit sie im Rotationsbetrieb stimmt.
create or replace function shift_leave_overlap(
  p_employee_id uuid, p_start_date date, p_end_date date
)
returns table (overlapping_employees int, critical_days int, worst_status staffing_status)
language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null then return; end if;
  if e.company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_employee_id <> auth_employee_id() and not is_leadership() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;

  return query
  with impact as (
    select * from check_leave_staffing_impact(p_employee_id, p_start_date, p_end_date)
  ),
  colleagues as (
    select count(distinct r.employee_id)::int as n
    from leave_requests r
    join employees c on c.id = r.employee_id
    where r.employee_id <> p_employee_id
      and r.status in ('approved', 'pending')
      and r.start_date <= p_end_date
      and r.end_date >= p_start_date
      and (
        (e.rotation_team is not null and c.rotation_team = e.rotation_team)
        or (e.shift_id is not null and c.shift_id = e.shift_id)
      )
  )
  select (select n from colleagues),
    (select count(*)::int from impact where status = 'critical'),
    coalesce((select status from impact order by
      case status when 'critical' then 0 when 'warn' then 1 else 2 end limit 1),
      'ok'::staffing_status);
end;
$$;

revoke execute on function check_leave_staffing_impact(uuid, date, date) from public, anon;
grant execute on function check_leave_staffing_impact(uuid, date, date) to authenticated;
revoke execute on function shift_leave_overlap(uuid, date, date) from public, anon;
grant execute on function shift_leave_overlap(uuid, date, date) to authenticated;
