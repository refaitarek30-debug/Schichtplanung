-- =============================================================
-- Phase 11c · Jahreswechsel: neuer Anspruch + Übertrag
--
-- Zum 1.1. bekommt jeder wieder den vollen Jahresanspruch. Was im alten
-- Jahr übrig war, wird übertragen – für Urlaub UND für V-Tage – und
-- verfällt, wenn es bis zum 31.03. nicht genommen wurde.
--
-- Der Übertrag wird beim ersten Zugriff im neuen Jahr angelegt
-- (ensure_leave_balance), es braucht also keinen Hintergrundjob.
-- =============================================================

alter table leave_balances
  add column if not exists v_carried_over numeric(4, 1) not null default 0;

drop view if exists leave_balances_view;

create view leave_balances_view with (security_invoker = true) as
with leave_days as (
  select distinct
    r.employee_id,
    gs.day::date as day,
    r.status,
    r.kind,
    extract(year from gs.day)::int as jahr
  from leave_requests r
  cross join lateral generate_series(
    r.start_date::timestamptz, r.end_date::timestamptz, '1 day'::interval
  ) gs(day)
  where r.status in ('approved', 'pending')
    and effective_shift_id(r.employee_id, gs.day::date) is not null
),
counted as (
  select
    employee_id,
    jahr,
    count(*) filter (where kind = 'urlaub' and status = 'approved' and day <  current_date) as used_days,
    count(*) filter (where kind = 'urlaub' and status = 'approved' and day >= current_date) as planned_days,
    count(*) filter (where kind = 'urlaub' and status = 'pending')                          as pending_days,
    count(*) filter (where kind = 'urlaub' and status = 'approved'
                       and day <= make_date(jahr, 3, 31))                                  as used_until_march,
    count(*) filter (where kind = 'v_tag'  and status = 'approved')                         as v_used,
    count(*) filter (where kind = 'v_tag'  and status = 'pending')                          as v_pending,
    count(*) filter (where kind = 'v_tag'  and status = 'approved'
                       and day <= make_date(jahr, 3, 31))                                  as v_used_until_march
  from leave_days
  group by employee_id, jahr
)
select
  b.id,
  b.company_id,
  b.employee_id,
  b.year,
  b.entitlement,
  -- Nach dem 31.03. bleibt vom Übertrag nur, was bis dahin genommen wurde.
  case when current_date <= make_date(b.year::int, 3, 31)
       then b.carried_over
       else least(b.carried_over, coalesce(c.used_until_march, 0)::numeric)
  end as carried_over,
  coalesce(c.used_days, 0)::numeric    as used_days,
  coalesce(c.planned_days, 0)::numeric as planned_days,
  coalesce(c.pending_days, 0)::numeric as pending_days,
  b.entitlement
    + case when current_date <= make_date(b.year::int, 3, 31)
           then b.carried_over
           else least(b.carried_over, coalesce(c.used_until_march, 0)::numeric) end
    - coalesce(c.used_days, 0)::numeric
    - coalesce(c.planned_days, 0)::numeric
    - coalesce(c.pending_days, 0)::numeric as remaining_days,
  b.v_entitlement,
  case when current_date <= make_date(b.year::int, 3, 31)
       then b.v_carried_over
       else least(b.v_carried_over, coalesce(c.v_used_until_march, 0)::numeric)
  end as v_carried_over,
  coalesce(c.v_used, 0)::numeric    as v_used_days,
  coalesce(c.v_pending, 0)::numeric as v_pending_days,
  b.v_entitlement
    + case when current_date <= make_date(b.year::int, 3, 31)
           then b.v_carried_over
           else least(b.v_carried_over, coalesce(c.v_used_until_march, 0)::numeric) end
    - coalesce(c.v_used, 0)::numeric
    - coalesce(c.v_pending, 0)::numeric as v_remaining_days,
  b.created_at,
  b.updated_at
from leave_balances b
left join counted c on c.employee_id = b.employee_id and c.jahr = b.year;

revoke all on leave_balances_view from public, anon;
grant select on leave_balances_view to authenticated;

-- Legt das Konto eines Jahres an, falls es noch fehlt, und überträgt den
-- Rest des Vorjahres. Idempotent: mehrfach aufrufbar, ändert nichts mehr,
-- sobald die Zeile existiert.
create or replace function ensure_leave_balance(p_employee_id uuid, p_year int)
returns void language plpgsql security definer set search_path = public as $$
declare
  e employees;
  prev_u numeric(4, 1) := 0;
  prev_v numeric(4, 1) := 0;
begin
  select * into e from employees where id = p_employee_id;
  if e.id is null or e.company_id is distinct from auth_company_id() then
    raise exception 'Mitarbeiter nicht gefunden.';
  end if;
  if not is_leadership() and p_employee_id is distinct from auth_employee_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_year < 2020 or p_year > 2100 then
    raise exception 'Ungültiges Jahr.';
  end if;

  if exists (select 1 from leave_balances where employee_id = p_employee_id and year = p_year) then
    return;
  end if;

  select greatest(remaining_days, 0), greatest(v_remaining_days, 0)
    into prev_u, prev_v
    from leave_balances_view
   where employee_id = p_employee_id and year = p_year - 1;

  insert into leave_balances (
    company_id, employee_id, year, entitlement, carried_over, v_entitlement, v_carried_over
  )
  values (
    e.company_id, p_employee_id, p_year::smallint,
    e.vacation_days, coalesce(prev_u, 0), e.v_days, coalesce(prev_v, 0)
  )
  on conflict (employee_id, year) do nothing;
end;
$$;

revoke execute on function ensure_leave_balance(uuid, int) from public, anon;
grant execute on function ensure_leave_balance(uuid, int) to authenticated;

-- Dasselbe für die ganze Belegschaft, z. B. einmal Anfang Januar.
create or replace function ensure_leave_balances_for_year(p_year int)
returns int language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  n int := 0;
begin
  if not is_leadership() then
    raise exception 'Nur Schichtleitung oder Administration dürfen das.';
  end if;
  for target in
    select id from employees where company_id = auth_company_id() and active
  loop
    perform ensure_leave_balance(target, p_year);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function ensure_leave_balances_for_year(int) from public, anon;
grant execute on function ensure_leave_balances_for_year(int) to authenticated;
