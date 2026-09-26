-- Genommene AF-Tage im Kalenderjahr – nur zur Anzeige.
--
-- Das AF-Stundenkonto zählt „genommen" erst ab dem Tag, zu dem der Stand
-- eingetragen wurde; alles davor steckt schon im Stand aus der Abrechnung.
-- Angezeigt werden soll aber, wie viele AF-Tage im Jahr schon genommen
-- sind. Gezählt werden vergangene Tage (vor heute) aus
--   - Abwesenheiten mit Grund Altersfreizeit (auch aus dem Plan importierte)
--   - genehmigten AF-Anträgen (nur geplante Arbeitstage)
-- Ein Tag zählt einmal, auch wenn er in beiden steht. Am Stand und an der
-- Prüfung von Anträgen ändert sich nichts.

create or replace function public.af_genommen_jahr(p_year integer)
returns table (employee_id uuid, tage integer)
language sql
stable
security definer
set search_path = public
as $$
  with personen as (
    select e.id
      from employees e
     where e.company_id = auth_company_id()
       and (is_leadership() or e.id = auth_employee_id())
  ), tage as (
    select a.employee_id, a.date as tag
      from absences a
      join personen p on p.id = a.employee_id
     where a.type::text = 'altersfreizeit'
       and extract(year from a.date) = p_year
       and a.date < current_date
    union
    select r.employee_id, gs.day::date
      from leave_requests r
      join personen p on p.id = r.employee_id
      cross join lateral generate_series(r.start_date, r.end_date, interval '1 day') gs(day)
     where r.kind = 'altersfreizeit'
       and r.status = 'approved'
       and extract(year from gs.day) = p_year
       and gs.day::date < current_date
       and is_planned_workday(r.employee_id, gs.day::date)
  )
  select p.id, count(t.tag)::integer
    from personen p
    left join tage t on t.employee_id = p.id
   group by p.id;
$$;

revoke all on function public.af_genommen_jahr(integer) from public, anon;
grant execute on function public.af_genommen_jahr(integer) to authenticated;
