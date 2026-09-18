-- Employee-id based helper RPCs must be tenant-scoped before reading the
-- requested employee. The composite overload is intentionally unchanged.
create or replace function public.is_employed_on(p_employee_id uuid, p_date date)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce((select is_employed_on(e, p_date) from employees e where e.id = p_employee_id and e.company_id = auth_company_id()), false);
$$;

create or replace function public.is_planned_workday(p_employee_id uuid, p_date date)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare e employees;
begin
  select * into e from employees where id = p_employee_id and company_id = auth_company_id();
  if e.id is null then return false; end if;
  if not is_employed_on(e, p_date) then return false; end if;
  if e.shift_worker and (e.shift_id is not null or e.rotation_pattern_id is not null) then
    return effective_shift_id(p_employee_id, p_date) is not null;
  end if;
  return extract(isodow from p_date) < 6 and not exists (
    select 1 from holidays h where h.date = p_date and (h.company_id = e.company_id or h.company_id is null)
  );
end;
$$;

create or replace function public.is_premium_day(p_employee_id uuid, p_date date)
returns boolean
language plpgsql
stable security definer
set search_path = public
as $$
declare e employees; sname text;
begin
  select * into e from employees where id = p_employee_id and company_id = auth_company_id();
  if e.id is null then return false; end if;
  if extract(dow from p_date) = 0 then return true; end if;
  if exists (select 1 from holidays h where h.date = p_date and (h.company_id = e.company_id or h.company_id is null)) then return true; end if;
  select s.name into sname from shifts s where s.id = effective_shift_id(p_employee_id, p_date) and s.company_id = e.company_id;
  return coalesce(sname ilike 'Nacht%', false);
end;
$$;

create or replace function public.calculate_leave_days_for_employee(
  p_employee_id uuid, p_start_date date, p_end_date date, p_half_day_period public.half_day_period
)
returns numeric
language plpgsql
stable security definer
set search_path = public
as $$
declare emp employees; d date; s shifts; day_shift uuid; counted int := 0;
begin
  select * into emp from employees where id = p_employee_id and company_id = auth_company_id();
  if emp.id is null then return 0; end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 366 then raise exception 'Ungültiger Zeitraum.'; end if;
  if not emp.shift_worker or (emp.shift_id is null and emp.rotation_pattern_id is null) then
    select count(*) into counted from generate_series(p_start_date, p_end_date, interval '1 day') as day
    where extract(isodow from day) < 6 and is_employed_on(p_employee_id, day::date)
      and not exists (select 1 from holidays h where h.date = day::date and (h.company_id = emp.company_id or h.company_id is null));
  else
    d := p_start_date;
    while d <= p_end_date loop
      day_shift := effective_shift_id(p_employee_id, d);
      if day_shift is not null then
        select * into s from shifts where id = day_shift and company_id = emp.company_id;
        if s.id is not null and shift_runs_on(s, d) then counted := counted + 1; end if;
      end if;
      d := d + 1;
    end loop;
  end if;
  if p_half_day_period is not null and counted = 1 then return 0.5; end if;
  return counted::numeric(4,1);
end;
$$;

revoke all on function public.is_employed_on(uuid,date), public.is_planned_workday(uuid,date), public.is_premium_day(uuid,date), public.calculate_leave_days_for_employee(uuid,date,date,public.half_day_period) from public, anon;
grant execute on function public.is_employed_on(uuid,date), public.is_planned_workday(uuid,date), public.is_premium_day(uuid,date), public.calculate_leave_days_for_employee(uuid,date,date,public.half_day_period) to authenticated, service_role;
