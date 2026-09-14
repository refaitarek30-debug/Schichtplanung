-- =============================================================
-- Phase 15 · Wer sieht wen im Schichtplan
--
-- Bisher lieferte shift_plan_grid() jedem die komplette Belegschaft.
-- Mitarbeiter sollen aber nur ihre eigene Schichtgruppe sehen – wer wann
-- in einer anderen Gruppe arbeitet, geht sie nichts an. Schichtleitung und
-- Administration sehen weiterhin alle Gruppen, sie planen ja über die
-- Gruppen hinweg.
--
-- Die Einschränkung steht bewusst hier und nicht nur in der Anzeige: die
-- Funktion läuft mit SECURITY DEFINER, also ist sie die Stelle, an der
-- entschieden wird, welche Zeilen das Gerät überhaupt erreichen.
--
-- Nebenbei hält diese Fassung endlich die eigenen Kürzel für V-Tage fest
-- (V/v statt U/u), die bislang nur direkt in der Datenbank standen.
-- =============================================================

create or replace function shift_plan_grid(
  p_company_id uuid,
  p_from date,
  p_days int
)
returns table (
  employee_id uuid,
  employee_name text,
  rotation_team text,
  personnel_number text,
  day date,
  shift_name text,
  shift_code text,
  absence_code text,
  is_me boolean
) language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth_employee_id();
  mein_team rotation_team;
  fuehrung boolean := is_leadership();
begin
  if p_company_id is distinct from auth_company_id() then
    raise exception 'Du hast keine Berechtigung für diesen Bereich.';
  end if;
  if p_days < 1 or p_days > 62 then
    raise exception 'Zeitraum zu groß.';
  end if;

  select e.rotation_team into mein_team from employees e where e.id = me;

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
    and shift_runs_on(s, gs.day::date)
  where e.company_id = p_company_id
    and e.active
    and (
      fuehrung
      or e.id = me
      or (mein_team is not null and e.rotation_team = mein_team)
    )
  order by e.rotation_team nulls last, e.last_name, gs.day;
end;
$$;

revoke execute on function shift_plan_grid(uuid, date, int) from public, anon;
grant execute on function shift_plan_grid(uuid, date, int) to authenticated;
