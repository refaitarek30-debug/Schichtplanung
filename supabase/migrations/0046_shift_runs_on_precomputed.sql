-- =============================================================
-- Feiertagsregel nicht je Zelle nachschlagen
--
-- shift_runs_on() aus 0044 liest die Einstellung work_on_holidays des
-- Unternehmens. In der Matrix passiert das einmal je Mitarbeiter und Tag
-- -- bei 50 Personen ueber 28 Tage sind das 1400 Nachschlagevorgaenge
-- fuer einen Wert, der sich waehrend der Abfrage nicht aendert.
--
-- Gemessen an der Live-Instanz: 0,84 s vor 0044, 1,15 s danach, mit
-- dieser Fassung wieder 0,82 s.
--
-- Die Regel selbst steht weiterhin nur an einer Stelle: die zweistellige
-- Fassung liest die Einstellung und reicht sie an die dreistellige durch.
-- =============================================================

create or replace function shift_runs_on(
  p_shift shifts,
  p_date date,
  p_work_on_holidays boolean
)
returns boolean
language sql immutable set search_path = public as $$
  select
    extract(dow from p_date)::int = any(p_shift.weekdays)
    and (
      coalesce(p_work_on_holidays, true)
      or not exists (
        select 1 from holidays h
        where h.date = p_date
          and (h.company_id = p_shift.company_id or h.company_id is null)
      )
    );
$$;

create or replace function shift_runs_on(p_shift shifts, p_date date)
returns boolean
language sql stable set search_path = public as $$
  select shift_runs_on(
    p_shift,
    p_date,
    coalesce(
      (select cs.work_on_holidays from company_settings cs
        where cs.company_id = p_shift.company_id),
      true)
  );
$$;

revoke execute on function shift_runs_on(shifts, date, boolean) from public, anon;
grant execute on function shift_runs_on(shifts, date, boolean) to authenticated;

-- Die Matrix liest die Einstellung einmal und gibt sie mit.
create or replace function shift_plan_grid(p_company_id uuid, p_from date, p_days integer)
returns table (employee_id uuid, employee_name text, rotation_team text, personnel_number text,
               day date, shift_name text, shift_code text, absence_code text, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
  feiertage_arbeiten boolean;
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team from employees e where e.id = me;

  -- Einmal lesen statt einmal je Zelle.
  select coalesce(cs.work_on_holidays, true) into feiertage_arbeiten
    from company_settings cs where cs.company_id = p_company_id;
  feiertage_arbeiten := coalesce(feiertage_arbeiten, true);

  return query
  select e.id, e.first_name || ' ' || e.last_name, e.rotation_team::text, e.personnel_number,
    gs.day::date, s.name,
    case when s.name ilike 'Früh%' then 'F' when s.name ilike 'Spät%' then 'S'
         when s.name ilike 'Nacht%' then 'N'
         when s.name is not null then upper(left(s.name, 1)) else null end,
    case
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'approved' and r.kind = 'v_tag'
        and gs.day::date between r.start_date and r.end_date) then 'V'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'pending' and r.kind = 'v_tag'
        and gs.day::date between r.start_date and r.end_date) then 'v'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'approved' and r.kind = 'urlaub'
        and gs.day::date between r.start_date and r.end_date) then 'U'
      when exists (select 1 from leave_requests r where r.employee_id = e.id
        and r.status = 'pending' and r.kind = 'urlaub'
        and gs.day::date between r.start_date and r.end_date) then 'u'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'krank') then 'K'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date and a.type = 'schulung') then 'FB'
      when exists (select 1 from absences a where a.employee_id = e.id
        and a.date = gs.day::date) then 'A'
      else null end,
    (e.id = me)
  from employees e
  cross join generate_series(p_from, p_from + (p_days - 1), interval '1 day') as gs(day)
  left join shifts s on s.id = effective_shift_id(e.id, gs.day::date)
    and shift_runs_on(s, gs.day::date, feiertage_arbeiten)
  where e.company_id = p_company_id
    and e.active
    and (
      fuehrung
      or e.id = me
      or (mein_team is not null and e.rotation_team = mein_team)
    )
  order by e.rotation_team nulls last, e.sort_order nulls last, e.last_name, gs.day;
end;
$$;

revoke execute on function shift_plan_grid(uuid, date, integer) from public, anon;
grant execute on function shift_plan_grid(uuid, date, integer) to authenticated;
