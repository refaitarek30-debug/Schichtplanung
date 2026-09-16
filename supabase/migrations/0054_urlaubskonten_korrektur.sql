-- Zwei Korrekturen an leave_balances_view.
--
-- 1) Tagschichtkräfte verbrauchten keinen Urlaub.
--
--    Die Ansicht zählte einen Tag nur, wenn
--    `effective_shift_id(...) is not null`. Seit 0047 haben
--    Tagschichtkräfte keine Schicht mehr -- der Antrag buchte fünf Tage
--    ab, das Konto blieb bei 30 von 30. Am Datenbestand nachgemessen:
--
--      Antrag 05.-09.10.2026 (Mo-Fr), Tagschichtkraft
--        requested_days laut Antrag = 5.0
--        view.used_days             = 0
--        view.remaining_days        = 30.0  (Anspruch 30.0)
--
--    Ersetzt durch is_planned_workday() -- dieselbe Funktion, mit der
--    auch der Antrag gerechnet wird. Damit können Antrag und Konto nicht
--    mehr auseinanderlaufen. Nebenbei erbt die Ansicht dadurch die
--    Eintritts- und Austrittsgrenze aus 0049.
--
-- 2) V-Tage verfallen nicht.
--
--    Der Übertrag wurde bisher nach dem 31.03. genauso gekappt wie beim
--    Urlaub. Das gilt laut betrieblicher Regel nur für Urlaubstage. Die
--    Kappung bleibt für Urlaub und entfällt für V-Tage; die Spalte
--    v_used_until_march wird dadurch nicht mehr gebraucht.

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
    and is_planned_workday(r.employee_id, gs.day::date)
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
    count(*) filter (where kind = 'v_tag'  and status = 'pending')                          as v_pending
  from leave_days
  group by employee_id, jahr
)
select
  b.id,
  b.company_id,
  b.employee_id,
  b.year,
  b.entitlement,
  -- Urlaub: nach dem 31.03. bleibt vom Übertrag nur, was bis dahin
  -- genommen wurde.
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
  -- V-Tage: kein Verfall, der Übertrag steht das ganze Jahr.
  b.v_carried_over,
  coalesce(c.v_used, 0)::numeric    as v_used_days,
  coalesce(c.v_pending, 0)::numeric as v_pending_days,
  b.v_entitlement
    + b.v_carried_over
    - coalesce(c.v_used, 0)::numeric
    - coalesce(c.v_pending, 0)::numeric as v_remaining_days,
  b.created_at,
  b.updated_at
from leave_balances b
left join counted c on c.employee_id = b.employee_id and c.jahr = b.year;

revoke all on leave_balances_view from public, anon;
grant select on leave_balances_view to authenticated;
